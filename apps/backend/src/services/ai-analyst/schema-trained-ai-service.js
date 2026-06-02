import { buildSchemaProfile, makeSchemaOnlyPacket, normalizeColumnName } from "./schema-fingerprint.js";
import { applyTrainedTemplates, buildRuleDashboardPlan, mergePlans, pickPrimaryCategory, pickPrimaryMetric, pickSecondaryMetric, sanitizeChartSpec, sanitizeKpiSpec } from "./dashboard-plan-engine.js";
import { findBestSchemaMatch, trainSchemaExample } from "./schema-training-store.js";
import { formatChatAnswerWithOllama, planCommandWithOllama, planDashboardWithOllama } from "./llm-schema-dashboard-planner.js";
import { buildGuardianDashboardResponse } from "./dashboard-quality-guardian.js";
import {
  buildSchemaUnderstanding,
} from "./schema-understanding-engine.js";
import { findAnalystTrainingForDomain } from "./analyst-training-memory.js";
import {
  buildRagDashboardPlan,
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} from "./schema-rag-retriever.js";
import { buildExcelAnalystPlan } from "./excel-analyst-brain.js";
import { executeExcelAnalysis } from "./excel-calculation-engine.js";
import { profileLargeDataset } from "./large-data-profiler.js";
import { buildSeniorAnalystPlan } from "./senior-analyst-brain.js";
import { selectSeniorKpis } from "./senior-kpi-selector.js";
import { buildSeniorDashboardPlan, calculateSeniorCharts } from "./senior-dashboard-planner.js";

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
  const profile = buildSchemaProfile(dataset);
  const understanding = buildSchemaUnderstanding(profile);
  const analystTraining = findAnalystTrainingForDomain(profile.domain);

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
    analystThinking: analystTraining?.analystThinking || null,
    dashboardGoal:
      analystTraining?.analystThinking?.businessQuestion ||
      understanding.domain?.goal ||
      "Create useful decision-making analytics.",
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
    message: `I found ${profile.rowCount.toLocaleString()} records, ${profile.columnCount} columns, and detected the domain as ${profile.domain}. Ask me to create a KPI, chart, filter, or dashboard.` ,
    schemaOnly: true,
  };
}

export async function runDashboardCommand({ dataset, query, currentDashboard = {}, useLlm = true }) {
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
    if (planned && planned.action !== "ANSWER") return { ...planned, rag };
    return { ...deterministic, aiFallback: planned?.aiError || null, model: planned?.model, provider: planned?.provider, rag };
  }

  return { ...deterministic, rag };
}

