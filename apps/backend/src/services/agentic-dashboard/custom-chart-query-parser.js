/**
 * Custom Chart Query Parser
 * 
 * Deterministic parser for user queries that request charts and KPIs.
 * Runs BEFORE AI to avoid hallucinations and coordinate x/y fields correctly.
 * 
 * Supports patterns like:
 * - "Show average salary_usd by country"
 * - "Create pie chart of country"
 * - "Show salary_usd distribution"
 * - "Show experience vs salary_usd"
 * - "Top 10 countries by salary"
 */

const AGGREGATION_ALIASES = {
  "average": "avg",
  "mean": "avg",
  "total": "sum",
  "highest": "max",
  "lowest": "min",
  "minimum": "min",
  "maximum": "max",
  "number of": "count",
  "records": "count",
  "count of": "count",
};

const CHART_TYPE_PATTERNS = {
  "scatter": /scatter|correlation|vs|versus/i,
  "line": /line|trend|over time|timeline/i,
  "area": /area|stacked/i,
  "histogram": /histogram|distribution/i,
  "donut": /donut|pie chart/i,
  "pie": /pie|percentage|share|proportion/i,
  "horizontal_bar": /horizontal|rank|ranking/i,
  "bar": /bar|chart|compare|by/i,
};

/**
 * Normalize a value to match column names
 * @param {string} value 
 * @returns {string}
 */
function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Find column in schema by exact or fuzzy match
 * @param {object} schemaProfile
 * @param {string} userInput
 * @returns {object|null}
 */
