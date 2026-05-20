import type {
  Aggregation,
  ChartSpec,
  ChartType,
  KpiSpec,
} from "@/features/dashboard/types/dashboardTypes";

export type RowValue = string | number | boolean | null | undefined;
export type Row = Record<string, RowValue>;

export type ColumnType = "number" | "string" | "date" | "boolean" | "unknown";
export type ColumnRole =
  | "metric"
  | "category"
  | "date"
  | "id"
  | "location"
  | "boolean"
  | "text";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface DashboardFilterCondition {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface DashboardFilters {
  [key: string]: unknown;
  conditions?: DashboardFilterCondition[];
  dateStart?: string;
  dateEnd?: string;
}

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  role: ColumnRole;
  uniqueCount: number;
  missingCount: number;
  missingPct: number;
  sampleValues: string[];
}

export interface DatasetProfile {
  columns: ColumnProfile[];
  totalRows: number;
  primaryMetric?: ColumnProfile;
  secondaryMetric?: ColumnProfile;
  primaryCategory?: ColumnProfile;
  secondaryCategory?: ColumnProfile;
  dateColumn?: ColumnProfile;
  locationColumn?: ColumnProfile;
  numericColumns: ColumnProfile[];
  categoryColumns: ColumnProfile[];
}

export interface DashboardChart extends ChartSpec {
  id: string;
  subtitle: string;
  data: Array<Record<string, string | number>>;
  warning?: string;
}

export interface DashboardKpi extends KpiSpec {
  id: string;
  value: string;
  rawValue: number | string;
  subtitle: string;
  status?: "good" | "warning" | "critical";
  insight?: string;
}

export interface DataQualityScore {
  totalRows: number;
  totalColumns: number;
  missingCells: number;
  duplicateRows: number;
  validRows: number;
  numericColumns: number;
  textColumns: number;
  categoricalColumns: number;
  dateColumns: number;
  booleanColumns: number;
  completeness: number;
  consistency: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
  finalScore: number;
}

export interface InsightCard {
  id: string;
  title: string;
  description: string;
  tone: "good" | "warning" | "critical" | "info";
}

const METRIC_HINTS = [
  "salary",
  "revenue",
  "amount",
  "value",
  "score",
  "marks",
  "stress",
  "anxiety",
  "rating",
  "profit",
  "sales",
  "cost",
  "price",
  "income",
];

const CATEGORY_HINTS = [
  "country",
  "region",
  "product",
  "education",
  "department",
  "gender",
  "platform",
  "status",
  "name",
  "category",
  "segment",
  "city",
  "state",
];

const LOCATION_HINTS = ["country", "region", "state", "city", "location", "market"];

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[\ufeff\s]+/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function isMissing(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isDateLike(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || !/\d/.test(text)) return false;
  return Number.isFinite(Date.parse(text));
}

function isBooleanLike(value: unknown) {
  if (typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  return ["true", "false", "yes", "no", "0", "1"].includes(value.trim().toLowerCase());
}

function formatMetric(value: number | string, format: KpiSpec["format"] = "number") {
  if (typeof value === "string") return value;
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === "percent") {
    return `${round(value, 1)}%`;
  }
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[^0-9.+-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "nan") {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanDatasetRows(rows: Row[] = []) {
  return rows.filter((row) => {
    if (!row || typeof row !== "object") return false;

    const keys = Object.keys(row).map(normalizeName);
    const sourceFile = String(row._source_file ?? row._sourceFile ?? row.source ?? "").toLowerCase();
    const schemaShape =
      keys.includes("column") &&
      (keys.includes("type") || keys.includes("data_type")) &&
      (keys.includes("description") || keys.includes("definition"));

    return !schemaShape && !sourceFile.includes("dictionary");
  });
}

export function inferColumnTypes(rows: Row[] = []) {
  const columnNames = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row || {})).filter((key) => !key.startsWith("__"))),
  );

  return Object.fromEntries(
    columnNames.map((name) => {
      const values = rows.map((row) => row[name]).filter((value) => !isMissing(value)).slice(0, 500);
      if (!values.length) return [name, "unknown" satisfies ColumnType];

      const numericRatio = values.filter((value) => safeNumber(value) !== null).length / values.length;
      const dateRatio = values.filter((value) => isDateLike(value)).length / values.length;
      const booleanRatio = values.filter((value) => isBooleanLike(value)).length / values.length;

      let type: ColumnType = "string";
      if (numericRatio >= 0.85) type = "number";
      else if (dateRatio >= 0.75) type = "date";
      else if (booleanRatio >= 0.9) type = "boolean";

      return [name, type];
    }),
  ) as Record<string, ColumnType>;
}

