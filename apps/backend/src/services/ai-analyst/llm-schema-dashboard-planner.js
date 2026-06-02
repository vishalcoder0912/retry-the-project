import { makeSchemaOnlyPacket } from "./schema-fingerprint.js";
import { sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findAnalystTrainingForDomain } from "./analyst-training-memory.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DASHBOARD_MODEL = process.env.DASHBOARD_LLM_MODEL || "neural-chat:7b";
const CHAT_MODEL = process.env.CHAT_LLM_MODEL || "llama3.2";

function extractJson(text = "") {
  const trimmed = String(text).trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }

  return null;
}

async function callOllama({ model, prompt, temperature = 0.1 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${DEFAULT_OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_ctx: 8192,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    return payload.response || "";
  } finally {
    clearTimeout(timer);
  }
}

function safeRagMatchesForPrompt(ragMatches = []) {
  return (ragMatches || []).slice(0, 5).map((match) => {
    const entry = match.entry || match;

    return {
      id: entry.id,
      name: entry.name,
      domain: entry.domain,
      score: match.score,
      schemaSignature: entry.schemaSignature,
      dashboardPlan: entry.dashboardPlan,
      notes: entry.notes,
    };
  });
}

function stripUnsafeSpec(spec = {}) {
  const {
    data,
    rows,
    rawRows,
    sampleRows,
    calculatedValues,
    chartData,
    value,
    values,
    result,
    results,
    ...safe
  } = spec || {};

  return safe;
}

function sanitizeDashboardPlan(plan = {}, schemaProfile) {
  return {
    kpis: Array.isArray(plan.kpis)
      ? plan.kpis.map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
    charts: Array.isArray(plan.charts)
      ? plan.charts.map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
  };
}

function buildDashboardPrompt(schemaProfile, memoryMatch, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const analystTraining = findAnalystTrainingForDomain(schemaProfile.domain);

  const legacyMemory = memoryMatch?.entry
    ? {
        matchedDataset: memoryMatch.entry.name,
        matchScore: memoryMatch.score,
        trainedDashboardPlan: memoryMatch.entry.dashboardPlan,
      }
    : null;

  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);
  const smartUnderstanding = options.schemaUnderstanding || null;

  return `You are InsightFlow's senior data analyst and schema-only dashboard planner.

YOUR JOB:
Understand the dataset schema, infer business meaning, and create the best dashboard plan.

THINK LIKE A SENIOR DATA ANALYST:
Before creating dashboard:
1. Identify the business domain.
2. Find the primary success metric.
3. Find dimensions that explain that metric.
4. Create KPIs useful for decision making.
5. Create charts that answer real business questions.
6. Reject charts that look visual but give no insight.

Never create random charts.
Never use ID columns as metrics.
Never use line chart without date/time.
Never use pie chart for high-cardinality data.
Never invent columns.

VERY IMPORTANT:
You do NOT see raw data rows.
You only see schema metadata, profile stats, role detection, and RAG memory.
You must return dashboard specifications only.
The local analytics engine will calculate real values later.

NEVER RETURN:
- raw rows
- chart.data
- KPI values
- fake numbers
- sample records
- SQL over private rows

ALLOWED OUTPUT:
- action
- message
- kpis
- charts
- schemaOnly

ALLOWED CHART TYPES:
bar, line, area, pie, donut, histogram, scatter, radar, composed, heatmap

ALLOWED AGGREGATIONS:
count, sum, avg, min, max, median, count_unique

DASHBOARD QUALITY RULES:
1. Always include Total Records KPI.
2. Prefer 3 to 6 useful KPIs.
3. Prefer 4 to 7 useful charts.
4. Use bar chart for metric by category.
5. Use histogram for numeric distribution.
6. Use scatter for metric vs metric.
7. Use line chart for metric by date.
8. Use donut/pie only for category distribution.
9. Use count_unique for unique category count.
10. For language/framework/skill/tag columns, add splitValues: true.
11. Use only existing column names from the current schema.
12. Each KPI/chart reason must explain the business question it answers.
13. Prefer metric-driver charts: primary metric by dimensions that explain it.
14. If domain is salary/workforce, optimize for "Which factors increase salary?"

CURRENT SCHEMA PACKET:
${JSON.stringify(packet, null, 2)}

ANALYST BUSINESS TRAINING MEMORY:
${JSON.stringify(analystTraining, null, 2)}

SMART SCHEMA UNDERSTANDING:
${JSON.stringify(smartUnderstanding, null, 2)}

LEGACY TRAINED MEMORY:
${JSON.stringify(legacyMemory, null, 2)}

RETRIEVED RAG MEMORIES:
${JSON.stringify(retrievedRagMemories, null, 2)}

RETURN STRICT JSON ONLY:
{
  "action": "GENERATE_DASHBOARD",
  "message": "short explanation for the user",
  "domain": "workforce_salary",
  "primaryMetric": "salary_usd",
  "dashboardGoal": "Find salary drivers",
  "businessQuestions": ["Which factors increase salary?"],
  "kpis": [
    {
      "title": "Total Records",
      "metric": "__row_count__",
      "aggregation": "count",
      "format": "number",
      "reason": "Total Records tells the user the dataset size behind salary analysis."
    }
  ],
  "charts": [
    {
      "type": "bar",
      "title": "Average Salary by Country",
      "xKey": "country",
      "yKey": "salary_usd",
      "aggregation": "avg",
      "limit": 10,
      "reason": "Country is a dimension that can explain differences in the main salary metric."
    }
  ],
  "insights": [
    "Country and experience are likely major salary drivers."
  ],
  "schemaOnly": true
}`;
}

function buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);

  return `You are InsightFlow's schema-only dashboard command router.

Rules:
- Return strict JSON only.
- Never include raw data rows.
- Never include chart.data.
- Never include KPI values.
- Use only schema column names.
- RAG memories are examples only, not real values.
- If user asks a normal question, return action ANSWER with a short answer.
- If user asks chart/KPI/filter change, return action and spec.

Allowed actions:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, GENERATE_KPI, FILTER, CLEAR_FILTERS, GENERATE_DASHBOARD, FIX_DASHBOARD, ANSWER

Current schema:
${JSON.stringify(packet, null, 2)}

Legacy trained memory:
${JSON.stringify(memoryMatch?.entry?.dashboardPlan || null, null, 2)}

Retrieved RAG memories:
${JSON.stringify(retrievedRagMemories, null, 2)}

Current dashboard specs:
${JSON.stringify(currentDashboard || {}, null, 2)}

User command:
${query}

Return example:
{"action":"GENERATE_CHART","message":"Created chart.","chartSpec":{"type":"scatter","title":"Salary vs Experience","xKey":"experience","yKey":"salary_usd","aggregation":"count","limit":500},"schemaOnly":true}`;
}

export async function planDashboardWithOllama(schemaProfile, memoryMatch, options = {}) {
  try {
    const text = await callOllama({
      model: DASHBOARD_MODEL,
      prompt: buildDashboardPrompt(schemaProfile, memoryMatch, options),
      temperature: 0.1,
    });
    const json = extractJson(text);
    if (!json) return null;

    return {
      source: `ollama:${DASHBOARD_MODEL}`,
      message: json.message || "Dashboard plan generated.",
      businessQuestions: Array.isArray(json.businessQuestions) ? json.businessQuestions : [],
      primaryMetric: json.primaryMetric,
      dashboardGoal: json.dashboardGoal,
      insights: Array.isArray(json.insights) ? json.insights : [],
      kpis: (json.kpis || []).map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 8),
      charts: (json.charts || json.chartSpecs || []).map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 10),
      schemaOnly: true,
      model: DASHBOARD_MODEL,
    };
  } catch (error) {
    return {
      source: "ollama-error",
      error: error.message,
      kpis: [],
      charts: [],
      schemaOnly: true,
      model: DASHBOARD_MODEL,
    };
  }
}

export async function planCommandWithOllama({
  query,
  schemaProfile,
  memoryMatch,
  ragMatches = [],
  currentDashboard,
}) {
  try {
    const text = await callOllama({ model: DASHBOARD_MODEL, prompt: buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard, {
      ragMatches,
    }) });
    const json = extractJson(text);
    if (!json) return null;

    return {
      action: json.action || "ANSWER",
      message: json.message || "Command processed.",
      chartSpec: json.chartSpec ? sanitizeChartSpec(stripUnsafeSpec(json.chartSpec), schemaProfile) : undefined,
      kpiSpec: json.kpiSpec ? sanitizeKpiSpec(stripUnsafeSpec(json.kpiSpec), schemaProfile) : undefined,
      filters: json.filters,
      dashboardPlan: json.dashboardPlan
        ? sanitizeDashboardPlan(json.dashboardPlan, schemaProfile)
        : undefined,
      schemaOnly: true,
      provider: "ollama",
      model: DASHBOARD_MODEL,
    };
  } catch (error) {
    return {
      action: "ANSWER",
      message: "I used the local dashboard engine because the LLM planner was unavailable.",
      schemaOnly: true,
      provider: "local",
      model: DASHBOARD_MODEL,
      aiError: error.message,
    };
  }
}

export async function formatChatAnswerWithOllama({ query, schemaProfile, localAnswer }) {
  try {
    const prompt = `You are InsightFlow AI Chat.
Rewrite the local analytics answer in a clear helpful tone.
Do not invent values. Do not ask for raw rows.

Schema only:
${JSON.stringify(makeSchemaOnlyPacket(schemaProfile), null, 2)}

User question: ${query}
Local computed answer: ${localAnswer}

Return only the final answer text.`;
    const text = await callOllama({ model: CHAT_MODEL, prompt, temperature: 0.2 });
    return { answer: text.trim() || localAnswer, model: CHAT_MODEL, provider: "ollama" };
  } catch (error) {
    return { answer: localAnswer, model: CHAT_MODEL, provider: "local", aiError: error.message };
  }
}
