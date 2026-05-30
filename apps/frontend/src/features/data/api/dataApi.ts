import { ChartConfig, ChatMessage, Dataset, DatasetAnalysis } from "@/features/data/model/dataStore";
import type { Aggregation, ChartSpec, KpiSpec } from "@/features/dashboard/types/dashboardTypes";
import logger from "@/shared/lib/logger";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CorrelationResult {
  column1: string;
  column2: string;
  coefficient: number;
  strength: "weak" | "moderate" | "strong";
  interpretation: string;
  sampleSize: number;
}

export interface CorrelationResponse {
  correlations: CorrelationResult[];
  summary: string;
  hasGemini: boolean;
}

export interface DatasetImportPayload {
  name: string;
  fileName?: string | null;
  columns: Dataset["columns"];
  rows: Dataset["rows"];
  sourceType?: string;
}

export interface QrUploadFileInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  sizeBytes: number;
  status: "uploaded" | "error" | "uploading";
}

export interface QrUploadSession {
  sessionId: string;
  uploadToken: string;
  uploadUrl: string;
  qrDataUrl: string;
  workspaceName: string;
  status: "waiting" | "uploading" | "completed" | "expired" | "error" | "closed";
  expiresAt: string;
}

export interface QrUploadStatus {
  sessionId: string;
  status: "waiting" | "uploading" | "completed" | "expired" | "error" | "closed";
  workspaceName: string;
  files: QrUploadFileInfo[];
  dataset?: Dataset;
  analysis?: DatasetAnalysis;
  error?: string | null;
  expiresAt: string;
}

interface ApiState {
  dataset: Dataset | null;
  chatMessages: ChatMessage[];
  analysis?: DatasetAnalysis;
}

interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface DashboardKPI {
  title: string;
  value: string;
  metric?: string;
  aggregation?: Aggregation;
  icon?: string;
  status?: "good" | "warning" | "critical";
  insight?: string;
}

export interface DashboardValidationIssue {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  fix?: unknown;
}

export interface DashboardValidateFixResponse {
  isCorrect: boolean;
  issues: DashboardValidationIssue[];
  observations: string[];
  message: string;
  correctedDashboard: {
    dataType: string;
    rowCount: number;
    columnCount: number;
    kpis: Array<{
      id: string;
      title: string;
      value: string;
      subtitle: string;
      metric?: string;
      aggregation?: string;
    }>;
    charts: ChartConfig[];
    chartRecommendations: ChartConfig[];
  };
}

export interface DashboardCommandResponse {
  action:
    | "GENERATE_CHART"
    | "MODIFY_CHART"
    | "DELETE_CHART"
    | "FILTER"
    | "CLEAR_FILTERS"
    | "GENERATE_KPI"
    | "ADD_KPI"
    | "ANSWER"
    | "DATASET_ANSWER"
    | "GENERAL_ANSWER"
    | "FIX_DASHBOARD";
  message: string;
  chart?: ChartConfig;
  chartSpec?: ChartSpec;
  kpiSpec?: KpiSpec;
  kpis?: DashboardKPI[];
  filters?: Record<string, string>;
  provider?: string;
  model?: string;
  schemaOnly?: boolean;
  correctedDashboard?: DashboardValidateFixResponse["correctedDashboard"];
  issues?: DashboardValidationIssue[];
  observations?: string[];
  aiError?: string | null;
}

export interface DashboardAiPayload {
  rows: any[];
  dataDictionary?: any[];
  datasetName?: string;
  filters?: Record<string, any>;
}

export interface DashboardAiCommandPayload extends DashboardAiPayload {
  query: string;
  currentDashboard?: any;
}

export interface DashboardAiFixPayload extends Omit<DashboardAiPayload, "filters"> {
  currentDashboard?: any;
}

export interface DashboardAiResponse {
  success: boolean;
  schemaProfile?: any;
  aiPlan?: any;
  dashboard?: any;
  action?: string;
  message?: string;
  schemaOnly?: boolean;
  correctedDashboard?: any;
  issues?: Array<{ type: string; message: string; severity?: string }>;
  observations?: string[];
  provider?: string;
}

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

export interface PdfImportResult {
  pdf: {
    id: string;
    datasetId: string;
    fileName: string;
    jobId: string;
    tableCount: number;
    chunkCount: number;
    textElementCount: number;
  };
  dataset: Dataset;
  analysis: DatasetAnalysis;
  knowledgeBaseSummary: {
    tableCount: number;
    chunkCount: number;
    textElementCount: number;
  };
  privacy: {
    rawPdfSentToLLM: boolean;
    extractedTextCanBeUsedForRAG: boolean;
    dashboardValuesCalculatedLocally: boolean;
  };
}

export interface PdfAskResult {
  answer: string;
  sources: Array<{
    source: number;
    id: string;
    preview: string;
  }>;
}

export interface AgenticConfigResponse {
  provider: string;
  ollamaHost: string;
  useCloudDeepReasoner: boolean;
  roles: Record<string, string>;
}

export interface AgenticHealthResponse {
  checks: Array<{
    model: string;
    installed: boolean;
  }>;
}


