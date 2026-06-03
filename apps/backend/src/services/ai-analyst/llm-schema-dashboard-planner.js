import { makeSchemaOnlyPacket } from "./schema-fingerprint.js";
import { critiqueDashboard, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const DASHBOARD_MODEL = process.env.DASHBOARD_LLM_MODEL || "qwen3:4b";
const CHAT_MODEL = process.env.CHAT_LLM_MODEL || "llama3.2";

const INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT = `You are InsightFlow Universal Schema AI Planner.

You are a Schema-Only AI Data Analyst, RAG-aware Schema Engine, and production dashboard architect.

Think like a McKinsey analyst, Tableau expert, Power BI expert, senior data scientist, and BI consultant.

You convert schema-only dataset intelligence into an enterprise-grade analytics dashboard. You NEVER see raw dataset rows.

You only receive:
- Dataset schema and column roles
- Semantic business ontology / schema understanding
- RAG knowledge base matches
- Calculated statistics already present in schema/profile packets

Mandatory semantic column classification:
- IDENTIFIER: id, user_id, order_id, transaction_id, uuid. Never chart directly.
- PERSON: name, customer_name, employee_name, reviewer_name, patient_name, doctor_name. Never use as KPI. Never use as chart axis unless explicitly requested. Default action is count distinct only.
- GEO: country, city, state, region, territory, province, latitude, longitude. Eligible for Geo Intelligence.
- DATE: date, order_date, admission_date, review_date, created_at. Eligible for trend analysis.
- NUMERIC: revenue, profit, sales, salary, billing_amount, review_count, orders, quantity, customers, rating. Eligible for KPIs and charts.
- CATEGORY: gender, department, product_category, insurance_provider, admission_type. Eligible for grouping.
- TEXT: description, review_text, notes, comments, title, profile_link, url. Never use as KPI and never use in charts.

Reasoning process:
1. Classify every column by semantic role before planning any KPI or chart.
2. Understand the dataset domain from schema semantics, examples, roles, and RAG.
3. Identify primary KPI, secondary KPIs, dimensions, segments, dates, geography, and relationships.
4. Generate dashboard intent: Executive, Analyst, Story, Forecast, Geo Analysis, and AI Insights where supported by schema.
5. Prefer the most useful KPI and chart decisions first. Every KPI and chart must have business value.

Mandatory dashboard intent:
- Executive summary metadata
- 4 to 6 KPI cards where schema supports them
- Minimum 4 and maximum 8 useful charts
- Top insights and AI recommendations metadata
- Story mode metadata
- Agent execution timeline metadata

KPI rules:
- Never hardcode KPI names by dataset type.
- Infer KPI names from schema meaning and RAG context.
- Include Total Records only as a supporting KPI; do not make it the main business KPI when a meaningful metric exists.
- Examples: salary implies average/median/highest salary; sales implies revenue/profit/margin/orders/customers; healthcare implies patients/diseases/risk/recovery where columns exist.
- KPI priority: Revenue, Profit, Sales, Billing Amount, Salary, Orders, Customers, Patients, Review Count, Rating, Quantity, Record Count.
- Generate coverage KPIs from useful category/geo fields such as Countries Covered, Conditions Covered, or Categories Covered.

Chart rules:
- Numeric + category -> bar or horizontal bar.
- Numeric + numeric -> scatter.
- Date + numeric -> line or area.
- Category distribution -> donut or pie.
- Many categories / rankings -> horizontal bar.
- Correlation -> heatmap.
- Geographic fields -> geo analysis metadata and a ranked regional chart using supported chart types.
- Generate exactly 7 production-grade charts when enough schema fields exist:
  1. Time trend: DATE vs best metric, line chart.
  2. Metric by top category, bar chart.
  3. Category distribution, pie or donut chart.
  4. Top locations, bar chart.
  5. Geo Intelligence metadata/map when geo fields exist.
  6. Secondary category analysis, bar chart.
  7. Metric distribution, histogram.
- If a slot is unsupported by schema, replace it with the next safest useful chart, never with a person/link/text field.

Chart rejection rules:
- Never generate Reviewer Name vs Review Count.
- Never generate Customer Name vs Sales.
- Never generate Doctor Name vs Billing.
- Never generate Patient Name vs Cost.
- Never generate Name Distribution.
- Never generate Email Distribution, Phone Distribution, Profile Link Distribution, URL Distribution, Description Distribution, or Text Distribution.
- Never use text/name/id/link/title/description columns as business metrics.

Geo rules:
- Generate geo analysis only when schema contains country, state, region, city, zipcode, latitude, or longitude semantics.
- Include geoAnalysis metadata for world map, choropleth, bubble map, geo KPI cards, regional ranking, and regional insights.
- Do not invent geographic values or percentages.
- Rank geo locations by the selected numeric business metric, not by person/name/link/text columns.
- Only highlight locations present in the dataset after local normalization.
- Unknown, null, invalid, or unmapped locations must be grouped as Unknown and not highlighted.

Executive summary rules:
- Generate overview, topTrend, biggestOpportunity, biggestRisk, businessRecommendation, and confidenceScore metadata.
- Insights must be explainable from schema meaning, RAG context, or provided statistics.

Critical safety:
- Never generate random charts.
- Never generate schema summary KPIs such as Attributes / Columns, Numeric Columns, Categorical Columns, Missing Values, or Data Quality Score.
- Never use __row_index__ as a chart dimension.
- Trend charts require a real date/time column. If no real date/time column exists, do not generate a trend chart.
- Never invent KPI values, chart.data, raw rows, sample records, or private row-derived facts.
- Never claim exact insights unless the required statistics are provided in the schema/profile packet.
- If only schema is available, speak in schema-safe language such as "use average salary grouped by country" instead of "country X has the highest salary".
- Use only existing schema columns.
- Return strict JSON only.`;

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
  return critiqueDashboard({
    kpis: Array.isArray(plan.kpis)
      ? plan.kpis.map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
    charts: Array.isArray(plan.charts)
      ? plan.charts.map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).filter(Boolean)
      : [],
    executiveSummary: plan.executiveSummary && typeof plan.executiveSummary === "object"
      ? plan.executiveSummary
      : undefined,
    geoAnalysis: Array.isArray(plan.geoAnalysis) ? plan.geoAnalysis : [],
    insights: Array.isArray(plan.insights) ? plan.insights : [],
    recommendations: Array.isArray(plan.recommendations) ? plan.recommendations : [],
    storyMode: plan.storyMode && typeof plan.storyMode === "object" ? plan.storyMode : undefined,
    confidenceScore: Number.isFinite(Number(plan.confidenceScore)) ? Number(plan.confidenceScore) : undefined,
  }, schemaProfile);
}