export function inferColumnRoles(
  rows: Row[] = [],
  columnTypes = inferColumnTypes(rows),
) {
  const totalRows = rows.length || 1;

  return Object.fromEntries(
    Object.entries(columnTypes).map(([name, type]) => {
      const normalized = normalizeName(name);
      const values = rows.map((row) => row[name]).filter((value) => !isMissing(value));
      const uniqueCount = new Set(values.map((value) => String(value).trim())).size;

      let role: ColumnRole = "text";

      if (/^(id|uuid|row_id|index|serial|sr_no)$/.test(normalized) || normalized.endsWith("_id")) {
        role = "id";
      } else if (type === "date" || /date|time|year|month|created|updated/.test(normalized)) {
        role = "date";
      } else if (LOCATION_HINTS.some((hint) => normalized.includes(hint))) {
        role = "location";
      } else if (type === "boolean") {
        role = "boolean";
      } else if (type === "number") {
        role = uniqueCount <= Math.max(12, totalRows * 0.04) ? "category" : "metric";
      } else if (uniqueCount <= Math.max(30, totalRows * 0.2)) {
        role = "category";
      }

      return [name, role];
    }),
  ) as Record<string, ColumnRole>;
}

export interface InferredColumns {
  types: Record<string, ColumnType>;
  roles: Record<string, ColumnRole>;
}

export function inferColumns(rows: Row[]): InferredColumns {
  const types = inferColumnTypes(rows);
  const roles = inferColumnRoles(rows, types);
  return { types, roles };
}

export interface PickedColumns {
  dimension?: ColumnProfile;
  secondDimension?: ColumnProfile;
  metric?: ColumnProfile;
  secondMetric?: ColumnProfile;
  date?: ColumnProfile;
}

export function pickColumns(rows: Row[]): PickedColumns {
  const profile = buildDatasetProfile(rows);
  return {
    dimension: profile.primaryCategory,
    secondDimension: profile.secondaryCategory,
    metric: profile.primaryMetric,
    secondMetric: profile.secondaryMetric,
    date: profile.dateColumn,
  };
}

export const uniqueValues = getUniqueValues;

export function getUniqueValues(rows: Row[], column: string, limit = 8) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = String(row[column] ?? "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function buildColumnProfiles(rows: Row[]) {
  const types = inferColumnTypes(rows);
  const roles = inferColumnRoles(rows, types);

  return Object.keys(types).map((name) => {
    const values = rows.map((row) => row[name]);
    const present = values.filter((value) => !isMissing(value));
    const missingCount = values.length - present.length;

    return {
      name,
      type: types[name],
      role: roles[name],
      uniqueCount: new Set(present.map((value) => String(value).trim())).size,
      missingCount,
      missingPct: rows.length ? round((missingCount / rows.length) * 100, 1) : 0,
      sampleValues: getUniqueValues(rows, name, 5),
    } satisfies ColumnProfile;
  });
}

export function buildDatasetProfile(rows: Row[] = []): DatasetProfile {
  const cleanRows = cleanDatasetRows(rows);
  const columns = buildColumnProfiles(cleanRows);
  const numericColumns = columns.filter((column) => column.role === "metric");
  const categoryColumns = columns.filter((column) =>
    ["category", "location", "boolean"].includes(column.role),
  );

  const primaryMetric =
    numericColumns.find((column) =>
      METRIC_HINTS.some((hint) => normalizeName(column.name).includes(hint)),
    ) || numericColumns[0];
  const secondaryMetric = numericColumns.find((column) => column.name !== primaryMetric?.name);
  const primaryCategory =
    categoryColumns.find((column) =>
      CATEGORY_HINTS.some((hint) => normalizeName(column.name).includes(hint)),
    ) || categoryColumns[0];
  const secondaryCategory = categoryColumns.find((column) => column.name !== primaryCategory?.name);
  const dateColumn = columns.find((column) => column.role === "date");
  const locationColumn = columns.find((column) => column.role === "location");

  return {
    columns,
    totalRows: cleanRows.length,
    primaryMetric,
    secondaryMetric,
    primaryCategory,
    secondaryCategory,
    dateColumn,
    locationColumn,
    numericColumns,
    categoryColumns,
  };
}

