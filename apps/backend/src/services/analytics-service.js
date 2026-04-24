import {
  toNumber,
  inferType,
  normalizeColumns,
  generateDemoDataset,
  humanize,
  pickPreferredColumn,
  metricAggregationForColumn,
  sortLabels,
  toLabel,
  normalizeText,
  normalizeGenderLabel,
  normalizeBoardLabel,
  normalizeDimensionLabel,
  isMeaningfulValue,
  prepareDatasetForAnalytics,
  getMinimumGroupCount,
  filterGroupedEntries,
  groupMetricByDimension,
  countRowsByDimension,
  countRowsMatchingValues,
  buildDatasetSchema,
  calculatePearsonCorrelation,
} from "@insightflow/shared-analytics";

import { callOllamaAI, isOllamaConfigured } from "./ollama-ai-service.js";
import { buildSchemaPacket, formatSchemaForPrompt } from "./schema-packet-builder.js";

// Re-export for backward compatibility
export { normalizeColumns, generateDemoDataset, buildDatasetSchema };

/**
 * Validate and fix AI-generated SQL to use correct values from dataset
 */
export function validateAndFixSQL(dataset, sql) {
  if (!sql || !dataset?.rows?.length) {
    return sql;
  }

  try {
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*['"]([^'"]+)['"]/gi);
    if (!whereMatch) {
      return sql;
    }

    const columnName = sql.match(/WHERE\s+(\w+)\s*=/i)?.[1];
    if (!columnName) {
      return sql;
    }

    const actualValues = new Set();
    for (const row of dataset.rows) {
      const val = row[columnName];
      if (val !== null && val !== undefined && String(val).trim()) {
        actualValues.add(String(val).trim().toLowerCase());
      }
    }

    if (actualValues.size === 0) {
      return sql;
    }

    let fixedSQL = sql;
    for (const match of whereMatch) {
      const valueMatch = match.match(/WHERE\s+(\w+)\s*=\s*['"]([^'"]+)['"]/i);
      if (!valueMatch) continue;

      const [, col, value] = valueMatch;
      const normalizedValue = value.trim().toLowerCase();

      if (!actualValues.has(normalizedValue)) {
        const matchingValue = [...actualValues].find((v) => {
          if (normalizedValue === "some college" && v === "high school") return true;
          if (normalizedValue === "high school" && v === "some college") return true;
          if (normalizedValue === "master" && v === "masters") return true;
          if (normalizedValue === "masters" && v === "master") return true;
          return v.includes(normalizedValue) || normalizedValue.includes(v);
        });

        if (matchingValue) {
          console.log(`[analytics] 🔧 Fixing SQL value: '${value}' -> '${matchingValue}'`);
          fixedSQL = fixedSQL.replace(/WHERE\s+\w+\s*=\s*['"][^'"]+['"]/i, `WHERE ${col} = '${matchingValue}'`);
        }
      }
    }

    return fixedSQL;
  } catch (error) {
    console.warn("[analytics] SQL validation error:", error.message);
    return sql;
  }
}

export const isGreetingQuery = (query) => {
  const normalizedQuery = normalizeText(query);

  return /^(hello|hi|hey|hola|good morning|good afternoon|good evening)( there)?$/.test(normalizedQuery);
};

const isDatasetHelpQuery = (normalizedQuery) =>
  /\b(help|ask|question|questions|query|queries|prompt|prompts|analyse|analyze)\b/.test(normalizedQuery)
  && /\b(dataset|data|table|file|column|columns)\b/.test(normalizedQuery);

const singularizeWord = (word) => {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
};

const normalizeComparableText = (value) =>
  normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map(singularizeWord)
    .join(" ");

const includesPhrase = (source, phrase) => {
  if (!source || !phrase) return false;
  return (` ${source} `).includes(` ${phrase} `);
};

export const isDatasetOverviewQuery = (normalizedQuery) =>
  /\b(what|waht|which|describe|explain|summary|summarize|overview|about)\b/.test(normalizedQuery)
  && /\b(dataset|data|table|file)\b/.test(normalizedQuery);

