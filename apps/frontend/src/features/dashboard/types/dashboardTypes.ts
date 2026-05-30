export type Aggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count_unique";

export type DashboardTheme = "dark" | "light";

export type ChartType =
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "histogram"
  | "scatter"
  | "radar"
  | "composed"
  | "heatmap";

export interface DashboardFilters {
  [key: string]: unknown;
  dateStart?: string;
  dateEnd?: string;
  conditions?: Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  xKey: string;
  yKey: string;
  aggregation: Exclude<Aggregation, "count_unique">;
  limit?: number;
  splitValues?: boolean;
}

export interface ChartConfig extends ChartSpec {
  id: string;
  data: Array<Record<string, string | number>>;
  subtitle?: string;
}

export interface KpiSpec {
  title: string;
  metric?: string;
  aggregation?: Aggregation;
  format?: "number" | "currency" | "percent" | "text";
}

export interface KpiConfig extends KpiSpec {
  id: string;
  value: string;
  rawValue?: number | string;
}

export interface DashboardState {
  filters: DashboardFilters;
  charts: ChartConfig[];
  extraKpis: KpiConfig[];
  theme: DashboardTheme;
  selectedChartId?: string;
}

export interface SchemaColumn {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  role?: "category" | "metric" | "date" | "id" | "location" | "boolean" | "text";
  description?: string;
  uniqueValues?: string[];
}

export interface DashboardSchema {
  columns: SchemaColumn[];
  rowCount: number;
  dictionary?: Record<string, string>;
}

export interface DashboardCommand {
  action:
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "ADD_KPI"
    | "GENERATE_KPI"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "ANSWER"
    | "FIX_DASHBOARD";
  message: string;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  filters?: Record<string, string>;
  schemaOnly: true;
  model?: string;
  provider?: string;
}
