import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/features/data/api/dataApi";
import type { Dataset } from "@/features/data/model/dataStore";
import { buildPremiumDashboardModel } from "@/features/dashboard/utils/premiumDashboardAnalytics";
import type { AgentMessage } from "@/features/dashboard/types/premiumDashboardTypes";

const starterMessages: AgentMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Hello. Ask me about KPIs, charts, correlations, segments, or recommendations.",
    createdAt: new Date().toISOString(),
  },
];

const randomId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

function findColumnName(dataset: Dataset, patterns: RegExp[]) {
  return dataset.columns.find((column) => patterns.some((pattern) => pattern.test(column.name)))?.name || null;
}

const normalizeName = (value: string) => value.toLowerCase().replace(/[_\s-]+/g, " ").trim();

const formatValue = (value: number, columnName = "") => {
  const isMoney = /amount|sales|revenue|salary|income|price|cost|profit|total|usd|inr/i.test(columnName);
  return new Intl.NumberFormat("en-US", {
    style: isMoney ? "currency" : "decimal",
    currency: "USD",
    maximumFractionDigits: value > 100 ? 0 : 2,
  }).format(value);
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const pickColumnFromQuery = (dataset: Dataset, query: string, fallback?: string | null, preference: "any" | "metric" | "dimension" = "any") => {
  const normalizedQuery = normalizeName(query);
  const metricPattern = /amount|sales|revenue|salary|income|price|cost|profit|total|value|quantity|score/;
  const dimensionPattern = /category|segment|type|group|department|country|region|city|location|product|name/;
  const candidates =
    preference === "metric"
      ? dataset.columns.filter((column) => metricPattern.test(normalizeName(column.name)))
      : preference === "dimension"
        ? dataset.columns.filter((column) => dimensionPattern.test(normalizeName(column.name)))
        : dataset.columns;
  const direct = candidates.find((column) => normalizedQuery.includes(normalizeName(column.name)));
  if (direct) return direct.name;

  const byKeyword = candidates.find((column) => {
    const name = normalizeName(column.name);
    if (metricPattern.test(normalizedQuery)) {
      return metricPattern.test(name);
    }
    if (dimensionPattern.test(normalizedQuery)) {
      return dimensionPattern.test(name);
    }
    return false;
  });

  return byKeyword?.name || fallback || null;
};

const numericValues = (dataset: Dataset, columnName: string) =>
  dataset.rows
    .map((row) => asNumber(row[columnName]))
    .filter((value): value is number => value !== null);

const uniqueCountForColumn = (dataset: Dataset, columnName: string) =>
  new Set(
    dataset.rows
      .map((row) => String(row[columnName] ?? "").trim())
      .filter(Boolean),
  ).size;

const groupMetric = (dataset: Dataset, dimension: string, metric: string, mode: "sum" | "avg" | "count") => {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const row of dataset.rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const value = asNumber(row[metric]);
    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value ?? 0;
    bucket.count += value === null && mode !== "count" ? 0 : 1;
    buckets.set(label, bucket);
  }

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      label,
      value: mode === "avg" ? (bucket.count ? bucket.sum / bucket.count : 0) : mode === "count" ? bucket.count : bucket.sum,
      count: bucket.count,
    }))
    .sort((left, right) => right.value - left.value);
};

const isLocalCalculationQuery = (query: string) =>
  /how many|number of|count|total|sum|average|avg|mean|median|highest|max|maximum|largest|lowest|min|minimum|smallest|by|group|category|segment|top|best|rank|outlier|anomal|distribution|spread|geo|country|city|location|region/i.test(query);

function buildFastLocalAnalytics(dataset: Dataset | null) {
  if (!dataset) return {};

  const educationColumn = findColumnName(dataset, [/education/i, /degree/i, /qualification/i]);
  const salaryColumn = findColumnName(dataset, [/salary/i, /revenue/i, /sales/i, /income/i]);

  if (!educationColumn || !salaryColumn) {
    return {};
  }

  const buckets = new Map<string, { sum: number; count: number }>();

  for (const row of dataset.rows) {
    const label = String(row[educationColumn] ?? "").trim();
    const value = asNumber(row[salaryColumn]);

    if (!label || value === null) continue;

    const bucket = buckets.get(label) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    buckets.set(label, bucket);
  }

  return {
    educationSalaryRanking: [...buckets.entries()]
      .map(([label, bucket]) => ({
        label,
        average: bucket.sum / bucket.count,
        count: bucket.count,
      }))
      .sort((left, right) => right.average - left.average)
      .slice(0, 10),
  };
}

