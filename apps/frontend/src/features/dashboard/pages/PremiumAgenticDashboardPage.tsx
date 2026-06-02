import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Download, FileJson, Share2, Trash2, Plus, UploadCloud, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import { ChartErrorBoundary } from "@/features/dashboard/components/ChartErrorBoundary";
import { EnhancedAgentPanel } from "@/features/dashboard/components/EnhancedAgentPanel";
import { PremiumDataPreview } from "@/features/dashboard/components/PremiumDataPreview";
import { PremiumInsightCards } from "@/features/dashboard/components/PremiumInsightCards";
import { PremiumMetricCard } from "@/features/dashboard/components/PremiumMetricCard";
import { PremiumRagPipeline } from "@/features/dashboard/components/PremiumRagPipeline";
import { ChartModals } from "@/features/dashboard/components/ChartModals";
import { usePremiumAgenticDashboard } from "@/features/dashboard/hooks/usePremiumAgenticDashboard";
import { useChartManager } from "@/features/dashboard/hooks/useChartManager";
import { buildDashboardChartFromCommand } from "@/features/dashboard/utils/dashboardCustomChart";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";
import GlobalGeoIntelligence from "@/features/dashboard/components/GlobalGeoIntelligence";

const PremiumChartCard = lazy(() => import("@/features/dashboard/components/PremiumChartCard"));

