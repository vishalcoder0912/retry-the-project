/**
 * Ollama AI Service - Using neural-chat:7b
 * Privacy-first: Only schema metadata sent to AI
 */

import { extractSchemaForAI, buildSchemaOnlyPrompt, validateSchemaOnlyContext } from '../utils/schema-extractor.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "neural-chat:7b";
const API_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS) || 60000;

/**
 * Check if Ollama is configured and running
 */
export async function isOllamaConfigured() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    console.log(`[ollama] Ollama is running with models:`, data.models?.map(m => m.name));
    return true;
  } catch (error) {
    console.warn(`[ollama] Ollama not available:`, error.message);
    return false;
  }
}

/**
 * Call Ollama AI with Mistral model using schema-only approach
 */
export async function callOllamaAI(dataset, query) {
  const configured = await isOllamaConfigured();
  if (!configured) {
    throw new Error("Ollama service not available. Please start Ollama with: ollama serve");
  }

  try {
    console.log(`[ollama] Calling ${OLLAMA_MODEL} for query:`, query);

    // Build schema-only context (no raw data)
    const schemaInfo = extractSchemaForAI(dataset, buildDatasetSchema(dataset));
    
    // Create prompt for Mistral with schema-only information
    const systemPrompt = `You are a data analytics expert. Analyze the provided dataset schema and user queries.
    
When analyzing, respond ONLY with valid JSON in this exact format:
{
  "intent": "aggregation|filter|comparison|distribution|correlation|count|trend|unclear",
  "columns_used": ["column_name"],
  "sql": "SELECT ... FROM dataset_rows WHERE ...",
  "insight": "1-2 sentence explanation",
  "chart_type": "bar|line|pie|histogram|scatter|table",
  "confidence": 0.0,
  "reasoning": "explain your analysis"
}

Be concise and accurate. Always validate that columns exist in the schema.
IMPORTANT: You only have access to schema information, not actual data values.`;

    const userPrompt = `
DATASET SCHEMA:
${formatSchemaForPrompt(schemaInfo)}

USER QUERY: "${query}"

Respond with valid JSON only, no additional text.`;

    // Call Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        temperature: 0.2,
        num_predict: 500,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.response;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON in Ollama response");
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Validate response
    const validation = validateAIResponse(aiResponse);
    if (!validation.valid) {
      console.warn("[ollama] Response validation failed:", validation.errors);
      return {
        success: false,
        error: "Invalid response format",
        usedAI: false,
        shouldFallback: true,
      };
    }

    return {
      success: true,
      ...aiResponse,
      usedAI: true,
      model: OLLAMA_MODEL,
    };
  } catch (error) {
    console.error("[ollama] Error calling Ollama:", error.message);
    return {
      success: false,
      error: error.message,
      usedAI: false,
      shouldFallback: true,
    };
  }
}

/**
 * Build dataset schema (no raw data) - using existing shared analytics
 */
function buildDatasetSchema(dataset) {
  // Import the shared analytics function to build schema
  const columns = (dataset.columns || []).map(col => ({
    name: col.name,
    type: col.type || 'string',
    role: col.role || 'dimension',
    sampleValues: col.sample || [],
  }));

  return {
    datasetName: dataset.name,
    rowCount: dataset.rowCount || 0,
    columnCount: columns.length,
    columns,
    primaryDimension: columns.find(col => col.role === 'dimension'),
    primaryMetric: columns.find(col => col.role === 'metric'),
  };
}

/**
 * Format schema for prompt
 */
function formatSchemaForPrompt(schemaInfo) {
  const { dataset, schema, dataSummary } = schemaInfo;
  
  return `
Dataset: ${dataset.name}
Rows: ${dataset.rowCount}
Columns: ${dataset.columnCount}

Data Summary:
- Numeric columns: ${dataSummary.numericColumns}
- Text columns: ${dataSummary.textColumns}
- Date columns: ${dataSummary.dateColumns}

COLUMNS:
${schema.columns
  .map(col => {
    let info = `- ${col.name} (${col.type}, ${col.role})`;
    if (col.sampleValues && col.sampleValues.length > 0) {
      const samples = col.sampleValues.slice(0, 3).join(', ');
      info += ` - Sample values: ${samples}`;
    }
    return info;
  })
  .join("\n")}

Primary Dimension: ${schema.primaryDimension?.name || 'none'}
Primary Metric: ${schema.primaryMetric?.name || 'none'}
`;
}

/**
 * Validate AI response
 */
function validateAIResponse(response) {
  const required = ["intent", "columns_used", "sql", "insight", "chart_type", "confidence"];
  const errors = [];

  for (const field of required) {
    if (!(field in response)) {
      errors.push(`Missing: ${field}`);
    }
  }

  if (typeof response.confidence !== "number" || response.confidence < 0 || response.confidence > 1) {
    errors.push("Invalid confidence");
  }

  if (!Array.isArray(response.columns_used)) {
    errors.push("columns_used must be an array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Enhanced Ollama service class for AI router integration
 */
class OllamaAIService {
  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
    this.model = OLLAMA_MODEL;
    this.timeout = API_TIMEOUT;
  }

  async isAvailable() {
    return await isOllamaConfigured();
  }

  async generateResponse(prompt, context = {}) {
    try {
      // Validate that no actual data is being sent
      const validation = validateSchemaOnlyContext(context);
      if (!validation.isValid) {
        console.warn('Ollama AI service detected potential data leakage:', validation.violations);
      }

      const { dataset, schema } = context;
      
      if (!dataset || !schema) {
        return {
          success: false,
          error: 'Dataset and schema are required',
          provider: 'ollama',
        };
      }

      // Use schema-only approach
      const schemaInfo = extractSchemaForAI(dataset, schema);
      const systemPrompt = buildSchemaOnlyPrompt(prompt, schemaInfo);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: systemPrompt,
          stream: false,
          temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
          num_predict: parseInt(process.env.AI_MAX_TOKENS) || 2048,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response?.trim() || '';

      return {
        success: true,
        content,
        provider: 'ollama',
        model: this.model,
      };
    } catch (error) {
      console.error('Ollama AI Error:', error.message);
      return {
        success: false,
        error: error.message,
        provider: 'ollama',
      };
    }
  }

  async testConnection() {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          success: false,
          error: 'Ollama service not available',
        };
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: 'Hello, can you respond with "Connection successful"?',
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json();

      return {
        success: true,
        model: this.model,
        response: data.response?.trim() || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const ollamaAIService = new OllamaAIService();
export { buildDatasetSchema, formatSchemaForPrompt, validateAIResponse };
