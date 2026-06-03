import { buildSchemaProfile, makeSchemaOnlyPacket, normalizeColumnName } from "./schema-fingerprint.js";
import { applyTrainedTemplates, buildRuleDashboardPlan, mergePlans, pickPrimaryCategory, pickPrimaryMetric, pickSecondaryMetric, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findBestSchemaMatch, trainSchemaExample } from "./schema-training-store.js";
import { formatChatAnswerWithOllama, planCommandWithOllama, planDashboardWithOllama } from "./llm-schema-dashboard-planner.js";
import { buildGuardianDashboardResponse } from "./dashboard-quality-guardian.js";
import { generateUnifiedDashboard } from "../agentic-dashboard/unified-dashboard-orchestrator.js";
import {
  buildSchemaUnderstanding,
} from "./schema-understanding-engine.js";
import {
  buildRagDashboardPlan,
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} from "./schema-rag-retriever.js";
import {
  governDashboardCommand,
  governChatAnswer,
} from "../agentic-dashboard/chat-agent.js";

function findColumn(profile, text, preferredRoles = []) {
  const lower = normalizeColumnName(text);
  const tokens = new Set(lower.split("_").filter(Boolean));
  const scored = (profile.columns || [])
    .map((column) => {
      const name = column.normalizedName || normalizeColumnName(column.name);
      const nameTokens = name.split("_").filter(Boolean);
      let score = 0;

      if (lower === name) score += 100;
      if (tokens.has(name)) score += 80;
      if (nameTokens.length && nameTokens.every((token) => tokens.has(token))) score += 60;
      if (nameTokens.some((token) => tokens.has(token))) score += 20;
      if (preferredRoles.includes(column.role)) score += 10;

      return { column, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.column ||
    profile.columns.find((column) => preferredRoles.includes(column.role)) ||
    profile.columns.find((column) => ["money_metric", "score_metric", "continuous_metric", "count_metric"].includes(column.role)) ||
    profile.columns[0];
}

function findCategory(profile, text) {
  const lower = normalizeColumnName(text);
  return profile.columns.find((column) => lower.includes(column.normalizedName) && ["category", "location", "target", "numeric_category"].includes(column.role)) ||
    pickPrimaryCategory(profile);
}

export async function generateSchemaDashboard(dataset, options = {}) {
  const unified = await generateUnifiedDashboard(dataset, options);
  const data = { ...unified.data };

  if (options.useLlm !== false) {
    const profile = buildSchemaProfile(dataset);
    const llmPlan = await planDashboardWithOllama(profile, null, {
      ragMatches: [],
      schemaUnderstanding: {},
    });

    if (llmPlan) {
      data.llm = {
        source: llmPlan.source,
        model: llmPlan.model,
        error: llmPlan.error,
      };
      data.model = llmPlan.model || data.model;
    }
  }

  return data;
}

export async function generateLegacySchemaDashboard(dataset, options = {}) {
  const profile = buildSchemaProfile(dataset);
  const understanding = buildSchemaUnderstanding(profile);

  const matchResult = findBestSchemaMatch(profile, {
    threshold: options.threshold ?? 0.35,
  });

  const ragResult = await retrieveSchemaRagMemories(profile, {
    threshold: options.ragThreshold ?? 0.55,
    limit: options.ragLimit ?? 5,
    useOllama: options.useRagEmbedding !== false,
  });

  const ragPlan = buildRagDashboardPlan(profile, ragResult.matches);
  const trainedPlan = applyTrainedTemplates(profile, matchResult.best);
  const rulePlan = buildRuleDashboardPlan(profile);

  let llmPlan = null;

  if (options.useLlm !== false) {
    llmPlan = await planDashboardWithOllama(profile, matchResult.best, {
      ragMatches: ragResult.matches,
      schemaUnderstanding: {
        domain: understanding.domain,
        roles: understanding.roles,
        userExplanation: understanding.userExplanation,
        kpiCandidates: understanding.kpiCandidates,
        chartCandidates: understanding.chartCandidates,
      },
    });
  }

  const smartCandidatePlan = {
    source: "schema-understanding-engine",
    domain: understanding.domain.domain,
    kpis: understanding.kpiCandidates,
    charts: understanding.chartCandidates,
  };

  const mergedDashboard = mergePlans(
    profile,
    ragPlan,
    trainedPlan,
    smartCandidatePlan,
    llmPlan?.charts?.length || llmPlan?.kpis?.length ? llmPlan : null,
    rulePlan
  );

  const guarded = buildGuardianDashboardResponse(profile, mergedDashboard, {
    maxCharts: options.maxCharts ?? 7,
    maxKpis: options.maxKpis ?? 8,
  });

  return {
    success: true,
    schemaOnly: true,
    profile: makeSchemaOnlyPacket(profile),
    understanding: {
      domain: understanding.domain,
      userExplanation: understanding.userExplanation,
      primaryMetric: understanding.roles.primaryMetric,
      primaryCategory: understanding.roles.primaryCategory,
      recommendedKpis: understanding.kpiCandidates.slice(0, 6),
      recommendedCharts: understanding.chartCandidates.slice(0, 7),
    },
    match: matchResult.best
      ? {
          dataset: matchResult.best.entry.name,
          domain: matchResult.best.entry.domain,
          score: matchResult.best.score,
        }
      : null,
    candidates: matchResult.candidates.map((candidate) => ({
      dataset: candidate.entry.name,
      domain: candidate.entry.domain,
      score: candidate.score,
    })),
    rag: {
      used: ragResult.used,
      threshold: ragResult.threshold,
      query: ragResult.query,
      matches: ragResult.matches.map((match) => ({
        id: match.entry.id,
        name: match.entry.name,
        domain: match.entry.domain,
        score: match.score,
      })),
      stats: ragResult.stats,
    },
    dashboard: guarded.dashboard,
    dashboardPlan: guarded.dashboard,
    dashboardType: llmPlan?.dashboardType || understanding.domain?.domain || profile.domain,
    executiveSummary: llmPlan?.executiveSummary || null,
    geoAnalysis: Array.isArray(llmPlan?.geoAnalysis) ? llmPlan.geoAnalysis : [],
    insights: Array.isArray(llmPlan?.insights) ? llmPlan.insights : [],
    recommendations: Array.isArray(llmPlan?.recommendations) ? llmPlan.recommendations : [],
    storyMode: llmPlan?.storyMode || null,
    confidenceScore: Number.isFinite(Number(llmPlan?.confidenceScore))
      ? Number(llmPlan.confidenceScore)
      : guarded.qualityScore / 100,
    dashboardHealth: guarded.dashboardHealth,
    provider: llmPlan?.source?.startsWith("ollama:") ? "ollama" : ragResult.used ? "rag+local" : "local",
    model: llmPlan?.model || "local",
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      warnings: guarded.warnings,
      fixes: guarded.fixes,
    },
    llm: llmPlan
      ? {
          source: llmPlan.source,
          model: llmPlan.model,
          error: llmPlan.error,
        }
      : null,
  };
}

export function trainSchemaDashboard(dataset, { dashboardPlan, rating = "good", notes = "", source = "upload-feedback" } = {}) {
  return trainSchemaExample({ dataset, dashboardPlan, rating, notes, source });
}

export async function trainSchemaRagDashboard(
  dataset,
  {
    dashboardPlan,
    acceptedDashboardPlan,
    rating = "good",
    notes = "",
    source = "user-feedback",
    useOllama,
  } = {}
) {
  return trainSchemaRagMemoryFromDataset({
    dataset,
    acceptedDashboardPlan: acceptedDashboardPlan || dashboardPlan,
    rating,
    notes,
    source,
    useOllama,
  });
}

function localCommand(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = pickPrimaryMetric(profile);
  const metric2 = pickSecondaryMetric(profile);
  const category = pickPrimaryCategory(profile);

  if (/clear|reset/.test(lower) && /filter/.test(lower)) {
    return { action: "CLEAR_FILTERS", message: "Filters cleared.", schemaOnly: true };
  }

  if (/remove|delete/.test(lower) && /chart/.test(lower)) {
    return { action: "DELETE_CHART", message: "Removed the selected chart.", schemaOnly: true };
  }

  if (
    /fix|repair|validate|correct|regenerate/.test(lower) &&
    /dashboard|chart|charts|kpi|broken|wrong|invalid/.test(lower)
  ) {
    return {
      action: "FIX_DASHBOARD",
      message: "I checked the dashboard and prepared a schema-safe repair plan.",
      dashboardPlan: buildRuleDashboardPlan(profile),
      schemaOnly: true,
    };
  }

  if (/best dashboard|generate dashboard|build dashboard|create dashboard/.test(lower)) {
    return {
      action: "GENERATE_DASHBOARD",
      message: "Generated the best schema-safe dashboard.",
      dashboardPlan: buildRuleDashboardPlan(profile),
      schemaOnly: true,
    };
  }

  const filterMatch = lower.match(/filter\s+([a-z0-9_\s]+)\s*(=|to|is)\s*([\w\s.-]+)/i);
  if (filterMatch) {
    const column = findCategory(profile, filterMatch[1]) || category;
    const value = filterMatch[3].trim();
    return {
      action: "FILTER",
      message: `Applied filter ${column?.name || filterMatch[1]} = ${value}.`,
      filters: column ? { [column.name]: value } : {},
      schemaOnly: true,
    };
  }

  if (/kpi|card|metric/.test(lower)) {
    const aggregation = /highest|max|top/.test(lower) ? "max" : /median/.test(lower) ? "median" : /sum|total/.test(lower) ? "sum" : /average|avg|mean/.test(lower) ? "avg" : /unique|distinct/.test(lower) ? "count_unique" : "count";
    const target = aggregation === "count" && /record|row/.test(lower) ? { name: "__row_count__", title: "Records" } : findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric", "location", "category"]);
    const title = aggregation === "count" && target.name === "__row_count__" ? "Total Records" : `${aggregation === "avg" ? "Average" : aggregation === "max" ? "Highest" : aggregation === "sum" ? "Total" : aggregation === "median" ? "Median" : aggregation === "count_unique" ? "Unique" : "Count"} ${target?.title || target?.name}`;
    return {
      action: "GENERATE_KPI",
      message: `Added KPI: ${title}.`,
      kpiSpec: sanitizeKpiSpec({ title, metric: target?.name || "__row_count__", aggregation, format: target?.role === "money_metric" ? "currency" : "number" }, profile),
      schemaOnly: true,
    };
  }

  if (/scatter|relationship|correlation| vs | versus /.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric"] ) || metric;
    const x = profile.columns.find((column) => column.name !== y?.name && ["continuous_metric", "score_metric", "count_metric"].includes(column.role)) || metric2;
    if (x && y) {
      return {
        action: "GENERATE_CHART",
        message: `Created scatter chart: ${y.title} vs ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type: "scatter", title: `${y.title} vs ${x.title}`, xKey: x.name, yKey: y.name, aggregation: "count", limit: 500 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/pie|donut|distribution|breakdown/.test(lower) && !/salary|amount|revenue|score|age|experience|hours/.test(lower)) {
    const x = findCategory(profile, lower) || category;
    if (x) {
      const type = /pie/.test(lower) ? "pie" : "donut";
      return {
        action: "GENERATE_CHART",
        message: `Created ${type} chart for ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type, title: `${x.title} Distribution`, xKey: x.name, yKey: "count", aggregation: "count", limit: 10 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/histogram|distribution/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]) || metric;
    if (y) {
      return {
        action: "GENERATE_CHART",
        message: `Created histogram for ${y.title}.`,
        chartSpec: sanitizeChartSpec({ type: "histogram", title: `${y.title} Distribution`, xKey: y.name, yKey: y.name, aggregation: "count", bins: 12 }, profile),
        schemaOnly: true,
      };
    }
  }

  if (/chart|graph|show|average|avg|top/.test(lower)) {
    const y = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]) || metric;
    const x = findCategory(profile, lower) || category;
    if (x && y) {
      const aggregation = /sum|total/.test(lower) ? "sum" : /max|highest/.test(lower) ? "max" : /median/.test(lower) ? "median" : /count/.test(lower) || y.name === "count" ? "count" : "avg";
      return {
        action: "GENERATE_CHART",
        message: `Created chart: ${aggregation} ${y.title} by ${x.title}.`,
        chartSpec: sanitizeChartSpec({ type: "bar", title: `${aggregation === "avg" ? "Average" : aggregation.toUpperCase()} ${y.title} by ${x.title}`, xKey: x.name, yKey: y.name, aggregation, limit: /top\s*(\d+)/.test(lower) ? Number(lower.match(/top\s*(\d+)/)[1]) : 10 }, profile),
        schemaOnly: true,
      };
    }
  }

  return {
    action: "ANSWER",
    message: buildDatasetUnderstandingAnswer(profile),
    schemaOnly: true,
  };
}