export default function PremiumAgenticDashboardPage() {
  const navigate = useNavigate();
  const { dataset, deleteDataset, loadDemo, isHydrating } = useData();
  const { dashboard, messages, loading, error, deepResearch, setDeepResearch, runPrompt } = usePremiumAgenticDashboard(dataset);
  const [chartsReady, setChartsReady] = useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState("Overview");
  const [dashboardMode, setDashboardMode] = useState<"Executive" | "Analyst" | "Story" | "Agentic Mode">("Agentic Mode");
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  
  // Chart management state
  const chartManager = useChartManager(dashboard?.charts || []);
  const [modalType, setModalType] = useState<"customize" | "build" | null>(null);
  const hasGeoColumn = useMemo(
    () => Boolean(dataset?.columns.some((column) => /country|region|state|city|location|territory|province|geo|lat|lon/i.test(column.name) || ["country", "city", "latitude", "longitude"].includes(column.type))),
    [dataset?.columns],
  );
  const hasDateColumn = useMemo(
    () => Boolean(dataset?.columns.some((column) => /date|month|year|time|created|updated|timestamp/i.test(column.name) || column.type === "date")),
    [dataset?.columns],
  );
  const analyticsTabs = useMemo(
    () => [
      "Overview",
      "Correlations",
      "Ranking",
      "Distribution",
      ...(hasDateColumn ? ["Trends"] : []),
      "Outliers",
      ...(hasGeoColumn ? ["Geo Analysis"] : []),
    ],
    [hasDateColumn, hasGeoColumn],
  );
  const promptChips = useMemo(() => generateDynamicQuestionSuggestions(dataset || undefined, 4), [dataset]);
  const columnNames = useMemo(
    () => dataset?.columns.map((column) => column.name).filter(Boolean) || [],
    [dataset?.columns],
  );
  const tabCharts = chartManager.getVisibleCharts().filter((chart) => {
    const title = `${chart.title} ${chart.type} ${chart.subtitle || ""}`.toLowerCase();

    if (activeAnalyticsTab === "Overview") return true;
    if (activeAnalyticsTab === "Correlations") return title.includes("correlation") || title.includes("vs") || chart.type === "scatter";
    if (activeAnalyticsTab === "Ranking") return !title.includes("outlier") && (title.includes("top") || title.includes("ranking") || chart.type === "table");
    if (activeAnalyticsTab === "Distribution") return title.includes("distribution") || chart.type === "histogram" || chart.type === "donut";
    if (activeAnalyticsTab === "Trends") return title.includes("trend") || chart.type === "line" || title.includes("date") || title.includes("month");
    if (activeAnalyticsTab === "Outliers") return title.includes("outlier") || title.includes("anomaly");
    if (activeAnalyticsTab === "Geo Analysis") return chart.type === "map" || title.includes("country") || title.includes("region") || title.includes("geo") || title.includes("location");

    return true;
  }).sort((left, right) => {
    if (activeAnalyticsTab !== "Geo Analysis") return 0;
    if (left.type === "map" && right.type !== "map") return -1;
    if (right.type === "map" && left.type !== "map") return 1;
    return 0;
  });

  useEffect(() => {
    if (!analyticsTabs.includes(activeAnalyticsTab)) {
      setActiveAnalyticsTab("Overview");
    }
  }, [activeAnalyticsTab, analyticsTabs]);

  useEffect(() => {
    setChartsReady(false);
    const timer = window.setTimeout(() => setChartsReady(true), 80);
    return () => window.clearTimeout(timer);
  }, [dataset?.id]);

  const downloadDataset = async (format: "csv" | "json") => {
    if (!dataset?.id) return;
    const blob = await api.exportDataset(dataset.id, format);
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${dataset.name || "dataset"}.${format}`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleChartCommand = (command: {
    action: string;
    chartId?: string;
    params?: Record<string, unknown>;
  }) => {
    switch (command.action) {
      case "create": {
        const chart = buildDashboardChartFromCommand(dataset, command.params || {});
        if (chart) {
          chartManager.addChart(chart);
          setActiveAnalyticsTab("Overview");
        } else {
          setModalType("build");
        }
        break;
      }
      case "remove":
        if (command.chartId) {
          const result = chartManager.removeChart(command.chartId);
          if (result.success) {
            // Could show toast notification here
            console.log(result.message);
          }
        }
        break;
      case "modify": {
        if (command.chartId) {
          const chart = chartManager.getChartById(command.chartId);
          if (chart) {
            const updatedChart = buildDashboardChartFromCommand(dataset, command.params || {}, chart);
            if (updatedChart) {
              chartManager.updateChart(command.chartId, updatedChart);
            } else {
              chartManager.setSelectedChartId(command.chartId);
              setModalType("customize");
            }
          }
        }
        break;
      }
      case "duplicate":
        if (command.chartId) {
          chartManager.duplicateChart(command.chartId);
        }
        break;
      case "toggle_visibility":
      case "toggle":
        if (command.chartId) {
          chartManager.toggleChartVisibility(command.chartId);
        }
        break;
    }
  };

  const handleCustomizeChart = (updates: Partial<PremiumChart>) => {
    if (chartManager.selectedChartId) {
      chartManager.updateChart(chartManager.selectedChartId, updates);
    }
  };

  const handleCreateChart = (newChart: PremiumChart) => {
    chartManager.addChart(newChart);
  };

  if (!dataset || !dashboard) {
    return (
      <main className="min-h-screen bg-[#020617] p-4 text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.32),transparent_32%),radial-gradient(circle_at_top_right,rgba(6,182,212,.14),transparent_34%),linear-gradient(180deg,#020617,#020617)]" />
        <section className="relative mx-auto mt-16 max-w-4xl rounded-3xl border border-violet-400/20 bg-slate-950/75 p-8 text-center shadow-[0_0_60px_rgba(124,58,237,0.16)] backdrop-blur-xl">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-[0_0_32px_rgba(34,211,238,.26)]">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">InsightFlow Dashboard</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Upload CSV, XLSX, or JSON to auto-generate KPIs, charts, data quality checks, geo analytics, AI Insight Engine status, and local AI insights.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/upload")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,.35)]"
            >
              <UploadCloud className="h-4 w-4" />
              Upload dataset
            </button>
            <button
              type="button"
              onClick={loadDemo}
              disabled={isHydrating}
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-violet-400/50 disabled:opacity-60"
            >
              Load demo data
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.32),transparent_32%),radial-gradient(circle_at_top_right,rgba(6,182,212,.14),transparent_34%),linear-gradient(180deg,#020617,#020617)]" />

      <div className={`relative grid gap-5 p-4 transition-all duration-300 ${aiPanelCollapsed ? "xl:grid-cols-[minmax(0,1fr)_60px]" : "xl:grid-cols-[minmax(0,1fr)_330px]"}`}>
        <section className="min-w-0 space-y-4">
          <header className="rounded-3xl border border-violet-400/20 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(124,58,237,0.13)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400">
                  Dataset: <span className="font-semibold text-emerald-300">{dataset.name}</span>
                  <span className="ml-2 rounded-full border border-slate-700 px-2 py-0.5 text-[10px]">{dataset.rows.length.toLocaleString()} rows</span>
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-white">DASHBOARD</h1>
                <p className="text-sm text-slate-400">AI-powered insights & agentic analytics</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300" type="button"><Share2 className="h-4 w-4" aria-hidden="true" />Share</button>
                <button onClick={() => downloadDataset("csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300" type="button"><Download className="h-4 w-4" aria-hidden="true" />Export</button>
                <button onClick={() => downloadDataset("json")} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300" type="button"><FileJson className="h-4 w-4" aria-hidden="true" />JSON</button>
                <button onClick={deleteDataset} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200" type="button"><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
              {["Executive", "Analyst", "Story", "Agentic Mode"].map((tab) => (
                <button key={tab} onClick={() => setDashboardMode(tab as typeof dashboardMode)} className={`rounded-xl px-5 py-2.5 ${dashboardMode === tab ? "bg-violet-600 text-white shadow-[0_0_18px_rgba(124,58,237,.45)]" : "text-slate-400 hover:text-white"}`} type="button">
                  {tab}
                  {tab === "Agentic Mode" && <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">BETA</span>}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {promptChips.map((chip) => (
                <button key={chip} onClick={() => runPrompt(chip)} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-400 hover:border-violet-400/50 hover:text-white" type="button">{chip}</button>
              ))}
            </div>
          </header>

          <section className="rounded-3xl border border-violet-400/20 bg-slate-950/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">{dataset.name}</h2>
                <p className="text-xs text-slate-500">Ready - {dataset.rows.length.toLocaleString()} rows - {dataset.columns.length} columns - {dataset.sourceType || "CSV"}</p>
              </div>
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-emerald-400/60 bg-emerald-400/10 text-center">
                <div>
                  <p className="text-xl font-black text-emerald-200">{dashboard.qualityScore}</p>
                  <p className="text-[10px] text-emerald-300">/100</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {dashboard.kpis.slice(0, 3).map((kpi) => (
                  <PremiumMetricCard key={kpi.id} kpi={kpi} featured={true} />
                ))}
              </div>
              {dashboard.kpis.length > 3 && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 border-t border-slate-800/40 pt-4">
                  {dashboard.kpis.slice(3).map((kpi) => (
                    <PremiumMetricCard key={kpi.id} kpi={kpi} featured={false} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {error && <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div>}

          <section className="rounded-3xl border border-violet-400/20 bg-slate-950/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {analyticsTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveAnalyticsTab(tab)}
                    className={`rounded-lg px-3 py-2 transition ${
                      activeAnalyticsTab === tab
                        ? "bg-violet-600 text-white"
                        : "text-slate-500 hover:bg-slate-900 hover:text-white"
                    }`}
                    type="button"
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setModalType("build")}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/20 transition"
                type="button"
                title="Create custom chart"
              >
                <Plus className="h-4 w-4" />
                Add Chart
              </button>
            </div>
            {chartsReady ? (
              <Suspense fallback={<div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">{tabCharts.slice(0, 3).map((chart) => <div key={chart.id} className="h-[330px] animate-pulse rounded-2xl border border-indigo-400/10 bg-slate-900/50" />)}</div>}>
                {activeAnalyticsTab === "Geo Analysis" && dataset?.rows?.length ? (
                  <GlobalGeoIntelligence rows={dataset.rows} columns={dataset.columns} />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {tabCharts.map((chart) => (
                      <ChartErrorBoundary key={chart.id} fallbackTitle={chart.title}>
                        <PremiumChartCard
                          chart={chart}
                          isVisible={chartManager.visibleCharts.has(chart.id)}
                          isSelected={chartManager.selectedChartId === chart.id}
                          onEdit={(chartId) => {
                            chartManager.setSelectedChartId(chartId);
                            setModalType("customize");
                          }}
                          onRemove={(chartId) => {
                            chartManager.removeChart(chartId);
                          }}
                          onDuplicate={(chartId) => {
                            chartManager.duplicateChart(chartId);
                          }}
                          onToggleVisibility={(chartId) => {
                            chartManager.toggleChartVisibility(chartId);
                          }}
                          onSelect={(chartId) => {
                            chartManager.setSelectedChartId(
                              chartManager.selectedChartId === chartId ? null : chartId
                            );
                          }}
                        />
                      </ChartErrorBoundary>
                    ))}
                    {tabCharts.length === 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                        No {activeAnalyticsTab} chart found for this dataset yet.
                        Click <span className="text-violet-300">Add Chart</span> to create one.
                      </div>
                    )}
                  </div>
                )}
              </Suspense>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {tabCharts.slice(0, 3).map((chart) => <div key={chart.id} className="h-[330px] animate-pulse rounded-2xl border border-indigo-400/10 bg-slate-900/50" />)}
              </div>
            )}
          </section>

          <PremiumInsightCards insights={dashboard.insights} />

          <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
            <PremiumRagPipeline steps={dashboard.ragPipeline} />
            <PremiumDataPreview dataset={dataset} onViewFullTable={() => navigate("/data")} onDownload={() => downloadDataset("csv")} />
          </div>

        </section>

        <EnhancedAgentPanel
          messages={messages}
          reasoning={dashboard.reasoning}
          loading={loading}
          onAsk={runPrompt}
          charts={chartManager.getVisibleCharts()}
          availableColumns={columnNames}
          onChartCommand={handleChartCommand}
          onCreateChart={() => setModalType("build")}
          deepResearch={deepResearch}
          onDeepResearchChange={setDeepResearch}
          isCollapsed={aiPanelCollapsed}
          onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)}
        />

        <ChartModals
          modalType={modalType}
          selectedChart={
            chartManager.selectedChartId
              ? chartManager.getChartById(chartManager.selectedChartId) || null
              : null
          }
          availableColumns={columnNames}
          data={dataset.rows}
          onCustomize={handleCustomizeChart}
          onCreateChart={handleCreateChart}
          onClose={() => {
            setModalType(null);
            chartManager.setSelectedChartId(null);
          }}
        />
      </div>
    </main>
  );
}
