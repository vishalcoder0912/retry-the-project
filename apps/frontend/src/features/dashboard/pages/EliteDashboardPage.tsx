import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  MoreVertical,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Table2,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import SchemaDashboardChat from "@/features/dashboard/components/SchemaDashboardChat";
import { useDashboardAiController } from "@/features/dashboard/hooks/useDashboardAiController";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useSchemaTrainedDashboard } from "@/features/dashboard/hooks/useSchemaTrainedDashboard";
import { useData } from "@/features/data/context/useData";
import type { ChartType } from "@/features/dashboard/types/dashboardTypes";
import type { InsightFlowResult, InsightFlowFilter } from "@/features/dashboard/types/dashboardTypes";
import type { Aggregation, ChartIntent, ChartSpec, KpiSpec } from "@/types/dashboard";
import GeoIntelligence from "@/features/dashboard/geo/GeoIntelligence";
import {
  applyFilters,
  buildChartFromSpec,
  buildDataQualityScore,
  buildDatasetProfile,
  buildKpiFromSpec,
  buildKpis,
  cleanDatasetRows,
  exportDashboardToJson,
  exportRowsToCsv,
  getUniqueValues,
  type DashboardChart,
  type DashboardFilters,
  type DashboardKpi,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import {
  loadDashboardState,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";
import { runInsightFlow } from "@/features/dashboard/utils/insightFlowEngine";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";
const CHART_TYPES: ChartType[] = [
  "bar",
  "line",
  "area",
  "pie",
  "donut",
  "histogram",
  "scatter",
  "radar",
  "composed",
  "heatmap",
];

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: Date | string | null) {
  if (!value) return "Just now";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Just now";
}

function fileType(datasetName?: string, sourceType?: string) {
  if (sourceType === "pdf") return "PDF";
  const ext = datasetName?.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "CSV";
}

function QualityRing({ score }: { score: number }) {
  return (
    <div
      className="grid size-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#22c55e ${score * 3.6}deg, rgba(51,65,85,0.9) 0deg)`,
      }}
    >
      <div className="grid size-14 place-items-center rounded-full bg-slate-950 text-center">
        <span className="text-lg font-bold text-white">{Math.round(score)}%</span>
      </div>
    </div>
  );
}