function normalizeDashboardAction(action = {}, schemaProfile) {
  const rawAction = String(action.action || "").toLowerCase();

  if (["create_chart", "add_chart", "generate_chart"].includes(rawAction)) {
    return {
      action: "GENERATE_CHART",
      chartSpec: sanitizeChartSpec(stripUnsafeSpec({
        type: action.chart_type || action.type,
        title: action.title,
        xKey: action.x || action.xKey || action.dimension,
        yKey: action.y || action.yKey || action.metric,
        aggregation: action.aggregation,
        reason: action.reason,
        limit: action.limit,
      }), schemaProfile),
    };
  }

  if (["modify_chart", "update_chart", "update_chart_type", "convert_chart_type"].includes(rawAction)) {
    return {
      action: "MODIFY_CHART",
      target: action.target || action.chart_id || action.title,
      chartSpec: sanitizeChartSpec(stripUnsafeSpec({
        type: action.chart_type || action.type,
        title: action.title,
        xKey: action.x || action.xKey || action.dimension,
        yKey: action.y || action.yKey || action.metric,
        aggregation: action.aggregation,
        reason: action.reason,
        limit: action.limit,
      }), schemaProfile),
    };
  }

  if (["create_kpi", "add_kpi", "generate_kpi"].includes(rawAction)) {
    return {
      action: "GENERATE_KPI",
      kpiSpec: sanitizeKpiSpec(stripUnsafeSpec({
        title: action.title,
        metric: action.metric || action.y,
        aggregation: action.aggregation,
        format: action.format,
        reason: action.reason,
        businessKpi: true,
      }), schemaProfile),
    };
  }

  if (["filter", "add_filter", "apply_filter"].includes(rawAction)) {
    return {
      action: "FILTER",
      filters: action.filters || (action.column ? { [action.column]: action.value } : {}),
    };
  }

  if (["clear_filters", "reset_filters"].includes(rawAction)) {
    return { action: "CLEAR_FILTERS" };
  }

  if (["delete_chart", "remove_chart"].includes(rawAction)) {
    return { action: "DELETE_CHART", target: action.target || action.chart_id || action.title };
  }

  return { action: "ANSWER" };
}

function normalizeDashboardActionEnvelope(json = {}, schemaProfile) {
  if (json.response_type !== "dashboard_action" || !Array.isArray(json.actions)) return null;

  const actions = json.actions
    .map((action) => ({
      ...action,
      ...normalizeDashboardAction(action, schemaProfile),
    }))
    .filter((action) => action.action && action.action !== "ANSWER");

  const primary = actions[0] || { action: "ANSWER" };

  return {
    response_type: "dashboard_action",
    natural_response: json.natural_response || json.message || "I prepared schema-safe dashboard actions.",
    message: json.natural_response || json.message || "I prepared schema-safe dashboard actions.",
    action: primary.action,
    chartSpec: primary.chartSpec,
    kpiSpec: primary.kpiSpec,
    filters: primary.filters,
    actions,
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
    schema_safe: json.schema_safe !== false,
    schemaOnly: true,
  };
}