function toDashboardActionItem(command = {}) {
  if (command.action === "GENERATE_CHART" && command.chartSpec) {
    return {
      action: "create_chart",
      chart_type: command.chartSpec.type,
      title: command.chartSpec.title,
      x: command.chartSpec.xKey,
      y: command.chartSpec.yKey,
      aggregation: command.chartSpec.aggregation,
      reason: command.chartSpec.reason || "Schema-safe chart action.",
      chartSpec: command.chartSpec,
    };
  }

  if (command.action === "MODIFY_CHART" && command.chartSpec) {
    return {
      action: "modify_chart",
      chart_type: command.chartSpec.type,
      title: command.chartSpec.title,
      x: command.chartSpec.xKey,
      y: command.chartSpec.yKey,
      aggregation: command.chartSpec.aggregation,
      reason: command.chartSpec.reason || "Schema-safe chart modification.",
      chartSpec: command.chartSpec,
    };
  }

  if (command.action === "GENERATE_KPI" && command.kpiSpec) {
    return {
      action: "create_kpi",
      title: command.kpiSpec.title,
      metric: command.kpiSpec.metric,
      aggregation: command.kpiSpec.aggregation,
      reason: command.kpiSpec.description || "Schema-safe KPI action.",
      kpiSpec: command.kpiSpec,
    };
  }

  if (command.action === "FILTER") {
    return {
      action: "filter",
      filters: command.filters || {},
      reason: "Schema-safe filter action.",
    };
  }

  if (command.action === "CLEAR_FILTERS") return { action: "clear_filters" };
  if (command.action === "DELETE_CHART") return { action: "delete_chart" };

  return null;
}

