import {
  callDatasetChat,
  OLLAMA_MODELS,
} from './ollama/ollama-dual-model-service.js';
import { buildDatasetFacts } from './ollama/dataset-schema-summary.js';
import { retrieveLearningMemory } from './ai-analyst/self-learning-memory.js';

function fallbackAnswer(query, facts) {
  const text = String(query || '').toLowerCase();

  if (/row|record|how many/.test(text)) {
    return `The dataset has ${facts.rowCount.toLocaleString()} rows and ${facts.columnCount.toLocaleString()} columns.`;
  }

  if (/column|schema/.test(text)) {
    return `The dataset columns are: ${facts.schema.columns
      .map((column) => `${column.name} (${column.type})`)
      .join(', ')}.`;
  }

  const firstMetric = facts.facts.numericColumns[0];

  if (firstMetric && /average|avg|mean/.test(text)) {
    return `The average ${firstMetric.name} is ${firstMetric.stats?.avg ?? 'not available'}.`;
  }

  return `I analyzed the dataset schema. It has ${facts.rowCount.toLocaleString()} rows and ${facts.columnCount.toLocaleString()} columns. Ask about columns, averages, totals, categories, trends, or comparisons.`;
}

export async function runLlamaDatasetChat(dataset, query) {
  const facts = buildDatasetFacts(dataset);

  const safeContext = {
    datasetName: facts.schema.datasetName,
    rowCount: facts.schema.rowCount,
    columnCount: facts.schema.columnCount,
    columns: facts.schema.columns,
    facts: facts.facts,
    privacy: {
      schemaOnly: true,
      rawRowsSentToAI: false,
    },
  };

  const memories = retrieveLearningMemory({
    userQuestion: query,
    schemaColumns: facts.schema.columns.map((c) => c.name || c.normalizedName).filter(Boolean),
    domain: facts.schema.domain || dataset.domain || "generic",
  });

  const prompt = `
You are InsightFlow AI Chat.

You answer questions about an uploaded dataset.

Important rules:
- You receive schema and calculated statistics only.
- Raw rows are not provided.
- Do not invent exact values beyond provided facts.
- If a value is not present in the facts, say it needs local calculation.
- Keep the answer useful and concise.

Use these learned corrections before answering:
${JSON.stringify(memories, null, 2)}

If a correction rule matches the user question, follow it.
Do not repeat previous mistakes.

User question:
${query}

Dataset safe context:
${JSON.stringify(safeContext, null, 2)}
`;

  try {
    const result = await callDatasetChat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    return {
      content: result.content,
      provider: 'ollama',
      model: OLLAMA_MODELS.chat,
      schemaOnly: true,
      insights: [],
      chart: null,
    };
  } catch (error) {
    return {
      content: fallbackAnswer(query, facts),
      provider: 'fallback',
      model: OLLAMA_MODELS.chat,
      schemaOnly: true,
      aiError: error.message,
      insights: [],
      chart: null,
    };
  }
}