function buildDashboardPrompt(schemaProfile, memoryMatch, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);

  const legacyMemory = memoryMatch?.entry
    ? {
        matchedDataset: memoryMatch.entry.name,
        matchScore: memoryMatch.score,
        trainedDashboardPlan: memoryMatch.entry.dashboardPlan,
      }
    : null;

  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);
  const smartUnderstanding = options.schemaUnderstanding || null;

  return `${INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT}

YOUR JOB:
Understand the dataset schema and create the best dashboard plan.

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
- executiveSummary
- geoAnalysis
- insights
- recommendations
- storyMode
- confidenceScore
- schemaOnly

ALLOWED CHART TYPES:
bar, horizontalBar, line, area, pie, donut, histogram, scatter, radar, composed, heatmap

ALLOWED AGGREGATIONS:
count, sum, avg, min, max, median, count_unique

DASHBOARD QUALITY RULES:
1. Always include Total Records KPI, but prioritize a meaningful primary business metric when available.
2. Prefer 4 to 6 useful KPIs.
3. Prefer 4 to 8 useful charts.
4. Use bar chart for metric by category.
5. Use histogram for numeric distribution.
6. Use scatter for metric vs metric.
7. Use line chart for metric by date.
8. Use donut/pie only for category distribution.
9. Use count_unique for unique category count.
10. For language/framework/skill/tag columns, add splitValues: true.
11. Use only existing column names from the current schema.
12. If geography exists, include geoAnalysis metadata and at least one regional ranking chart using a supported chart type.
13. Do not output schema profile metrics as KPIs: Attributes / Columns, Numeric Columns, Categorical Columns, Missing Values, or Data Quality Score.
14. Never use __row_index__.
15. Never create line/trend charts unless the schema has a real date/time column.

CURRENT SCHEMA PACKET:
${JSON.stringify(packet, null, 2)}

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
  "kpis": [
    {
      "title": "Total Records",
      "metric": "__row_count__",
      "aggregation": "count",
      "format": "number"
    }
  ],
  "charts": [
    {
      "type": "bar",
      "title": "Average Salary by Country",
      "xKey": "country",
      "yKey": "salary_usd",
      "aggregation": "avg",
      "limit": 10
    }
  ],
  "executiveSummary": {
    "overview": "Schema-aware overview without invented values.",
    "topTrend": "Trend to calculate from available date and metric columns, or null.",
    "biggestOpportunity": "Opportunity implied by segment/metric semantics, or null.",
    "biggestRisk": "Risk implied by schema/statistics, or null.",
    "businessRecommendation": "Recommended analytical action.",
    "confidenceScore": 0.85
  },
  "geoAnalysis": [],
  "insights": [],
  "recommendations": [],
  "storyMode": {
    "whatHappened": "What the dashboard should evaluate.",
    "whyItHappened": "Drivers to test from schema relationships.",
    "whatWillHappen": "Forecast intent if date and metric columns exist.",
    "recommendedAction": "Next analytical action."
  },
  "confidenceScore": 0.85,
  "schemaOnly": true
}`;
}