function withDashboardActionEnvelope(command = {}) {
  if (command.response_type === "dashboard_action") return command;

  const item = toDashboardActionItem(command);
  if (!item) return command;

  return {
    ...command,
    response_type: "dashboard_action",
    natural_response: command.message || "I prepared a schema-safe dashboard action.",
    actions: [item],
    warnings: command.warnings || [],
    schema_safe: true,
    schemaOnly: true,
  };
}

export async function runDashboardCommand({ dataset, query, currentDashboard = {}, useLlm = true, requireOllamaValidation, useOllamaValidator }) {
  const profile = buildSchemaProfile(dataset);
  const matchResult = findBestSchemaMatch(profile, { threshold: 0.35 });
  const ragResult = await retrieveSchemaRagMemories(profile, {
    threshold: 0.55,
    limit: 5,
  });

  const deterministic = localCommand(profile, query);
  const shouldUseLlm = useLlm && deterministic.action === "ANSWER";
  const rag = {
    used: ragResult.used,
    matches: ragResult.matches.map((match) => ({
      id: match.entry.id,
      domain: match.entry.domain,
      score: match.score,
    })),
  };

  if (shouldUseLlm) {
    const planned = await planCommandWithOllama({
      query,
      schemaProfile: profile,
      memoryMatch: matchResult.best,
      ragMatches: ragResult.matches,
      currentDashboard,
    });
    if (planned && planned.action !== "ANSWER") {
      return governDashboardCommand({
        dataset,
        query,
        command: withDashboardActionEnvelope({ ...planned, rag }),
        currentDashboard,
        requireOllama: requireOllamaValidation ?? useOllamaValidator,
      });
    }
    return governDashboardCommand({
      dataset,
      query,
      command: withDashboardActionEnvelope({ ...deterministic, aiFallback: planned?.aiError || null, model: planned?.model, provider: planned?.provider, rag }),
      currentDashboard,
      requireOllama: requireOllamaValidation ?? useOllamaValidator,
    });
  }

  return governDashboardCommand({
    dataset,
    query,
    command: withDashboardActionEnvelope({ ...deterministic, rag }),
    currentDashboard,
    requireOllama: requireOllamaValidation ?? useOllamaValidator,
  });
}