export const classifyChatQuery = (query) => {
  const normalizedQuery = normalizeText(query);

  if (isGreetingQuery(query)) {
    return "greeting";
  }

  if (isDatasetOverviewQuery(normalizedQuery) || isDatasetHelpQuery(normalizedQuery)) {
    return "dataset-help";
  }

  return "analysis";
};

const pickDimensionForQuery = (schema, queryLower) => {
  const dimensions = schema.columns.filter((column) => column.role === "dimension");
  return dimensions.find((column) => queryLower.includes(column.name.toLowerCase()))
    ?? schema.primaryDimension
    ?? schema.secondaryDimension
    ?? null;
};

const pickMetricForQuery = (schema, queryLower) => {
  const metrics = schema.columns.filter((column) => column.role === "metric");
  return metrics.find((column) => queryLower.includes(column.name.toLowerCase()))
    ?? schema.primaryMetric
    ?? schema.secondaryMetric
    ?? null;
};

const detectQueryValueFilter = (dataset, schema, normalizedQuery) => {
  const dimensions = schema.columns.filter((column) => column.role === "dimension");
  const comparableQuery = normalizeComparableText(normalizedQuery);

  for (const dimension of dimensions) {
    const values = new Set();

    for (const row of dataset.rows) {
      const label = normalizeDimensionLabel(dimension.name, row[dimension.name]);
      if (label) {
        values.add(label);
      }
      if (values.size >= 50) {
        break;
      }
    }

    const matches = [];

    for (const value of values) {
      const normalizedValue = normalizeText(value);
      const comparableValue = normalizeComparableText(value);
      if (!normalizedValue) {
        continue;
      }

      if (includesPhrase(normalizedQuery, normalizedValue) || includesPhrase(comparableQuery, comparableValue)) {
        matches.push(value);
      }
    }

    if (matches.length > 0) {
      return { dimension, values: [...new Set(matches)] };
    }
  }

  return null;
};

const buildAnalysisPlan = (dataset, schema, query) => {
  const queryLower = query.toLowerCase();
  const normalizedQuery = normalizeText(query);
  const dimension = pickDimensionForQuery(schema, queryLower);
  const metric = pickMetricForQuery(schema, queryLower);
  const valueFilter = detectQueryValueFilter(dataset, schema, normalizedQuery);
  const wantsCount = /\bhow many\b|\bcount\b|\bnumber of\b|\btotal people\b|\bpeople\b/.test(normalizedQuery);
  const mentionsMetric = schema.columns
    .filter((column) => column.role === "metric")
    .some((column) => includesPhrase(normalizedQuery, normalizeText(column.name)));
  const overviewQuery = isDatasetOverviewQuery(normalizedQuery);

  if (overviewQuery) {
    return {
      mode: "overview",
      metric,
      dimension: schema.primaryDimension ?? dimension,
      chartType: "bar",
      intent: "overview",
    };
  }

  if ((queryLower.includes("trend") || queryLower.includes("monthly") || queryLower.includes("over time")) && schema.primaryDimension) {
    const trendDimension = schema.columns.find((column) => column.name === schema.primaryDimension.name && (column.type === "date" || column.name === "month"))
      ?? schema.columns.find((column) => column.type === "date")
      ?? schema.columns.find((column) => column.name === "month")
      ?? schema.primaryDimension;

    return {
      mode: "metricByDimension",
      metric,
      dimension: trendDimension,
      aggregation: metric ? metricAggregationForColumn(metric.name) : "sum",
      chartType: trendDimension.type === "date" || trendDimension.name === "month" ? "area" : "line",
      intent: "trend",
    };
  }

  if (wantsCount && valueFilter) {
    return {
      mode: "countMatchingValues",
      dimension: valueFilter.dimension,
      matchValues: valueFilter.values,
      chartType: "bar",
      intent: "count-filter",
    };
  }

  if (valueFilter && !mentionsMetric) {
    return {
      mode: "countMatchingValues",
      dimension: valueFilter.dimension,
      matchValues: valueFilter.values,
      chartType: "bar",
      intent: "value-filter",
    };
  }

  if (wantsCount && dimension) {
    return {
      mode: "countByDimension",
      dimension,
      chartType: "pie",
      intent: "count",
    };
  }

  if (dimension && metric) {
    return {
      mode: "metricByDimension",
      metric,
      dimension,
      aggregation: queryLower.includes("average") || queryLower.includes("avg")
        ? "average"
        : metricAggregationForColumn(metric.name),
      chartType: queryLower.includes("pie") ? "pie" : "bar",
      intent: "breakdown",
    };
  }

  if (dimension) {
    return {
      mode: "countByDimension",
      dimension,
      chartType: "pie",
      intent: "count",
    };
  }

  return {
    mode: "summary",
    metric,
    dimension,
    chartType: "bar",
    intent: "summary",
  };
};

