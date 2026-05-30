import { findColumn, safeNumber } from "./schema-profiler.js";

function aggregate(values = [], aggregation = "count") {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== ""
  );

  if (aggregation === "count") return present.length;

  if (aggregation === "count_unique") {
    return new Set(present.map((v) => String(v).trim().toLowerCase())).size;
  }

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

  if (aggregation === "p75") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.75) - 1;
    return sorted[Math.max(0, index)];
  }

  if (aggregation === "p25") {
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.25) - 1;
    return sorted[Math.max(0, index)];
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

function formatValue(metricName, value, aggregation) {
  const name = String(metricName || "").toLowerCase();

  if (aggregation === "count_unique") {
    return Math.round(value).toLocaleString();
  }

  if (/salary|revenue|sales|amount|price|cost|profit|income|compensation/.test(name)) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  if (/rate|percent|margin|quality|attendance/.test(name)) {
    return `${Number(value).toFixed(1)}%`;
  }

  if (Number.isInteger(value) || Math.abs(value) >= 1000) {
    return Math.round(value).toLocaleString();
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

  if (template.aggregation === "count_unique") {
    const col =
      findColumn(schema, template.metricAliases || [], "dimension") ||
      findColumn(schema, template.metricAliases || [], "category") ||
      findColumn(schema, template.metricAliases || [], "location");

    if (!col) return null;

    const uniqueCount = new Set(
      rows
        .map((row) => row[col.name])
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v).trim().toLowerCase())
    ).size;

    return {
      id: crypto.randomUUID(),
      title: template.title,
      value: uniqueCount.toLocaleString(),
      metric: col.name,
      aggregation: "count_unique",
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
    value: formatValue(metric.name, value, template.aggregation),
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