export async function generateSeniorAnalystDashboard({ dataset, currentDashboard = {}, options = {} } = {}) {
  const dataProfile = profileLargeDataset(dataset, {
    sampleSize: options.sampleSize || 5000,
  });
  const seniorPlanResult = buildSeniorAnalystPlan(dataProfile, options);
  const seniorAnalysisPlan = seniorPlanResult.seniorAnalysisPlan;

  const ragResult = await retrieveSchemaRagMemories(dataProfile, {
    threshold: options.ragThreshold ?? 0.5,
    limit: options.ragLimit ?? 5,
    useOllama: options.useRagEmbedding !== false,
  });

  const ragPlan = buildRagDashboardPlan(dataProfile, ragResult.matches);
  const rulePlan = buildRuleDashboardPlan(dataProfile);
  const seniorDashboardPlan = buildSeniorDashboardPlan({
    profile: dataProfile,
    seniorAnalysisPlan,
    maxCharts: options.maxCharts ?? 10,
  });

  const selectedKpis = selectSeniorKpis({
    dataset,
    profile: dataProfile,
    seniorAnalysisPlan,
    maxKpis: options.maxKpis ?? 8,
  });

  const mergedPlan = mergePlans(
    dataProfile,
    ragPlan,
    {
      ...seniorDashboardPlan,
      kpis: selectedKpis.map(({ value, ...spec }) => spec),
    },
    rulePlan,
    currentDashboard?.kpis || currentDashboard?.charts
      ? {
          source: "current-dashboard-context",
          domain: dataProfile.domain,
          kpis: currentDashboard.kpis || [],
          charts: currentDashboard.charts || [],
        }
      : null
  );

  const guarded = buildGuardianDashboardResponse(dataProfile, mergedPlan, {
    maxCharts: options.maxCharts ?? 10,
    maxKpis: options.maxKpis ?? 8,
  });

  const allowedKpiKeys = new Set(selectedKpis.map((kpi) => `${kpi.title}-${kpi.metric}-${kpi.aggregation}`));
  const finalKpis = selectedKpis
    .filter((kpi) => allowedKpiKeys.has(`${kpi.title}-${kpi.metric}-${kpi.aggregation}`))
    .slice(0, options.maxKpis ?? 8);

  const qualityCharts = seniorDashboardPlan.charts.filter((chart) => chart.section === "Data quality");
  const chartSpecsForCalculation = [
    ...guarded.dashboard.charts,
    ...qualityCharts.filter((chart) => !guarded.dashboard.charts.some((safeChart) => safeChart.id === chart.id)),
  ];

  const calculatedCharts = calculateSeniorCharts({
    dataset,
    profile: dataProfile,
    charts: chartSpecsForCalculation,
  });

  const dashboard = {
    ...guarded.dashboard,
    source: "senior-analyst-brain+rag+local-calculation+quality-guardian",
    layout: seniorDashboardPlan.layout,
    kpis: finalKpis,
    charts: calculatedCharts.slice(0, options.maxCharts ?? 10),
    schemaOnly: false,
    valuesCalculatedLocally: true,
  };

  const warnings = [
    ...(dataProfile.warnings || []),
    ...(seniorAnalysisPlan.warnings || []),
    ...(guarded.dashboardHealth?.warnings || []).map((warning) => warning.message || String(warning)),
    finalKpis.length === 0 ? "No meaningful KPIs could be calculated from available columns." : null,
    calculatedCharts.length === 0 ? "No meaningful chart data could be calculated from available columns." : null,
  ].filter(Boolean);

  const confidence = Math.round(
    Math.min(
      0.98,
      0.35 +
        (finalKpis.length ? 0.2 : 0) +
        (calculatedCharts.length ? 0.2 : 0) +
        (ragResult.used ? 0.1 : 0) +
        (dataProfile.dataQualityScore || 0) / 100 * 0.13
    ) * 100
  ) / 100;

  return {
    success: true,
    schemaOnly: false,
    seniorAnalysisPlan,
    profile: makeSchemaOnlyPacket(dataProfile, { includeStats: true, includeTopValues: true }),
    dataQuality: {
      score: dataProfile.dataQualityScore,
      duplicateEstimate: dataProfile.duplicateEstimate,
      sampling: dataProfile.sampling,
      warnings: dataProfile.warnings,
    },
    rag: {
      used: ragResult.used,
      matches: ragResult.matches.map((match) => ({
        id: match.entry.id,
        name: match.entry.name,
        domain: match.entry.domain,
        score: match.score,
      })),
      stats: ragResult.stats,
    },
    dashboard,
    dashboardPlan: guarded.dashboard,
    KPIs: finalKpis,
    kpis: finalKpis,
    charts: dashboard.charts,
    warnings,
    quality: {
      score: guarded.qualityScore,
      health: guarded.dashboardHealth,
      guardian: guarded.dashboard.guardian,
    },
    confidence,
    provider: ragResult.used ? "rag+local" : "local",
    model: "senior-analyst-local-rules",
  };
}