function computeLocalAnswer(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]);
  const category = findCategory(profile, lower);

  if (/schema|columns|fields/.test(lower)) {
    return buildDatasetUnderstandingAnswer(profile, { includeColumns: true });
  }

  if (/kpi|dashboard|chart/.test(lower)) {
    const plan = buildRuleDashboardPlan(profile);
    return `Recommended KPIs: ${plan.kpis.map((k) => k.title).join(", ")}. Recommended charts: ${plan.charts.map((c) => c.title).join(", ")}.`;
  }

  if (metric?.stats && /average|avg|mean/.test(lower)) {
    return `Average ${metric.title} is approximately ${metric.stats.mean}.`;
  }

  if (category && /top|most|distribution|breakdown/.test(lower)) {
    const top = category.topValues?.slice(0, 5).map((item) => `${item.value} (${item.count})`).join(", ");
    return `Top ${category.title} values are: ${top || "not available from schema profile"}.`;
  }

  return buildDatasetUnderstandingAnswer(profile);
}

function inferIntent(query) {
  const lower = String(query || "").toLowerCase();
  if (/report|presentation|board|executive summary|summary/.test(lower)) return "executive narrative";
  if (/trend|growth|changed|over time|fastest/.test(lower)) return "trend analysis";
  if (/compare| vs | versus /.test(lower)) return "comparison";
  if (/correlation|relationship|affect|impact/.test(lower)) return "relationship analysis";
  if (/top|highest|best|rank|most/.test(lower)) return "ranking";
  if (/country|region|city|state|geo|map/.test(lower)) return "geo analysis";
  if (/kpi|average|avg|total|sum|revenue|salary|count/.test(lower)) return "KPI analysis";
  return "dataset understanding";
}

