import type { DashboardChart, DashboardFilters, DashboardKpi } from "@/features/dashboard/utils/dashboardAnalytics";

export type StoredDashboardState = {
  filters: DashboardFilters;
  manualCharts: DashboardChart[];
  manualKpis: DashboardKpi[];
};

function getKey(datasetId?: string) {
  return datasetId ? `insightflow-dashboard-state:${datasetId}` : "";
}

export function loadDashboardState(datasetId?: string): StoredDashboardState {
  if (!datasetId || typeof window === "undefined") {
    return { filters: {}, manualCharts: [], manualKpis: [] };
  }

  try {
    const raw = window.localStorage.getItem(getKey(datasetId));
    if (!raw) return { filters: {}, manualCharts: [], manualKpis: [] };
    const parsed = JSON.parse(raw) as Partial<StoredDashboardState>;
    return {
      filters: parsed.filters || {},
      manualCharts: Array.isArray(parsed.manualCharts) ? parsed.manualCharts : [],
      manualKpis: Array.isArray(parsed.manualKpis) ? parsed.manualKpis : [],
    };
  } catch {
    return { filters: {}, manualCharts: [], manualKpis: [] };
  }
}

export function saveDashboardState(datasetId: string | undefined, state: StoredDashboardState) {
  if (!datasetId || typeof window === "undefined") return;
  window.localStorage.setItem(getKey(datasetId), JSON.stringify(state));
}
