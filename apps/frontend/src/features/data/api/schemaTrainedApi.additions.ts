import { schemaAiClient, type DatasetPayload } from "./schemaAiClient";

export type SchemaDashboardResponse = {
  success: boolean;
  schemaOnly: true;
  profile: {
    datasetName: string;
    rowCount: number;
    columnCount: number;
    domain: string;
    signature: string;
    columns: Array<{
      name: string;
      type: string;
      role: string;
      uniqueCount: number;
      missingPct: number;
      topValues?: string[];
    }>;
  };
  match: null | { dataset: string; domain: string; score: number };
  dashboard: {
    domain: string;
    kpis: Array<{
      id?: string;
      title: string;
      metric: string;
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median" | "count_unique";
      format?: "number" | "currency" | "percent";
    }>;
    charts: Array<{
      id?: string;
      type: "bar" | "line" | "area" | "pie" | "donut" | "histogram" | "scatter" | "radar" | "composed" | "heatmap";
      title: string;
      xKey: string;
      yKey: string;
      aggregation: "count" | "sum" | "avg" | "min" | "max" | "median";
      limit?: number;
    }>;
  };
};

export type SchemaAggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count_unique";

export type SchemaDashboardKpiSpec = SchemaDashboardResponse["dashboard"]["kpis"][number];
export type SchemaDashboardChartSpec = SchemaDashboardResponse["dashboard"]["charts"][number];

export type SchemaDashboardCommandResponse = {
  action:
    | "GENERATE_DASHBOARD"
    | "FIX_DASHBOARD"
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "GENERATE_KPI"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "ANSWER";
  message: string;
  chartSpec?: SchemaDashboardResponse["dashboard"]["charts"][number];
  kpiSpec?: SchemaDashboardResponse["dashboard"]["kpis"][number];
  filters?: Record<string, string>;
  dashboardPlan?: SchemaDashboardResponse["dashboard"];
  correctedDashboard?: unknown;
  schemaOnly: true;
  provider?: string;
  model?: string;
  aiError?: string | null;
};

export const schemaTrainedApi = {
  getSchemaTrainingMemory: schemaAiClient.getSchemaTrainingMemory,
  getSchemaRagMemory: () => schemaAiClient.getSchemaRagMemory(),
  trainSchemaRagMemory: (payload: Record<string, unknown>) =>
    schemaAiClient.trainSchemaRagMemory(payload),
  trainCurrentDashboardPattern: (datasetId: string, payload: Record<string, unknown>) =>
    schemaAiClient.trainCurrentDashboardPattern(datasetId, payload),
  generateSchemaDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.generateSchemaDashboard(datasetId, payload, {
      useLlm: payload.useLlm as boolean | undefined,
      threshold: payload.threshold as number | undefined,
    }),
  understandDatasetSchema: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.understandDatasetSchema(datasetId, payload),
  generateSmartRagDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.generateSmartRagDashboard(datasetId, payload),
  trainSmartRagDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.trainSmartRagDashboard(datasetId, payload),
  trainSchemaDashboard: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.trainSchemaDashboard(
      datasetId,
      payload,
      payload.dashboardPlan || payload.acceptedDashboard || { kpis: [], charts: [] },
      String(payload.rating || "good"),
    ),
  runDashboardCommand: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.sendDashboardCommand(
      datasetId,
      String(payload.query || ""),
      payload.currentDashboard,
      payload,
      { useLlm: payload.useLlm as boolean | undefined },
    ),
  sendDashboardCommand: (
    datasetId: string,
    query: string,
    currentDashboard?: unknown,
    dataset?: DatasetPayload,
  ) => schemaAiClient.sendDashboardCommand(datasetId, query, currentDashboard, dataset),
  runSchemaChat: (datasetId: string, payload: DatasetPayload & Record<string, unknown> = {}) =>
    schemaAiClient.sendSchemaChat(
      datasetId,
      String(payload.query || payload.message || ""),
      payload,
      { useLlm: payload.useLlm as boolean | undefined },
    ),
  sendSchemaChat: (datasetId: string, query: string, dataset?: DatasetPayload) =>
    schemaAiClient.sendSchemaChat(datasetId, query, dataset),
};