function formatAnalystAnswer({ query, localAnswer, profile }) {
  const intent = inferIntent(query);

  return [
    "Summary",
    localAnswer,
    "",
    "What This Can Help Answer",
    ...buildBusinessQuestions(profile).slice(0, 5).map((question, index) => `${index + 1}. ${question}`),
    "",
    "Recommended Starting Point",
    ...buildRecommendedVisuals(profile).slice(0, 5).map((visual) => `- ${visual}`),
    "",
    "Next Step",
    intent === "dataset understanding"
      ? "I can turn this into a focused dashboard with KPIs, distributions, segment comparisons, and ranking views."
      : "I can use this as the basis for the next dashboard action or deeper analysis.",
  ].join("\n");
}

function roleLabel(column = {}) {
  const name = String(column.normalizedName || column.name || "").toLowerCase();
  if (/salary|income|pay|compensation/.test(name)) return "employee compensation";
  if (/revenue|sales|amount|profit|cost|price|billing/.test(name)) return "financial performance";
  if (/country|state|city|region|territory|location/.test(name)) return "geographic distribution";
  if (/education|degree|qualification/.test(name)) return "qualification level";
  if (/experience|seniority|tenure|years/.test(name)) return "seniority indicator";
  if (/department|team|function/.test(name)) return "organizational segment";
  if (/category|segment|type|status/.test(name)) return "business segment";
  if (/date|time|created|ordered|admission/.test(name)) return "time trend";
  if (/rating|score|satisfaction/.test(name)) return "quality or performance score";

  if (column.role === "location") return "geographic dimension";
  if (column.role === "date") return "time dimension";
  if (["money_metric", "continuous_metric", "score_metric", "count_metric"].includes(column.role)) return "business metric";
  if (["category", "target", "numeric_category"].includes(column.role)) return "analysis segment";
  return "supporting field";
}

