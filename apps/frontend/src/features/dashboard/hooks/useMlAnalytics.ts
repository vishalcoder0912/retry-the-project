import { useCallback, useMemo, useState } from "react";
import { mlApi } from "@/features/data/api/mlApi";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

const idle = { data: null, error: null, loading: false };

export function useMlAnalytics(datasetId?: string) {
  const [profile, setProfile] = useState<AsyncState<any>>(idle);
  const [fullAnalysis, setFullAnalysis] = useState<AsyncState<any>>(idle);

  const loadProfile = useCallback(async () => {
    if (!datasetId) return;

    setProfile({ data: null, error: null, loading: true });
    try {
      const result = await mlApi.profileByDataset(datasetId);
      setProfile({ data: result, error: null, loading: false });
    } catch (error) {
      setProfile({
        data: null,
        error: error instanceof Error ? error.message : "Failed to load profile",
        loading: false,
      });
    }
  }, [datasetId]);

  const runFullAnalysis = useCallback(
    async (target?: string, goal?: string) => {
      if (!datasetId) return;

      setFullAnalysis({ data: null, error: null, loading: true });
      try {
        const result = await mlApi.fullAgenticAnalysis(datasetId, { target, goal });
        setFullAnalysis({ data: result, error: null, loading: false });
      } catch (error) {
        setFullAnalysis({
          data: null,
          error: error instanceof Error ? error.message : "Failed to run analysis",
          loading: false,
        });
      }
    },
    [datasetId],
  );

  const profileResult = (fullAnalysis.data as any)?.result?.profile ?? (profile.data as any)?.result;
  const measures = useMemo(
    () => profileResult?.measures ?? Object.keys(profileResult?.numericSummary ?? {}),
    [profileResult],
  );
  const dimensions = useMemo(() => profileResult?.dimensions ?? [], [profileResult]);

  return { profile, fullAnalysis, measures, dimensions, loadProfile, runFullAnalysis };
}
