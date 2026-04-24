import { ChatMessage, Dataset } from "@/features/data/model/dataStore";

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
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