const materializePlan = (dataset, plan) => {
  if (plan.mode === "overview" && plan.dimension) {
    const data = countRowsByDimension(dataset.rows, plan.dimension).slice(0, 8);
    if (data.length === 0) {
      return null;
    }

    return {
      type: data.length <= 6 ? "pie" : "bar",
      title: `Dataset overview by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    const data = groupMetricByDimension(dataset.rows, plan.dimension, plan.metric, plan.aggregation);
    return {
      type: plan.chartType === "pie" && data.length <= 6 ? "pie" : plan.chartType,
      title: `${plan.aggregation === "average" ? "Average " : ""}${humanize(plan.metric.name)} by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: plan.metric.name,
      data,
    };
  }

  if (plan.mode === "countByDimension" && plan.dimension) {
    const data = countRowsByDimension(dataset.rows, plan.dimension);
    return {
      type: data.length <= 6 ? "pie" : "bar",
      title: `Count by ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const data = countRowsMatchingValues(dataset.rows, plan.dimension, plan.matchValues);
    const titleValues = plan.matchValues.join(", ");
    return {
      type: "bar",
      title: `Count of ${titleValues} in ${humanize(plan.dimension.name)}`,
      xKey: plan.dimension.name,
      yKey: "count",
      data,
    };
  }

  return null;
};

const buildSqlForPlan = (plan) => {
  if (plan.mode === "overview") {
    return null;
  }

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    const aggregationSql = plan.aggregation === "average" ? "AVG" : "SUM";
    return `SELECT ${plan.dimension.name}, ${aggregationSql}(${plan.metric.name}) AS ${plan.metric.name} FROM dataset_rows GROUP BY ${plan.dimension.name} ORDER BY ${plan.metric.name} DESC;`;
  }

  if (plan.mode === "countByDimension" && plan.dimension) {
    return `SELECT ${plan.dimension.name}, COUNT(*) AS count FROM dataset_rows GROUP BY ${plan.dimension.name} ORDER BY count DESC;`;
  }

  if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const escapedValues = plan.matchValues.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(", ");
    return `SELECT ${plan.dimension.name}, COUNT(*) AS count FROM dataset_rows WHERE ${plan.dimension.name} IN (${escapedValues}) GROUP BY ${plan.dimension.name} ORDER BY count DESC;`;
  }

  return "SELECT * FROM dataset_rows LIMIT 100;";
};

const buildInsightsFromSchema = (schema, plan) => {
  const base = [
    `Schema inspection found ${schema.columnCount} columns across ${schema.rowCount} rows.`,
    `Dimensions: ${schema.columns.filter((column) => column.role === "dimension").map((column) => column.name).join(", ") || "none"}.`,
    `Metrics: ${schema.columns.filter((column) => column.role === "metric").map((column) => column.name).join(", ") || "none"}.`,
  ];

  if (plan.mode === "metricByDimension" && plan.metric && plan.dimension) {
    base.push(`This response used the schema to pair metric \`${plan.metric.name}\` with dimension \`${plan.dimension.name}\`.`);
  } else if (plan.mode === "overview") {
    const primaryDimension = plan.dimension?.name ? `\`${plan.dimension.name}\`` : "the primary categorical columns";
    base.push(`This response summarizes the dataset structure and highlights ${primaryDimension} as the main grouping field.`);
  } else if (plan.mode === "countByDimension" && plan.dimension) {
    base.push(`This response used the schema to count records by \`${plan.dimension.name}\` without sending row values to any AI system.`);
  } else if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const valuesList = plan.matchValues.map((value) => `\`${value}\``).join(", ");
    base.push(`This response counted rows where \`${plan.dimension.name}\` matched ${valuesList} using only local processing.`);
  }

  return base;
};

