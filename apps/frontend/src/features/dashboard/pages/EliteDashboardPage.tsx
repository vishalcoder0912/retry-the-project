import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import SchemaDashboardChat from "@/features/dashboard/components/SchemaDashboardChat";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import type { DashboardCommandResponse } from "@/features/data/api/dataApi";
import type { ChartType } from "@/features/dashboard/types/dashboardTypes";
import {
  applyFilters,
  buildChartFromSpec,
  buildDataQualityScore,
  buildDatasetProfile,
  buildDefaultCharts,
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
      className="grid h-20 w-20 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#22c55e ${score * 3.6}deg, rgba(51,65,85,0.9) 0deg)`,
      }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-950 text-center">
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
          <Database className="h-5 w-5" />
        </div>
      </div>
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

  const rawRows = useMemo<Row[]>(() => (dataset?.rows || []) as Row[], [dataset?.rows]);
  const rows = useMemo(() => cleanDatasetRows(rawRows), [rawRows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const baseCharts = useMemo(() => buildDefaultCharts(filteredRows), [filteredRows]);
  const defaultKpis = useMemo(() => buildKpis(filteredRows), [filteredRows]);

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

  const autoCharts = useMemo(
    () =>
      baseCharts.map((chart) =>
        chartTypeOverrides[chart.id]
          ? buildChartFromSpec(filteredRows, { ...chart, type: chartTypeOverrides[chart.id] })
          : chart,
      ),
    [baseCharts, chartTypeOverrides, filteredRows],
  );

  const charts = useMemo(() => {
    const merged = [...manualCharts, ...autoCharts].filter((chart) => !hiddenChartIds.has(chart.id));
    const seen = new Set<string>();
    return merged.filter((chart) => {
      const key = `${chart.title}|${chart.type}|${chart.xKey}|${chart.yKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [autoCharts, hiddenChartIds, manualCharts]);

  const kpis = useMemo(() => [...defaultKpis, ...manualKpis].slice(0, 8), [defaultKpis, manualKpis]);
  const tableColumns = profile.columns.map((column) => column.name);
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
    setManualCharts([]);
    setManualKpis([]);
    setHiddenChartIds(new Set());
    setChartTypeOverrides({});
  }

  function applyDashboardCommand(command: DashboardCommandResponse) {
    if (command.action === "FILTER" && command.filters) {
      setFilters((current) => ({ ...current, ...command.filters }));
      return;
    }

    if (command.action === "CLEAR_FILTERS") {
      setFilters({});
      return;
    }

    if (command.action === "DELETE_CHART") {
      const last = charts.at(-1);
      if (last) removeChart(last);
      return;
    }

    if ((command.action === "GENERATE_KPI" || command.action === "ADD_KPI") && command.kpiSpec) {
      setManualKpis((current) => [buildKpiFromSpec(filteredRows, command.kpiSpec!), ...current]);
      return;
    }

    if ((command.action === "GENERATE_CHART" || command.action === "MODIFY_CHART") && command.chartSpec) {
      setManualCharts((current) => [buildChartFromSpec(filteredRows, command.chartSpec!), ...current]);
    }
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
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Auto-generated insights from your current dataset schema.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={shareDashboard} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <Share2 className="mr-2 inline h-4 w-4" />
              Share
            </button>
            <button onClick={exportCsv} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <Download className="mr-2 inline h-4 w-4" />
              Export CSV
            </button>
            <button onClick={exportJson} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
              <FileText className="mr-2 inline h-4 w-4" />
              JSON
            </button>
            <button onClick={() => void deleteDataset()} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
              <Trash2 className="mr-2 inline h-4 w-4" />
              Delete
            </button>
            <button className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 text-slate-100 hover:bg-slate-800">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
          <main className="space-y-5">
            <section className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-200">
                <Calendar className="h-4 w-4 text-slate-400" />
                {dateColumn ? (
                  <>
                    <input
                      type="date"
                      value={String(filters.dateStart || "")}
                      onChange={(event) => setFilters((current) => ({ ...current, dateStart: event.target.value }))}
                      className="bg-transparent outline-none"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      value={String(filters.dateEnd || "")}
                      onChange={(event) => setFilters((current) => ({ ...current, dateEnd: event.target.value }))}
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
                  onChange={(event) => setFilters((current) => ({ ...current, [primaryFilter.name]: event.target.value || undefined }))}
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

              <button className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                <Plus className="mr-2 inline h-4 w-4" />
                Add Filter
              </button>
              <button onClick={() => setFilters({})} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                <RefreshCw className="mr-2 inline h-4 w-4" />
                Reset
              </button>
            </section>

            <section className={`${CARD} border-violet-500/60 bg-gradient-to-r from-violet-600/25 via-slate-900/80 to-blue-600/10 p-5`}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-600/20">
                    <FileSpreadsheet className="h-9 w-9 text-white" />
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
                  <div>
                    <p className="text-xs text-slate-400">Data Quality Score</p>
                    <QualityRing score={quality.finalScore} />
                  </div>
                  <button onClick={() => setShowSchema(true)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                    <Table2 className="mr-2 inline h-4 w-4" />
                    View Schema
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {kpis.slice(0, 6).map((kpi, index) => (
                <KpiCard key={`${kpi.id}-${index}`} kpi={kpi} index={index} />
              ))}
            </section>

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

            <section className={`${CARD} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-slate-700/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Data Preview</h2>
                  <p className="text-sm text-slate-400">{filteredRows.length.toLocaleString()} filtered rows x {tableColumns.length} columns</p>
                </div>
                <div className="flex gap-2">
                  <Link to="/data" className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                    <Table2 className="mr-2 inline h-4 w-4" />
                    View Full Table
                  </Link>
                  <button onClick={exportCsv} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800">
                    <Download className="mr-2 inline h-4 w-4" />
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
            dataset={{ id: dataset.id, name: dataset.name, rows, columns: dataset.columns }}
            currentDashboard={{ filters, charts, kpis }}
            onCommand={applyDashboardCommand}
            collapsible
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
              <button onClick={() => setShowSchema(false)} className="rounded-xl border border-slate-700 bg-slate-950 p-2 text-slate-200">
                <X className="h-4 w-4" />
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

      <div className="fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/90 px-3 py-2 text-xs text-slate-400 shadow-xl backdrop-blur md:flex">
        <ShieldCheck className="h-4 w-4 text-green-400" />
        Schema-only AI enabled
      </div>
    </div>
  );
}