function buildCommandPrompt(query, schemaProfile, memoryMatch, currentDashboard, options = {}) {
  const packet = makeSchemaOnlyPacket(schemaProfile);
  const retrievedRagMemories = safeRagMatchesForPrompt(options.ragMatches);

  return `${INSIGHTFLOW_DASHBOARD_SYSTEM_PROMPT}

You are Schema AI Studio Assistant.

You are InsightFlow's schema-only dashboard command router, but you must sound like a senior BI analyst and dashboard copilot.

Rules:
- Return strict JSON only.
- Never include raw data rows.
- Never include chart.data.
- Never include KPI values.
- Use only schema column names.
- RAG memories are examples only, not real values.
- If user asks a normal question, return action ANSWER with a concise business-focused analyst answer.
- If user asks chart/KPI/filter change, return action and spec.
- Never expose intent labels, confidence scores, internal agents, or planner logic.
- Do not lead with row count, column count, detected domain, or confidence unless specifically asked.
- Before creating anything, consider the current dashboard specs and avoid duplicates.
- If the user asks to edit/convert/sort/recolor/group an existing chart, use MODIFY_CHART instead of GENERATE_CHART when possible.
- If the user asks for a missing metric, choose the closest semantic metric from schema and explain the substitution in message.
- Always base actions only on existing schema columns and provided column profiles/statistics.
- Avoid fake insights: do not claim a segment is highest, lowest, best, worst, or trending unless that statistic is present.

AI_CAN:
- Create dashboards
- Edit dashboards
- Delete dashboard elements
- Reorder charts
- Resize charts
- Create custom KPIs
- Create calculated metrics
- Create filters
- Create tabs/pages
- Create drilldowns
- Convert chart types
- Explain charts and dashboards
- Recommend visualizations
- Generate executive summaries
- Detect anomalies and trends from available metadata/calculated analytics
- Build complete dashboards automatically
- Understand natural language
- Use dashboard memory
- Avoid duplicate charts
- Auto-select best visualizations
- Self-heal missing columns using semantic matching

When the user asks to build or modify the dashboard, return this schema-safe action envelope:
{
  "response_type": "dashboard_action",
  "natural_response": "",
  "actions": [
    {
      "action": "create_chart",
      "chart_type": "bar",
      "title": "",
      "x": "",
      "y": "",
      "aggregation": "",
      "reason": ""
    }
  ],
  "warnings": [],
  "schema_safe": true
}

Supported action names:
create_chart, modify_chart, update_chart_type, delete_chart, create_kpi, filter, clear_filters

Allowed internal action aliases:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, FILTER, CLEAR_FILTERS, GENERATE_KPI, GENERATE_DASHBOARD, FIX_DASHBOARD, ANSWER

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
{"response_type":"dashboard_action","natural_response":"I’ll show salary by experience so you can compare compensation patterns without assuming any result upfront.","actions":[{"action":"create_chart","chart_type":"scatter","title":"Salary vs Experience","x":"experience","y":"salary_usd","aggregation":"count","reason":"Metric-vs-metric relationship view"}],"warnings":[],"schema_safe":true}`;
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

    return critiqueDashboard({
      source: `ollama:${DASHBOARD_MODEL}`,
      message: json.message || "Dashboard plan generated.",
      dashboardType: json.dashboardType,
      kpis: (json.kpis || []).map((item) => sanitizeKpiSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 8),
      charts: (json.charts || json.chartSpecs || []).map((item) => sanitizeChartSpec(stripUnsafeSpec(item), schemaProfile)).slice(0, 10),
      executiveSummary: json.executiveSummary,
      geoAnalysis: Array.isArray(json.geoAnalysis) ? json.geoAnalysis : [],
      insights: Array.isArray(json.insights) ? json.insights : [],
      recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
      storyMode: json.storyMode,
      confidenceScore: Number.isFinite(Number(json.confidenceScore)) ? Number(json.confidenceScore) : undefined,
      schemaOnly: true,
      model: DASHBOARD_MODEL,
    }, schemaProfile);
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

    const envelope = normalizeDashboardActionEnvelope(json, schemaProfile);
    if (envelope) {
      return {
        ...envelope,
        provider: "ollama",
        model: DASHBOARD_MODEL,
      };
    }

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
    const prompt = `You are Schema AI Studio Assistant.

You are not a schema reporter. You are a senior data analyst, dashboard architect, BI consultant, product analyst, and AI copilot.
You only know the uploaded dataset through schema, semantic mappings, RAG knowledge, dashboard metadata, generated KPIs/charts, insights, geo analysis, executive summaries, calculated metrics, and the user conversation supplied to you.

Grounding rules:
- Never invent information, columns, segments, statistics, or KPI values.
- Never hallucinate values.
- Use only the provided schema-only packet and local computed analytics answer.
- If the requested information is not available, say: "Based on the current schema and available analytics, this information cannot be determined."
- Do not ask for raw rows.
- Keep the response concise, analytical, and business-focused.
- Do not expose intent labels, confidence scores, internal agents, planner logic, or chain of thought.
- Do not lead with row count, column count, detected domain, or confidence unless the user specifically asks.
- Explain the business meaning of important fields, what decisions the data can support, and what dashboard views would be useful.
- If the user asks to create or modify a dashboard element, answer like an analyst applying that dashboard action.

Reasoning Layer, internal only:
1. Identify user intent.
2. Find the relevant KPI.
3. Find related charts.
4. Find related insights.
5. Find related geo information.
6. Find related story summary.
7. Generate the answer.
8. Generate the recommendation.

Prefer these sections when useful:
Summary
Key Fields
What This Can Answer
Recommended Starting Point
Next Step

Never include a section named Confidence Score.

Schema only:
${JSON.stringify(makeSchemaOnlyPacket(schemaProfile), null, 2)}

User question: ${query}
Local computed answer: ${localAnswer}

Return only the final answer text. Do not expose the Reasoning Layer.`;
    const text = await callOllama({ model: CHAT_MODEL, prompt, temperature: 0.2 });
    return { answer: text.trim() || localAnswer, model: CHAT_MODEL, provider: "ollama" };
  } catch (error) {
    return { answer: localAnswer, model: CHAT_MODEL, provider: "local", aiError: error.message };
  }
}