const buildSuggestedQuestions = (schema) => {
  const suggestions = [];
  const primaryDimension = schema.primaryDimension;
  const secondaryDimension = schema.secondaryDimension;
  const primaryMetric = schema.primaryMetric;

  if (primaryMetric && primaryDimension) {
    suggestions.push(`Show ${humanize(primaryMetric.name)} by ${humanize(primaryDimension.name)}.`);
    suggestions.push(`What is the average ${humanize(primaryMetric.name)} by ${humanize(primaryDimension.name)}?`);
  }

  const timeDimension = schema.columns.find((column) => column.type === "date" || normalizeText(column.name) === "month");
  if (primaryMetric && timeDimension) {
    suggestions.push(`Show the trend of ${humanize(primaryMetric.name)} over ${humanize(timeDimension.name)}.`);
  }

  if (secondaryDimension) {
    suggestions.push(`How many records are there by ${humanize(secondaryDimension.name)}?`);
  } else if (primaryDimension) {
    suggestions.push(`Count records by ${humanize(primaryDimension.name)}.`);
  }

  const sampledDimension = schema.columns.find((column) => column.role === "dimension" && Array.isArray(column.sample) && column.sample.length > 0);
  if (sampledDimension) {
    const sampleValue = sampledDimension.sample.find((value) => normalizeText(value));
    if (sampleValue) {
      suggestions.push(`How many rows match ${humanize(sampledDimension.name)} = "${sampleValue}"?`);
    }
  }

  return [...new Set(suggestions)].slice(0, 4);
};

const buildGuidedDatasetResponse = (schema, chart) => {
  const suggestions = buildSuggestedQuestions(schema);
  const dimensions = schema.columns.filter((column) => column.role === "dimension").map((column) => column.name);
  const metrics = schema.columns.filter((column) => column.role === "metric").map((column) => column.name);
  const topGroups = chart?.data?.slice(0, 3)
    .map((item) => `${item[chart.xKey]}: ${Number(item[chart.yKey] ?? 0).toLocaleString()}`)
    .join(", ");

  const contentParts = [
    `${schema.datasetName} contains ${schema.rowCount.toLocaleString()} rows and ${schema.columnCount} columns.`,
  ];

  if (dimensions.length > 0) {
    contentParts.push(`Main categorical columns are ${dimensions.slice(0, 4).join(", ")}.`);
  }

  if (metrics.length > 0) {
    contentParts.push(`Main numeric columns are ${metrics.slice(0, 4).join(", ")}.`);
  }

  if (topGroups && chart?.xKey) {
    contentParts.push(`A quick overview by ${humanize(chart.xKey)} shows ${topGroups}.`);
  }

  if (suggestions.length > 0) {
    contentParts.push(`You can ask follow-up questions like: ${suggestions.join(" ")}`);
  }

  return {
    content: contentParts.join(" "),
    insights: [
      `Dataset name: ${schema.datasetName}`,
      `Rows: ${schema.rowCount.toLocaleString()} | Columns: ${schema.columnCount}`,
      ...suggestions.map((question) => `Try asking: ${question}`),
    ],
  };
};

