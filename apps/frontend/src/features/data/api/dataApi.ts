import { ChartConfig, ChatMessage, Dataset, DatasetAnalysis } from "@/features/data/model/dataStore";
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

interface ApiState {
  dataset: Dataset | null;
  chatMessages: ChatMessage[];
  analysis?: DatasetAnalysis;
}

interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

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
      const errorMessage = errorPayload?.error || `Request failed with status ${response.status}`;
      
      logger.error(`API Error: ${method} ${path}`, {
        statusCode: response.status,
        duration,
        path,
        method,
      });

      throw new ApiError(errorMessage, response.status, errorPayload?.code);
    }

    logger.info(`API: ${method} ${path}`, {
      statusCode: response.status,
      duration,
    });

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
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
  importDataset: (payload: DatasetImportPayload) =>
    request<ApiState>("/api/datasets/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  loadDemo: () =>
    request<ApiState>("/api/datasets/demo", {
      method: "POST",
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
  getAICorrelations: (datasetId: string) =>
    request<CorrelationResponse>(`/api/datasets/${datasetId}/ai-correlations`, {
      method: "GET",
    }),
  getAIProfile: (datasetId: string) =>
    request<{ success: boolean; profile: unknown }>(`/api/datasets/${datasetId}/ai/profile`, {
      method: "GET",
    }),
  getAIAnomalies: (datasetId: string) =>
    request<{ success: boolean; anomalies: unknown }>(`/api/datasets/${datasetId}/ai/anomalies`, {
      method: "GET",
    }),
  getAIRelationships: (datasetId: string) =>
    request<{ success: boolean; relationships: unknown }>(`/api/datasets/${datasetId}/ai/relationships`, {
      method: "GET",
    }),
  getAICleaning: (datasetId: string) =>
    request<{ success: boolean; suggestions: unknown }>(`/api/datasets/${datasetId}/ai/cleaning`, {
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
  generateQRSession: () =>
    request<{ success: boolean; sessionId: string; uploadToken: string; expiresAt: string; uploadUrl: string }>("/api/qr-upload/generate", {
      method: "POST",
    }),
  getQRSessionStatus: (sessionId: string, token: string) =>
    request<{ success: boolean; status: string; fileInfo?: unknown }>(`/api/qr-upload/${sessionId}/status?token=${token}`, {
      method: "GET",
    }),
};
