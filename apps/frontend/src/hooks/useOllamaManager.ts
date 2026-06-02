/**
 * useOllamaManager Hook
 * Frontend hook for interacting with Ollama Manager AI
 */

import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

interface DashboardPlan {
  domain: string;
  dashboardTitle: string;
  kpis: Array<{
    title: string;
    metric: string;
    aggregation: string;
    reason: string;
  }>;
  charts: Array<{
    title: string;
    type: string;
    xKey: string;
    yKey: string;
    aggregation: string;
    reason: string;
  }>;
  insights: string[];
  warnings: string[];
}

interface DashboardCommandResult {
  intent: string;
  answer: string;
  action: {
    targetTitle?: string;
    chart?: Record<string, unknown>;
    kpi?: Record<string, unknown>;
    filter?: Record<string, string>;
  };
  reason: string;
  source?: "local" | "ollama" | "fallback";
  cached?: boolean;
}

interface OllamaStatus {
  running: boolean;
  host: string;
  models: string[];
  configured: {
    manager: string;
    dashboard: string;
    chat: string;
    embedding: string;
  };
  available: {
    manager: boolean;
    dashboard: boolean;
    chat: boolean;
    embedding: boolean;
  };
}

export function useOllamaManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const generateDashboard = useCallback(
    async (schemaProfile: Record<string, unknown>): Promise<DashboardPlan | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/ollama-manager/generate-dashboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaProfile }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        return data.dashboard;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to generate dashboard";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const sendDashboardCommand = useCallback(
    async (
      message: string,
      schemaProfile: Record<string, unknown>,
      currentDashboard: Record<string, unknown>
    ): Promise<DashboardCommandResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/ollama-manager/fast-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, schemaProfile, currentDashboard }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to process command";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const chat = useCallback(
    async (message: string, schemaProfile?: Record<string, unknown>): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/ollama-manager/fast-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, schemaProfile, currentDashboard: {} }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        return data.result?.answer || data.answer;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to get answer";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getStatus = useCallback(async (): Promise<OllamaStatus | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/ollama-manager/status`);
      const data = await res.json();
      return data.status;
    } catch {
      return null;
    }
  }, []);

  const findSimilar = useCallback(
    async (schemaProfile: Record<string, unknown>, topK = 3) => {
      try {
        const res = await fetch(`${API_BASE}/api/ollama-manager/find-similar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaProfile, topK }),
        });
        const data = await res.json();
        return data.memories || [];
      } catch {
        return [];
      }
    },
    []
  );

  const sendFeedback = useCallback(
    async (memoryId: string, feedbackType: "good" | "bad" | "adjusted", details?: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/ollama-manager/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memoryId, feedbackType, details }),
        });
        return await res.json();
      } catch {
        return null;
      }
    },
    []
  );

  return {
    loading,
    error,
    clearError,
    generateDashboard,
    sendDashboardCommand,
    chat,
    getStatus,
    findSimilar,
    sendFeedback,
  };
}
