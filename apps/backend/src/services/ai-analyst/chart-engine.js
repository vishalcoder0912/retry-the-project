import { findColumn, safeNumber } from "./schema-profiler.js";

function aggregate(values = [], aggregation = "count") {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== ""
  );

  if (aggregation === "count") return present.length;

  const numbers = present.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === "sum") return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === "avg") return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === "min") return Math.min(...numbers);
  if (aggregation === "max") return Math.max(...numbers);

  return present.length;
}

function groupBy(rows, xKey, yKey, aggregation = "count", limit = 10) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(yKey ? row[yKey] : label);
  }

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [aggregation === "count" ? "count" : yKey]: aggregate(values, aggregation),
    }))
    .sort((a, b) => Number(Object.values(b).at(-1)) - Number(Object.values(a).at(-1)))
    .slice(0, limit);
}

function histogram(rows, key, bins = 8) {
  const values = rows
    .map((row) => safeNumber(row[key]))
    .filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: String(min), count: values.length }];
  }

  const step = (max - min) / bins;

  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: min + index * step,
    end: index === bins - 1 ? max : min + (index + 1) * step,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), bins - 1);
    buckets[index].count += 1;
  }

  return buckets.map((bucket) => ({
    range: `${Math.round(bucket.start).toLocaleString()}-${Math.round(bucket.end).toLocaleString()}`,
    count: bucket.count,
  }));
}

function splitCount(rows, key, limit = 10) {
  const counts = new Map();

  for (const row of rows) {
    String(row[key] ?? "")
      .split(/[,;/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ [key]: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function applyFilters(rows, filters = {}) {
  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  if (!entries.length) return rows;

  return rows.filter((row) =>
    entries.every(([column, value]) => {
      return String(row[column] ?? "").toLowerCase() === String(value).toLowerCase();
    })
  );
}

function buildChartFromTemplate(rows, schema, template, filters = {}) {
  const filteredRows = applyFilters(rows, filters);

  const xColumn =
    findColumn(schema, template.xAliases || [], template.xRole) ||
    findColumn(schema, [], template.xRole);

  const yColumn =
    findColumn(schema, template.yAliases || [], template.yRole) ||
    findColumn(schema, [], template.yRole);

  if (template.type === "histogram") {
    const metric = yColumn || findColumn(schema, [], "metric");
    if (!metric) return null;

    const data = histogram(filteredRows, metric.name, 8);

    if (!data.length) return null;

    return {
      id: crypto.randomUUID(),
      title: template.title,
      type: "histogram",
      xKey: "range",
      yKey: "count",
      aggregation: "count",
      data,
    };
  }

  if (template.aggregation === "split_count") {
    if (!xColumn) return null;

    const data = splitCount(filteredRows, xColumn.name, 10);

    if (!data.length) return null;

    return {
      id: crypto.randomUUID(),
      title: template.title,
      type: "bar",
      xKey: xColumn.name,
      yKey: "count",
      aggregation: "count",
      data,
    };
  }

  if (!xColumn) return null;

  const aggregation = template.aggregation || "count";
  const yKey = aggregation === "count" ? null : yColumn?.name;

  if (aggregation !== "count" && !yKey) return null;

  const data = groupBy(
    filteredRows,
    xColumn.name,
    yKey,
    aggregation,
    template.limit || 10
  );

  if (!data.length) return null;

  return {
    id: crypto.randomUUID(),
    title: template.title,
    type: template.type || "bar",
    xKey: xColumn.name,
    yKey: aggregation === "count" ? "count" : yKey,
    aggregation,
    data,
  };
}

export function buildAutoCharts({ dataset, schema, playbook, memoryMatch }) {
  const rows = dataset.rows || [];

  const baseCharts = (playbook.charts || [])
    .map((template) => buildChartFromTemplate(rows, schema, template))
    .filter(Boolean);

  const learnedCharts = (memoryMatch?.chartTemplates || [])
    .map((template) =>
      buildChartFromTemplate(rows, schema, {
        title: template.title,
        type: template.type,
        xAliases: [template.xKey],
        yAliases: [template.yKey],
        aggregation: template.aggregation,
      })
    )
    .filter(Boolean);

  const merged = [...learnedCharts, ...baseCharts];

  const seen = new Set();

  return merged
    .filter((chart) => {
      const key = `${chart.title}-${chart.xKey}-${chart.yKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function buildChartFromCommand({
  dataset,
  schema,
  chartSpec,
  filters = {},
}) {
  if (!chartSpec) return null;

  return buildChartFromTemplate(
    dataset.rows || [],
    schema,
    {
      title: chartSpec.title || "Generated Chart",
      type: chartSpec.type || "bar",
      xAliases: chartSpec.xKey ? [chartSpec.xKey] : chartSpec.dimension ? [chartSpec.dimension] : [],
      yAliases: chartSpec.yKey ? [chartSpec.yKey] : chartSpec.metric ? [chartSpec.metric] : [],
      xRole: chartSpec.xRole,
      yRole: chartSpec.yRole,
      aggregation: chartSpec.aggregation || "count",
      limit: chartSpec.limit || 10,
    },
    filters
  );
}