const buildOverviewContent = (schema, chart) => {
  const dimensions = schema.columns.filter((column) => column.role === "dimension").map((column) => column.name);
  const metrics = schema.columns.filter((column) => column.role === "metric").map((column) => column.name);
  const topGroups = chart?.data?.slice(0, 4)
    .map((item) => `${item[chart.xKey]}: ${Number(item[chart.yKey] ?? 0).toLocaleString()}`)
    .join(", ");

  const parts = [
    `${schema.datasetName} contains ${schema.rowCount.toLocaleString()} rows and ${schema.columnCount} columns.`,
  ];

  if (dimensions.length > 0) {
    parts.push(`Main categorical fields: ${dimensions.slice(0, 4).join(", ")}.`);
  }

  if (metrics.length > 0) {
    parts.push(`Main numeric fields: ${metrics.slice(0, 4).join(", ")}.`);
  }

  if (topGroups && chart?.xKey) {
    parts.push(`Top ${humanize(chart.xKey)} groups: ${topGroups}.`);
  }

  return parts.join(" ");
};

const buildLocalResponse = (dataset, query) => {
  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const schema = buildDatasetSchema(analyticsDataset);
  const queryType = classifyChatQuery(query);

  if (queryType === "greeting") {
    const chart = materializePlan(analyticsDataset, {
      mode: "overview",
      metric: schema.primaryMetric,
      dimension: schema.primaryDimension ?? schema.secondaryDimension,
      chartType: "bar",
      intent: "overview",
    });
    const guided = buildGuidedDatasetResponse(schema, chart);

    return {
      content: `Hello. I can help you explore ${schema.datasetName}. ${guided.content}`,
      sql: null,
      chart,
      insights: guided.insights,
      schema,
      intent: "greeting",
    };
  }

  if (queryType === "dataset-help") {
    const chart = materializePlan(analyticsDataset, {
      mode: "overview",
      metric: schema.primaryMetric,
      dimension: schema.primaryDimension ?? schema.secondaryDimension,
      chartType: "bar",
      intent: "overview",
    });
    const guided = buildGuidedDatasetResponse(schema, chart);

    return {
      content: guided.content,
      sql: null,
      chart,
      insights: guided.insights,
      schema,
      intent: "overview",
    };
  }

  const plan = buildAnalysisPlan(analyticsDataset, schema, query);
  const chart = materializePlan(analyticsDataset, plan);

  let content = `I analyzed the ${schema.datasetName} schema and used it to select an appropriate ${chart?.type ?? "summary"} view.`;

  if (plan.mode === "overview") {
    content = buildOverviewContent(schema, chart);
  } else if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const breakdown = chart.data.map((item) => `${item[plan.dimension.name]}: ${Number(item.count ?? 0).toLocaleString()}`).join("; ");
    const valueList = plan.matchValues.map((value) => `"${value}"`).join(" and ");
    const percentage = ((total / schema.rowCount) * 100).toFixed(1);
    content = `Found ${total.toLocaleString()} records (${percentage}%) matching ${humanize(plan.dimension.name)} = ${valueList} out of ${schema.rowCount.toLocaleString()} total records. Breakdown: ${breakdown}.`;
  } else if (plan.mode === "countByDimension" && plan.dimension && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    const topItems = chart.data.slice(0, 5).map((item) => `${item[plan.dimension.name]}: ${Number(item.count ?? 0).toLocaleString()}`).join(", ");
    content = `Counted ${total.toLocaleString()} records by ${humanize(plan.dimension.name)}. Top categories: ${topItems}.`;
  } else if (plan.mode === "metricByDimension" && plan.metric && plan.dimension && chart?.data?.length) {
    const total = chart.data.reduce((sum, item) => sum + Number(item[plan.metric.name] ?? 0), 0);
    const avg = chart.data.length > 0 ? (total / chart.data.length).toFixed(2) : 0;
    content = `Aggregated ${humanize(plan.metric.name)} by ${humanize(plan.dimension.name)} using ${plan.aggregation}. Total: ${Number(total).toLocaleString()}, Average: ${avg}.`;
  }

  return {
    content,
    sql: buildSqlForPlan(plan),
    chart,
    insights: buildInsightsFromSchema(schema, plan),
    schema,
    intent: plan.intent,
  };
};

