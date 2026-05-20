import { randomUUID } from 'node:crypto';
import {
  callDashboardPlanner,
  OLLAMA_MODELS,
} from './ollama/ollama-dual-model-service.js';
import {
  buildSchemaSummary,
  cleanRows,
  findColumn,
  safeNumber,
} from './ollama/dataset-schema-summary.js';

function aggregate(values = [], aggregation = 'count') {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== '',
  );

  if (aggregation === 'count') return present.length;

  const numbers = present.map(safeNumber).filter((value) => value !== null);

  if (!numbers.length) return 0;

  if (aggregation === 'sum') return numbers.reduce((a, b) => a + b, 0);
  if (aggregation === 'avg') return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (aggregation === 'min') return Math.min(...numbers);
  if (aggregation === 'max') return Math.max(...numbers);

  if (aggregation === 'median') {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return present.length;
}

function groupBy(rows, xKey, yKey, aggregation = 'count', limit = 10) {
  const groups = new Map();

  for (const row of rows) {
    const label = String(row[xKey] ?? 'Unknown').trim() || 'Unknown';

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(yKey ? row[yKey] : label);
  }

  return [...groups.entries()]
    .map(([label, values]) => ({
      [xKey]: label,
      [aggregation === 'count' ? 'count' : yKey]: aggregate(values, aggregation),
    }))
    .sort((a, b) => Number(Object.values(b).at(-1)) - Number(Object.values(a).at(-1)))
    .slice(0, limit);
}

