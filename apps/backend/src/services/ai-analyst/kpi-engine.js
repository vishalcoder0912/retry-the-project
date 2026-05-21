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

  if (aggregation === "median") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return present.length;
}

function calculateQualityScore(rows, schema) {
  const totalCells = Math.max(rows.length * schema.columns.length, 1);
  const missingCells = schema.columns.reduce(
    (sum, column) => sum + column.nullCount,
    0
  );

  return ((totalCells - missingCells) / totalCells) * 100;
}

function formatValue(metricName, value) {
  const name = String(metricName || "").toLowerCase();

  if (/salary|revenue|sales|amount|price|cost|profit|income/.test(name)) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  if (/rate|percent|margin|quality|attendance/.test(name)) {
    return `${Number(value).toFixed(1)}%`;
  }

  return Number(value.toFixed ? value.toFixed(2) : value).toLocaleString();
}

function buildKpiFromTemplate(rows, schema, template) {
  if (template.aggregation === "count") {
    return {
      id: crypto.randomUUID(),
      title: template.title,
      value: rows.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    };
  }

  if (template.aggregation === "quality_score") {
    return {
      id: crypto.randomUUID(),
      title: template.title,
      value: `${calculateQualityScore(rows, schema).toFixed(1)}%`,
      metric: "*",
      aggregation: "quality_score",
    };
  }

  const metric =
    findColumn(schema, template.metricAliases || [], "metric") ||
    (template.metricRole ? findColumn(schema, [], template.metricRole) : null) ||
    findColumn(schema, [], "metric");

  if (!metric) return null;

  const value = aggregate(
    rows.map((row) => row[metric.name]),
    template.aggregation
  );

  return {
    id: crypto.randomUUID(),
    title: template.title,
    value: formatValue(metric.name, value),
    metric: metric.name,
    aggregation: template.aggregation,
  };
}

export function buildAutoKpis({ dataset, schema, playbook, memoryMatch }) {
  const rows = dataset.rows || [];

  const baseKpis = (playbook.kpis || [])
    .map((template) => buildKpiFromTemplate(rows, schema, template))
    .filter(Boolean);

  const learnedKpis = (memoryMatch?.kpiTemplates || [])
    .map((template) =>
      buildKpiFromTemplate(rows, schema, {
        title: template.title,
        metricAliases: [template.metric],
        aggregation: template.aggregation,
      })
    )
    .filter(Boolean);

  const merged = [...learnedKpis, ...baseKpis];

  const seen = new Set();

  return merged
    .filter((kpi) => {
      if (seen.has(kpi.title)) return false;
      seen.add(kpi.title);
      return true;
    })
    .slice(0, 8);
}