export const createChatResponse = (dataset, query) => {
  return buildLocalResponse(dataset, query);
};

/**
 * Create chat response using AI with intelligent caching
 * Cache hit = instant response ($0 cost)
 * Cache miss = call Gemini, then cache result
 */
export const createLocalFallbackChatResponse = (dataset, query) => {
  const response = buildLocalResponse(dataset, query);

  return {
    content: response.content,
    sql: response.sql || null,
    chart: response.chart || null,
    insights: response.insights,
    usedAI: false,
    intent: response.intent,
    confidence: 0.7,
    model: "Local Analysis Engine",
    fromCache: false,
    cacheHit: false,
    reason: "local-fallback",
  };
};

export const createSchemaFirstChatResponse = async (dataset, query) => {
  const { getCachedQuery, cacheQuery } = await import("./query-cache.js");
  console.log("\n[analytics] ========================================");
  console.log(`[analytics] NEW QUERY: "${query.substring(0, 60)}..."`);
  console.log(`[analytics] Dataset ID: ${dataset.id}`);
  console.log("[analytics] ========================================");

  if (isGreetingQuery(query)) {
    console.log("[analytics] → Greeting query (skipping cache)");
    return {
      content: "Hello! I'm your AI data analyst. Ask me anything about your dataset!",
      sql: null,
      chart: null,
      insights: [],
      usedAI: false,
      reason: "greeting",
      fromCache: false,
    };
  }

  console.log("[analytics] STEP 1: Checking cache...");
  const cachedResult = getCachedQuery(dataset.id, query);

  if (cachedResult) {
    console.log("[analytics] ✅✅✅ CACHE HIT FOUND!");
    console.log("[analytics] Returning cached response immediately");
    console.log("[analytics] ════════════════════════════════════════");
    console.log("[analytics] CACHED RESPONSE:");
    console.log(`[analytics]   Model Used: ${cachedResult.model || 'Local Analysis'}`);
    console.log(`[analytics]   Response: ${cachedResult.content?.substring(0, 200)}...`);
    console.log("[analytics] ════════════════════════════════════════");
    return {
      ...cachedResult,
      fromCache: true,
      cacheHit: true,
      cacheMessage: "⚡ Retrieved from cache (instant response, $0 cost)",
    };
  }

  console.log("[analytics] ❌ Cache MISS - will call AI or fallback");
  console.log("[analytics] ════════════════════════════════════════");
  console.log("[analytics] USER QUERY RECEIVED:");
  console.log(`[analytics]   "${query}"`);
  console.log("[analytics] ════════════════════════════════════════");

  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const datasetForAI = {
    name: dataset.name,
    rows: dataset.rows,
    columns: dataset.columns,
    rowCount: dataset.rows?.length || 0,
    columnCount: dataset.columns?.length || 0,
  };

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaConfigured();

  if (ollamaAvailable) {
    console.log("[analytics] STEP 2: Ollama available, calling Mistral...");
    try {
      const aiResponse = await callOllamaAI(datasetForAI, query);
      console.log(`[analytics] AI response success: ${aiResponse.success}`);
      console.log(`[analytics] AI used: ${aiResponse.usedAI}`);

      if (aiResponse.success && aiResponse.usedAI) {
        console.log("[analytics] ✅ Ollama analysis successful");
        let chart = null;
        if (aiResponse.chart_type && aiResponse.chart_type !== 'table') {
          chart = materializePlan(
            analyticsDataset,
            buildPlanFromAIResponse(analyticsDataset, aiResponse)
          );
        }

        const validatedSQL = validateAndFixSQL(dataset, aiResponse.sql);

        const response = {
          content: aiResponse.insight,
          sql: validatedSQL,
          chart: chart,
          insights: [
            `Analysis type: ${aiResponse.intent}`,
            `Confidence: ${(aiResponse.confidence * 100).toFixed(0)}%`,
            aiResponse.reasoning,
          ],
          usedAI: true,
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          fromCache: false,
          cacheHit: false,
          model: "Mistral (Ollama)",
        };

        console.log("[analytics] STEP 3: Caching AI response...");
        cacheQuery(dataset.id, query, response);
        console.log("[analytics] ✅ Response cached");

        console.log("[analytics] ════════════════════════════════════════");
        console.log("[analytics] 🤖 AI RESPONSE GENERATED:");
        console.log(`[analytics]   Model: Mistral (Ollama)`);
        console.log(`[analytics]   Intent: ${aiResponse.intent}`);
        console.log(`[analytics]   Confidence: ${(aiResponse.confidence * 100).toFixed(0)}%`);
        console.log(`[analytics]   Insight: ${aiResponse.insight?.substring(0, 150)}...`);
        console.log(`[analytics]   SQL: ${aiResponse.sql?.substring(0, 100)}...`);
        console.log("[analytics] ════════════════════════════════════════");

        return response;
      }
      console.log("[analytics] AI response not usable, falling back...");
    } catch (error) {
      console.warn("[analytics] Ollama call failed:", error.message);
      console.log("[analytics] Falling back to local analysis...");
    }
  } else {
    console.log("[analytics] Ollama not configured, using local analysis");
  }

  // PRIORITY 3: Fallback to local analysis engine
  console.log("[analytics] STEP 4: AI failed or not available, using local analysis fallback (Priority 3)...");
  const localResponse = createLocalFallbackChatResponse(dataset, query);

  cacheQuery(dataset.id, query, localResponse);
  console.log("[analytics] ✅ Local response cached");

  console.log("[analytics] ════════════════════════════════════════");
  console.log("[analytics] 📊 LOCAL FALLBACK RESPONSE:");
  console.log(`[analytics]   Model: Local Analysis Engine`);
  console.log(`[analytics]   Intent: ${localResponse.intent}`);
  console.log(`[analytics]   Response: ${localResponse.content?.substring(0, 150)}...`);
  console.log(`[analytics]   SQL: ${localResponse.sql?.substring(0, 100)}...`);
  console.log("[analytics] ════════════════════════════════════════");

  return localResponse;
};