function findColumnByFuzzyMatch(schemaProfile, userInput) {
  if (!schemaProfile?.columns || !userInput) return null;

  const normalized = normalize(userInput);
  const columns = schemaProfile.columns;

  // Exact match first
  let found = columns.find((c) => normalize(c.name) === normalized);
  if (found) return found;

  // Substring match
  found = columns.find((c) => normalize(c.name).includes(normalized) || normalized.includes(normalize(c.name)));
  if (found) return found;

  // Common semantic aliases
  const aliases = {
    "salary": ["salary_usd", "salary", "income", "pay", "compensation"],
    "income": ["salary_usd", "salary", "income", "pay"],
    "pay": ["salary_usd", "salary", "income"],
    "nation": ["country"],
    "location": ["country", "region", "state", "city"],
    "qualification": ["education", "degree"],
    "degree": ["education"],
    "exp": ["experience"],
    "years": ["experience"],
    "tech": ["frameworks", "technologies"],
    "tools": ["frameworks", "tools"],
  };

  const searchKey = normalize(userInput);
  if (aliases[searchKey]) {
    for (const alias of aliases[searchKey]) {
      found = columns.find((c) => normalize(c.name) === normalize(alias));
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract aggregation from query text
 * @param {string} query
 * @param {string} defaultAgg
 * @returns {string}
 */
function extractAggregation(query = "", defaultAgg = "avg") {
  const lower = query.toLowerCase();

  for (const [alias, canonical] of Object.entries(AGGREGATION_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }

  if (/average|mean/i.test(lower)) return "avg";
  if (/sum|total/i.test(lower)) return "sum";
  if (/max|highest/i.test(lower)) return "max";
  if (/min|lowest/i.test(lower)) return "min";
  if (/count|number of|records/i.test(lower)) return "count";
  if (/median/i.test(lower)) return "median";

  return defaultAgg;
}

/**
 * Detect chart type from query
 * @param {string} query
 * @returns {string}
 */
function detectChartType(query = "") {
  for (const [type, pattern] of Object.entries(CHART_TYPE_PATTERNS)) {
    if (pattern.test(query)) return type;
  }
  return "bar";
}

/**
 * Try to parse a simple chart query deterministically
 * Returns null if parsing is uncertain; lets AI handle it.
 * 
 * Examples:
 * - "Show average salary_usd by country" 
 *   → {metric: salary_usd, dimension: country, aggregation: avg, chartType: bar}
 * 
 * - "Create pie chart of country"
 *   → {dimension: country, chartType: donut, aggregation: count}
 * 
 * - "Show salary_usd distribution"
 *   → {metric: salary_usd, chartType: histogram}
 * 
 * - "Show experience vs salary_usd"
 *   → {x: experience, y: salary_usd, chartType: scatter}
 * 
 * @param {string} query
 * @param {object} schemaProfile
 * @returns {object|null} Canonical action or null
 */
export function parseCustomChartQuery(query = "", schemaProfile = {}) {
  if (!query || !schemaProfile?.columns?.length) return null;

  const lower = query.toLowerCase();
  const words = query.split(/[\s,;]+/).filter(Boolean);

  // Pattern 1: "Show [aggregation] [metric] by [dimension]"
  // Example: "show average salary_usd by country"
  const showByMatch = /show\s+(?:(\w+)\s+)?(\w+)\s+by\s+(\w+)/i.exec(query);
  if (showByMatch) {
    const aggWord = showByMatch[1];
    const metricWord = showByMatch[2];
    const dimensionWord = showByMatch[3];

    const metric = findColumnByFuzzyMatch(schemaProfile, metricWord);
    const dimension = findColumnByFuzzyMatch(schemaProfile, dimensionWord);

    if (metric && dimension) {
      return {
        action: "create_chart",
        chart_type: detectChartType(lower),
        title: `${aggWord || "Average"} ${metric.name || metricWord} by ${dimension.name || dimensionWord}`,
        x: dimension.name,
        y: metric.name,
        aggregation: extractAggregation(aggWord || query, metric.type === "number" ? "avg" : "count"),
      };
    }
  }

  // Pattern 2: "[metric] distribution" or "[metric] histogram"
  // Example: "salary_usd distribution"
  const distMatch = /(\w+)\s+(distribution|histogram)/i.exec(query);
  if (distMatch) {
    const metricWord = distMatch[1];
    const metric = findColumnByFuzzyMatch(schemaProfile, metricWord);

    if (metric && metric.type === "number") {
      return {
        action: "create_chart",
        chart_type: "histogram",
        title: `${metric.name} Distribution`,
        x: metric.name,
        y: metric.name,
        aggregation: "none",
      };
    }
  }

  // Pattern 3: "[dimension] pie/donut" or "pie chart of [dimension]"
  // Example: "Create pie chart of country" or "country pie"
  const pieMatch = /(?:(?:pie|donut)\s+(?:chart\s+)?of|create\s+(?:pie|donut)\s+chart\s+of|(\w+)\s+(?:pie|donut))/i.exec(query);
  if (pieMatch) {
    // Extract dimension name from the query
    let dimensionWord = null;
    if (pieMatch[1]) {
      dimensionWord = pieMatch[1];
    } else {
      // Try to find word after "of"
      const ofMatch = /of\s+(\w+)/i.exec(query);
      if (ofMatch) dimensionWord = ofMatch[1];
    }

    if (dimensionWord) {
      const dimension = findColumnByFuzzyMatch(schemaProfile, dimensionWord);
      if (dimension) {
        return {
          action: "create_chart",
          chart_type: "donut",
          title: `Records by ${dimension.name}`,
          x: dimension.name,
          y: "__row_count__",
          aggregation: "count",
        };
      }
    }
  }

  // Pattern 4: "[metric1] vs [metric2]" (scatter)
  // Example: "experience vs salary_usd"
  const vsMatch = /(\w+)\s+vs\s+(\w+)/i.exec(query);
  if (vsMatch) {
    const metric1Word = vsMatch[1];
    const metric2Word = vsMatch[2];

    const x = findColumnByFuzzyMatch(schemaProfile, metric1Word);
    const y = findColumnByFuzzyMatch(schemaProfile, metric2Word);

    if (x && y && x.type === "number" && y.type === "number") {
      return {
        action: "create_chart",
        chart_type: "scatter",
        title: `${x.name} vs ${y.name}`,
        x: x.name,
        y: y.name,
        aggregation: "none",
      };
    }
  }

  // Pattern 5: "Top [N] [dimension] by [metric]"
  // Example: "Top 10 countries by salary"
  const topMatch = /top\s+(\d+)?\s+(\w+)\s+by\s+(\w+)/i.exec(query);
  if (topMatch) {
    const limit = topMatch[1] ? Number(topMatch[1]) : 10;
    const dimensionWord = topMatch[2];
    const metricWord = topMatch[3];

    const dimension = findColumnByFuzzyMatch(schemaProfile, dimensionWord);
    const metric = findColumnByFuzzyMatch(schemaProfile, metricWord);

    if (metric && dimension) {
      return {
        action: "create_chart",
        chart_type: detectChartType(lower),
        title: `Top ${limit} ${dimension.name} by ${metric.name}`,
        x: dimension.name,
        y: metric.name,
        aggregation: extractAggregation(query, "avg"),
        limit,
        sort: "desc",
      };
    }
  }

  // Pattern 6: "KPI for [aggregation] [metric]"
  // Example: "Add KPI for highest salary_usd"
  const kpiMatch = /kpi\s+(?:for\s+)?(?:(\w+)\s+)?(\w+)/i.exec(query);
  if (kpiMatch) {
    const aggWord = kpiMatch[1];
    const metricWord = kpiMatch[2];

    const metric = findColumnByFuzzyMatch(schemaProfile, metricWord);
    if (metric) {
      return {
        action: "create_kpi",
        title: `${aggWord || "Total"} ${metric.name}`,
        metric: metric.name,
        aggregation: extractAggregation(aggWord || query, "sum"),
      };
    }
  }

  // Pattern 7: "[metric] by [dimension]" (bare form, default to bar + avg for numeric)
  // Example: "salary_usd by country"
  const bareByMatch = /(\w+)\s+by\s+(\w+)/i.exec(query);
  if (bareByMatch && !showByMatch) {
    // Avoid double-matching
    const metricWord = bareByMatch[1];
    const dimensionWord = bareByMatch[2];

    const metric = findColumnByFuzzyMatch(schemaProfile, metricWord);
    const dimension = findColumnByFuzzyMatch(schemaProfile, dimensionWord);

    if (metric && dimension) {
      const aggregation = metric.type === "number" ? "avg" : "count";
      return {
        action: "create_chart",
        chart_type: "bar",
        title: `${aggregation === "avg" ? "Average" : "Count"} ${metric.name} by ${dimension.name}`,
        x: dimension.name,
        y: metric.name,
        aggregation,
      };
    }
  }

  // Pattern 8: "Filter [column] = [value]"
  // Example: "Filter country = USA"
  const filterMatch = /filter\s+(\w+)\s*=\s*(\w+)/i.exec(query);
  if (filterMatch) {
    const columnWord = filterMatch[1];
    const columnValue = filterMatch[2];
    const column = findColumnByFuzzyMatch(schemaProfile, columnWord);

    if (column) {
      return {
        action: "filter",
        filters: {
          [column.name]: columnValue,
        },
      };
    }
  }

  // Uncertain pattern - let AI handle it
  return null;
}

/**
 * Normalize a raw action to canonical shape
 * Ensures x/y/aggregation are consistent before validation
 * 
 * @param {object} action
 * @returns {object} Normalized action
 */
export function normalizeChartAction(action = {}) {
  const normalized = { ...action };

  // Map old field names to canonical names
  if (normalized.xKey && !normalized.x) normalized.x = normalized.xKey;
  if (normalized.x && !normalized.xKey) normalized.xKey = normalized.x;

  if (normalized.yKey && !normalized.y) normalized.y = normalized.yKey;
  if (normalized.y && !normalized.yKey) normalized.yKey = normalized.y;

  if (normalized.metric && !normalized.y) normalized.y = normalized.metric;
  if (normalized.y && !normalized.metric && normalized.action !== "create_chart") normalized.metric = normalized.y;

  if (normalized.dimension && !normalized.x) normalized.x = normalized.dimension;
  if (normalized.x && !normalized.dimension) normalized.dimension = normalized.x;

  if (normalized.category && !normalized.x) normalized.x = normalized.category;
  if (normalized.x && !normalized.category) normalized.category = normalized.x;

  if (normalized.groupBy && !normalized.x) normalized.x = normalized.groupBy;

  // Normalize aggregation words
  if (normalized.aggregation) {
    const agg = String(normalized.aggregation).toLowerCase();
    normalized.aggregation = AGGREGATION_ALIASES[agg] || agg;
  }

  // Map old chart type names
  if (normalized.chart_type && !normalized.type) normalized.type = normalized.chart_type;
  if (normalized.type && !normalized.chart_type) normalized.chart_type = normalized.type;

  return normalized;
}

/**
 * Extract numeric and category columns from schema
 * For quick pattern detection
 * 
 * @param {object} schemaProfile
 * @returns {object}
 */
export function categorizeSchemaColumns(schemaProfile = {}) {
  const metrics = [];
  const categories = [];
  const dates = [];

  for (const column of schemaProfile.columns || []) {
    if (column.type === "number" || column.role?.includes("metric")) {
      metrics.push(column);
    } else if (column.type === "date" || column.role === "date") {
      dates.push(column);
    } else {
      categories.push(column);
    }
  }

  return { metrics, categories, dates };
}
