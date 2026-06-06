/**
 * custom-chart-query-parser.js
 *
 * Deterministic natural-language query parser for dashboard actions.
 * Runs BEFORE the AI model to resolve clear chart/filter/KPI intents
 * directly from the schema, avoiding hallucinations on column names.
 *
 * Usage:
 *   import { parseCustomChartQuery } from './custom-chart-query-parser.js';
 *   const action = parseCustomChartQuery(userQuery, schemaProfile);
 *   if (action) {
 *     // Use action directly — skip AI for this query
 *   }
 */

// ---------------------------------------------------------------------------
// Chart type keyword maps
// ---------------------------------------------------------------------------
const CHART_TYPE_KEYWORDS = {
  bar: ['bar chart', 'bar graph', 'bar plot', 'column chart', 'grouped bar'],
  horizontal_bar: ['horizontal bar', 'horizontal chart', 'hbar'],
  line: ['line chart', 'line graph', 'line plot', 'trend', 'over time', 'time series'],
  area: ['area chart', 'area graph', 'area plot', 'stacked area'],
  pie: ['pie chart', 'pie graph', 'pie plot', 'proportion', 'share', 'breakdown'],
  donut: ['donut chart', 'doughnut chart', 'donut graph'],
  scatter: ['scatter', 'scatter plot', 'scatterplot', 'correlation', 'vs', 'versus', 'against', 'relationship between'],
  histogram: ['histogram', 'distribution', 'frequency', 'spread'],
  map: ['map', 'geo map', 'geographic', 'choropleth', 'world map', 'country map'],
};

// Aggregation aliases → canonical name
const AGGREGATION_ALIASES = {
  average: 'avg',
  mean: 'avg',
  avg: 'avg',
  total: 'sum',
  sum: 'sum',
  count: 'count',
  number: 'count',
  minimum: 'min',
  min: 'min',
  maximum: 'max',
  max: 'max',
  median: 'median',
  unique: 'count_unique',
  distinct: 'count_unique',
  count_unique: 'count_unique',
};

// Preposition patterns used in "show X by Y", "show X vs Y", etc.
const BY_PREPOSITIONS = /\bby\b|\bper\b|\bfor each\b|\bfor every\b|\bgrouped by\b|\bbroken down by\b/i;
const VS_PREPOSITIONS = /\bvs\.?\b|\bversus\b|\bagainst\b|\bcompared to\b|\band\b/i;
const SHOW_VERBS = /\b(show|display|plot|draw|create|generate|visualize|chart|graph|make)\b/i;
const FILTER_VERBS = /\b(filter|where|only|include|exclude|limit to|restrict to|find|search)\b/i;
const KPI_VERBS = /\b(total|sum of|average|avg of|count of|mean|max|maximum|min|minimum|how many|how much|what is the)\b/i;

// ---------------------------------------------------------------------------
// Column fuzzy matcher
// ---------------------------------------------------------------------------

/**
 * Normalize a string for fuzzy matching: lowercase, strip punctuation/spaces.
 */
