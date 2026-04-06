export interface DataColumn {
  name: string;
  type: "string" | "number" | "date";
  sample: string[];
}

export type DatasetCellValue = string | number | boolean | null;

export interface DatasetRow extends Record<string, DatasetCellValue> {
  __rowId?: number;
}

export type ChartDatum = Record<string, string | number>;

export interface Dataset {
  id: string;
  name: string;
  columns: DataColumn[];
  rows: DatasetRow[];
  uploadedAt: Date;
  rowCount: number;
  sourceType?: string;
  fileName?: string | null;
}

export interface KPI {
  label: string;
  value: string;
  change?: number;
  icon: string;
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area";
  title: string;
  xKey: string;
  yKey: string;
  data: ChartDatum[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  chart?: ChartConfig;
  insights?: string[];
  timestamp: Date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PREFERRED_NUMERIC_COLUMNS = ["revenue", "sales", "amount", "units_sold", "units", "profit_margin", "customer_rating"];
const PREFERRED_DIMENSION_COLUMNS = ["month", "date", "category", "region", "segment", "country"];

const toNumber = (value: DatasetCellValue | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toLabel = (value: DatasetCellValue | undefined): string | null => {
  if (value == null) return null;
  const label = String(value).trim();
  return label ? label : null;
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const pickPreferredColumn = (columns: DataColumn[], preferredNames: string[]) => {
  for (const name of preferredNames) {
    const found = columns.find((column) => column.name === name);
    if (found) {
      return found;
    }
  }

  return columns[0];
};

const sortLabels = (labels: string[], columnType: DataColumn["type"]) => {
  const uniqueLabels = [...new Set(labels)];
  const monthIndex = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index]));

  if (uniqueLabels.length > 0 && uniqueLabels.every((label) => monthIndex.has(label.toLowerCase()))) {
    return [...uniqueLabels].sort(
      (left, right) => (monthIndex.get(left.toLowerCase()) ?? 99) - (monthIndex.get(right.toLowerCase()) ?? 99),
    );
  }

  if (columnType === "date") {
    return [...uniqueLabels].sort((left, right) => Date.parse(left) - Date.parse(right));
  }

  return [...uniqueLabels].sort((left, right) => left.localeCompare(right));
};

const getNumericColumns = (data: Dataset) => data.columns.filter((column) => column.type === "number");
const getDimensionColumns = (data: Dataset) => data.columns.filter((column) => column.type !== "number");

const sumColumn = (rows: DatasetRow[], columnName: string) =>
  rows.reduce((total, row) => total + (toNumber(row[columnName]) ?? 0), 0);

const averageColumn = (rows: DatasetRow[], columnName: string) => {
  let total = 0;
  let count = 0;

  rows.forEach((row) => {
    const value = toNumber(row[columnName]);
    if (value == null) {
      return;
    }

    total += value;
    count += 1;
  });

  return count > 0 ? total / count : 0;
};

const groupMetricByDimension = (
  rows: DatasetRow[],
  dimensionColumn: DataColumn,
  metricColumn: DataColumn,
) => {
  const grouped = new Map<string, number>();

  rows.forEach((row) => {
    const label = toLabel(row[dimensionColumn.name]);
    const value = toNumber(row[metricColumn.name]);

    if (!label || value == null) {
      return;
    }

    grouped.set(label, (grouped.get(label) ?? 0) + value);
  });

  return sortLabels([...grouped.keys()], dimensionColumn.type).map((label) => ({
    [dimensionColumn.name]: label,
    [metricColumn.name]: Number((grouped.get(label) ?? 0).toFixed(2)),
  }));
};

const summarizeMetrics = (rows: DatasetRow[], columns: DataColumn[]) =>
  columns.slice(0, 6).map((column) => ({
    metric: humanize(column.name),
    value: Number(sumColumn(rows, column.name).toFixed(2)),
  }));

const formatMetricValue = (columnName: string, value: number) => {
  const normalized = columnName.toLowerCase();

  if (normalized.includes("revenue") || normalized.includes("amount") || normalized.includes("sales")) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  if (normalized.includes("margin") || normalized.includes("rate")) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (normalized.includes("rating") || normalized.includes("score")) {
    return value.toFixed(1);
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
};

const iconForMetric = (columnName: string) => {
  const normalized = columnName.toLowerCase();

  if (normalized.includes("revenue") || normalized.includes("amount") || normalized.includes("sales")) return "dollar";
  if (normalized.includes("unit") || normalized.includes("count") || normalized.includes("order")) return "package";
  if (normalized.includes("margin") || normalized.includes("rate")) return "percent";
  if (normalized.includes("rating") || normalized.includes("score")) return "star";

  return "chart";
};

export const generateDemoData = (): Dataset => {
  const categories = ["Electronics", "Clothing", "Food", "Software", "Services"];
  const regions = ["North", "South", "East", "West"];
  const rows: DatasetRow[] = [];

  for (let index = 0; index < 200; index += 1) {
    rows.push({
      month: MONTHS[Math.floor(Math.random() * 12)],
      category: categories[Math.floor(Math.random() * categories.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      revenue: Math.floor(Math.random() * 50000) + 5000,
      units_sold: Math.floor(Math.random() * 500) + 10,
      profit_margin: (Math.random() * 0.4 + 0.1).toFixed(2),
      customer_rating: (Math.random() * 2 + 3).toFixed(1),
    });
  }

  return {
    id: "demo-1",
    name: "Sales Analytics 2024",
    columns: [
      { name: "month", type: "string", sample: MONTHS.slice(0, 3) },
      { name: "category", type: "string", sample: categories.slice(0, 3) },
      { name: "region", type: "string", sample: regions.slice(0, 3) },
      { name: "revenue", type: "number", sample: ["25000", "18000", "32000"] },
      { name: "units_sold", type: "number", sample: ["150", "230", "89"] },
      { name: "profit_margin", type: "number", sample: ["0.25", "0.18", "0.32"] },
      { name: "customer_rating", type: "number", sample: ["4.2", "3.8", "4.7"] },
    ],
    rows,
    uploadedAt: new Date(),
    rowCount: rows.length,
  };
};

export const generateDemoKPIs = (data: Dataset): KPI[] => {
  const numericColumns = getNumericColumns(data);
  const dimensionColumns = getDimensionColumns(data);
  const primaryMetric = pickPreferredColumn(numericColumns, PREFERRED_NUMERIC_COLUMNS);
  const secondaryMetric = numericColumns.find((column) => column.name !== primaryMetric?.name);
  const rowCount = data.rowCount || data.rows.length;
  const kpis: KPI[] = [
    { label: "Rows", value: rowCount.toLocaleString(), icon: "rows" },
    { label: "Columns", value: data.columns.length.toLocaleString(), icon: "columns" },
  ];

  if (primaryMetric) {
    const total = sumColumn(data.rows, primaryMetric.name);
    kpis.push({
      label: `Total ${humanize(primaryMetric.name)}`,
      value: formatMetricValue(primaryMetric.name, total),
      icon: iconForMetric(primaryMetric.name),
    });
  }

  if (secondaryMetric) {
    const average = averageColumn(data.rows, secondaryMetric.name);
    kpis.push({
      label: `Avg ${humanize(secondaryMetric.name)}`,
      value: formatMetricValue(secondaryMetric.name, average),
      icon: iconForMetric(secondaryMetric.name),
    });
  } else if (dimensionColumns[0]) {
    const distinctCount = new Set(
      data.rows
        .map((row) => toLabel(row[dimensionColumns[0].name]))
        .filter((value): value is string => value !== null),
    ).size;

    kpis.push({
      label: `Distinct ${humanize(dimensionColumns[0].name)}`,
      value: distinctCount.toLocaleString(),
      icon: "chart",
    });
  }

  return kpis.slice(0, 4);
};

export const generateDemoCharts = (data: Dataset): ChartConfig[] => {
  const numericColumns = getNumericColumns(data);
  const dimensionColumns = getDimensionColumns(data);

  if (data.rows.length === 0 || numericColumns.length === 0) {
    return [];
  }

  const primaryMetric = pickPreferredColumn(numericColumns, PREFERRED_NUMERIC_COLUMNS);
  const secondaryMetric = numericColumns.find((column) => column.name !== primaryMetric?.name);
  const primaryDimension = pickPreferredColumn(dimensionColumns, PREFERRED_DIMENSION_COLUMNS);
  const secondaryDimension = dimensionColumns.find((column) => column.name !== primaryDimension?.name);
  const charts: ChartConfig[] = [];

  if (primaryDimension && primaryMetric) {
    const series = groupMetricByDimension(data.rows, primaryDimension, primaryMetric);
    if (series.length > 0) {
      charts.push({
        type: primaryDimension.name === "month" || primaryDimension.type === "date" ? "area" : "bar",
        title: `${humanize(primaryMetric.name)} by ${humanize(primaryDimension.name)}`,
        xKey: primaryDimension.name,
        yKey: primaryMetric.name,
        data: series,
      });
    }
  }

  if (secondaryDimension && primaryMetric) {
    const series = groupMetricByDimension(data.rows, secondaryDimension, primaryMetric);
    if (series.length > 0) {
      charts.push({
        type: series.length <= 6 ? "pie" : "bar",
        title: `${humanize(primaryMetric.name)} by ${humanize(secondaryDimension.name)}`,
        xKey: secondaryDimension.name,
        yKey: primaryMetric.name,
        data: series,
      });
    }
  }

  if (primaryDimension && secondaryMetric) {
    const series = groupMetricByDimension(data.rows, primaryDimension, secondaryMetric);
    if (series.length > 0) {
      charts.push({
        type: primaryDimension.type === "date" ? "line" : "bar",
        title: `${humanize(secondaryMetric.name)} by ${humanize(primaryDimension.name)}`,
        xKey: primaryDimension.name,
        yKey: secondaryMetric.name,
        data: series,
      });
    }
  }

  if (charts.length === 0) {
    const summary = summarizeMetrics(data.rows, numericColumns);
    if (summary.length > 0) {
      charts.push({
        type: "bar",
        title: "Metric Totals",
        xKey: "metric",
        yKey: "value",
        data: summary,
      });
    }
  }

  return charts.slice(0, 4);
};