/**
 * Build plan from AI response
 */
function buildPlanFromAIResponse(dataset, aiResponse) {
  const schema = buildDatasetSchema(prepareDatasetForAnalytics(dataset));
  
  const columnsInSchema = (aiResponse.columns_used || [])
    .map(name => schema.columns.find(c => c.name === name))
    .filter(Boolean);

  const metrics = columnsInSchema.filter(c => c.role === "metric");
  const dimensions = columnsInSchema.filter(c => c.role === "dimension");

  return {
    mode: metrics.length > 0 && dimensions.length > 0
      ? "metricByDimension"
      : dimensions.length > 0
      ? "countByDimension"
      : "summary",
    metric: metrics[0] || null,
    dimension: dimensions[0] || null,
    chartType: aiResponse.chart_type,
    intent: aiResponse.intent,
  };
}

/**
 * Fallback to local analysis (FREE, no external API)
 */
function fallbackToLocalAnalysis(dataset, query) {
  console.log("[analytics] Using local fallback analysis");

  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const schema = buildDatasetSchema(analyticsDataset);
  const plan = buildAnalysisPlan(analyticsDataset, schema, query);
  const chart = materializePlan(analyticsDataset, plan);

  return {
    content: `Using local analysis: ${chart?.title || "Analyzing your data"}`,
    sql: buildSqlForPlan(plan),
    chart,
    insights: buildInsightsFromSchema(schema, plan),
    usedAI: false,
    reason: "local-fallback",
    fromCache: false,
  };
}

