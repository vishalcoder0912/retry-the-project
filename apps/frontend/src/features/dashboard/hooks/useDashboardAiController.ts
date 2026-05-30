import { useCallback, useEffect, useMemo, useState } from "react";
import {
  schemaAiClient,
  type DashboardCommandResponse,
  type DatasetPayload,
} from "@/features/data/api/schemaAiClient";
import {
  applyFilters,
  buildChartFromSpec,
  buildDefaultCharts,
  buildKpiFromSpec,
  buildKpis,
  cleanDatasetRows,
  type DashboardChart,
  type DashboardFilters,
  type DashboardKpi,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import type { ChartSpec, ChartType, KpiSpec } from "@/features/dashboard/types/dashboardTypes";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "chart" | "kpi" | "action" | "warning";
  model?: string;
  provider?: string;
};

type DashboardSpecs = {
  kpis: KpiSpec[];
  charts: ChartSpec[];
  source?: string;
  domain?: string;
};

type ControllerOptions = {
  dataset?: DatasetPayload | null;
  initialDashboard?: Partial<DashboardSpecs> | null;
  initialFilters?: DashboardFilters;
  useLlm?: boolean;
};

function makeId() {
  return crypto.randomUUID?.() || String(Date.now() + Math.random());
}

function toDatasetPayload(dataset?: DatasetPayload | null): DatasetPayload {
  return {
    id: dataset?.id,
    name: dataset?.name,
    rows: Array.isArray(dataset?.rows) ? dataset.rows : [],
    columns: Array.isArray(dataset?.columns) ? dataset.columns : [],
  };
}

function normalizeFilters(filters: DashboardCommandResponse["filters"]): DashboardFilters {
  if (!filters) return {};
  if (!Array.isArray(filters)) return filters as DashboardFilters;

  return filters.reduce<DashboardFilters>((next, filter) => {
    const key = String(filter.key || filter.column || "");
    if (!key) return next;
    next[key] = filter.value;
    return next;
  }, {});
}

function localFallbackAnswer(query: string, rows: Row[]) {
  return `Local fallback handled "${query}". Dataset has ${rows.length.toLocaleString()} clean rows, and dashboard values are calculated locally.`;
}

