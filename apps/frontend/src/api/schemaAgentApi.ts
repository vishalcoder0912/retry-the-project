export type SchemaTrainResponse = {
  ok: boolean;
  profile: any;
  dashboardSpec: any;
  guardian: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  memoryRecordId?: string;
  trainingExamplesCount?: number;
  message?: string;
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json();
}

export const schemaAgentApi = {
  trainSchema(datasetId: string) {
    return requestJson<SchemaTrainResponse>(
      `/api/schema-agent/datasets/${encodeURIComponent(datasetId)}/train-schema`,
      { method: 'POST' }
    );
  },

  buildDashboardSpec(datasetId: string) {
    return requestJson<SchemaTrainResponse>(
      `/api/schema-agent/datasets/${encodeURIComponent(datasetId)}/dashboard-spec`,
      { method: 'POST' }
    );
  },

  memoryStats() {
    return requestJson<{ ok: boolean; stats: any }>(
      '/api/schema-agent/memory/stats'
    );
  },
};
