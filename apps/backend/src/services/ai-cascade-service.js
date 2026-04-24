/**
 * AI Cascade Service
 * Priority: 1. Ollama (Local)
 *          2. Gemini API (Cloud)
 *          3. Local Fallback (Schema-based)
 */

import { callOllamaAI, isOllamaConfigured } from "./ollama-ai-service.js";
import { createLocalFallbackChatResponse, classifyChatQuery, validateAndFixSQL } from "./analytics-service.js";
import { getCachedQuery, cacheQuery } from "./query-cache.js";

function isMeaningfulAiResult(aiResponse, queryType) {
  if (!aiResponse?.success) {
    return false;
  }

  if (queryType !== "analysis") {
    return false;
  }

  return Boolean(aiResponse.intent && aiResponse.insight && aiResponse.sql);
}

export async function performAICascadeAnalysis(dataset, query) {
  console.log("\n[cascade] ====================================");
  console.log(`[cascade] Starting AI cascade for: "${query.substring(0, 30)}..."`);
  console.log("[cascade] Priority: Ollama -> Gemini -> Local");

  const queryType = classifyChatQuery(query);
  const cachedResult = getCachedQuery(dataset.id, query);

  if (cachedResult) {
    console.log("[cascade] CACHE HIT");
    return {
      ...cachedResult,
      fromCache: true,
      cascade: { stage: "cache", timestamp: new Date().toISOString() },
    };
  }

  console.log("[cascade] CACHE MISS - Proceeding");

  if (queryType !== "analysis") {
    console.log(`[cascade] Using local guided response for query type: ${queryType}`);
    const localResult = await tryLocalFallback(dataset, query);
    cacheQuery(dataset.id, query, localResult);
    return {
      ...localResult,
      cascade: { stage: "local", model: "Local Schema", timestamp: new Date().toISOString() },
    };
  }

  const ollamaResult = await tryOllamaAnalysis(dataset, query, queryType);
  if (ollamaResult.success) {
    console.log("[cascade] LEVEL 1: OLLAMA SUCCESS");
    cacheQuery(dataset.id, query, ollamaResult);
    return {
      ...ollamaResult,
      cascade: { stage: "ollama", model: ollamaResult.model || "Ollama", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] OLLAMA FAILED: ${ollamaResult.error}`);
  console.log("[cascade] -> LEVEL 2: GEMINI");

  const geminiResult = await tryGeminiAnalysis(dataset, query);
  if (geminiResult.success) {
    console.log("[cascade] LEVEL 2: GEMINI SUCCESS");
    cacheQuery(dataset.id, query, geminiResult);
    return {
      ...geminiResult,
      cascade: { stage: "gemini", model: "Gemini 1.5 Flash", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] GEMINI FAILED: ${geminiResult.error}`);
  console.log("[cascade] -> LEVEL 3: LOCAL FALLBACK");

  const localResult = await tryLocalFallback(dataset, query);
  console.log("[cascade] LEVEL 3: LOCAL SUCCESS");
  cacheQuery(dataset.id, query, localResult);
  return {
    ...localResult,
    cascade: { stage: "local", model: "Local Schema", timestamp: new Date().toISOString() },
  };
}

async function tryOllamaAnalysis(dataset, query, queryType) {
  try {
    const isAvailable = await isOllamaConfigured();
    if (!isAvailable) {
      return { success: false, error: "Ollama not available" };
    }

    const aiResponse = await callOllamaAI(dataset, query);
    if (!isMeaningfulAiResult(aiResponse, queryType)) {
      return { success: false, error: aiResponse.error || "AI response did not match the user query" };
    }

    const validatedSQL = validateAndFixSQL(dataset, aiResponse.sql);

    return {
      success: true,
      content: aiResponse.insight,
      sql: validatedSQL,
      chart: null,
      insights: [
        `Analysis type: ${aiResponse.intent}`,
        `Confidence: ${((aiResponse.confidence ?? 0) * 100).toFixed(0)}%`,
        aiResponse.reasoning,
      ].filter(Boolean),
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      usedAI: true,
      model: aiResponse.model || "Ollama",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryGeminiAnalysis(dataset, query) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { success: false, error: "GEMINI_API_KEY not configured" };
    }

    const { generateSQLFromSchema } = await import("./schema-ai-service.js");
    const { buildSchemaPacketAsync } = await import("./schema-packet-builder.js");

    const schemaPacket = await buildSchemaPacketAsync(dataset);
    const response = await generateSQLFromSchema(schemaPacket, query, { allowFallback: false });

    if (response.fallback || (!response.sql && response.intent === "unclear")) {
      return { success: false, error: "Gemini could not generate valid query" };
    }

    return {
      success: true,
      content: response.insight,
      sql: response.sql,
      intent: response.intent,
      confidence: response.confidence,
      usedAI: true,
      model: "Gemini 1.5 Flash",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryLocalFallback(dataset, query) {
  try {
    const response = createLocalFallbackChatResponse(dataset, query);
    return {
      success: true,
      content: response.content,
      sql: response.sql,
      chart: response.chart,
      insights: response.insights,
      intent: response.intent,
      confidence: response.confidence || 0.7,
      usedAI: false,
      model: response.model || "Local Schema Analysis",
      reason: response.reason,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getCascadeStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    levels: {
      ollama: { name: "Ollama", available: false },
      gemini: { name: "Google Gemini", available: !!process.env.GEMINI_API_KEY },
      local: { name: "Local Fallback", available: true },
    },
  };

  try {
    status.levels.ollama.available = await isOllamaConfigured();
  } catch {
    status.levels.ollama.available = false;
  }

  return status;
}
