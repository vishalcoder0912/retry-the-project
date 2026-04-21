/**
 * Ollama AI Service - Replace Gemini with Ollama + Mistral
 * Uses local Mistral model for data analytics
 */

import axios from "axios";
import { buildSchemaPacket, formatSchemaForPrompt } from "./schema-packet-builder.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const OLLAMA_TIMEOUT_MS = 60000;

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
    console.log("[ollama] Building schema packet for Ollama...");
    
    const schemaPacket = buildSchemaPacket(dataset);
    const schemaText = formatSchemaForPrompt(schemaPacket);

    const systemPrompt = `You are an expert data analyst. You receive ONLY dataset schema (column names, types, and statistics - NO raw data values).

Your job:
1. Understand the user's question
2. Determine what analysis is needed
3. Generate SQL that correctly queries the data
4. Suggest the best visualization
5. Provide clear insights about the findings

CRITICAL RULES:
- ONLY use columns that exist in the provided schema
- NEVER make up columns or assume data exists
- Generate SQL that works with SQLite
- If a column is marked [INVALID], do not use it
- If confidence is low, say so

INTENT TYPES: aggregation, filter, comparison, distribution, correlation, count, trend, summary
CHART TYPES: bar, line, pie, histogram, scatter, table

ALWAYS respond with ONLY valid JSON (no markdown, no extra text):
{
  "intent": "aggregation",
  "columns_used": ["column1", "column2"],
  "sql": "SELECT ... FROM dataset_rows",
  "insight": "2-3 sentence finding",
  "chart_type": "bar",
  "confidence": 0.95,
  "reasoning": "Why you chose this"
}`;

    const userPrompt = `SCHEMA INFORMATION:
${schemaText}

USER QUERY:
"${query}"

Analyze this query and respond with ONLY JSON (no markdown code blocks).`;

    console.log("[ollama] Sending request to Ollama...");
    console.log("[ollama] Model:", OLLAMA_MODEL);
    console.log("[ollama] Schema length:", schemaText.length, "chars");

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        format: "json",
      },
      {
        timeout: OLLAMA_TIMEOUT_MS,
      }
    );

    console.log("[ollama] Response received from Ollama");
    
    const responseText = response.data.response.trim();
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

    console.log("[ollama] ✅ Ollama analysis successful");
    console.log("[ollama] Intent:", aiResponse.intent);
    console.log("[ollama] Confidence:", aiResponse.confidence);

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
      model: "Mistral (Ollama)",
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

export { getAvailableModels };