/**
 * Build chart data from SQL query result
 */
const buildChartFromSQL = (dataset, sql, chartType, columns) => {
  try {
    // Basic SQL parsing to determine aggregation
    const sqlLower = sql.toLowerCase();
    const hasGroupBy = sqlLower.includes('group by');
    const hasOrderBy = sqlLower.includes('order by');
    
    // Get dimension and metric from query
    let dimension = columns?.[0];
    let metric = columns?.[1];
    
    // If no explicit columns, try to infer from schema
    if (!dimension) {
      const analyticsDataset = prepareDatasetForAnalytics(dataset);
      const dims = analyticsDataset.columns.filter(c => c.role === 'dimension');
      const mets = analyticsDataset.columns.filter(c => c.role === 'metric');
      dimension = dims[0]?.name;
      metric = mets[0]?.name;
    }

    if (!dimension) return null;

    // Execute simple aggregation locally
    const rows = dataset.rows || [];
    const grouped = {};
    
    for (const row of rows) {
      const key = String(row[dimension] || 'Unknown');
      if (!grouped[key]) {
        grouped[key] = { count: 0, sum: 0 };
      }
      grouped[key].count++;
      if (metric && row[metric]) {
        grouped[key].sum += Number(row[metric]) || 0;
      }
    }

    const data = Object.entries(grouped)
      .map(([name, vals]) => ({
        [dimension]: name,
        count: vals.count,
        ...(metric ? { [metric]: vals.sum } : {})
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      type: chartType === 'pie' && data.length <= 6 ? 'pie' : chartType || 'bar',
      title: `Analysis: ${dimension}`,
      xKey: dimension,
      yKey: metric || 'count',
      data,
    };
  } catch {
    return null;
  }
};

export const generateCorrelationAnalysis = (dataset) => {
  const analyticsDataset = prepareDatasetForAnalytics(dataset);
  const numericColumns = analyticsDataset.columns.filter((column) => column.type === "number");

  if (numericColumns.length < 2) {
    return {
      correlations: [],
      summary: "Not enough numeric columns for correlation analysis.",
      hasGemini: false,
    };
  }

  const columnPairs = [];
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      columnPairs.push([numericColumns[i], numericColumns[j]]);
    }
  }

  const correlations = [];
  for (const [col1, col2] of columnPairs) {
    const x = [];
    const y = [];

    analyticsDataset.rows.forEach((row) => {
      const xVal = toNumber(row[col1.name]);
      const yVal = toNumber(row[col2.name]);
      if (xVal !== null && yVal !== null) {
        x.push(xVal);
        y.push(yVal);
      }
    });

    if (x.length >= 3) {
      const correlation = calculatePearsonCorrelation(x, y);
      if (correlation !== null) {
        let strength = "weak";
        let interpretation = "";

        const absCorr = Math.abs(correlation);
        if (absCorr >= 0.7) {
          strength = "strong";
          interpretation = correlation > 0
            ? `${col1.name} and ${col2.name} show a strong positive correlation.`
            : `${col1.name} and ${col2.name} show a strong negative correlation.`;
        } else if (absCorr >= 0.4) {
          strength = "moderate";
          interpretation = correlation > 0
            ? `${col1.name} and ${col2.name} show moderate positive correlation.`
            : `${col1.name} and ${col2.name} show moderate negative correlation.`;
        } else {
          interpretation = `${col1.name} and ${col2.name} show weak/no significant correlation.`;
        }

        correlations.push({
          column1: col1.name,
          column2: col2.name,
          coefficient: Number(correlation.toFixed(3)),
          strength,
          interpretation,
          sampleSize: x.length,
        });
      }
    }
  }

  correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

  return {
    correlations,
    summary: correlations.length > 0
      ? `Found ${correlations.length} correlation(s) among ${numericColumns.length} numeric columns.`
      : "No significant correlations found between numeric columns.",
    hasGemini: false,
  };
};