function histogram(rows, key, bins = 8) {
  const values = rows.map((row) => safeNumber(row[key])).filter((value) => value !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return [{ range: String(min), count: values.length }];

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
    String(row[key] ?? '')
      .split(/[,;/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      [key]: label,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildKpis(dataset, schema) {
  const rows = cleanRows(dataset.rows || []);

  const metric =
    findColumn(schema, ['salary', 'salary_usd', 'revenue', 'sales', 'amount', 'score'], 'metric') ||
    findColumn(schema, [], 'metric');

  const kpis = [
    {
      id: randomUUID(),
      title: 'Total Records',
      value: rows.length.toLocaleString(),
      metric: '*',
      aggregation: 'count',
      icon: 'database',
    },
  ];

  if (metric) {
    const values = rows.map((row) => row[metric.name]);

    kpis.push(
      {
        id: randomUUID(),
        title: `Average ${metric.name}`,
        value: Number(aggregate(values, 'avg').toFixed(2)).toLocaleString(),
        metric: metric.name,
        aggregation: 'avg',
        icon: 'bar-chart',
      },
      {
        id: randomUUID(),
        title: `Highest ${metric.name}`,
        value: Number(aggregate(values, 'max').toFixed(2)).toLocaleString(),
        metric: metric.name,
        aggregation: 'max',
        icon: 'trending-up',
      },
    );
  }

  return kpis;
}

function fallbackPlan(query, schema) {
  const text = String(query || '').toLowerCase();

  if (/remove|delete/.test(text) && /chart|graph/.test(text)) {
    return {
      action: 'DELETE_CHART',
      message: 'Removed the latest chart.',
    };
  }

  if (/reset|clear/.test(text) && /filter/.test(text)) {
    return {
      action: 'CLEAR_FILTERS',
      message: 'Cleared all filters.',
    };
  }

  const filterMatch = String(query).match(
    /(?:filter|where|show only)\s+([\w\s_-]+)\s*(?:=|is|:)\s*["']?([^"']+)["']?/i,
  );

  if (filterMatch) {
    const column = findColumn(schema, [filterMatch[1]], 'dimension');

    if (column) {
      return {
        action: 'FILTER',
        message: `Applied filter ${column.name} = ${filterMatch[2].trim()}`,
        filters: {
          [column.name]: filterMatch[2].trim(),
        },
      };
    }
  }

  if (/kpi|summary|card/.test(text)) {
    return {
      action: 'GENERATE_KPI',
      message: 'Generated KPI summary.',
    };
  }

  const type =
    /pie|donut/.test(text)
      ? 'pie'
      : /line|trend|time/.test(text)
        ? 'line'
        : /histogram|distribution/.test(text)
          ? 'histogram'
          : 'bar';

  const metric =
    findColumn(schema, ['salary', 'salary_usd', 'revenue', 'sales', 'amount', 'score'], 'metric') ||
    findColumn(schema, [], 'metric');

  const dimension =
    findColumn(schema, ['country', 'region', 'education', 'product', 'category'], 'dimension') ||
    findColumn(schema, [], 'dimension');

  return {
    action: 'GENERATE_CHART',
    message: 'Created chart using local fallback.',
    chartSpec: {
      title: metric && dimension ? `${metric.name} by ${dimension.name}` : 'Generated Chart',
      type,
      xKey: dimension?.name,
      yKey: metric?.name,
      aggregation: /average|avg|mean/.test(text) ? 'avg' : 'count',
      limit: 10,
    },
  };
}

function validatePlan(plan = {}) {
  const allowedActions = new Set([
    'GENERATE_CHART',
    'MODIFY_CHART',
    'DELETE_CHART',
    'FILTER',
    'CLEAR_FILTERS',
    'GENERATE_KPI',
    'ADD_KPI',
    'ANSWER',
  ]);

  const action = String(plan.action || 'ANSWER').toUpperCase();

  if (!allowedActions.has(action)) {
    return {
      action: 'ANSWER',
      message: 'I understood the request, but could not map it to a dashboard action.',
    };
  }

  return {
    action: action === 'ADD_KPI' ? 'GENERATE_KPI' : action,
    message: plan.message || 'Dashboard updated.',
    chartSpec: plan.chartSpec || plan.chart || null,
    filters: plan.filters || {},
  };
}

function buildChartFromSpec(dataset, schema, chartSpec) {
  const rows = cleanRows(dataset.rows || []);

  if (!chartSpec) return null;

  const chartType = chartSpec.type || 'bar';
  const aggregation = chartSpec.aggregation || 'count';

  const xColumn =
    findColumn(schema, [chartSpec.xKey, chartSpec.dimension].filter(Boolean), null) ||
    findColumn(schema, [], chartType === 'line' ? 'date' : 'dimension');

  const yColumn =
    findColumn(schema, [chartSpec.yKey, chartSpec.metric].filter(Boolean), 'metric') ||
    findColumn(schema, [], 'metric');

  if (chartType === 'histogram') {
    const metric = yColumn || xColumn;
    if (!metric) return null;

    return {
      id: randomUUID(),
      type: 'histogram',
      title: chartSpec.title || `${metric.name} Distribution`,
      xKey: 'range',
      yKey: 'count',
      aggregation: 'count',
      data: histogram(rows, metric.name, chartSpec.bins || 8),
      provider: 'ollama',
      model: OLLAMA_MODELS.dashboard,
    };
  }

  if (!xColumn) return null;
  if (aggregation !== 'count' && aggregation !== 'split_count' && !yColumn) return null;

  const data =
    aggregation === 'split_count'
      ? splitCount(rows, xColumn.name, chartSpec.limit || 10)
      : groupBy(
        rows,
        xColumn.name,
        yColumn?.name || xColumn.name,
        aggregation,
        chartSpec.limit || 10,
      );

  return {
    id: randomUUID(),
    type: chartType,
    title:
      chartSpec.title ||
      `${aggregation === 'count' ? 'Count' : aggregation} by ${xColumn.name}`,
    xKey: xColumn.name,
    yKey: aggregation === 'count' || aggregation === 'split_count' ? 'count' : yColumn.name,
    aggregation: aggregation === 'split_count' ? 'count' : aggregation,
    data,
    provider: 'ollama',
    model: OLLAMA_MODELS.dashboard,
  };
}

async function planWithNeuralChat(query, schema) {
  const prompt = `
You are InsightFlow Dashboard AI.

You control a data analytics dashboard.

Rules:
- You receive schema only.
- Never return chart.data.
- Never invent KPI values.
- Use only existing column names from schema.
- Backend code calculates all chart/KPI values.
- Return JSON only.

Allowed actions:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, FILTER, CLEAR_FILTERS, GENERATE_KPI, ANSWER

Allowed chart types:
bar, line, area, pie, histogram

Allowed aggregations:
count, sum, avg, min, max, median, split_count

Return this JSON:
{
  "action": "GENERATE_CHART",
  "message": "short message",
  "chartSpec": {
    "title": "",
    "type": "bar",
    "xKey": "",
    "yKey": "",
    "aggregation": "avg",
    "limit": 10
  },
  "filters": {}
}

User command:
${query}

Schema:
${JSON.stringify(schema, null, 2)}
`;

  const result = await callDashboardPlanner([
    {
      role: 'user',
      content: prompt,
    },
  ]);

  return result.json;
}

export async function runDashboardAIAgent(dataset, query) {
  const schema = buildSchemaSummary(dataset);

  let plan;
  let aiError = null;

  try {
    plan = await planWithNeuralChat(query, schema);
  } catch (error) {
    aiError = error.message;
    plan = fallbackPlan(query, schema);
  }

  const command = validatePlan(plan);

  if (command.action === 'GENERATE_CHART' || command.action === 'MODIFY_CHART') {
    const chart = buildChartFromSpec(dataset, schema, command.chartSpec);

    if (!chart) {
      return {
        action: 'ANSWER',
        message: 'I understood your request, but this chart is not possible with the current schema.',
        provider: 'ollama',
        model: OLLAMA_MODELS.dashboard,
        schemaOnly: true,
        aiError,
      };
    }

    return {
      action: command.action,
      message: command.message || `Created ${chart.title}.`,
      chart,
      provider: 'ollama',
      model: OLLAMA_MODELS.dashboard,
      schemaOnly: true,
      aiError,
    };
  }

  if (command.action === 'GENERATE_KPI') {
    return {
      action: 'GENERATE_KPI',
      message: command.message || 'Generated KPI summary.',
      kpis: buildKpis(dataset, schema),
      provider: 'ollama',
      model: OLLAMA_MODELS.dashboard,
      schemaOnly: true,
      aiError,
    };
  }

  return {
    action: command.action,
    message: command.message,
    filters: command.filters,
    provider: 'ollama',
    model: OLLAMA_MODELS.dashboard,
    schemaOnly: true,
    aiError,
  };
}