function buildLocalAgentAnswer(dataset: Dataset, query: string) {
  const normalizedQuery = query.toLowerCase();
  const dashboard = buildPremiumDashboardModel(dataset);
  const metric = dashboard.primaryMetric;
  const dimension = dashboard.primaryDimension;
  const quality = dashboard.qualityScore;
  const topInsight = dashboard.insights[0]?.message;
  const outlierChart = dashboard.charts.find((chart) => chart.id === "metric-outliers");
  const distributionChart = dashboard.charts.find((chart) => chart.id === "metric-distribution" || chart.id === "category-distribution");
  const geoChart = dashboard.charts.find((chart) => chart.type === "map");
  const topSegmentChart = dashboard.charts.find((chart) => chart.id === "avg-metric-by-dimension" || chart.id === "top-dimension-ranking");
  const requestedMetric = pickColumnFromQuery(dataset, query, metric, "metric");
  const requestedDimension = pickColumnFromQuery(dataset, query, dimension, "dimension");
  const values = requestedMetric ? numericValues(dataset, requestedMetric) : [];

  if (/how many|number of rows|row count|total records|record count|count records|count rows/i.test(normalizedQuery)) {
    return `${dataset.name} has ${dataset.rows.length.toLocaleString()} records. Calculation: COUNT(rows) = ${dataset.rows.length.toLocaleString()}.`;
  }

  if (/distinct|unique|how many .*categor|count .*categor|number of .*categor|unique values/i.test(normalizedQuery) && requestedDimension) {
    const count = uniqueCountForColumn(dataset, requestedDimension);
    return `${dataset.name} has ${count.toLocaleString()} unique ${requestedDimension} values. Calculation: COUNT(DISTINCT ${requestedDimension}) = ${count.toLocaleString()}.`;
  }

  if (/total|sum|overall/i.test(normalizedQuery) && requestedMetric && values.length) {
    const total = values.reduce((sum, value) => sum + value, 0);
    return `Total ${requestedMetric} is ${formatValue(total, requestedMetric)}. Calculation: SUM(${requestedMetric}) across ${values.length.toLocaleString()} numeric rows.`;
  }

  if (/average|avg|mean/i.test(normalizedQuery) && requestedMetric && values.length) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return `Average ${requestedMetric} is ${formatValue(average, requestedMetric)}. Calculation: SUM(${requestedMetric}) / COUNT(${requestedMetric}) = ${formatValue(average, requestedMetric)} from ${values.length.toLocaleString()} numeric rows.`;
  }

  if (/median/i.test(normalizedQuery) && requestedMetric && values.length) {
    const medianValue = median(values);
    return `Median ${requestedMetric} is ${formatValue(medianValue ?? 0, requestedMetric)}. Calculation: middle value after sorting ${values.length.toLocaleString()} numeric ${requestedMetric} values.`;
  }

  if (/highest|max|maximum|largest/i.test(normalizedQuery) && requestedMetric && values.length && !/by|group|category|segment/i.test(normalizedQuery)) {
    const max = Math.max(...values);
    const row = dataset.rows.find((item) => asNumber(item[requestedMetric]) === max);
    const label = row?.name || row?.id || row?.[dimension || ""] || "matching row";
    return `Highest ${requestedMetric} is ${formatValue(max, requestedMetric)} at ${String(label)}. Calculation: MAX(${requestedMetric}) across ${values.length.toLocaleString()} numeric rows.`;
  }

  if (/lowest|min|minimum|smallest/i.test(normalizedQuery) && requestedMetric && values.length) {
    const min = Math.min(...values);
    const row = dataset.rows.find((item) => asNumber(item[requestedMetric]) === min);
    const label = row?.name || row?.id || row?.[dimension || ""] || "matching row";
    return `Lowest ${requestedMetric} is ${formatValue(min, requestedMetric)} at ${String(label)}. Calculation: MIN(${requestedMetric}) across ${values.length.toLocaleString()} numeric rows.`;
  }

  if (/by|group|category|segment|which .*highest|top/i.test(normalizedQuery) && requestedMetric && requestedDimension && requestedMetric !== requestedDimension) {
    const mode = /average|avg|mean/i.test(normalizedQuery) ? "avg" : /count|number/i.test(normalizedQuery) ? "count" : "sum";
    const grouped = groupMetric(dataset, requestedDimension, requestedMetric, mode).slice(0, 5);
    if (grouped.length) {
      const label = mode === "avg" ? `average ${requestedMetric}` : mode === "count" ? "record count" : `total ${requestedMetric}`;
      return `Top ${requestedDimension} by ${label}: ${grouped.map((row) => `${row.label}: ${mode === "count" ? row.value.toLocaleString() : formatValue(row.value, requestedMetric)}`).join(", ")}. Calculation: ${mode.toUpperCase()}(${requestedMetric}) GROUP BY ${requestedDimension}.`;
    }
  }

  if (/outlier|anomal/i.test(normalizedQuery)) {
    const rows = outlierChart?.data.slice(0, 5) || [];
    return rows.length
      ? `I found the highest ${metric || "metric"} values: ${rows.map((row) => `${row.label}: ${Number(row.value).toLocaleString()}`).join(", ")}. These are good candidates for validation or segmentation.`
      : "I could not find a reliable numeric metric for outlier analysis in this dataset.";
  }

  if (/geo|country|city|location|region|map/i.test(normalizedQuery)) {
    const rows = geoChart?.data.slice(0, 5) || [];
    return rows.length
      ? `Location analysis is available. Top locations by ${geoChart?.metricOptions?.find((item) => item.key === geoChart.yKey)?.label || "records"} are ${rows.map((row) => `${row.label}: ${Number(row[geoChart?.yKey || "value"] ?? row.value ?? row.count).toLocaleString()}`).join(", ")}.`
      : "No geographic columns detected. Upload data with country, city, latitude, or longitude.";
  }

  if (/distribution|spread|histogram|breakdown/i.test(normalizedQuery)) {
    const rows = distributionChart?.data.slice(0, 6) || [];
    return rows.length
      ? `The main distribution uses ${distributionChart?.title}. Top buckets are ${rows.map((row) => `${row.label}: ${Number(row.value).toLocaleString()}`).join(", ")}.`
      : "I need a numeric or categorical column to build a distribution.";
  }

  if (/top|best|highest|segment|rank/i.test(normalizedQuery)) {
    const rows = topSegmentChart?.data.slice(0, 5) || [];
    return rows.length
      ? `Top ${dimension || "segments"} by ${metric || "metric"}: ${rows.map((row) => `${row.label}: ${Number(row.value).toLocaleString()}`).join(", ")}.`
      : topInsight || "I need at least one categorical dimension and one numeric metric to rank segments.";
  }

  return `Dataset summary: ${dataset.name} has ${dataset.rows.length.toLocaleString()} rows and ${dataset.columns.length} columns. Primary metric is ${metric || "not detected"}, primary dimension is ${dimension || "not detected"}, and data quality is ${quality}/100. Recommended next action: ${dashboard.insights.find((insight) => insight.id === "recommendation")?.message || "upload a richer dataset for deeper analysis"}`;
}

