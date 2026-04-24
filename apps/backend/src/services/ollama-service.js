import {
  buildSchemaPacketAsync,
  formatSchemaForPrompt,
  validateColumnsExist,
} from "./schema-packet-builder.js";
import { GEMINI_SYSTEM_PROMPT } from "../config/gemini-config.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const OLLAMA_TIMEOUT_MS = 120000; // 120 seconds timeout for local models processing large datasets

export async function callOllamaAI(dataset, query) {
  try {
    const schemaPacket = await buildSchemaPacketAsync(dataset);
    const schemaText = formatSchemaForPrompt(schemaPacket);

    const userPrompt = `${GEMINI_SYSTEM_PROMPT}\n\nSCHEMA INFORMATION:\n${schemaText}\n\nUSER QUERY:\n"${query}"\n\nAnalyze this query and respond with ONLY valid JSON formatting. No markdown blocks. No explanations.`;

    console.log(`[ollama-ai] Sending request to local Ollama (${OLLAMA_MODEL}) at ${OLLAMA_URL}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: userPrompt,
        stream: false,
        format: "json", // Enforce JSON
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response;

    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[ollama-ai] JSON parse error:", parseError.message);
      throw new Error("Invalid JSON response from Ollama");
    }

    validateColumnsExist(aiResponse.columns_used || [], schemaPacket);

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
      provider: "ollama",
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("[ollama-ai] Request timed out, falling back...");
    } else {
      console.warn(`[ollama-ai] Error: ${error.message}`);
    }
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}