export function applyFilters(rows: Row[], filters: DashboardFilters = {}) {
  const conditions = filters.conditions || [];

  return rows.filter((row) => {
    for (const [key, rawValue] of Object.entries(filters)) {
      if (
        key === "conditions" ||
        key === "dateStart" ||
        key === "dateEnd" ||
        rawValue === undefined ||
        rawValue === ""
      ) {
        continue;
      }

      const cell = String(row[key] ?? "").toLowerCase();
      const expected = String(rawValue).toLowerCase();

      if (cell !== expected) return false;
    }

    for (const condition of conditions) {
      const rawCell = row[condition.column];
      const cellText = String(rawCell ?? "").toLowerCase();
      const compareText = condition.value.toLowerCase();
      const cellNumber = safeNumber(rawCell);
      const compareNumber = safeNumber(condition.value);

      if (condition.operator === "equals" && cellText !== compareText) return false;
      if (condition.operator === "not_equals" && cellText === compareText) return false;
      if (condition.operator === "contains" && !cellText.includes(compareText)) return false;
      if (condition.operator === "gt" && !(cellNumber !== null && compareNumber !== null && cellNumber > compareNumber)) return false;
      if (condition.operator === "gte" && !(cellNumber !== null && compareNumber !== null && cellNumber >= compareNumber)) return false;
      if (condition.operator === "lt" && !(cellNumber !== null && compareNumber !== null && cellNumber < compareNumber)) return false;
      if (condition.operator === "lte" && !(cellNumber !== null && compareNumber !== null && cellNumber <= compareNumber)) return false;
    }

    const dateKey = Object.keys(row).find((key) => /date|time|year|month/i.test(key));
    if (dateKey && (filters.dateStart || filters.dateEnd)) {
      const dateValue = new Date(String(row[dateKey] ?? "")).getTime();
      if (!Number.isFinite(dateValue)) return false;
      if (filters.dateStart && dateValue < new Date(filters.dateStart).getTime()) return false;
      if (filters.dateEnd && dateValue > new Date(filters.dateEnd).getTime()) return false;
    }

    return true;
  });
}

export function sum(values: unknown[]) {
  return round(
    values
      .map((value) => safeNumber(value))
      .filter((value): value is number => value !== null)
      .reduce((total, value) => total + value, 0),
  );
}

export function average(values: unknown[]) {
  const numeric = values
    .map((value) => safeNumber(value))
    .filter((value): value is number => value !== null);
  return numeric.length ? round(sum(numeric) / numeric.length) : 0;
}

export function median(values: unknown[]) {
  const numeric = values
    .map((value) => safeNumber(value))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  if (!numeric.length) return 0;
  const middle = Math.floor(numeric.length / 2);
  return numeric.length % 2
    ? round(numeric[middle])
    : round((numeric[middle - 1] + numeric[middle]) / 2);
}

export function min(values: unknown[]) {
  const numeric = values
    .map((value) => safeNumber(value))
    .filter((value): value is number => value !== null);
  return numeric.length ? round(Math.min(...numeric)) : 0;
}

export function max(values: unknown[]) {
  const numeric = values
    .map((value) => safeNumber(value))
    .filter((value): value is number => value !== null);
  return numeric.length ? round(Math.max(...numeric)) : 0;
}

export function countUnique(values: unknown[]) {
  return new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  ).size;
}

function aggregateValues(values: unknown[], aggregation: Aggregation | "count_unique") {
  if (aggregation === "count") {
    return values.filter((value) => !isMissing(value)).length;
  }
  if (aggregation === "sum") return sum(values);
  if (aggregation === "avg") return average(values);
  if (aggregation === "min") return min(values);
  if (aggregation === "max") return max(values);
  if (aggregation === "median") return median(values);
  return countUnique(values);
}

export function groupByAggregate(
  rows: Row[],
  xKey: string,
  yKey: string,
  aggregation: Aggregation,
  limit = 10,
) {
  const groups = new Map<string, unknown[]>();

  for (const row of rows) {
    const label = String(row[xKey] ?? "Unknown").trim() || "Unknown";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)?.push(aggregation === "count" ? label : row[yKey]);
  }

  return Array.from(groups.entries())
    .map(([label, values]) => ({
      [xKey]: label,
      [aggregation === "count" ? "count" : yKey]: round(aggregateValues(values, aggregation)),
    }))
    .sort((left, right) => Number(Object.values(right).at(-1) ?? 0) - Number(Object.values(left).at(-1) ?? 0))
    .slice(0, limit);
}