function KpiCard({ kpi, index }: { kpi: DashboardKpi; index: number }) {
  const colors = ["bg-blue-500/20 text-blue-300", "bg-violet-500/20 text-violet-300", "bg-cyan-500/20 text-cyan-300", "bg-amber-500/20 text-amber-300", "bg-red-500/20 text-red-300", "bg-green-500/20 text-green-300"];

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{kpi.title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{kpi.value}</p>
          <p className="mt-1 text-xs text-slate-500">{kpi.subtitle}</p>
        </div>
        <div className={`rounded-2xl p-3 ${colors[index % colors.length]}`}>
          <Database className="size-5" />
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ result, mode }: { result: InsightFlowResult; mode: string }) {
  const insight = mode === "Executive" ? result.insights.executive
    : mode === "Analyst" ? result.insights.analyst
      : result.insights.story;

  const icon = mode === "Executive" ? <TrendingUp className="size-4" />
    : mode === "Analyst" ? <BarChart3 className="size-4" />
      : <Lightbulb className="size-4" />;

  const borderColor = mode === "Executive" ? "border-violet-500/40"
    : mode === "Analyst" ? "border-cyan-500/40"
      : "border-amber-500/40";

  const bgColor = mode === "Executive" ? "from-violet-600/10"
    : mode === "Analyst" ? "from-cyan-600/10"
      : "from-amber-600/10";

  return (
    <section className={`rounded-2xl border ${borderColor} bg-gradient-to-r ${bgColor} via-slate-900/80 to-slate-900/60 p-5 shadow-xl backdrop-blur`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid size-8 place-items-center rounded-lg ${
          mode === "Executive" ? "bg-violet-500/20 text-violet-300"
            : mode === "Analyst" ? "bg-cyan-500/20 text-cyan-300"
              : "bg-amber-500/20 text-amber-300"
        }`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{mode} Insight</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{insight}</p>
        </div>
      </div>
      {result.qualityScore.total > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Target className="size-3" />
          Dashboard Score: <span className={`font-semibold ${result.qualityScore.passed ? "text-green-400" : "text-amber-400"}`}>
            {result.qualityScore.total}% {result.qualityScore.passed ? "(Passed)" : "(Needs Improvement)"}
          </span>
        </div>
      )}
    </section>
  );
}

function QualityRings({ quality, insightScore }: { quality: { finalScore: number }; insightScore: { total: number; passed: boolean } }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <p className="mb-1 text-xs text-slate-400">Data Quality</p>
        <div
          className="grid size-16 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#22c55e ${quality.finalScore * 3.6}deg, rgba(51,65,85,0.9) 0deg)`,
          }}
        >
          <div className="grid size-11 place-items-center rounded-full bg-slate-950 text-center">
            <span className="text-sm font-bold text-white">{Math.round(quality.finalScore)}%</span>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="mb-1 text-xs text-slate-400">Dashboard Score</p>
        <div
          className="grid size-16 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${insightScore.passed ? "#7c3aed" : "#f59e0b"} ${insightScore.total * 3.6}deg, rgba(51,65,85,0.9) 0deg)`,
          }}
        >
          <div className="grid size-11 place-items-center rounded-full bg-slate-950 text-center">
            <span className="text-sm font-bold text-white">{Math.round(insightScore.total)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChips({ filters, activeFilters, onFilterChange }: {
  filters: InsightFlowFilter[];
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const key = filter.key;
        const isActive = activeFilters[key] !== undefined && activeFilters[key] !== "";
        return (
          <div key={key} className="relative">
            {filter.type === "date" ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
                <Calendar className="size-4 text-slate-400" />
                <input
                  type="date"
                  value={String(activeFilters[`${key}Start`] || "")}
                  onChange={(e) => onFilterChange(`${key}Start`, e.target.value)}
                  className="w-32 bg-transparent outline-none"
                  placeholder="Start"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="date"
                  value={String(activeFilters[`${key}End`] || "")}
                  onChange={(e) => onFilterChange(`${key}End`, e.target.value)}
                  className="w-32 bg-transparent outline-none"
                  placeholder="End"
                />
              </div>
            ) : filter.type === "geo" || filter.type === "category" || filter.type === "business" ? (
              <select
                value={String(activeFilters[key] || "")}
                onChange={(e) => onFilterChange(key, e.target.value)}
                className={`rounded-xl border px-4 py-2 text-sm outline-none ${
                  isActive
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                    : "border-slate-700/60 bg-slate-900/70 text-slate-100"
                }`}
              >
                <option value="">All {filter.label}</option>
                {filter.values.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function EliteDashboardPage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate, deleteDataset } = useData();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [manualCharts, setManualCharts] = useState<DashboardChart[]>([]);
  const [manualKpis, setManualKpis] = useState<DashboardKpi[]>([]);
  const [hiddenChartIds, setHiddenChartIds] = useState<Set<string>>(new Set());
  const [chartTypeOverrides, setChartTypeOverrides] = useState<Record<string, ChartType>>({});
  const [showSchema, setShowSchema] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<"Executive" | "Analyst" | "Story">("Executive");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [useInsightFlow, setUseInsightFlow] = useState(true);

  const rawRows = useMemo<Row[]>(() => (dataset?.rows || []) as Row[], [dataset?.rows]);
  const rows = useMemo(() => cleanDatasetRows(rawRows), [rawRows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const filteredRows = useMemo(() => {
    let result = applyFilters(rows, filters);
    if (countryFilter && profile.locationColumn) {
      result = result.filter(
        (r) => String(r[profile.locationColumn!.name]).toLowerCase() === countryFilter.toLowerCase(),
      );
    }
    return result;
  }, [rows, filters, countryFilter, profile.locationColumn]);
  const insightFlowResult = useMemo<InsightFlowResult | null>(() => {
    if (!useInsightFlow || !rows.length) return null;
    return runInsightFlow(rows);
  }, [rows, useInsightFlow]);

  const insightFlowFilters = useMemo(() => {
    return insightFlowResult?.filters || [];
  }, [insightFlowResult]);

  const defaultKpis = useMemo(() => buildKpis(filteredRows), [filteredRows]);
  const tableColumns = profile.columns.map((column) => column.name);
  const schemaDashboard = useSchemaTrainedDashboard({
    datasetId: dataset?.id || "local-dataset",
    datasetName: dataset?.name || "Uploaded Dataset",
    rows,
    columns: dataset?.columns || tableColumns,
    dictionaryRows: (dataset as { dictionaryRows?: unknown[] } | null)?.dictionaryRows || (dataset as { dataDictionary?: unknown[] } | null)?.dataDictionary || [],
    autoLoad: Boolean(rows.length),
  });
  const aiController = useDashboardAiController({
    dataset: {
      id: dataset?.id || "local-dataset",
      name: dataset?.name || "Uploaded Dataset",
      rows,
      columns: dataset?.columns || tableColumns,
    },
    initialDashboard: {
      kpis: schemaDashboard.kpiSpecs as KpiSpec[],
      charts: schemaDashboard.chartSpecs as ChartSpec[],
      source: schemaDashboard.provider,
    },
    initialFilters: filters,
  });

  useEffect(() => {
    const current = JSON.stringify(filters);
    const next = JSON.stringify(aiController.filters);
    if (current !== next) setFilters(aiController.filters);
  }, [aiController.filters, filters]);

  useEffect(() => {
    if (!dataset?.id) return;
    const stored = loadDashboardState(dataset.id);
    setFilters(stored.filters);
    setManualCharts(stored.manualCharts);
    setManualKpis(stored.manualKpis);
    setHiddenChartIds(new Set());
    setChartTypeOverrides({});
  }, [dataset?.id]);

  useEffect(() => {
    if (!dataset?.id) return;
    saveDashboardState(dataset.id, { filters, manualCharts, manualKpis });
  }, [dataset?.id, filters, manualCharts, manualKpis]);

  const insightFlowKpis = useMemo(() => {
    if (!insightFlowResult?.kpis.length) return [];
    return insightFlowResult.kpis.map((k) => ({
      id: k.id,
      title: k.title,
      value: k.value,
      rawValue: k.rawValue,
      subtitle: k.subtitle,
      metric: k.metric,
      aggregation: k.aggregation as Aggregation,
      format: k.format,
      businessKpi: true,
    })) as DashboardKpi[];
  }, [insightFlowResult]);

  const insightFlowCharts = useMemo(() => {
    if (!insightFlowResult?.charts.length) return [];
    return insightFlowResult.charts.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      subtitle: c.subtitle,
      xKey: c.xKey,
      yKey: c.yKey,
      aggregation: c.aggregation as Aggregation,
      intent: c.intent,
      data: c.data,
      businessValue: c.businessValue,
      warning: c.warning,
    })) as DashboardChart[];
  }, [insightFlowResult]);

  const trainedCharts = useMemo(
    () =>
      schemaDashboard.chartSpecs
        .map((spec) =>
          buildChartFromSpec(filteredRows, {
            ...spec,
            type: chartTypeOverrides[spec.id || spec.title] || spec.type,
          } as ChartSpec),
        )
        .filter(Boolean),
    [chartTypeOverrides, filteredRows, schemaDashboard.chartSpecs],
  );

  const charts = useMemo(() => {
    const source = insightFlowCharts.length ? insightFlowCharts
      : aiController.charts.length ? aiController.charts
        : trainedCharts;
    const merged = [...manualCharts, ...source]
      .filter(Boolean)
      .filter((chart) => !hiddenChartIds.has(chart.id));

    const seen = new Set<string>();

    return merged
      .filter((chart) => {
        const key = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 7);
  }, [aiController.charts, hiddenChartIds, manualCharts, trainedCharts]);

  const trainedKpis = useMemo(
    () =>
      schemaDashboard.kpiSpecs
        .map((spec) => buildKpiFromSpec(filteredRows, spec as KpiSpec))
        .filter(Boolean),
    [filteredRows, schemaDashboard.kpiSpecs],
  );

  const kpis = useMemo(
    () => {
      const source = insightFlowKpis.length ? insightFlowKpis
        : aiController.kpis.length ? aiController.kpis
          : trainedKpis.length ? trainedKpis
            : defaultKpis;
      return [...source, ...manualKpis].slice(0, 8);
    },
    [insightFlowKpis, aiController.kpis, defaultKpis, manualKpis, trainedKpis],
  );

  const handleInsightFlowFilter = (key: string, value: string) => {
    if (key.endsWith("Start") || key.endsWith("End")) {
      const filterKey = key.endsWith("Start") ? "dateStart" : "dateEnd";
      setFilters((prev) => ({ ...prev, [filterKey]: value || undefined }));
      aiController.setFilters({ ...filters, [filterKey]: value || undefined });
    } else {
      const next = { ...filters, [key]: value || undefined };
      setFilters(next);
      aiController.setFilters(next);
    }
  };

  const primaryFilter = profile.primaryCategory;
  const dateColumn = profile.dateColumn;

  if (isHydrating) {
    return <StatusPanel title="Loading dashboard" message="Preparing your analytics workspace." />;
  }

  if (apiError) {
    return <StatusPanel title="Dashboard unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  }

  if (!dataset) {
    return (
      <StatusPanel
        title="No dataset loaded"
        message="Upload a dataset to build a schema-aware dashboard, or load the demo dataset to explore the interface."
        actionLabel="Load Demo Dataset"
        onAction={() => void loadDemo()}
      />
    );
  }

  function updateChartType(chart: DashboardChart, type: ChartType) {
    const converted = buildChartFromSpec(filteredRows, { ...chart, type });
    aiController.convertChart(chart.id, type);
    setManualCharts((current) =>
      current.some((item) => item.id === chart.id)
        ? current.map((item) => (item.id === chart.id ? converted : item))
        : current,
    );
    setChartTypeOverrides((current) => ({ ...current, [chart.id]: type }));
  }

  function removeChart(chart: DashboardChart) {
    setManualCharts((current) => current.filter((item) => item.id !== chart.id));
    setHiddenChartIds((current) => new Set([...current, chart.id]));
  }

  function duplicateChart(chart: DashboardChart) {
    setManualCharts((current) => [{ ...chart, id: crypto.randomUUID(), title: `${chart.title} Copy` }, ...current]);
  }

  function exportCsv() {
    downloadFile(`${dataset.name || "dataset"}-filtered.csv`, exportRowsToCsv(filteredRows), "text/csv;charset=utf-8");
  }

  function exportJson() {
    downloadFile(
      `${dataset.name || "dashboard"}-dashboard.json`,
      exportDashboardToJson({
        datasetName: dataset.name,
        filters,
        kpis,
        charts,
      }),
      "application/json;charset=utf-8",
    );
  }

  async function shareDashboard() {
    const summary = [
      `Dataset: ${dataset.name}`,
      `Rows: ${filteredRows.length}/${rows.length}`,
      `Columns: ${profile.columns.length}`,
      `Quality: ${quality.finalScore}%`,
      `Filters: ${Object.entries(filters).filter(([key, value]) => key !== "conditions" && value).map(([key, value]) => `${key}=${String(value)}`).join(", ") || "none"}`,
      `Charts: ${charts.map((chart) => chart.title).join(", ") || "none"}`,
    ].join("\n");

    await navigator.clipboard?.writeText(summary);
  }

  function resetDashboard() {
    setFilters({});
    aiController.setFilters({});
    setManualCharts([]);
    setManualKpis([]);
    setHiddenChartIds(new Set());
    setChartTypeOverrides({});
  }

  function applyAiDashboardCommand(command: Record<string, unknown>) {
    if (!command) return;

    if (command.action === "GENERATE_DASHBOARD") {
      const plan = command.dashboardPlan || command.dashboard;

      if (plan?.charts?.length || plan?.kpis?.length) {
        schemaDashboard.applyCommand(command);

        setManualCharts([]);
        setManualKpis([]);
        setHiddenChartIds(new Set());

        return;
      }
    }

    schemaDashboard.applyCommand(command);
    aiController.applyCommand(command);
  }

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-white">{dataset.name}</span>
              <span>-</span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs">{filteredRows.length.toLocaleString()} rows</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
              {insightFlowResult?.dashboardType || "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {insightFlowResult
                ? `${insightFlowResult.datasetType} · ${insightFlowResult.qualityScore.passed ? "Self-critic: Passed" : "Self-critic: Scored " + insightFlowResult.qualityScore.total + "%"}`
                : "Auto-generated insights from your current dataset schema."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={shareDashboard} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <Share2 className="mr-2 inline size-4" />
              Share
            </button>
            <button type="button" onClick={exportCsv} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <Download className="mr-2 inline size-4" />
              Export CSV
            </button>
            <button type="button" onClick={exportJson} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <FileText className="mr-2 inline size-4" />
              JSON
            </button>
            <button type="button" onClick={() => void deleteDataset()} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
              <Trash2 className="mr-2 inline size-4" />
              Delete
            </button>
            <button type="button" className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 text-slate-100 hover:bg-slate-800">
              <MoreVertical className="size-5" />
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-3">
          <div className="flex rounded-xl border border-slate-700/70 bg-slate-950/70 p-1">
            {(["Executive", "Analyst", "Story"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDashboardMode(mode)}
                className={[
                  "min-w-24 rounded-lg px-4 py-2 text-sm font-medium transition",
                  dashboardMode === mode
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                ].join(" ")}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {insightFlowResult && (
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-violet-200">
                {insightFlowResult.datasetType}
              </span>
            )}
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              {insightFlowCharts.length || schemaDashboard.chartSpecs.length || charts.length} charts
            </span>
            {insightFlowResult && (
              <span className={`rounded-full border px-3 py-1 ${
                insightFlowResult.qualityScore.passed
                  ? "border-green-500/30 bg-green-500/10 text-green-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}>
                {insightFlowResult.qualityScore.passed ? "✓ Self-Critic Passed" : `Self-Critic ${insightFlowResult.qualityScore.total}%`}
              </span>
            )}
            {schemaDashboard.memoryMatch && (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                trained memory matched
              </span>
            )}
            {schemaDashboard.loading && <span>Training dashboard...</span>}
          </div>
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <main className="space-y-5">
            <section className="flex flex-wrap gap-3">
              {insightFlowFilters.length > 0 ? (
                <FilterChips
                  filters={insightFlowFilters}
                  activeFilters={filters as Record<string, string>}
                  onFilterChange={handleInsightFlowFilter}
                />
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
                    <Calendar className="size-4 text-slate-400" />
                    {dateColumn ? (
                      <>
                        <input
                          type="date"
                          value={String(filters.dateStart || "")}
                          onChange={(event) => {
                            const next = { ...filters, dateStart: event.target.value };
                            setFilters(next);
                            aiController.setFilters(next);
                          }}
                          className="bg-transparent outline-none"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="date"
                          value={String(filters.dateEnd || "")}
                          onChange={(event) => {
                            const next = { ...filters, dateEnd: event.target.value };
                            setFilters(next);
                            aiController.setFilters(next);
                          }}
                          className="bg-transparent outline-none"
                        />
                      </>
                    ) : (
                      <span>All rows</span>
                    )}
                  </div>

                  {primaryFilter && (
                    <select
                      value={String(filters[primaryFilter.name] || "")}
                      onChange={(event) => {
                        const next = { ...filters, [primaryFilter.name]: event.target.value || undefined };
                        setFilters(next);
                        aiController.setFilters(next);
                      }}
                      className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 outline-none"
                    >
                      <option value="">All {primaryFilter.name}</option>
                      {getUniqueValues(rows, primaryFilter.name, 50).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              <button type="button" onClick={() => { setFilters({}); aiController.setFilters({}); }} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                <RefreshCw className="mr-2 inline size-4" />
                Reset
              </button>
            </section>

            <section className={`${CARD} border-violet-500/60 bg-gradient-to-r from-violet-600/25 via-slate-900/80 to-blue-600/10 p-5`}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-600/20">
                    <FileSpreadsheet className="size-9 text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-semibold text-white">{dataset.name}</h2>
                      <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300">Ready</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                      <span>{rows.length.toLocaleString()} rows</span>
                      <span>{profile.columns.length.toLocaleString()} columns</span>
                      <span>{fileType(dataset.fileName || dataset.name, dataset.sourceType)}</span>
                      <span>Uploaded {formatDate(dataset.uploadedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">Schema-aware dashboard with locally calculated values.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {insightFlowResult ? (
                    <QualityRings quality={quality} insightScore={insightFlowResult.qualityScore} />
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400">Data Quality Score</p>
                      <QualityRing score={quality.finalScore} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setUseInsightFlow((p) => !p)} className={`rounded-xl border px-4 py-2 text-sm ${
                      useInsightFlow
                        ? "border-violet-500/50 bg-violet-500/10 text-violet-200"
                        : "border-slate-700/60 bg-slate-950/60 text-slate-100"
                    }`}>
                      <CheckCircle2 className="mr-2 inline size-4" />
                      InsightFlow
                    </button>
                    <button type="button" onClick={() => setShowSchema(true)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                      <Table2 className="mr-2 inline size-4" />
                      View Schema
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {kpis.slice(0, 6).map((kpi, index) => (
                <KpiCard key={`${kpi.id}-${index}`} kpi={kpi} index={index} />
              ))}
            </section>

            {insightFlowResult && <InsightPanel result={insightFlowResult} mode={dashboardMode} />}

            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {charts.length ? (
                charts.slice(0, 9).map((chart) => (
                  <SmartChartCard
                    key={chart.id}
                    chart={chart}
                    availableTypes={CHART_TYPES}
                    onTypeChange={(type) => updateChartType(chart, type)}
                    onRemove={() => removeChart(chart)}
                    onDuplicate={() => duplicateChart(chart)}
                  />
                ))
              ) : (
                <div className={`${CARD} col-span-full p-10 text-center text-slate-400`}>
                  Not enough data to render charts yet.
                </div>
              )}
            </section>

            <GeoIntelligence
              rows={filteredRows}
              columns={tableColumns}
              onFilterByCountry={(country) => {
                setCountryFilter(country);
                if (country) {
                  setFilters((prev) => ({ ...prev }));
                }
              }}
            />

            <section className={`${CARD} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-slate-700/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Data Preview</h2>
                  <p className="text-sm text-slate-400">{filteredRows.length.toLocaleString()} filtered rows x {tableColumns.length} columns</p>
                </div>
                <div className="flex gap-2">
                  <Link to="/data" className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                    <Table2 className="mr-2 inline size-4" />
                    View Full Table
                  </Link>
                  <button type="button" onClick={exportCsv} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                    <Download className="mr-2 inline size-4" />
                    Download
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-950/60 text-xs text-slate-400">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      {tableColumns.slice(0, 7).map((column) => (
                        <th key={column} className="px-4 py-3">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 8).map((row, index) => (
                      <tr key={index} className="border-t border-slate-800/80 text-slate-200 hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                        {tableColumns.slice(0, 7).map((column) => (
                          <td key={column} className="max-w-[220px] truncate px-4 py-3">
                            {String(row[column] ?? "") || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>

          <SchemaDashboardChat
            dataset={{
              id: dataset?.id || "local-dataset",
              name: dataset?.name || "Uploaded Dataset",
              rows,
              columns: dataset?.columns || tableColumns,
            }}
            currentDashboard={{
              kpis: schemaDashboard.kpiSpecs,
              charts: schemaDashboard.chartSpecs,
              filters: schemaDashboard.filters,
            }}
            controller={aiController}
            onCommand={applyAiDashboardCommand}
            onSend={(query) => {
              if (/explain|why|summary|describe/i.test(query)) {
                void schemaDashboard.sendChat(query);
              } else {
                void schemaDashboard.sendCommand(query);
              }
            }}
          />
        </div>
      </div>

      {showSchema && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className={`${CARD} max-h-[80vh] w-full max-w-4xl overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-700/60 p-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Dataset Schema</h2>
                <p className="text-sm text-slate-400">Column types, inferred roles, missing values, and examples.</p>
              </div>
              <button type="button" onClick={() => setShowSchema(false)} className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-200">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Column</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Missing</th>
                    <th className="px-4 py-3">Unique</th>
                    <th className="px-4 py-3">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.columns.map((column) => (
                    <tr key={column.name} className="border-t border-slate-800 text-slate-200">
                      <td className="px-4 py-3 font-medium">{column.name}</td>
                      <td className="px-4 py-3">{column.type}</td>
                      <td className="px-4 py-3">{column.role}</td>
                      <td className="px-4 py-3">{column.missingPct}%</td>
                      <td className="px-4 py-3">{column.uniqueCount}</td>
                      <td className="px-4 py-3 text-slate-400">{column.sampleValues.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/90 px-3 py-2 text-xs text-slate-400 shadow-xl backdrop-blur">
        <ShieldCheck className="size-4 text-green-400" />
        {useInsightFlow ? "InsightFlow Engine v2" : "Schema-only AI"}
        {insightFlowResult && (
          <span className="ml-1 text-violet-400">· {insightFlowResult.datasetType}</span>
        )}
      </div>
    </div>
  );
}