type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

const apiBaseUrl = (() => {
  // Use empty string to leverage Vite proxy in development
  // In production, set VITE_API_BASE_URL to the backend URL
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.log('Using Vite proxy for API requests');
  }
  return baseUrl.replace(/\/$/, "");
})();

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const startTime = Date.now();
  const method = init?.method || "GET";

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      ...init,
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const errorMessage = errorPayload?.error?.message || errorPayload?.error || `Request failed with status ${response.status}`;
      
      logger.error(`API Error: ${method} ${path}`, {
        statusCode: response.status,
        duration,
        path,
        method,
      });

      throw new ApiError(errorMessage, response.status, errorPayload?.error?.code || errorPayload?.code);
    }

    logger.info(`API: ${method} ${path}`, {
      statusCode: response.status,
      duration,
    });

    if (response.status === 204) {
      return {} as T;
    }

    const payload = await response.json() as T | ApiEnvelope<T>;

    if (
      payload
      && typeof payload === "object"
      && "success" in payload
      && "data" in payload
    ) {
      return (payload as ApiEnvelope<T>).data as T;
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error(`Network error: ${method} ${path}`, {
      error: error instanceof Error ? error.message : "Unknown error",
      path,
      method,
    }, error instanceof Error ? error : undefined);
    
    throw new ApiError(
      error instanceof Error ? error.message : "Network request failed",
      0,
      "NETWORK_ERROR"
    );
  }
};