export function buildHistogram(rows: Row[], key: string, bins = 8) {
  const values = rows
    .map((row) => safeNumber(row[key]))
    .filter((value): value is number => value !== null);

  if (!values.length) return [];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (minValue === maxValue) {
    return [{ range: String(minValue), count: values.length }];
  }

  const step = (maxValue - minValue) / bins;
  const buckets = Array.from({ length: bins }, (_, index) => ({
    start: minValue + index * step,
    end: index === bins - 1 ? maxValue : minValue + (index + 1) * step,
    count: 0,
  }));

  for (const value of values) {
    const bucketIndex = Math.min(Math.floor((value - minValue) / step), bins - 1);
    buckets[bucketIndex].count += 1;
  }

  return buckets.map((bucket) => ({
    range: `${round(bucket.start)}-${round(bucket.end)}`,
    count: bucket.count,
  }));
}

export function buildScatterData(rows: Row[], xKey: string, yKey: string, limit = 250) {
  const validRows = rows
    .map((row, index) => ({
      [xKey]: safeNumber(row[xKey]),
      [yKey]: safeNumber(row[yKey]),
      index: index + 1,
    }))
    .filter(
      (row): row is Record<string, number> =>
        typeof row[xKey] === "number" && typeof row[yKey] === "number",
    );

  if (validRows.length <= limit) return validRows;

  const step = Math.max(Math.floor(validRows.length / limit), 1);
  return validRows.filter((_, index) => index % step === 0).slice(0, limit);
}

export function buildCorrelationMatrix(rows: Row[], numericColumns?: string[]) {
  const profile = buildDatasetProfile(rows);
  const columns = numericColumns?.length
    ? numericColumns
    : profile.numericColumns.map((column) => column.name).slice(0, 6);

  const correlation = (leftKey: string, rightKey: string) => {
    const paired = rows
      .map((row) => [safeNumber(row[leftKey]), safeNumber(row[rightKey])] as const)
      .filter((pair): pair is readonly [number, number] => pair[0] !== null && pair[1] !== null);

    if (paired.length < 2) return 0;

    const leftValues = paired.map((pair) => pair[0]);
    const rightValues = paired.map((pair) => pair[1]);
    const leftMean = average(leftValues);
    const rightMean = average(rightValues);

    let numerator = 0;
    let leftVariance = 0;
    let rightVariance = 0;

    paired.forEach(([left, right]) => {
      numerator += (left - leftMean) * (right - rightMean);
      leftVariance += (left - leftMean) ** 2;
      rightVariance += (right - rightMean) ** 2;
    });

    const denominator = Math.sqrt(leftVariance * rightVariance);
    return denominator ? round(numerator / denominator, 2) : 0;
  };

  return columns.flatMap((xKey) =>
    columns.map((yKey) => ({
      x: xKey,
      y: yKey,
      value: xKey === yKey ? 1 : correlation(xKey, yKey),
    })),
  );
}

function inferValidityScore(rows: Row[], columns: ColumnProfile[]) {
  if (!rows.length || !columns.length) return 100;

  let validChecks = 0;
  let totalChecks = 0;

  for (const column of columns) {
    if (!["number", "date", "boolean"].includes(column.type)) continue;

    for (const row of rows) {
      const value = row[column.name];
      if (isMissing(value)) continue;
      totalChecks += 1;

      if (
        (column.type === "number" && safeNumber(value) !== null) ||
        (column.type === "date" && isDateLike(value)) ||
        (column.type === "boolean" && isBooleanLike(value))
      ) {
        validChecks += 1;
      }
    }
  }

  return totalChecks ? round((validChecks / totalChecks) * 100, 1) : 100;
}

