/**
 * AI Cascade Service
 * Priority: 1. Ollama + Mistral (Local)
 *          2. Gemini API (Cloud)
 *          3. Local Fallback (Schema-based)
 */

import { callOllamaAI, isOllamaConfigured } from "./ollama-ai-service.js";
import { createSchemaFirstChatResponse } from "./analytics-service.js";
import { getCachedQuery, cacheQuery } from "./query-cache.js";

export async function performAICascadeAnalysis(dataset, query) {
  console.log("\n[cascade] ====================================");
  console.log(`[cascade] Starting AI cascade for: "${query.substring(0, 30)}..."`);
  console.log("[cascade] Priority: Ollama → Gemini → Local");

  const cachedResult = getCachedQuery(dataset.id, query);
  
  if (cachedResult) {
    console.log("[cascade] ✅ CACHE HIT");
    return {
      ...cachedResult,
      fromCache: true,
      cascade: { stage: "cache", timestamp: new Date().toISOString() },
    };
  }

  console.log("[cascade] ❌ CACHE MISS - Proceeding");

  const ollamaResult = await tryOllamaAnalysis(dataset, query);
  if (ollamaResult.success) {
    console.log("[cascade] ✅ LEVEL 1: OLLAMA SUCCESS");
    cacheQuery(dataset.id, query, ollamaResult);
    return {
      ...ollamaResult,
      cascade: { stage: "ollama", model: "Mistral", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] ❌ OLLAMA FAILED: ${ollamaResult.error}`);
  console.log("[cascade] → LEVEL 2: GEMINI");

  const geminiResult = await tryGeminiAnalysis(dataset, query);
  if (geminiResult.success) {
    console.log("[cascade] ✅ LEVEL 2: GEMINI SUCCESS");
    cacheQuery(dataset.id, query, geminiResult);
    return {
      ...geminiResult,
      cascade: { stage: "gemini", model: "Gemini 1.5 Flash", timestamp: new Date().toISOString() },
    };
  }

  console.log(`[cascade] ❌ GEMINI FAILED: ${geminiResult.error}`);
  console.log("[cascade] → LEVEL 3: LOCAL FALLBACK");

  const localResult = await tryLocalFallback(dataset, query);
  console.log("[cascade] ✅ LEVEL 3: LOCAL SUCCESS");
  cacheQuery(dataset.id, query, localResult);
  return {
    ...localResult,
    cascade: { stage: "local", model: "Local Schema", timestamp: new Date().toISOString() },
  };
}

async function tryOllamaAnalysis(dataset, query) {
  try {
    const isAvailable = await isOllamaConfigured();
    if (!isAvailable) {
      return { success: false, error: "Ollama not available" };
    }

    const aiResponse = await callOllamaAI(dataset, query);
    if (!aiResponse.success) {
      return { success: false, error: aiResponse.error };
    }

    return {
      success: true,
      content: aiResponse.insight,
      sql: aiResponse.sql,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      usedAI: true,
      aiModel: "Mistral (Ollama)",
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
    const { buildSchemaPacket } = await import("./schema-packet-builder.js");
    
    const schemaPacket = buildSchemaPacket(dataset);
    const response = await generateSQLFromSchema(schemaPacket, query);

    if (!response.sql && response.intent === "unclear") {
      return { success: false, error: "Gemini could not generate valid query" };
    }

    return {
      success: true,
      content: response.insight,
      sql: response.sql,
      intent: response.intent,
      confidence: response.confidence,
      usedAI: true,
      aiModel: "Gemini 1.5 Flash",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function tryLocalFallback(dataset, query) {
  try {
    const response = await createSchemaFirstChatResponse(dataset, query);
    return {
      success: true,
      content: response.content,
      sql: response.sql,
      intent: response.intent,
      confidence: response.confidence || 0.7,
      usedAI: false,
      aiModel: "Local Schema Analysis",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getCascadeStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    levels: {
      ollama: { name: "Ollama + Mistral", available: false },
      gemini: { name: "Google Gemini", available: !!process.env.GEMINI_API_KEY },
      local: { name: "Local Fallback", available: true },
    },
  };

  try {
    status.levels.ollama.available = await isOllamaConfigured();
  } catch (e) {
    status.levels.ollama.available = false;
  }

  return status;
}