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

import { callGeminiAI, isGeminiConfigured, sanitizeSQL, getConfidenceLevel } from "./gemini-ai-service.js";
import { buildSchemaPacket, formatSchemaForPrompt } from "./schema-packet-builder.js";

// Re-export for backward compatibility
export { normalizeColumns, generateDemoDataset, buildDatasetSchema };

const isGreetingQuery = (query) => {
  const normalizedQuery = normalizeText(query);

  return /^(hello|hi|hey|hola|good morning|good afternoon|good evening)( there)?$/.test(normalizedQuery);
};

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
  } else if (plan.mode === "countByDimension" && plan.dimension) {
    base.push(`This response used the schema to count records by \`${plan.dimension.name}\` without sending row values to any AI system.`);
  } else if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && plan.matchValues.length > 0) {
    const valuesList = plan.matchValues.map((value) => `\`${value}\``).join(", ");
    base.push(`This response counted rows where \`${plan.dimension.name}\` matched ${valuesList} using only local processing.`);
  }

  return base;
};

export const createChatResponse = (dataset, query) => {
  const analyticsDataset = prepareDatasetForAnalytics(dataset);

  if (isGreetingQuery(query)) {
    return {
      content: "Hello, how can I help you?",
      sql: null,
      chart: null,
      insights: [],
      schema: buildDatasetSchema(analyticsDataset),
    };
  }

  const schema = buildDatasetSchema(analyticsDataset);
  const plan = buildAnalysisPlan(analyticsDataset, schema, query);
  const chart = materializePlan(analyticsDataset, plan);

  let content = `I analyzed the ${schema.datasetName} schema and used it to select an appropriate ${chart?.type ?? "summary"} view.`;
  
  if (plan.mode === "countMatchingValues" && plan.dimension && Array.isArray(plan.matchValues) && chart?.data?.length) {
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
  };
};

/**
 * Create chat response using AI with intelligent caching
 * Cache hit = instant response ($0 cost)
 * Cache miss = call Gemini, then cache result
 */
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
    return {
      ...cachedResult,
      fromCache: true,
      cacheHit: true,
      cacheMessage: "⚡ Retrieved from cache (instant response, $0 cost)",
    };
  }

  console.log("[analytics] ❌ Cache MISS - will call AI or fallback");

  const analyticsDataset = prepareDatasetForAnalytics(dataset);

  if (isGeminiConfigured()) {
    console.log("[analytics] STEP 2: Gemini configured, calling AI...");
    try {
      const datasetForAI = {
        name: dataset.name,
        rows: dataset.rows,
        columns: dataset.columns,
        rowCount: dataset.rows?.length || 0,
        columnCount: dataset.columns?.length || 0,
      };

      const aiResponse = await callGeminiAI(datasetForAI, query);
      console.log(`[analytics] AI response success: ${aiResponse.success}`);
      console.log(`[analytics] AI used: ${aiResponse.usedAI}`);

      if (aiResponse.success && aiResponse.usedAI) {
        console.log("[analytics] ✅ AI analysis successful");
        let chart = null;
        if (aiResponse.chart_type && aiResponse.chart_type !== 'table') {
          chart = materializePlan(
            analyticsDataset,
            buildPlanFromAIResponse(analyticsDataset, aiResponse)
          );
        }

        const response = {
          content: aiResponse.insight,
          sql: aiResponse.sql,
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
        };

        console.log("[analytics] STEP 3: Caching AI response...");
        cacheQuery(dataset.id, query, response);
        console.log("[analytics] ✅ Response cached");

        return response;
      }
      console.log("[analytics] AI response not usable, falling back...");
    } catch (error) {
      console.warn("[analytics] AI call failed:", error.message);
      console.log("[analytics] Falling back to local analysis...");
    }
  } else {
    console.log("[analytics] Gemini not configured, using local analysis");
  }

  console.log("[analytics] STEP 4: Using local analysis fallback");
  const schema = buildDatasetSchema(analyticsDataset);
  const plan = buildAnalysisPlan(analyticsDataset, schema, query);
  const chart = materializePlan(analyticsDataset, plan);

  const localResponse = {
    content: `Local analysis: ${chart?.title || "Dataset analysis"}`,
    sql: buildSqlForPlan(plan) || null,
    chart: chart || null,
    insights: buildInsightsFromSchema(schema, plan),
    usedAI: false,
    fromCache: false,
    cacheHit: false,
    reason: "local-fallback",
  };

  cacheQuery(dataset.id, query, localResponse);
  console.log("[analytics] ✅ Local response cached");

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