export function buildDataQualityScore(rows: Row[] = []) {
  const cleanRows = cleanDatasetRows(rows);
  const profile = buildDatasetProfile(cleanRows);
  const totalColumns = profile.columns.length;
  const totalRows = cleanRows.length;
  const totalCells = totalRows * Math.max(totalColumns, 1);
  const missingCells = profile.columns.reduce((total, column) => total + column.missingCount, 0);
  const duplicateRows = (() => {
    const signatures = new Map<string, number>();
    cleanRows.forEach((row) => {
      const signature = JSON.stringify(row);
      signatures.set(signature, (signatures.get(signature) || 0) + 1);
    });
    return Array.from(signatures.values())
      .filter((count) => count > 1)
      .reduce((total, count) => total + count - 1, 0);
  })();

  const completeness = totalCells ? round(((totalCells - missingCells) / totalCells) * 100, 1) : 100;
  const uniqueness = totalRows ? round(((totalRows - duplicateRows) / totalRows) * 100, 1) : 100;
  const validity = inferValidityScore(cleanRows, profile.columns);
  const consistency = round((completeness + validity) / 2, 1);
  const timeliness = profile.dateColumn ? validity : 100;
  const finalScore = round(
    completeness * 0.35 +
      uniqueness * 0.2 +
      validity * 0.2 +
      consistency * 0.15 +
      timeliness * 0.1,
    1,
  );

  return {
    totalRows,
    totalColumns,
    missingCells,
    duplicateRows,
    validRows: Math.max(totalRows - duplicateRows, 0),
    numericColumns: profile.numericColumns.length,
    textColumns: profile.columns.filter((column) => column.type === "string").length,
    categoricalColumns: profile.categoryColumns.length,
    dateColumns: profile.columns.filter((column) => column.type === "date").length,
    booleanColumns: profile.columns.filter((column) => column.type === "boolean").length,
    completeness,
    consistency,
    validity,
    uniqueness,
    timeliness,
    finalScore,
  } satisfies DataQualityScore;
}

function buildTrendData(rows: Row[], xKey: string, yKey: string, aggregation: Aggregation = "sum") {
  const groups = new Map<string, unknown[]>();

  for (const row of rows) {
    const raw = row[xKey];
    const label = xKey === "__row_index__"
      ? String(row.__row_index__ ?? "")
      : isDateLike(raw)
      ? new Date(String(raw)).toISOString().slice(0, 10)
      : String(raw ?? "");
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)?.push(row[yKey]);
  }

  return Array.from(groups.entries())
    .map(([label, values]) => ({
      [xKey]: label,
      [yKey]: round(aggregateValues(values, aggregation)),
    }))
    .sort((left, right) => String(left[xKey]).localeCompare(String(right[xKey])))
    .slice(-24);
}

function buildRowIndexRows(rows: Row[]) {
  return rows.map((row, index) => ({
    ...row,
    __row_index__: index + 1,
  }));
}

function makeChart(spec: ChartSpec, data: Array<Record<string, string | number>>, warning?: string): DashboardChart {
  return {
    id: crypto.randomUUID(),
    ...spec,
    subtitle: `${spec.aggregation.toUpperCase()} - ${titleCase(spec.xKey)} vs ${titleCase(spec.yKey)}`,
    data,
    warning,
  };
}

export function buildChartFromSpec(rows: Row[], chartSpec: ChartSpec): DashboardChart {
  const withIndex = buildRowIndexRows(cleanDatasetRows(rows));
  const limit = chartSpec.limit ?? 10;
  const xKey = chartSpec.xKey || "__row_index__";
  const yKey = chartSpec.yKey || "count";

  if (!withIndex.length) {
    return makeChart(chartSpec, [], "Not enough data to render this chart.");
  }

  if (chartSpec.type === "histogram") {
    return makeChart(
      { ...chartSpec, xKey: "range", yKey: "count" },
      buildHistogram(withIndex, yKey === "count" ? xKey : yKey),
      undefined,
    );
  }

  if (chartSpec.type === "scatter") {
    return makeChart(chartSpec, buildScatterData(withIndex, xKey, yKey, 240));
  }

  if (chartSpec.type === "heatmap") {
    return makeChart(chartSpec, buildCorrelationMatrix(withIndex));
  }

  if (chartSpec.type === "line" || chartSpec.type === "area") {
    const resolvedXKey = xKey === "__row_index__" ? "__row_index__" : xKey;
    const trendRows = buildTrendData(withIndex, resolvedXKey, yKey, chartSpec.aggregation);
    return makeChart({ ...chartSpec, xKey: resolvedXKey }, trendRows);
  }

  return makeChart(
    chartSpec,
    groupByAggregate(withIndex, xKey, yKey === "count" ? xKey : yKey, chartSpec.aggregation, limit),
  );
}