export const api = {
  getState: () => request<ApiState>("/api/state"),
  resetState: () =>
    request<ApiState>("/api/state/reset", {
      method: "POST",
    }),
  importDataset: (payload: DatasetImportPayload) =>
    request<ApiState>("/api/datasets/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  mergeDatasets: (datasets: DatasetImportPayload[]) =>
    request<ApiState>("/api/datasets/merge", {
      method: "POST",
      body: JSON.stringify({ datasets }),
    }),
  loadDemo: () =>
    request<ApiState>("/api/datasets/demo", {
      method: "POST",
    }),
  importPdf: async (file: File): Promise<PdfImportResult> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiBaseUrl}/api/pdf/import`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "PDF import failed",
        response.status,
        errorPayload?.error?.code,
      );
    }

    const payload = await response.json() as ApiEnvelope<PdfImportResult>;
    return payload.data as PdfImportResult;
  },
  askPdf: (pdfId: string, query: string): Promise<PdfAskResult> =>
    request<PdfAskResult>(`/api/pdf/${pdfId}/ask`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  updateRow: (datasetId: string, rowId: number, column: string, value: unknown) =>
    request<{ dataset: Dataset }>(`/api/datasets/${datasetId}/rows/${rowId}`, {
      method: "PATCH",
      body: JSON.stringify({ column, value }),
    }),
  sendChatQuery: (datasetId: string, query: string, preferences?: {
    chartCount?: string;
    chartTypes?: string[];
    showTrends?: boolean;
    showCorrelations?: boolean;
  }) =>
    request<ChatResponse>(`/api/datasets/${datasetId}/chat`, {
      method: "POST",
      body: JSON.stringify({ query, ...preferences }),
    }),
  generateSchemaDashboard: (
    datasetId: string,
    useLlm = true,
    dataset?: { rows?: unknown[]; columns?: unknown[] },
  ) =>
    request<SchemaDashboardResponse>(`/api/datasets/${datasetId}/schema-dashboard`, {
      method: "POST",
      body: JSON.stringify({ useLlm, ...(dataset || {}) }),
    }),
  trainSchemaDashboard: (
    datasetId: string,
    dashboardPlan: unknown,
    rating: "good" | "bad" = "good",
    notes = "",
  ) =>
    request(`/api/datasets/${datasetId}/schema-train`, {
      method: "POST",
      body: JSON.stringify({ dashboardPlan, rating, notes }),
    }),
  sendDashboardCommand: (
    datasetId: string,
    query: string,
    currentDashboard?: unknown,
    dataset?: { rows?: unknown[]; columns?: unknown[] },
  ) =>
    request<DashboardCommandResponse>(`/api/datasets/${datasetId}/dashboard-command`, {
      method: "POST",
      body: JSON.stringify({
        query,
        currentDashboard,
        useLlm: true,
        columns: dataset?.columns,
      }),
    }),
  sendSchemaChat: (datasetId: string, query: string, dataset?: { rows?: unknown[]; columns?: unknown[] }) =>
    request<{
      userMessage: unknown;
      assistantMessage: {
        role: "assistant";
        content: string;
        model?: string;
        provider?: string;
        schemaOnly: true;
      };
    }>(`/api/datasets/${datasetId}/schema-chat`, {
      method: "POST",
      body: JSON.stringify({
        query,
        useLlm: true,
        columns: dataset?.columns,
      }),
    }),
  getSchemaTrainingMemory: () =>
    request("/api/ai/schema-training-memory", {
      method: "GET",
    }),
  validateAndFixDashboard: (
    datasetId: string,
    currentDashboard: {
      kpis: unknown[];
      charts: unknown[];
      filters?: Record<string, unknown>;
    }
  ) =>
    request<DashboardValidateFixResponse>(
      `/api/datasets/${datasetId}/dashboard-validate-fix`,
      {
        method: "POST",
        body: JSON.stringify({ currentDashboard }),
      }
    ),
  analyzeWithAnalyticsBrain: (datasetId: string) =>
    request<DatasetAnalysis>(`/api/datasets/${datasetId}/analytics-brain`, {
      method: "POST",
    }),
  runPlaybookAnalysis: (datasetId: string) =>
    request<DatasetAnalysis>(`/api/datasets/${datasetId}/playbook-analysis`, {
      method: "POST",
    }),
  sendAnalyticsBrainFeedback: (input: {
    patternId: string;
    action: string;
    rating: "good" | "bad";
    note?: string;
  }) =>
    request<{ success: boolean }>("/api/analytics-brain/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getAICorrelations: (datasetId: string) =>
    request<CorrelationResponse>(`/api/datasets/${datasetId}/ai-correlations`, {
      method: "GET",
    }),
  getAIProfile: (datasetId: string) =>
    request<{ profile: unknown }>(`/api/datasets/${datasetId}/ai/profile`, {
      method: "GET",
    }),
  getAIAnomalies: (datasetId: string) =>
    request<{ anomalies: unknown }>(`/api/datasets/${datasetId}/ai/anomalies`, {
      method: "GET",
    }),
  getAIRelationships: (datasetId: string) =>
    request<{ relationships: unknown }>(`/api/datasets/${datasetId}/ai/relationships`, {
      method: "GET",
    }),
  getAICleaning: (datasetId: string) =>
    request<{ suggestions: unknown }>(`/api/datasets/${datasetId}/ai/cleaning`, {
      method: "GET",
    }),
  exportDataset: async (datasetId: string, format: 'json' | 'csv' | 'md') => {
    const response = await fetch(`${apiBaseUrl}/api/datasets/${datasetId}/export/${format}`);
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    return response.blob();
  },
  getCascadeStatus: () =>
    request<{ success: boolean; cascade: unknown }>("/api/cascade/status", {
      method: "GET",
    }),
  generateQRSession: async (input?: {
    portalBaseUrl?: string;
    workspaceName?: string;
  }): Promise<QrUploadSession> => {
    const response = await fetch(`${apiBaseUrl}/api/qr-upload/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        portalBaseUrl:
          input?.portalBaseUrl ||
          import.meta.env.VITE_PUBLIC_APP_URL ||
          window.location.origin,
        workspaceName: input?.workspaceName || "InsightFlow Workspace",
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Failed to generate QR session",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  getQRSessionStatus: async (
    sessionId: string,
    token: string
  ): Promise<QrUploadStatus> => {
    const response = await fetch(
      `${apiBaseUrl}/api/qr-upload/${sessionId}/status?token=${encodeURIComponent(token)}`
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Failed to get QR session status",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  uploadToQRSession: async (
    sessionId: string,
    token: string,
    files: File[]
  ): Promise<QrUploadStatus> => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(
      `${apiBaseUrl}/api/qr-upload/${sessionId}/upload?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);

      throw new ApiError(
        errorPayload?.error?.message || "Upload failed",
        response.status,
        errorPayload?.error?.code
      );
    }

    const payload = await response.json();
    return payload.data ?? payload;
  },
  deleteDataset: (datasetId: string) =>
    request<void>(`/api/datasets/${datasetId}`, {
      method: "DELETE",
    }),
  runAiAnalyst: (datasetId: string) =>
    request<{ analysis: DatasetAnalysis }>(`/api/datasets/${datasetId}/ai-analyst/analyze`, {
      method: "POST",
    }),
  sendAiAnalystCommand: (input: {
    datasetId: string;
    command: string;
    currentAnalysis?: unknown;
    filters?: Record<string, string>;
  }) =>
    request<{ result: DashboardCommandResponse }>(
      `/api/datasets/${input.datasetId}/ai-analyst/command`,
      {
        method: "POST",
        body: JSON.stringify({
          command: input.command,
          currentAnalysis: input.currentAnalysis,
          filters: input.filters || {},
        }),
      }
    ),
  getAgenticConfig: () =>
    request<AgenticConfigResponse>("/api/agentic-models/config"),
  getAgenticHealth: () =>
    request<AgenticHealthResponse>("/api/agentic-models/health"),
  runAgenticAnalysis: (datasetId: string, goal: string) =>
    request<any>(`/api/agentic-models/datasets/${datasetId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),
};

async function postDashboardAi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.message || payload.error?.message || "Request failed",
      response.status,
      payload.error?.code
    );
  }

  return payload as T;
}

export const dashboardAiApi = {
  generateDashboard(body: DashboardAiPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/generate", body);
  },

  sendDashboardCommand(body: DashboardAiCommandPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/command", body);
  },

  validateAndFixDashboard(body: DashboardAiFixPayload) {
    return postDashboardAi<DashboardAiResponse>("/api/dashboard-ai/fix", body);
  },
};