export function usePremiumAgenticDashboard(dataset: Dataset | null) {
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiHealth, setAiHealth] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>(starterMessages);
  const [loading, setLoading] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboard = useMemo(() => {
    if (!dataset) return null;
    return buildPremiumDashboardModel(dataset, {
      aiResult,
      aiHealth,
      warnings: error ? [error] : [],
    });
  }, [dataset, aiResult, aiHealth, error]);

  const localAnalytics = useMemo(() => buildFastLocalAnalytics(dataset), [dataset]);

  const refreshAiDashboard = useCallback(async () => {
    if (!dataset?.id) return null;
    setLoading(true);
    setError(null);

    try {
      const [dashboardResponse, healthResponse] = await Promise.allSettled([
        api.generateSchemaDashboard(dataset.id, true, {
          rows: dataset.rows,
          columns: dataset.columns,
        }),
        api.getAgenticHealth(),
      ]);

      const nextAiResult = dashboardResponse.status === "fulfilled" ? dashboardResponse.value as Record<string, unknown> : null;
      const nextHealth = healthResponse.status === "fulfilled" ? healthResponse.value as Record<string, unknown> : null;
      startTransition(() => {
        setAiResult(nextAiResult);
        setAiHealth(nextHealth);
      });
      return { nextAiResult, nextHealth };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dashboard AI fallback is active.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [dataset]);

  useEffect(() => {
    const scheduleIdle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback
        : (callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 250);
    const cancelIdle =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const idleId = scheduleIdle(() => {
      refreshAiDashboard();
    });

    return () => {
      cancelIdle(idleId);
    };
  }, [refreshAiDashboard]);

  const runPrompt = useCallback(
    async (query: string) => {
      if (!dataset?.id || !query.trim()) return;

      const userMessage: AgentMessage = {
        id: randomId(),
        role: "user",
        content: query.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const localAnswer = buildLocalAgentAnswer(dataset, query.trim());
        if (isLocalCalculationQuery(query)) {
          setMessages((current) => [
            ...current,
            {
              id: randomId(),
              role: "assistant",
              content: localAnswer,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }

        const currentDashboard = aiResult?.dashboardPlan || aiResult?.dashboard;
        const schemaProfile = {
          datasetName: dataset.name,
          rowCount: dataset.rows.length,
          columnCount: dataset.columns.length,
          columns: dataset.columns,
          localAnalytics,
        };
        const fastResult = await api.sendFastDashboardChat(
          deepResearch ? `${query.trim()}\n\nGive a short schema-only explanation.` : query.trim(),
          schemaProfile,
          currentDashboard,
        );
        const result = fastResult.result;

        startTransition(() => {
          setAiResult((current) => ({
            ...(current || {}),
            command: result,
            fastChat: {
              source: result.source,
              cached: result.cached,
              reason: result.reason,
            },
          }));
        });

        setMessages((current) => [
          ...current,
          {
            id: randomId(),
            role: "assistant",
            content: result.answer || localAnswer,
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to run dashboard AI.";
        const fallbackAnswer = buildLocalAgentAnswer(dataset, query.trim());
        setError(message);
        setMessages((current) => [
          ...current,
          {
            id: randomId(),
            role: "assistant",
            content: fallbackAnswer,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [aiResult, dataset, deepResearch, localAnalytics],
  );

  return {
    dashboard,
    aiResult,
    aiHealth,
    messages,
    loading,
    error,
    deepResearch,
    setDeepResearch,
    refreshAiDashboard,
    runPrompt,
  };
}