export function buildKpiFromSpec(rows: Row[], kpiSpec: KpiSpec): DashboardKpi {
  const cleanRows = cleanDatasetRows(rows);
  const quality = buildDataQualityScore(cleanRows);
  let rawValue: number | string = 0;

  if (kpiSpec.metric === "__row_count__" || !kpiSpec.metric) {
    rawValue = cleanRows.length;
  } else if (kpiSpec.metric === "__quality_score__") {
    rawValue = quality.finalScore;
  } else {
    rawValue = aggregateValues(
      cleanRows.map((row) => row[kpiSpec.metric!]),
      kpiSpec.aggregation || "count",
    );
  }

  return {
    ...kpiSpec,
    id: crypto.randomUUID(),
    rawValue,
    value: formatMetric(rawValue, kpiSpec.format),
    subtitle: kpiSpec.metric === "__quality_score__" ? "Data quality" : `${(kpiSpec.aggregation || "count").toUpperCase()} - ${titleCase(kpiSpec.metric || "Rows")}`,
    status: typeof rawValue === "number" && rawValue < 0 ? "critical" : "good",
  };
}

export function buildKpis(rows: Row[]) {
  const cleanRows = cleanDatasetRows(rows);
  const profile = buildDatasetProfile(cleanRows);
  const quality = buildDataQualityScore(cleanRows);
  const kpis: DashboardKpi[] = [
    buildKpiFromSpec(cleanRows, { title: "Total Rows", metric: "__row_count__", aggregation: "count", format: "number" }),
    buildKpiFromSpec(cleanRows, {
      title: "Attributes / Columns",
      metric: "__row_count__",
      aggregation: "count",
      format: "number",
    }),
    {
      id: crypto.randomUUID(),
      title: "Numeric Columns",
      metric: "__numeric_columns__",
      aggregation: "count",
      format: "number",
      rawValue: profile.numericColumns.length,
      value: profile.numericColumns.length.toLocaleString(),
      subtitle: "Metric-ready columns",
    },
    {
      id: crypto.randomUUID(),
      title: "Categorical Columns",
      metric: "__categorical_columns__",
      aggregation: "count",
      format: "number",
      rawValue: profile.categoryColumns.length,
      value: profile.categoryColumns.length.toLocaleString(),
      subtitle: "Segment columns",
    },
    {
      id: crypto.randomUUID(),
      title: "Missing Values",
      metric: "__missing_values__",
      aggregation: "count",
      format: "number",
      rawValue: quality.missingCells,
      value: quality.missingCells.toLocaleString(),
      subtitle: `${quality.completeness}% complete`,
      status: quality.missingCells > 0 ? "warning" : "good",
    },
    buildKpiFromSpec(cleanRows, {
      title: "Data Quality Score",
      metric: "__quality_score__",
      aggregation: "avg",
      format: "percent",
    }),
  ];

  kpis[1] = {
    ...kpis[1],
    rawValue: profile.columns.length,
    value: profile.columns.length.toLocaleString(),
    subtitle: "Detected columns",
  };

  if (profile.primaryMetric) {
    kpis.push(
      buildKpiFromSpec(cleanRows, {
        title: `Highest ${titleCase(profile.primaryMetric.name)}`,
        metric: profile.primaryMetric.name,
        aggregation: "max",
        format: "number",
      }),
    );
  }

  return kpis;
}

