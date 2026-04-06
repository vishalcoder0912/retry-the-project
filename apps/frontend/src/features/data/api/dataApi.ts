import { ChatMessage, Dataset } from "@/features/data/model/dataStore";

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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

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
};