export function useDashboardAiController({
  dataset,
  initialDashboard,
  initialFilters = {},
  useLlm = true,
}: ControllerOptions) {
  const payload = useMemo(() => toDatasetPayload(dataset), [dataset]);
  const rows = useMemo(() => cleanDatasetRows((payload.rows || []) as Row[]), [payload.rows]);

  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [dashboardSpecs, setDashboardSpecs] = useState<DashboardSpecs>({
    kpis: initialDashboard?.kpis || [],
    charts: initialDashboard?.charts || [],
    source: initialDashboard?.source,
    domain: initialDashboard?.domain,
  });
  const [manualKpis, setManualKpis] = useState<KpiSpec[]>([]);
  const [manualCharts, setManualCharts] = useState<ChartSpec[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "assistant",
      content: "Dashboard AI Guardian is ready. I use schema-only AI specs and calculate values locally.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardHealth, setDashboardHealth] = useState<DashboardCommandResponse["dashboardHealth"]>();

  useEffect(() => {
    if (!initialDashboard?.kpis?.length && !initialDashboard?.charts?.length) return;
    setDashboardSpecs({
      kpis: initialDashboard.kpis || [],
      charts: initialDashboard.charts || [],
      source: initialDashboard.source,
      domain: initialDashboard.domain,
    });
  }, [initialDashboard?.charts, initialDashboard?.domain, initialDashboard?.kpis, initialDashboard?.source]);

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const allSpecs = useMemo<DashboardSpecs>(() => ({
    ...dashboardSpecs,
    kpis: [...(dashboardSpecs.kpis || []), ...manualKpis],
    charts: [...(dashboardSpecs.charts || []), ...manualCharts],
  }), [dashboardSpecs, manualKpis, manualCharts]);

  const rendered = useMemo(() => {
    const kpiSpecs = allSpecs.kpis.length ? allSpecs.kpis : [];
    const chartSpecs = allSpecs.charts.length ? allSpecs.charts : [];

    return {
      rows: filteredRows,
      kpis: kpiSpecs.length ? kpiSpecs.map((spec) => buildKpiFromSpec(filteredRows, spec)) : buildKpis(filteredRows),
      charts: chartSpecs.length ? chartSpecs.map((spec) => buildChartFromSpec(filteredRows, spec)).slice(0, 10) : buildDefaultCharts(filteredRows),
    };
  }, [allSpecs, filteredRows]);

  const pushAssistant = useCallback((content: string, options: Partial<Message> = {}) => {
    setMessages((current) => [...current, { id: makeId(), role: "assistant", content, ...options }]);
  }, []);

  const applyCommand = useCallback((command: DashboardCommandResponse) => {
    if (command.dashboardHealth) setDashboardHealth(command.dashboardHealth);

    if ((command.action === "GENERATE_DASHBOARD" || command.action === "FIX_DASHBOARD") && (command.dashboard || command.dashboardPlan)) {
      const dashboard = command.dashboard || command.dashboardPlan;
      setDashboardSpecs({
        kpis: (dashboard?.kpis || []) as KpiSpec[],
        charts: (dashboard?.charts || []) as ChartSpec[],
        source: dashboard?.source,
        domain: dashboard?.domain,
      });
      setManualCharts([]);
      setManualKpis([]);
      pushAssistant(command.message || "Dashboard regenerated with the quality guardian.", {
        type: command.dashboardHealth?.status === "failed" ? "warning" : "action",
        model: command.model,
        provider: command.provider,
      });
      return;
    }

    if ((command.action === "GENERATE_CHART" || command.action === "MODIFY_CHART") && command.chartSpec) {
      const { data: _data, rows: _rows, rawRows: _rawRows, ...chartSpec } = command.chartSpec as ChartSpec & { data?: unknown; rows?: unknown; rawRows?: unknown };
      if (command.action === "MODIFY_CHART") {
        setManualCharts((current) => current.length ? [...current.slice(0, -1), chartSpec] : [chartSpec]);
      } else {
        setManualCharts((current) => [...current, chartSpec]);
      }
      pushAssistant(command.message || "Chart generated from a safe AI spec and calculated locally.", {
        type: "chart",
        model: command.model,
        provider: command.provider,
      });
      return;
    }

    if (command.action === "GENERATE_KPI" && command.kpiSpec) {
      const { value: _value, data: _data, rows: _rows, ...kpiSpec } = command.kpiSpec as KpiSpec & { value?: unknown; data?: unknown; rows?: unknown };
      setManualKpis((current) => [...current, kpiSpec].slice(-8));
      pushAssistant(command.message || "KPI generated from a safe AI spec and calculated locally.", {
        type: "kpi",
        model: command.model,
        provider: command.provider,
      });
      return;
    }

    if (command.action === "DELETE_CHART") {
      setManualCharts((current) => current.slice(0, -1));
      setDashboardSpecs((current) => ({ ...current, charts: current.charts.slice(0, -1) }));
      pushAssistant(command.message || "Removed a chart.", { type: "action" });
      return;
    }

    if (command.action === "FILTER") {
      const nextFilters = normalizeFilters(command.filters);
      setFilters((current) => ({ ...current, ...nextFilters }));
      pushAssistant(command.message || "Filter applied.", { type: "action" });
      return;
    }

    if (command.action === "CLEAR_FILTERS") {
      setFilters({});
      pushAssistant(command.message || "Filters cleared.", { type: "action" });
      return;
    }

    pushAssistant(command.message || "I can help build charts, KPIs, filters, and explain this dashboard.", {
      type: "text",
      model: command.model,
      provider: command.provider,
    });
  }, [pushAssistant]);

  const runCommand = useCallback(async (query: string) => {
    const text = query.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { id: makeId(), role: "user", content: text }]);

    try {
      if (/understand|explain schema|schema samjhao|data samjhao/i.test(text)) {
        const result: any = await schemaAiClient.understandDatasetSchema(payload.id || "local-dataset", {
          ...payload,
        });

        pushAssistant(result?.explanation || "Schema understanding generated.", {
          type: "text",
          provider: "smart-schema-understanding",
        });
        return;
      }

      if (/smart dashboard|best dashboard|rag dashboard/i.test(text)) {
        const result: any = await schemaAiClient.generateSmartRagDashboard(payload.id || "local-dataset", {
          ...payload,
          useOllama: useLlm,
        });

        const dashboard = result?.dashboard;

        if (dashboard) {
          setDashboardSpecs({
            kpis: (dashboard.kpis || []) as KpiSpec[],
            charts: (dashboard.charts || []) as ChartSpec[],
            source: dashboard.source,
            domain: dashboard.domain,
          });
          setManualCharts([]);
          setManualKpis([]);
        }

        if (result?.quality?.health) setDashboardHealth(result.quality.health);

        pushAssistant(
          result?.understanding?.userExplanation || "Smart RAG dashboard generated.",
          {
            type: "action",
            provider: "smart-rag-dashboard",
          },
        );
        return;
      }

      if (/remember|train this|save pattern|learn this dashboard/i.test(text)) {
        const result: any = await schemaAiClient.trainSmartRagDashboard(payload.id || "local-dataset", {
          ...payload,
          acceptedDashboardPlan: allSpecs,
          rating: "good",
          notes: "User approved this dashboard from UI.",
          useOllama: useLlm,
        });

        pushAssistant(
          `I saved this dashboard pattern. RAG memory now has ${result?.stats?.total || "updated"} patterns.`,
          {
            type: "action",
            provider: "smart-rag-training",
          },
        );
        return;
      }

      const command = await schemaAiClient.sendDashboardCommand(
        payload.id || "local-dataset",
        text,
        allSpecs,
        payload,
        { useLlm },
      );
      applyCommand(command);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dashboard command failed.";
      setError(message);

      if (/fix|build|regenerate|dashboard/i.test(text)) {
        const localCharts = buildDefaultCharts(rows).map(({ data: _data, subtitle: _subtitle, warning: _warning, calculatedLocally: _local, ...spec }) => spec);
        const localKpis = buildKpis(rows).map(({ value: _value, rawValue: _rawValue, subtitle: _subtitle, status: _status, insight: _insight, calculatedLocally: _local, ...spec }) => spec);
        setDashboardSpecs({ kpis: localKpis, charts: localCharts, source: "frontend-fallback" });
        pushAssistant(`Backend command failed, so I rebuilt the dashboard locally. ${message}`, { type: "warning" });
      } else {
        pushAssistant(message || localFallbackAnswer(text, rows), { type: "warning" });
      }
    } finally {
      setLoading(false);
    }
  }, [allSpecs, applyCommand, loading, payload, pushAssistant, rows, useLlm]);

  const askChat = useCallback(async (query: string) => {
    const text = query.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { id: makeId(), role: "user", content: text }]);

    try {
      const response = await schemaAiClient.sendSchemaChat(payload.id || "local-dataset", text, payload, { useLlm });
      pushAssistant(response.assistantMessage?.content || localFallbackAnswer(text, rows), {
        type: "text",
        model: response.assistantMessage?.model,
        provider: response.assistantMessage?.provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Schema chat failed.";
      setError(message);
      pushAssistant(`${localFallbackAnswer(text, rows)} Debug: ${message}`, { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [loading, payload, pushAssistant, rows, useLlm]);

  const convertChart = useCallback((chartId: string, type: ChartType) => {
    setDashboardSpecs((current) => ({
      ...current,
      charts: current.charts.map((chart) => chart.id === chartId ? { ...chart, type } : chart),
    }));
    setManualCharts((current) => current.map((chart) => chart.id === chartId ? { ...chart, type } : chart));
  }, []);

  return {
    loading,
    error,
    messages,
    filters,
    setFilters,
    filteredRows,
    kpis: rendered.kpis as DashboardKpi[],
    charts: rendered.charts as DashboardChart[],
    dashboardSpecs: allSpecs,
    dashboardHealth,
    runCommand,
    askChat,
    applyCommand,
    convertChart,
  };
}