function normalizeToken(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Find the best-matching column name from schemaProfile given a raw token.
 * Returns the real column name (preserving original casing) or null.
 *
 * @param {string} token - A word or phrase from the user query
 * @param {import('../ai-analyst/schema-fingerprint.js').SchemaProfile} schemaProfile
 * @returns {string|null}
 */
export function findColumnMatch(token, schemaProfile) {
  if (!token || !schemaProfile?.columns?.length) return null;

  const normToken = normalizeToken(token);
  if (!normToken) return null;

  const columns = schemaProfile.columns;

  // 1. Exact name match
  const exact = columns.find((c) => normalizeToken(c.name) === normToken);
  if (exact) return exact.name;

  // 2. Exact normalizedName match
  const normalized = columns.find((c) => normalizeToken(c.normalizedName) === normToken);
  if (normalized) return normalized.name;

  // 3. Prefix / contains match — prefer the shortest column name that contains token
  const contains = columns
    .filter((c) => normalizeToken(c.name).includes(normToken))
    .sort((a, b) => a.name.length - b.name.length);
  if (contains.length) return contains[0].name;

  return null;
}

// ---------------------------------------------------------------------------
// Chart type detector
// ---------------------------------------------------------------------------

/**
 * Detect chart type from the raw query text.
 * Returns a canonical chart type string or null.
 *
 * @param {string} query
 * @returns {string|null}
 */
export function detectChartType(query) {
  const lower = query.toLowerCase();
  for (const [type, keywords] of Object.entries(CHART_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aggregation detector
// ---------------------------------------------------------------------------

/**
 * Detect aggregation intent from the query.
 * Returns a canonical aggregation string or null.
 *
 * @param {string} query
 * @returns {string|null}
 */
export function detectAggregation(query) {
  const lower = query.toLowerCase();
  for (const [alias, canonical] of Object.entries(AGGREGATION_ALIASES)) {
    // Match as a whole word
    const pattern = new RegExp(`\\b${alias}\\b`);
    if (pattern.test(lower)) return canonical;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Column extractor: splits query into candidate tokens and matches against schema
// ---------------------------------------------------------------------------

/**
 * Extract up to two column candidates from a query given a schema.
 * Tries multi-word and single-word tokens.
 *
 * @param {string} query
 * @param {object} schemaProfile
 * @returns {{ left: string|null, right: string|null }}
 */
function extractColumnCandidates(query, schemaProfile) {
  // 1. Try splitting around prepositions first (on the raw query so prepositions aren't stripped)
  const bySplit = query.split(BY_PREPOSITIONS).map((s) => s.trim()).filter(Boolean);
  const vsSplit = query.split(VS_PREPOSITIONS).map((s) => s.trim()).filter(Boolean);

  // Use whichever split gives two distinct parts
  const parts = bySplit.length >= 2 ? bySplit : vsSplit.length >= 2 ? vsSplit : [query];

  // Helper to strip noise words and find the best column match
  function cleanAndMatch(phrase) {
    const cleaned = phrase
      .replace(SHOW_VERBS, '')
      .replace(FILTER_VERBS, '')
      .replace(KPI_VERBS, '')
      .replace(/\b(chart|graph|plot|map|histogram|distribution|the|a|an|of|for|in|with|and|or|by|per|each)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const tokens = cleaned.split(/\s+/).filter(Boolean);
    // Try full phrase, then decreasing n-grams
    for (let len = tokens.length; len >= 1; len--) {
      for (let start = 0; start <= tokens.length - len; start++) {
        const candidate = tokens.slice(start, start + len).join(' ');
        const match = findColumnMatch(candidate, schemaProfile);
        if (match) return match;
      }
    }
    return null;
  }

  const left = parts[0] ? cleanAndMatch(parts[0]) : null;
  const right = parts[1] ? cleanAndMatch(parts[1]) : null;

  return { left, right };
}

// ---------------------------------------------------------------------------
// Column role helpers (mirrors chat-agent.js logic)
// ---------------------------------------------------------------------------

const METRIC_ROLES = new Set(['money_metric', 'score_metric', 'continuous_metric', 'count_metric', 'rate_metric']);
const CATEGORY_ROLES = new Set(['category', 'location', 'target', 'numeric_category']);

function isMetric(col) {
  return col && (col.type === 'number' || METRIC_ROLES.has(col.role));
}

function isCategory(col) {
  return col && (CATEGORY_ROLES.has(col.role) || col.type === 'category' || col.type === 'boolean' || col.type === 'string' || col.role === 'dimension');
}

function isDate(col) {
  return col && (col.type === 'date' || col.role === 'date' || /date|time|month|year|created|updated/i.test(col.name || ''));
}

function isGeo(col) {
  return col && (col.role === 'location' || /country|state|city|region|territory|province|location|market/i.test(col.name || ''));
}

function getColumn(schemaProfile, name) {
  if (!name) return null;
  return (schemaProfile?.columns || []).find((c) => c.name === name) || null;
}

// ---------------------------------------------------------------------------
// Chart type auto-selection based on column roles
// ---------------------------------------------------------------------------

/**
 * Given two matched columns (or one), pick the most suitable chart type.
 *
 * @param {object|null} xCol
 * @param {object|null} yCol
 * @param {string|null} explicit - User-specified chart type (already detected)
 * @returns {string}
 */
function inferChartType(xCol, yCol, explicit) {
  if (explicit) return explicit;
  if (!xCol) return 'bar';

  if (isGeo(xCol) && (!yCol || yCol === 'count')) return 'map';
  if (isDate(xCol)) return 'line';
  if (isMetric(xCol) && isMetric(yCol)) return 'scatter';
  if (isCategory(xCol) && isMetric(yCol)) return 'bar';
  if (isCategory(xCol) && !yCol) return 'pie';
  return 'bar';
}

// ---------------------------------------------------------------------------
// Filter intent parser
// ---------------------------------------------------------------------------

const FILTER_PATTERN = /\b(?:filter|where|only|find)\s+(\w[\w\s]*?)\s*(?:=|is|equals?|==)\s*["']?([^"',]+)["']?/i;
const EXCLUDE_PATTERN = /\bexclude\s+(\w[\w\s]*?)\s*(?:=|is|equals?|==)\s*["']?([^"',]+)["']?/i;

/**
 * Try to parse a filter intent from a query.
 *
 * @param {string} query
 * @param {object} schemaProfile
 * @returns {object|null}
 */
function tryParseFilter(query, schemaProfile) {
  const match = FILTER_PATTERN.exec(query) || EXCLUDE_PATTERN.exec(query);
  if (!match) return null;

  const rawColumn = match[1].trim();
  const value = match[2].trim();
  const colName = findColumnMatch(rawColumn, schemaProfile);
  if (!colName) return null;

  return {
    action: 'filter',
    filters: { [colName]: value },
    schema_safe: true,
    _parsed_by: 'custom-chart-query-parser',
  };
}

// ---------------------------------------------------------------------------
// KPI intent parser
// ---------------------------------------------------------------------------

const KPI_PATTERN = /\b(?:total|sum|average|avg|mean|count|max|maximum|min|minimum|unique|distinct)\s+(?:of\s+)?(\w[\w\s]*)/i;

/**
 * Try to parse a KPI intent from a query.
 *
 * @param {string} query
 * @param {object} schemaProfile
 * @returns {object|null}
 */
function tryParseKpi(query, schemaProfile) {
  const match = KPI_PATTERN.exec(query);
  if (!match) return null;

  const aggRaw = match[0].split(/\s+/)[0].toLowerCase();
  const aggregation = AGGREGATION_ALIASES[aggRaw] || 'count';
  const rawMetric = match[1].trim();

  const colName = findColumnMatch(rawMetric, schemaProfile);
  if (!colName) return null;

  const col = getColumn(schemaProfile, colName);
  if (col && !isMetric(col) && aggregation !== 'count' && aggregation !== 'count_unique') return null;

  return {
    action: 'create_kpi',
    metric: colName,
    aggregation,
    title: `${aggRaw.charAt(0).toUpperCase() + aggRaw.slice(1)} of ${colName}`,
    schema_safe: true,
    _parsed_by: 'custom-chart-query-parser',
  };
}

// ---------------------------------------------------------------------------
// Main export: parseCustomChartQuery
// ---------------------------------------------------------------------------

/**
 * Try to deterministically parse a user query into a dashboard action.
 *
 * Returns a fully-formed action object if the query is unambiguous, or null
 * if the query is too complex / ambiguous and should be forwarded to the AI.
 *
 * @param {string} query - Raw user query text
 * @param {object} schemaProfile - Schema profile from buildSchemaProfile()
 * @returns {object|null} A dashboard action or null
 */
export function parseCustomChartQuery(query, schemaProfile) {
  if (!query || typeof query !== 'string') return null;
  if (!schemaProfile?.columns?.length) return null;

  const q = query.trim();

  // 1. Filter intent?
  if (FILTER_VERBS.test(q)) {
    const filterAction = tryParseFilter(q, schemaProfile);
    if (filterAction) return filterAction;
  }

  // 2. KPI intent? (before chart, as "total salary" could match chart too)
  if (KPI_VERBS.test(q) && !SHOW_VERBS.test(q)) {
    const kpiAction = tryParseKpi(q, schemaProfile);
    if (kpiAction) return kpiAction;
  }

  // 3. Chart intent
  const { left, right } = extractColumnCandidates(q, schemaProfile);
  if (!left && !right) return null; // Can't resolve any column → fall back to AI

  let xCol = getColumn(schemaProfile, left);
  let yCol = getColumn(schemaProfile, right);
  let finalLeft = left;
  let finalRight = right;

  // Smart swap: if left is a metric and right is a category, swap them so category is on X and metric is on Y
  if (isMetric(xCol) && isCategory(yCol)) {
    finalLeft = right;
    finalRight = left;
    const temp = xCol;
    xCol = yCol;
    yCol = temp;
  }

  const explicitType = detectChartType(q);
  const chartType = inferChartType(xCol, yCol, explicitType);
  
  let aggregation = detectAggregation(q);
  if (!aggregation) {
    if (yCol && isMetric(yCol)) {
      if (yCol.role === 'money_metric' || yCol.role === 'count_metric' || /revenue|sales|profit|quantity|discount|orders|customers/i.test(yCol.name || '')) {
        aggregation = 'sum';
      } else {
        aggregation = 'avg';
      }
    } else {
      aggregation = 'count';
    }
  }

  // For scatter, both must be metrics
  if (chartType === 'scatter') {
    if (!isMetric(xCol) || !isMetric(yCol)) return null; // Can't safely resolve → AI
  }

  // Build the action
  const action = {
    action: 'create_chart',
    chart_type: chartType,
    x: finalLeft || undefined,
    y: finalRight || 'count',
    xKey: finalLeft || undefined,
    yKey: finalRight || 'count',
    aggregation,
    title: buildTitle(q, finalLeft, finalRight, chartType, aggregation),
    schema_safe: true,
    _parsed_by: 'custom-chart-query-parser',
  };

  if (process.env.DEBUG_CHART_VALIDATION === '1') {
    console.log('[custom-chart-query-parser] Parsed action:', JSON.stringify(action, null, 2));
  }

  return action;
}

// ---------------------------------------------------------------------------
// Utility: generate a readable chart title
// ---------------------------------------------------------------------------

function buildTitle(query, xCol, yCol, chartType, aggregation) {
  if (xCol && yCol && yCol !== 'count') {
    const aggLabel = aggregation === 'avg' ? 'Average' : aggregation === 'sum' ? 'Total' : aggregation.charAt(0).toUpperCase() + aggregation.slice(1);
    return `${aggLabel} ${yCol} by ${xCol}`;
  }
  if (xCol && (!yCol || yCol === 'count')) {
    return `${xCol} Distribution`;
  }
  // Fallback: capitalize first 60 chars of query
  return query.slice(0, 60).replace(/^\w/, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// normalizeChartAction — ensures both x/xKey and y/yKey are populated
// Call this on any action (AI or parser-generated) before Guardian validation
// ---------------------------------------------------------------------------

/**
 * Normalizes chart action field aliases so that both `x/xKey` and `y/yKey`
 * are consistently set, preventing Guardian from failing on missing fields.
 *
 * @param {object} action
 * @returns {object}
 */
export function normalizeChartAction(action = {}) {
  const x = action.xKey || action.x || action.column || undefined;
  const y = action.yKey || action.y || action.metric || 'count';
  const type = action.chart_type || action.type || 'bar';

  return {
    ...action,
    x,
    y,
    xKey: x,
    yKey: y,
    chart_type: type,
    type,
    aggregation: action.aggregation || (y && y !== 'count' ? 'avg' : 'count'),
  };
}

// ---------------------------------------------------------------------------
// categorizeSchemaColumns — quick column classifier for external use
// ---------------------------------------------------------------------------

/**
 * Returns a categorized summary of schema columns by role class.
 *
 * @param {object} schemaProfile
 * @returns {{ metrics: string[], categories: string[], dates: string[], geo: string[], other: string[] }}
 */
export function categorizeSchemaColumns(schemaProfile) {
  const cols = schemaProfile?.columns || [];
  return {
    metrics: cols.filter(isMetric).map((c) => c.name),
    categories: cols.filter((c) => isCategory(c) && !isGeo(c)).map((c) => c.name),
    dates: cols.filter(isDate).map((c) => c.name),
    geo: cols.filter(isGeo).map((c) => c.name),
    other: cols.filter((c) => !isMetric(c) && !isCategory(c) && !isDate(c) && !isGeo(c)).map((c) => c.name),
  };
}