function describeDomain(profile) {
  const names = (profile.columns || []).map((column) => column.normalizedName || normalizeColumnName(column.name)).join(" ");
  if (/salary|income|pay|compensation/.test(names)) {
    return "workforce compensation dataset that can explain salary patterns across employee, location, and qualification segments";
  }
  if (/revenue|sales|profit|order|customer/.test(names)) {
    return "commercial performance dataset that can show revenue, customer, product, and market patterns";
  }
  if (/patient|hospital|medical|disease|condition|billing/.test(names)) {
    return "healthcare operations dataset that can support patient, condition, provider, and billing analysis";
  }
  if (/rating|review|score/.test(names)) {
    return "feedback and quality dataset that can highlight satisfaction, ratings, and review patterns";
  }
  return "business dataset that can be explored through its key measures, segments, and distributions";
}

function importantColumns(profile) {
  const roles = ["money_metric", "continuous_metric", "score_metric", "count_metric", "location", "date", "category", "target", "numeric_category"];
  const selected = [];
  for (const column of profile.columns || []) {
    if (roles.includes(column.role) && !selected.some((item) => item.name === column.name)) selected.push(column);
    if (selected.length >= 6) break;
  }
  return selected;
}

function buildBusinessQuestions(profile) {
  const metric = pickPrimaryMetric(profile);
  const category = pickPrimaryCategory(profile);
  const secondaryMetric = pickSecondaryMetric(profile);
  const location = (profile.columns || []).find((column) => column.role === "location");
  const date = (profile.columns || []).find((column) => column.role === "date");

  return [
    metric && location ? `Which ${location.title.toLowerCase()} segments perform best on ${metric.title.toLowerCase()}?` : null,
    metric && category ? `How does ${metric.title.toLowerCase()} vary by ${category.title.toLowerCase()}?` : null,
    metric ? `What does the ${metric.title.toLowerCase()} distribution look like, and are there outliers?` : null,
    metric && secondaryMetric ? `Is there a relationship between ${metric.title.toLowerCase()} and ${secondaryMetric.title.toLowerCase()}?` : null,
    date && metric ? `How is ${metric.title.toLowerCase()} changing over time?` : null,
    category ? `Which ${category.title.toLowerCase()} groups dominate the dataset?` : null,
  ].filter(Boolean);
}

function buildRecommendedVisuals(profile) {
  const plan = buildRuleDashboardPlan(profile);
  return plan.charts?.length
    ? plan.charts.map((chart) => chart.title)
    : ["Metric by Category", "Category Distribution", "Top Segment Ranking", "Metric Distribution"];
}

function buildDatasetUnderstandingAnswer(profile, { includeColumns = false } = {}) {
  const columns = importantColumns(profile);
  const lines = [
    `This appears to be a ${describeDomain(profile)}.`,
    "",
    "The most useful fields appear to be:",
    ...columns.map((column) => `- ${column.name} -> ${roleLabel(column)}`),
  ];

  if (includeColumns) {
    const remaining = (profile.columns || [])
      .filter((column) => !columns.some((selected) => selected.name === column.name))
      .slice(0, 6)
      .map((column) => column.name);
    if (remaining.length) {
      lines.push("", `Other available fields include ${remaining.join(", ")}.`);
    }
  }

  lines.push(
    "",
    "Based on these fields, I would start by looking for performance differences, segment patterns, distributions, rankings, and any unusual outliers."
  );

  return lines.join("\n");
}

export async function runSchemaChat({ dataset, query, useLlm = true, requireOllamaValidation, useOllamaValidator }) {
  const profile = buildSchemaProfile(dataset);
  const localAnswer = computeLocalAnswer(profile, query);
  const structuredLocalAnswer = formatAnalystAnswer({ query, localAnswer, profile });
  if (!useLlm) {
    const governed = await governChatAnswer({
      dataset,
      query,
      answer: structuredLocalAnswer,
      requireOllama: requireOllamaValidation ?? useOllamaValidator,
    });
    return { ...governed, model: "local", provider: "local", schemaOnly: true };
  }
  const formatted = await formatChatAnswerWithOllama({ query, schemaProfile: profile, localAnswer: structuredLocalAnswer });
  const governed = await governChatAnswer({
    dataset,
    query,
    answer: formatted.answer,
    requireOllama: requireOllamaValidation ?? useOllamaValidator,
  });
  return { ...formatted, ...governed, schemaOnly: true };
}