export function buildDefaultCharts(rows: Row[]) {
  const cleanRows = cleanDatasetRows(rows);
  const profile = buildDatasetProfile(cleanRows);
  const withIndex = buildRowIndexRows(cleanRows);
  const charts: DashboardChart[] = [];

  if (!withIndex.length) return charts;

  if (profile.primaryMetric && profile.primaryCategory) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "bar",
        title: `Average ${titleCase(profile.primaryMetric.name)} by ${titleCase(profile.primaryCategory.name)}`,
        xKey: profile.primaryCategory.name,
        yKey: profile.primaryMetric.name,
        aggregation: "avg",
        limit: 10,
      }),
    );
  }

  if (profile.primaryMetric) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "histogram",
        title: `${titleCase(profile.primaryMetric.name)} Distribution`,
        xKey: "range",
        yKey: profile.primaryMetric.name,
        aggregation: "count",
        limit: 8,
      }),
    );
  }

  if (profile.primaryCategory) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "donut",
        title: `Records by ${titleCase(profile.primaryCategory.name)}`,
        xKey: profile.primaryCategory.name,
        yKey: "count",
        aggregation: "count",
        limit: 8,
      }),
    );
  }

  if (profile.primaryMetric) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "line",
        title: profile.dateColumn
          ? `${titleCase(profile.primaryMetric.name)} Over Time`
          : `${titleCase(profile.primaryMetric.name)} Trend (By Row Index)`,
        xKey: profile.dateColumn?.name || "__row_index__",
        yKey: profile.primaryMetric.name,
        aggregation: "avg",
        limit: 24,
      }),
    );
  }

  if (profile.primaryMetric && profile.secondaryMetric) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "scatter",
        title: `${titleCase(profile.primaryMetric.name)} vs ${titleCase(profile.secondaryMetric.name)}`,
        xKey: profile.secondaryMetric.name,
        yKey: profile.primaryMetric.name,
        aggregation: "avg",
        limit: 200,
      }),
    );
  }

  if (profile.primaryMetric && profile.primaryCategory) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "horizontalBar",
        title: `Top ${titleCase(profile.primaryCategory.name)} by ${titleCase(profile.primaryMetric.name)}`,
        xKey: profile.primaryCategory.name,
        yKey: profile.primaryMetric.name,
        aggregation: "max",
        limit: 10,
      }),
    );
  }

  if (profile.numericColumns.length >= 2) {
    charts.push(
      buildChartFromSpec(withIndex, {
        type: "heatmap",
        title: "Correlation Analysis",
        xKey: profile.numericColumns[0].name,
        yKey: profile.numericColumns[1].name,
        aggregation: "avg",
      }),
    );
  }

  return charts.filter((chart, index, list) => {
    const signature = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}`;
    return list.findIndex((candidate) => `${candidate.title}|${candidate.type}|${candidate.xKey}|${candidate.yKey}` === signature) === index;
  });
}

export const buildSevenCharts = buildDefaultCharts;

export function generateDynamicInsights(rows: Row[]): InsightCard[] {
  const cleanRows = cleanDatasetRows(rows);
  const profile = buildDatasetProfile(cleanRows);
  const quality = buildDataQualityScore(cleanRows);
  const insights: InsightCard[] = [];

  if (profile.primaryMetric && profile.primaryCategory) {
    const grouped = groupByAggregate(cleanRows, profile.primaryCategory.name, profile.primaryMetric.name, "avg", 1)[0];
    if (grouped) {
      insights.push({
        id: crypto.randomUUID(),
        title: `${titleCase(String(grouped[profile.primaryCategory.name]))} leads`,
        description: `Highest average ${titleCase(profile.primaryMetric.name)} is ${grouped[profile.primaryMetric.name]}.`,
        tone: "good",
      });
    }
  }

  insights.push({
    id: crypto.randomUUID(),
    title: `Data quality is ${quality.finalScore >= 85 ? "strong" : "mixed"}`,
    description: `${quality.completeness}% completeness and ${quality.uniqueness}% uniqueness across the dataset.`,
    tone: quality.finalScore >= 85 ? "good" : "warning",
  });

  if (profile.primaryMetric) {
    const values = cleanRows
      .map((row) => safeNumber(row[profile.primaryMetric!.name]))
      .filter((value): value is number => value !== null);
    const mean = average(values);
    const deviations = values.filter((value) => Math.abs(value - mean) > Math.max(mean * 0.8, 1)).length;
    insights.push({
      id: crypto.randomUUID(),
      title: "Anomaly watch",
      description: `${deviations} records in ${titleCase(profile.primaryMetric.name)} stand far from the average.`,
      tone: deviations > 0 ? "warning" : "info",
    });
  }

  return insights.slice(0, 4);
}

export function exportRowsToCsv(rows: Row[]) {
  const cleanRows = cleanDatasetRows(rows);
  const columns = Array.from(
    new Set(cleanRows.flatMap((row) => Object.keys(row)).filter((key) => !key.startsWith("__"))),
  );

  const lines = [
    columns.join(","),
    ...cleanRows.map((row) =>
      columns
        .map((column) => `"${String(row[column] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  return lines.join("\n");
}

export function exportDashboardToJson(input: {
  datasetName: string;
  filters: DashboardFilters;
  kpis: DashboardKpi[];
  charts: DashboardChart[];
}) {
  return JSON.stringify(input, null, 2);
}
