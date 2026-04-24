/**
 * Ollama AI Service - Replace Gemini with Ollama + Mistral
 * Uses local Mistral model for data analytics
 */

import axios from "axios";
import { buildSchemaPacketAsync, formatSchemaForPrompt } from "./schema-packet-builder.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_MODEL_CANDIDATES = (process.env.OLLAMA_MODEL_CANDIDATES || "llama3.2,mistral,gemma4")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 4096);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 140);
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.1);
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "10m";
const SCHEMA_PACKET_SAMPLE_SIZE = Number(process.env.SCHEMA_PACKET_SAMPLE_SIZE || 100);
const OLLAMA_RETRY_SAMPLE_SIZES = (process.env.OLLAMA_RETRY_SAMPLE_SIZES || "100,40,20")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

function isTimeoutError(error) {
  return error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "");
}

function resolveModelNameFromAvailable(candidate, availableNames) {
  if (availableNames.includes(candidate)) {
    return candidate;
  }

  const taggedMatch = availableNames.find((name) => name === `${candidate}:latest`);
  if (taggedMatch) {
    return taggedMatch;
  }

  const prefixMatch = availableNames.find((name) => name.startsWith(`${candidate}:`));
  return prefixMatch || null;
}

async function resolveOllamaModelNames() {
  const models = await getAvailableModels();
  const availableNames = models.map((model) => model.name);
  const candidates = [OLLAMA_MODEL, ...OLLAMA_MODEL_CANDIDATES];
  const resolved = [];

  for (const candidate of candidates) {
    const resolvedName = resolveModelNameFromAvailable(candidate, availableNames);
    if (resolvedName && !resolved.includes(resolvedName)) {
      resolved.push(resolvedName);
    }
  }

  for (const availableName of availableNames) {
    if (!resolved.includes(availableName)) {
      resolved.push(availableName);
    }
  }

  return resolved.length > 0 ? resolved : [OLLAMA_MODEL];
}

function buildOllamaPrompts(schemaText, query) {
  const systemPrompt = `You are an expert data analyst.

You receive only dataset schema metadata, not raw rows.
Generate a concise SQLite query and a short answer for the user.

CRITICAL RULES:
1. For categorical columns (like education, country, etc.), you MUST use the EXACT values shown in "Top values" from the schema
2. NEVER guess or infer values - only use values explicitly listed in the schema's topValues
3. If user mentions "high school", look for "High School" in education topValues
4. If user mentions "master" or "masters", look for "Masters" in education topValues
5. Use only columns present in the schema
6. Never invent columns
7. Table name: dataset
8. If a column is marked [INVALID], do not use it
9. Return JSON only

JSON shape:
{
  "intent": "aggregation",
  "columns_used": ["column1"],
  "sql": "SELECT ... FROM dataset",
  "insight": "short finding",
  "chart_type": "bar",
  "confidence": 0.95,
  "reasoning": "short reason"
}`;

  const userPrompt = `SCHEMA:
${schemaText}

QUESTION:
${query}

Return JSON only.`;

  return { systemPrompt, userPrompt };
}

async function requestOllama({ model, systemPrompt, userPrompt }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        format: "json",
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: {
          num_ctx: OLLAMA_NUM_CTX,
          num_predict: OLLAMA_NUM_PREDICT,
          temperature: OLLAMA_TEMPERATURE,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`timeout of ${OLLAMA_TIMEOUT_MS}ms exceeded`);
      timeoutError.code = "ECONNABORTED";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if Ollama service is running and configured
 */
export async function isOllamaConfigured() {
  try {
    console.log("[ollama] Checking if Ollama is running at", OLLAMA_BASE_URL);
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 3000,
    });
    console.log("[ollama] ✅ Ollama is available");
    return true;
  } catch (error) {
    console.log("[ollama] ❌ Ollama not available:", error.message);
    return false;
  }
}

/**
 * Check model availability
 */
export async function getAvailableModels() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 3000,
    });
    return response.data.models || [];
  } catch (error) {
    console.error("[ollama] Error fetching models:", error.message);
    return [];
  }
}

/**
 * Call Ollama AI with schema packet
 */
export async function callOllamaAI(dataset, query) {
  try {
    const modelNames = await resolveOllamaModelNames();
    const attemptedSampleSizes = [...new Set([SCHEMA_PACKET_SAMPLE_SIZE, ...OLLAMA_RETRY_SAMPLE_SIZES])];
    let responseText = "";
    let finalSchemaPacket = null;
    let selectedModelName = modelNames[0];

    modelLoop:
    for (const modelName of modelNames) {
      selectedModelName = modelName;
      console.log("[ollama] Trying model:", modelName);

      for (const sampleSize of attemptedSampleSizes) {
        console.log("[ollama] Building schema packet for Ollama...");

        const schemaPacket = await buildSchemaPacketAsync(dataset, { sampleSize });
        const schemaText = formatSchemaForPrompt(schemaPacket);
        const { systemPrompt, userPrompt } = buildOllamaPrompts(schemaText, query);

        console.log("[ollama] Sending request to Ollama...");
        console.log("[ollama] Model:", modelName);
        console.log("[ollama] Schema length:", schemaText.length, "chars");
        console.log("[ollama] Schema sample rows:", schemaPacket.sampledRowCount);
        console.log("[ollama] Timeout:", OLLAMA_TIMEOUT_MS, "ms");

        try {
          const response = await requestOllama({ model: modelName, systemPrompt, userPrompt });
          console.log("[ollama] Response received from Ollama");
          responseText = response.response.trim();
          finalSchemaPacket = schemaPacket;
          break modelLoop;
        } catch (error) {
          if (isTimeoutError(error) && sampleSize !== attemptedSampleSizes.at(-1)) {
            console.warn(`[ollama] Timeout with sample size ${sampleSize}, retrying with smaller schema packet...`);
            continue;
          }

          console.warn(`[ollama] Model ${modelName} failed with sample size ${sampleSize}: ${error.message}`);
          break;
        }
      }
    }

    if (!responseText) {
      throw new Error(`All Ollama models failed: ${modelNames.join(", ")}`);
    }

    console.log("[ollama] Raw response length:", responseText.length);

    let aiResponse;
    try {
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      aiResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[ollama] JSON parse error:", parseError.message);
      console.error("[ollama] Raw response:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON from Ollama: ${responseText.substring(0, 100)}`);
    }

    if (!aiResponse.intent || !aiResponse.sql) {
      throw new Error("Missing required fields: intent or sql");
    }

    if (finalSchemaPacket && Array.isArray(aiResponse.columns_used)) {
      const validColumns = new Set(finalSchemaPacket.columns.map((column) => column.name));
      aiResponse.columns_used = aiResponse.columns_used.filter((column) => validColumns.has(column));
    }

    // Ensure chart_type is set based on intent
    const intentToChartType = {
      'aggregation': 'bar',
      'filter': 'table',
      'comparison': 'bar',
      'distribution': 'histogram',
      'correlation': 'scatter',
      'count': 'pie',
      'trend': 'line',
      'summary': 'table'
    };
    if (!aiResponse.chart_type) {
      aiResponse.chart_type = intentToChartType[aiResponse.intent] || 'table';
    }

    console.log("[ollama] ✅ Ollama analysis successful");
    console.log("[ollama] Intent:", aiResponse.intent);
    console.log("[ollama] Chart type:", aiResponse.chart_type);
    console.log("[ollama] Confidence:", aiResponse.confidence);

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
      model: `${selectedModelName} (Ollama)`,
    };
  } catch (error) {
    console.error("[ollama] Error:", error.message);
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}
