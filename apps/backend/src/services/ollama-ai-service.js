/**
 * Ollama AI Service - Replace Gemini with Ollama + Mistral
 * Uses local Mistral model for data analytics
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral";
const API_TIMEOUT = 60000; // 60 seconds

/**
 * Check if Ollama is configured and running
 */
export async function isOllamaConfigured() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    const data = await response.json();
    console.log(`[ollama] ✅ Ollama is running with models:`, data.models?.map(m => m.name));
    return true;
  } catch (error) {
    console.warn(`[ollama] ❌ Ollama not available:`, error.message);
    return false;
  }
}

/**
 * Call Ollama AI with Mistral model
 */
export async function callOllamaAI(dataset, query) {
  const configured = await isOllamaConfigured();
  if (!configured) {
    throw new Error("Ollama service not available. Please start Ollama with: ollama serve");
  }

  try {
    console.log(`[ollama] Calling ${OLLAMA_MODEL} for query:`, query);

    // Build schema packet (no raw data)
    const schemaInfo = buildDatasetSchema(dataset);
    
    // Create prompt for Mistral
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

Be concise and accurate. Always validate that columns exist in the schema.`;

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
      timeout: API_TIMEOUT,
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
 * Build dataset schema (no raw data)
 */
function buildDatasetSchema(dataset) {
  const columns = (dataset.columns || []).map(col => {
    const values = (dataset.rows || [])
      .map(r => r[col.name])
      .filter(v => v !== null && v !== undefined && v !== "");

    const schema = {
      name: col.name,
      type: col.type || detectType(values),
      count: values.length,
      nullCount: (dataset.rows?.length || 0) - values.length,
      uniqueCount: new Set(values).size,
    };

    // Add statistics for numeric columns
    if (schema.type === "number") {
      const numbers = values.map(Number).filter(n => !isNaN(n));
      if (numbers.length > 0) {
        schema.min = Math.min(...numbers);
        schema.max = Math.max(...numbers);
        schema.mean = (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2);
        schema.median = getMedian(numbers);
      }
    } else {
      // Top values for categorical
      const freq = {};
      values.forEach(v => (freq[v] = (freq[v] || 0) + 1));
      schema.topValues = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
    }

    return schema;
  });

  return {
    datasetName: dataset.name,
    rowCount: dataset.rows?.length || 0,
    columnCount: columns.length,
    columns,
  };
}

/**
 * Format schema for prompt
 */
function formatSchemaForPrompt(schema) {
  return `
Dataset: ${schema.datasetName}
Rows: ${schema.rowCount}
Columns: ${schema.columnCount}

COLUMNS:
${schema.columns
  .map(col => {
    let info = `- ${col.name} (${col.type}): ${col.count} values, ${col.uniqueCount} unique`;
    if (col.type === "number") {
      info += `, range [${col.min}-${col.max}], mean=${col.mean}`;
    } else {
      const topVals = Object.entries(col.topValues || {})
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`)
        .join(", ");
      info += `, top values: ${topVals}`;
    }
    return info;
  })
  .join("\n")}
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect column type
 */
function detectType(values) {
  if (values.length === 0) return "string";
  const firstValue = values[0];
  if (!isNaN(Number(firstValue))) return "number";
  return "string";
}

/**
 * Get median value
 */
function getMedian(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
}

export { buildDatasetSchema, formatSchemaForPrompt, validateAIResponse };
