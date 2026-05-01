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
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn('VITE_API_BASE_URL not set, using default:', baseUrl);
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
  sendChatQuery: (datasetId: string, query: string) =>
    request<ChatResponse>(`/api/datasets/${datasetId}/chat`, {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  getAICorrelations: (datasetId: string) =>
    request<CorrelationResponse>(`/api/datasets/${datasetId}/ai-correlations`, {
      method: "GET",
    }),
};