function computeLocalAnswer(profile, query) {
  const lower = String(query || "").toLowerCase();
  const metric = findColumn(profile, lower, ["money_metric", "score_metric", "continuous_metric", "count_metric"]);
  const category = findCategory(profile, lower);

  if (/schema|columns|fields/.test(lower)) {
    return `This dataset has ${profile.rowCount.toLocaleString()} rows and ${profile.columnCount} columns. Main domain: ${profile.domain}. Columns: ${profile.columns.map((c) => `${c.name} (${c.type}, ${c.role})`).join(", ")}.`;
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

  return `Dataset summary: ${profile.rowCount.toLocaleString()} rows, ${profile.columnCount} columns, detected domain ${profile.domain}. Primary metric: ${metric?.name || "not detected"}. Primary category: ${category?.name || "not detected"}.`;
}

export async function runSchemaChat({ dataset, query, useLlm = true }) {
  const profile = buildSchemaProfile(dataset);
  const localAnswer = computeLocalAnswer(profile, query);
  if (!useLlm) return { answer: localAnswer, model: "local", provider: "local", schemaOnly: true };
  const formatted = await formatChatAnswerWithOllama({ query, schemaProfile: profile, localAnswer });
  return { ...formatted, schemaOnly: true };
}

export async function runExcelAnalystChat({
  dataset,
  query,
  currentDashboard = {},
  useLlm = true,
} = {}) {
  const plan = await buildExcelAnalystPlan({
    dataset,
    query,
    currentDashboard,
    options: { useOllama: useLlm },
  });

  const calculation = executeExcelAnalysis({
    rows: dataset?.rows || [],
    plan,
  });

  const message = buildExcelAnswerMessage(query, plan, calculation);
  const warnings = [
    ...(plan.quality?.warnings || []),
    ...(calculation.ok ? [] : [calculation.warning]),
  ].filter(Boolean);

  return {
    schemaOnly: true,
    provider: "excel-analyst-rag",
    model: useLlm ? "rag-plus-local-calculation" : "local-calculation",
    query,
    intent: plan.intent,
    answer: message,
    plan: plan.executionPlan,
    calculation,
    suggestedCharts: plan.recommendedDashboard?.charts || [],
    suggestedKpis: plan.recommendedDashboard?.kpis || [],
    recommendedDashboard: plan.recommendedDashboard,
    confidence: buildExcelConfidence(plan, calculation),
    warnings,
    rag: plan.rag,
    quality: plan.quality,
    profile: plan.publicProfile,
  };
}

function buildExcelConfidence(plan, calculation) {
  let score = 0.45;
  if (plan.executionPlan?.metric) score += 0.2;
  if (plan.executionPlan?.dimension || plan.executionPlan?.dateColumn) score += 0.15;
  if (plan.rag?.used) score += 0.1;
  if (calculation?.ok) score += 0.1;
  return Math.round(Math.min(score, 0.98) * 100) / 100;
}

function formatMetricLocal(value, metricKey) {
  if (typeof value !== "number") return String(value);
  if (/salary|amount|revenue|sales|profit|price|cost|usd/i.test(metricKey)) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return value.toLocaleString();
}

function labelLocal(text) {
  if (!text) return "";
  return String(text).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildExcelAnswerMessage(query, plan, calculation) {
  if (!calculation.ok) {
    return `I could not complete the analysis because: ${calculation.warning}`;
  }

  const p = plan.executionPlan || {};

  if (Array.isArray(calculation.result) && calculation.result.length > 0) {
    const sorted = [...calculation.result].sort((left, right) => (right.value ?? right.count ?? 0) - (left.value ?? left.count ?? 0));
    const highest = sorted[0];
    const second = sorted[1];
    
    const highestLabel = highest.name || highest.period || highest.label || `Row ${highest.rowIndex || 1}`;
    const highestValue = highest.value ?? highest.count ?? highest.zScore ?? 0;
    const formattedHighest = formatMetricLocal(highestValue, p.metric || "value");

    let summaryText = "";
    if (plan.intent === "TREND") {
      summaryText = `Trend analysis over time shows key movements in the data. The highest peak occurred at ${highestLabel} with a value of ${formattedHighest}.`;
    } else {
      summaryText = `${labelLocal(p.dimension || "Category")}-wise ${labelLocal(p.metric || "metric")} analysis shows that ${highestLabel} has the highest contribution of ${formattedHighest}`;
      if (second) {
        const secondLabel = second.name || second.period || second.label || `Row ${second.rowIndex || 2}`;
        const secondValue = second.value ?? second.count ?? second.zScore ?? 0;
        const formattedSecond = formatMetricLocal(secondValue, p.metric || "value");
        summaryText += `, followed closely by ${secondLabel} with ${formattedSecond}`;
      }
      summaryText += `. This indicates a notable compensation or performance concentration in these categories.`;
    }

    const rowsText = calculation.result.slice(0, 5)
      .map((item, index) => {
        const labelStr = item.name || item.period || item.label || `Row ${item.rowIndex}`;
        const val = item.value ?? item.count ?? item.zScore;
        const formatted = formatMetricLocal(val, p.metric || "value");
        return `• ${labelStr}: ${formatted}`;
      })
      .join("\n");

    return [
      summaryText,
      "",
      "Breakdown Details:",
      rowsText
    ].join("\n");
  }

  if (typeof calculation.result === "number") {
    const formatted = formatMetricLocal(calculation.result, p.metric || "value");
    return `Analysis of the dataset shows that the calculated aggregate ${labelLocal(p.metric || "metric")} is ${formatted}. This value represents the total sum or count of points satisfying the query conditions.`;
  }

  return [
    "I analyzed your dataset like a senior business analyst.",
    `Intent detected: ${plan.intent}.`,
    p.metric ? `Metric used: ${labelLocal(p.metric)}.` : null,
    p.dimension ? `Dimension used: ${labelLocal(p.dimension)}.` : null,
    "",
    "The analysis calculation completed successfully.",
  ].filter((line) => line !== null).join("\n");
}
