export type DatasetPayload = {
  id?: string;
  name?: string;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<{ name?: string; key?: string; type?: string; role?: string } | string>;
};

export type DashboardCommandResponse = {
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
  message?: string;
  chartSpec?: Record<string, unknown>;
  kpiSpec?: Record<string, unknown>;
  filters?: Record<string, unknown> | Array<{ key?: string; column?: string; operator?: string; value?: unknown }>;
  dashboard?: { kpis?: unknown[]; charts?: unknown[]; source?: string; domain?: string; filters?: unknown[] };
  dashboardPlan?: { kpis?: unknown[]; charts?: unknown[]; source?: string; domain?: string; filters?: unknown[] };
  dashboardHealth?: { status: "healthy" | "warning" | "failed"; score: number; issues?: unknown[]; warnings?: unknown[] };
  schemaOnly: true;
  provider?: string;
  model?: string;
  aiError?: string;
};

export type SchemaChatResponse = {
  userMessage?: { role: "user"; content: string; timestamp?: string };
  assistantMessage: { role: "assistant"; content: string; model?: string; provider?: string; schemaOnly: true; timestamp?: string };
};

export type ExcelAnalystResponse = {
  userMessage?: { role: "user"; content: string; timestamp?: string };
  assistantMessage?: { role: "assistant"; content: string; model?: string; provider?: string; schemaOnly: true; timestamp?: string };
  analysis?: {
    schemaOnly: true;
    provider: string;
    model: string;
    query: string;
    intent: string;
    answer: string;
    plan: Record<string, unknown>;
    calculation: { ok: boolean; type?: string; warning?: string; result: unknown };
    suggestedCharts?: unknown[];
    suggestedKpis?: unknown[];
    confidence?: number;
    warnings?: unknown[];
  };
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function endpoint(path: string) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const details = payload?.error?.details || payload?.raw || "";
    throw new Error(details ? `${message}: ${details}` : message);
  }

  return (payload?.data ?? payload) as T;
}

function safeDatasetBody(dataset?: DatasetPayload) {
  return {
    id: dataset?.id,
    name: dataset?.name,
    rows: Array.isArray(dataset?.rows) ? dataset.rows : undefined,
    columns: Array.isArray(dataset?.columns) ? dataset.columns : undefined,
  };
}

export const schemaAiClient = {
  getSchemaTrainingMemory: () => request("/api/ai/schema-training-memory"),

  generateSchemaDashboard: (
    datasetId: string,
    dataset?: DatasetPayload,
    options: { useLlm?: boolean; threshold?: number } = {},
  ) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-dashboard`, {
      method: "POST",
      body: JSON.stringify({ ...safeDatasetBody(dataset), ...options }),
    }),

  sendDashboardCommand: (
    datasetId: string,
    query: string,
    currentDashboard?: unknown,
    dataset?: DatasetPayload,
    options: { useLlm?: boolean } = {},
  ) =>
    request<DashboardCommandResponse>(`/api/datasets/${encodeURIComponent(datasetId)}/dashboard-command`, {
      method: "POST",
      body: JSON.stringify({
        query,
        currentDashboard,
        ...safeDatasetBody(dataset),
        ...options,
      }),
    }),

  sendSchemaChat: (
    datasetId: string,
    query: string,
    dataset?: DatasetPayload,
    options: { useLlm?: boolean } = {},
  ) =>
    request<SchemaChatResponse>(`/api/datasets/${encodeURIComponent(datasetId)}/schema-chat`, {
      method: "POST",
      body: JSON.stringify({
        query,
        ...safeDatasetBody(dataset),
        ...options,
      }),
    }),

  runExcelAnalyze: (
    datasetId: string,
    payload: Record<string, unknown>,
  ) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/excel-analyze`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  runExcelChat: (
    datasetId: string,
    payload: Record<string, unknown>,
  ) =>
    request<ExcelAnalystResponse>(`/api/datasets/${encodeURIComponent(datasetId)}/excel-chat`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainExcelRagSeeds: (payload: Record<string, unknown> = {}) =>
    request("/api/ai/excel-rag/train-seeds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainSchemaDashboard: (
    datasetId: string,
    dataset: DatasetPayload,
    dashboardPlan: unknown,
    rating = "good",
  ) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-train`, {
      method: "POST",
      body: JSON.stringify({ ...safeDatasetBody(dataset), dashboardPlan, rating }),
    }),

  getSchemaRagMemory: () => request("/api/ai/schema-rag-memory"),

  retrieveSchemaRagMemory: (payload: Record<string, unknown>) =>
    request("/api/ai/schema-rag/retrieve", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainSchemaRagMemory: (payload: Record<string, unknown>) =>
    request("/api/ai/schema-rag/train", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainCurrentDashboardPattern: (datasetId: string, payload: Record<string, unknown>) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-rag-train`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  understandDatasetSchema: (datasetId: string, payload: Record<string, unknown>) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-understand`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateSmartRagDashboard: (datasetId: string, payload: Record<string, unknown>) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/smart-rag-dashboard`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainSmartRagDashboard: (datasetId: string, payload: Record<string, unknown>) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/smart-rag-train`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateSeniorDashboard: (datasetId: string, payload: Record<string, unknown>) =>
    request(`/api/datasets/${encodeURIComponent(datasetId)}/senior-dashboard`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  trainSeniorAnalystSeeds: () =>
    request("/api/ai/senior-analyst/train-seeds", {
      method: "POST",
      body: JSON.stringify({ useOllama: false }),
    }),
};

export function getSchemaRagMemory() {
  return schemaAiClient.getSchemaRagMemory();
}

export function retrieveSchemaRagMemory(payload: Record<string, unknown>) {
  return schemaAiClient.retrieveSchemaRagMemory(payload);
}

export function trainSchemaRagMemory(payload: Record<string, unknown>) {
  return schemaAiClient.trainSchemaRagMemory(payload);
}

export function trainCurrentDashboardPattern(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.trainCurrentDashboardPattern(datasetId, payload);
}

export function understandDatasetSchema(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.understandDatasetSchema(datasetId, payload);
}

export function generateSmartRagDashboard(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.generateSmartRagDashboard(datasetId, payload);
}

export function trainSmartRagDashboard(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.trainSmartRagDashboard(datasetId, payload);
}

export function generateSeniorDashboard(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.generateSeniorDashboard(datasetId, payload);
}

export function trainSeniorAnalystSeeds() {
  return schemaAiClient.trainSeniorAnalystSeeds();
}

export function generateSchemaDashboard(datasetId: string, payload: Record<string, unknown>) {
  return request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-dashboard`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runDashboardCommand(datasetId: string, payload: Record<string, unknown>) {
  return request(`/api/datasets/${encodeURIComponent(datasetId)}/dashboard-command`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runSchemaChat(datasetId: string, payload: Record<string, unknown>) {
  return request(`/api/datasets/${encodeURIComponent(datasetId)}/schema-chat`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runExcelAnalyze(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.runExcelAnalyze(datasetId, payload);
}

export function runExcelChat(datasetId: string, payload: Record<string, unknown>) {
  return schemaAiClient.runExcelChat(datasetId, payload);
}

export function trainExcelRagSeeds(payload: Record<string, unknown> = {}) {
  return schemaAiClient.trainExcelRagSeeds(payload);
}
