import { useCallback, useState } from 'react';
import { schemaAgentApi, SchemaTrainResponse } from '../api/schemaAgentApi';

export function useAutoTrainSchema() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SchemaTrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trainAndBuild = useCallback(async (datasetId: string) => {
    setLoading(true);
    setError(null);

    try {
      const trainResult = await schemaAgentApi.trainSchema(datasetId);
      const dashboardResult = await schemaAgentApi.buildDashboardSpec(datasetId);
      setResult(dashboardResult);
      return {
        trainResult,
        dashboardResult,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Schema training failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    result,
    error,
    trainAndBuild,
  };
}
