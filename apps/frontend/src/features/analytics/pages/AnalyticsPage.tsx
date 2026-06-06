<<<<<<< HEAD
import { Fragment, useMemo, useState } from "react";
import {
  Bookmark,
  Brain,
  CheckCircle2,
  Download,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
  formatMetricValue,
  pickBusinessDimension,
  pickBusinessMetric,
  titleCase,
} from "@/features/dashboard/utils/commandCenterAnalytics";
=======
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Download,
  Globe2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useData } from "@/features/data/context/useData";
import SchemaDashboardChat from "@/features/dashboard/components/SchemaDashboardChat";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
>>>>>>> origin/main
import {
  applyFilters,
  average,
  buildChartFromSpec,
  buildCorrelationMatrix,
<<<<<<< HEAD
  exportDashboardToJson,
  groupByAggregate,
  safeNumber,
=======
  buildDataQualityScore,
  buildDatasetProfile,
  cleanDatasetRows,
  countUnique,
  exportDashboardToJson,
  generateDynamicInsights,
  groupByAggregate,
  max,
  safeNumber,
  sum,
  type DashboardChart,
>>>>>>> origin/main
  type DashboardFilters,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

<<<<<<< HEAD
const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";
=======
const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";
>>>>>>> origin/main

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

<<<<<<< HEAD
function detectAnomalies(rows: Row[], metric?: string) {
  if (!metric) return [];
  const values: Array<{ index: number; value: number; row: Row }> = [];
  rows.forEach((row, index) => {
    const value = safeNumber(row[metric]);
    if (value !== null) values.push({ index, value, row });
  });
  if (values.length < 4) return [];
  const mean = average(values.map((entry) => entry.value));
  const variance = values.reduce((total, entry) => total + (entry.value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (!stddev) return [];
  return values
    .map((entry) => ({ ...entry, z: (entry.value - mean) / stddev }))
    .filter((entry) => Math.abs(entry.z) > 2)
    .sort((left, right) => Math.abs(right.z) - Math.abs(left.z))
    .slice(0, 8);
}

function CorrelationHeatmap({ rows }: { rows: Row[] }) {
  const cells = buildCorrelationMatrix(rows);
  const xLabels = Array.from(new Set(cells.map((cell) => String(cell.x)))).slice(0, 6);
  const yLabels = Array.from(new Set(cells.map((cell) => String(cell.y)))).slice(0, 6);
  const cellMap = useMemo(
    () => new Map(cells.map((cell) => [`${String(cell.x)}::${String(cell.y)}`, Number(cell.value || 0)])),
    [cells],
  );

  if (!cells.length) {
    return <div className="grid min-h-[260px] place-items-center text-sm text-[#64748B]">At least two numeric columns are required for correlations.</div>;
  }

  return (
    <div className="overflow-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${xLabels.length}, minmax(90px, 1fr))` }}>
        <div />
        {xLabels.map((label) => <div key={label} className="truncate p-2 text-center text-xs font-semibold text-[#64748B]">{label}</div>)}
        {yLabels.map((rowLabel) => (
          <Fragment key={rowLabel}>
            <div key={`${rowLabel}-label`} className="truncate p-2 text-xs font-semibold text-[#334155]">{rowLabel}</div>
            {xLabels.map((columnLabel) => {
              const value = cellMap.get(`${columnLabel}::${rowLabel}`) || 0;
              const positive = value >= 0;
              const color = positive
                ? `rgba(37,99,235,${0.12 + Math.abs(value) * 0.68})`
                : `rgba(239,68,68,${0.12 + Math.abs(value) * 0.68})`;
              return (
                <div key={`${rowLabel}-${columnLabel}`} className="rounded-lg p-3 text-center text-xs font-bold text-[#0F172A]" style={{ background: color }}>
                  {value.toFixed(2)}
                </div>
              );
            })}
          </Fragment>
        ))}
=======
function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Gauge({ score }: { score: number }) {
  return (
    <div
      className="grid size-44 place-items-center rounded-full"
      style={{ background: `conic-gradient(#22c55e ${score * 3.6}deg, rgba(51,65,85,0.9) 0deg)` }}
    >
      <div className="grid size-32 place-items-center rounded-full bg-slate-950 text-center">
        <div>
          <p className="text-4xl font-semibold text-white">{Math.round(score)}%</p>
          <p className="text-sm text-slate-400">Excellent</p>
        </div>
>>>>>>> origin/main
      </div>
    </div>
  );
}

<<<<<<< HEAD
export default function AnalyticsPage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const baseModel = useMemo(() => buildCommandCenterModel(dataset), [dataset]);
  const metric = pickBusinessMetric(baseModel.profile);
  const dimension = pickBusinessDimension(baseModel.profile);
  const filteredRows = useMemo(() => applyFilters(baseModel.rows, filters), [baseModel.rows, filters]);
  const model = useMemo(() => buildCommandCenterModel(dataset, filters), [dataset, filters]);
  const anomalies = useMemo(() => detectAnomalies(filteredRows, metric), [filteredRows, metric]);

  const trendChart = useMemo(() => {
    if (!metric || !model.profile.dateColumn) return null;
    return buildChartFromSpec(filteredRows, {
      type: "area",
      title: `Trend Decomposition & Forecast (${titleCase(metric)})`,
      xKey: model.profile.dateColumn.name,
      yKey: metric,
      aggregation: metric.includes("salary") ? "avg" : "sum",
      intent: "trend",
      limit: 24,
    });
  }, [filteredRows, metric, model.profile.dateColumn]);

  const anomalyChart = useMemo(() => {
    if (!metric) return null;
    return buildChartFromSpec(filteredRows.map((row, index) => ({ ...row, __row_index__: index + 1 })), {
      type: "line",
      title: `Anomaly Detection (${titleCase(metric)})`,
      xKey: model.profile.dateColumn?.name || "__row_index__",
      yKey: metric,
      aggregation: "avg",
      intent: "trend",
      limit: 40,
    });
  }, [filteredRows, metric, model.profile.dateColumn]);

  const segmentChart = useMemo(() => {
    if (!metric || !dimension) return null;
    return buildChartFromSpec(filteredRows, {
      type: "donut",
      title: `Segmentation Analysis (${titleCase(metric)})`,
      xKey: dimension,
      yKey: metric,
      aggregation: metric.includes("salary") ? "avg" : "sum",
      intent: "segment_comparison",
      limit: 8,
    });
  }, [dimension, filteredRows, metric]);

  const strongest = useMemo(() => {
    const correlations = buildCorrelationMatrix(filteredRows);
    return correlations.reduce<(typeof correlations)[number] | undefined>((best, cell) => {
      if (cell.x === cell.y) return best;
      if (!best) return cell;
      return Math.abs(Number(cell.value)) > Math.abs(Number(best.value)) ? cell : best;
    }, undefined);
  }, [filteredRows]);

  if (isHydrating) return <StatusPanel title="Loading analytics" message="Preparing advanced analysis." />;
  if (apiError) return <StatusPanel title="Analytics unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  if (!dataset) return <StatusPanel title="No dataset loaded" message="Upload a dataset before running advanced analytics." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;

  const summaryCards = [
    ["Correlations Found", buildCorrelationMatrix(filteredRows).filter((cell) => cell.x !== cell.y && Math.abs(Number(cell.value)) > 0.35).length, "Strong and moderate pairs", TrendingUp],
    ["Anomalies Detected", anomalies.length, metric ? `Z-score on ${titleCase(metric)}` : "No metric", ShieldCheck],
    ["Strongest Driver", strongest ? String(strongest.x) : "-", strongest ? `vs ${strongest.y}: ${Number(strongest.value).toFixed(2)}` : "Need two metrics", Target],
    ["Forecast Confidence", `${Math.round(model.quality.finalScore)}%`, "Based on data quality", Brain],
    ["Data Health", `${Math.round(model.quality.finalScore)}%`, `${model.quality.completeness}% complete`, CheckCircle2],
  ] as const;

  function exportReport() {
    downloadFile(
      `${dataset.name || "advanced-analytics"}.json`,
      exportDashboardToJson({ datasetName: dataset.name, filters, kpis: model.kpis, charts: model.charts }),
=======
function detectAnomalies(rows: Row[], metric?: string) {
  if (!metric) return 0;
  const values = rows.map((row) => safeNumber(row[metric])).filter((value): value is number => value !== null);
  if (values.length < 4) return 0;
  const mean = average(values);
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (!stddev) return 0;
  return values.filter((value) => Math.abs((value - mean) / stddev) > 2).length;
}

function Sparkline({ values }: { values: number[] }) {
  const maxValue = Math.max(...values, 1);
  return (
    <div className="mt-3 flex h-8 items-end gap-1">
      {values.slice(-18).map((value, index) => (
        <span
          key={index}
          className="w-full rounded-full bg-violet-500/70"
          style={{ height: `${Math.max(10, (value / maxValue) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeTab, setActiveTab] = useState("Overview");
  const [showAi, setShowAi] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const quality = useMemo(() => buildDataQualityScore(filteredRows), [filteredRows]);
  const metric = profile.primaryMetric?.name;
  const category = profile.primaryCategory?.name;
  const dateKey = profile.dateColumn?.name || "__row_index__";
  const metricValues = filteredRows.map((row) => safeNumber(metric ? row[metric] : null)).filter((value): value is number => value !== null);
  const anomalies = detectAnomalies(filteredRows, metric);
  const insights = generateDynamicInsights(filteredRows);

  const analyticsRows = useMemo(
    () => filteredRows.map((row, index) => ({ ...row, __row_index__: index + 1 })),
    [filteredRows],
  );

  const charts = useMemo<DashboardChart[]>(() => {
    const list: DashboardChart[] = [];

    if (metric) {
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "area",
          title: `${metric} Over ${profile.dateColumn ? "Time" : "Row Index"}`,
          xKey: dateKey,
          yKey: metric,
          aggregation: "avg",
          intent: "trend",
          limit: 24,
        }),
      );
    }

    if (metric && category) {
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "donut",
          title: `${metric} by ${category}`,
          xKey: category,
          yKey: metric,
          aggregation: "sum",
          intent: "comparison",
          limit: 8,
        }),
      );
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "horizontalBar",
          title: `Top 10 ${category} by ${metric}`,
          xKey: category,
          yKey: metric,
          aggregation: "max",
          intent: "ranking",
          limit: 10,
        }),
      );
    }

    if (profile.locationColumn && metric) {
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "bar",
          title: `Geographic Distribution by ${profile.locationColumn.name}`,
          xKey: profile.locationColumn.name,
          yKey: metric,
          aggregation: "sum",
          intent: "geo",
          limit: 10,
        }),
      );
    } else if (category) {
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "bar",
          title: `Records by ${category}`,
          xKey: category,
          yKey: "count",
          aggregation: "count",
          intent: "distribution",
          limit: 10,
        }),
      );
    }

    if (profile.numericColumns.length >= 2) {
      list.push(
        buildChartFromSpec(analyticsRows, {
          type: "heatmap",
          title: "Correlation Analysis",
          xKey: profile.numericColumns[0].name,
          yKey: profile.numericColumns[1].name,
          aggregation: "avg",
          intent: "correlation",
        }),
      );
    }

    return list;
  }, [analyticsRows, category, dateKey, metric, profile.dateColumn, profile.locationColumn, profile.numericColumns]);

  const visibleCharts = useMemo(() => {
    if (activeTab === "Trends") return charts.filter((chart) => chart.intent === "trend");
    if (activeTab === "Geography") return charts.filter((chart) => chart.intent === "geo");
    if (activeTab === "Correlation") return charts.filter((chart) => chart.intent === "correlation");
    if (activeTab === "Segments") {
      return charts.filter((chart) => chart.intent === "distribution" || chart.intent === "ranking" || chart.intent === "comparison");
    }
    return charts;
  }, [activeTab, charts]);

  if (isHydrating) {
    return <StatusPanel title="Loading analytics" message="Preparing dynamic analytics from your current dataset." />;
  }

  if (apiError) {
    return <StatusPanel title="Analytics unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  }

  if (!dataset) {
    return <StatusPanel title="No dataset loaded" message="Upload a dataset before opening analytics." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;
  }

  function exportReport() {
    downloadFile(
      `${dataset.name || "analytics"}-report.json`,
      exportDashboardToJson({
        datasetName: dataset.name,
        filters,
        kpis: [],
        charts,
      }),
>>>>>>> origin/main
      "application/json;charset=utf-8",
    );
  }

<<<<<<< HEAD
  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-1 size-8 text-[#7C3AED]" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Advanced Analytics</h1>
              <p className="mt-1 text-sm text-[#64748B]">Explore correlations, trends, anomalies, and performance drivers from your real dataset.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
              <Play className="mr-2 inline size-4" />
              Run Analysis
            </button>
            <button type="button" onClick={exportReport} className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-bold text-[#334155] shadow-sm">
              <Download className="mr-2 inline size-4" />
              Export
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(([title, value, subtitle, Icon]) => (
            <div key={title} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#64748B]">{title}</p>
                  <p className="mt-2 text-2xl font-bold text-[#0F172A]">{String(value)}</p>
                  <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                  <Icon className="size-5" />
                </div>
              </div>
=======
  const kpis = [
    {
      title: "Total Records",
      value: filteredRows.length.toLocaleString(),
      sub: `${rows.length.toLocaleString()} total rows`,
      icon: TrendingUp,
      spark: groupByAggregate(analyticsRows, dateKey, metric || dateKey, metric ? "avg" : "count", 18).map((item) => Number(Object.values(item).at(-1) || 0)),
    },
    {
      title: metric ? `Total ${metric}` : "Total Value",
      value: formatNumber(metric ? sum(metricValues) : filteredRows.length),
      sub: metric ? "Sum for primary metric" : "Record count",
      icon: Sparkles,
      spark: metricValues,
    },
    {
      title: metric ? `Average ${metric}` : "Average Value",
      value: formatNumber(metric ? average(metricValues) : 0),
      sub: metric ? "Mean value" : "Metric unavailable",
      icon: TrendingUp,
      spark: metricValues,
    },
    {
      title: "Unique Categories",
      value: category ? countUnique(filteredRows.map((row) => row[category])).toLocaleString() : "0",
      sub: category || "No category column",
      icon: Globe2,
      spark: [countUnique(filteredRows.map((row) => (category ? row[category] : "")))],
    },
    {
      title: "Anomalies Detected",
      value: anomalies.toLocaleString(),
      sub: metric ? `z-score on ${metric}` : "Metric unavailable",
      icon: AlertTriangle,
      spark: [anomalies],
    },
    {
      title: "Data Quality Score",
      value: `${quality.finalScore}%`,
      sub: `${quality.completeness}% complete`,
      icon: ShieldCheck,
      spark: [quality.completeness, quality.validity, quality.uniqueness],
    },
  ];

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Analytics</h1>
            <p className="mt-1 text-sm text-slate-400">Deep dive into your data and uncover powerful insights.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {category && (
              <select
                value={String(filters[category] || "")}
                onChange={(event) => setFilters((current) => ({ ...current, [category]: event.target.value || undefined }))}
                className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm outline-none"
              >
                <option value="">All {category}</option>
                {Array.from(new Set(rows.map((row) => String(row[category] ?? "")).filter(Boolean))).slice(0, 50).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            )}
            {profile.dateColumn && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
                <Calendar className="size-4 text-slate-400" />
                <input type="date" value={String(filters.dateStart || "")} onChange={(event) => setFilters((current) => ({ ...current, dateStart: event.target.value }))} className="bg-transparent outline-none" />
                <input type="date" value={String(filters.dateEnd || "")} onChange={(event) => setFilters((current) => ({ ...current, dateEnd: event.target.value }))} className="bg-transparent outline-none" />
              </div>
            )}
            <button type="button" onClick={exportReport} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm hover:bg-slate-800">
              <Download className="mr-2 inline size-4" />
              Export
            </button>
            <button type="button" onClick={() => setShowAi((current) => !current)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm hover:bg-violet-500">
              <Bot className="mr-2 inline size-4" />
              AI Chat
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["Overview", "Trends", "Segments", "Correlation", profile.locationColumn ? "Geography" : "Data Quality", "Data Quality"].filter((item, index, list) => list.indexOf(item) === index).map((tab) => (
              <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm ${activeTab === tab ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <RefreshCw className="size-4" />
            Auto refresh
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
          </label>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.title} className={`${CARD} p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{kpi.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{kpi.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
                </div>
                <div className="rounded-2xl bg-violet-500/20 p-3 text-violet-200">
                  <kpi.icon className="size-5" />
                </div>
              </div>
              <Sparkline values={kpi.spark.length ? kpi.spark : [1]} />
>>>>>>> origin/main
            </div>
          ))}
        </section>

<<<<<<< HEAD
        <section className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#334155]">Metric</span>
          <select aria-label="Select analytics metric" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] shadow-sm">
            {model.profile.numericColumns.map((column) => <option key={column.name}>{column.name}</option>)}
          </select>
          {dimension && (
            <>
              <span className="text-sm font-semibold text-[#334155]">Segment</span>
              <select
                value={String(filters[dimension] || "")}
                aria-label="Select analytics segment"
                onChange={(event) => setFilters((current) => ({ ...current, [dimension]: event.target.value || undefined }))}
                className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] shadow-sm"
              >
                <option value="">All Segments</option>
                {groupByAggregate(baseModel.rows, dimension, metric || dimension, metric ? "avg" : "count", 50).map((row) => (
                  <option key={String(row[dimension])} value={String(row[dimension])}>{String(row[dimension])}</option>
                ))}
              </select>
            </>
          )}
          <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155] shadow-sm">
            <Bookmark className="mr-2 inline size-4" />
            Save View
          </button>
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="grid gap-5 xl:grid-cols-2">
            <section className={`${CARD} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-[#0F172A]">Correlation Heatmap</h2>
                <span className="text-xs text-[#64748B]">Pearson correlation</span>
              </div>
              <CorrelationHeatmap rows={filteredRows} />
            </section>
            {anomalyChart && <SmartChartCard chart={anomalyChart} />}
            {segmentChart && <SmartChartCard chart={segmentChart} />}
            {trendChart && <SmartChartCard chart={trendChart} />}
          </main>

          <aside className="space-y-4">
            <section className={`${CARD} p-5`}>
              <h2 className="flex items-center gap-2 font-bold text-[#0F172A]">
                <Sparkles className="size-5 text-[#7C3AED]" />
                AI Findings & Recommendations
              </h2>
              <div className="mt-4 space-y-3">
                {model.insights.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="font-bold text-[#0F172A]">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#64748B]">{insight.description}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className={`${CARD} p-5`}>
              <h3 className="font-bold text-[#0F172A]">Impact Summary</h3>
              <p className="mt-4 text-sm text-[#64748B]">Primary metric</p>
              <p className="mt-1 text-3xl font-bold text-[#22C55E]">
                {metric ? formatMetricValue(average(filteredRows.map((row) => safeNumber(row[metric])).filter((value): value is number => value !== null)), metric) : "-"}
              </p>
              <p className="mt-2 text-sm text-[#64748B]">Average based on current filters.</p>
            </section>
          </aside>
=======
        <div className={showAi ? "grid gap-5 2xl:grid-cols-[1fr_360px]" : ""}>
          <main className="space-y-5">
            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {visibleCharts.map((chart) => (
                <SmartChartCard key={chart.id} chart={chart} />
              ))}
              <div className={`${CARD} grid min-h-[22rem] place-items-center p-5`}>
                <Gauge score={quality.finalScore} />
                <div className="mt-4 grid w-full gap-2 text-sm text-slate-300">
                  {[
                    ["Completeness", quality.completeness],
                    ["Consistency", quality.consistency],
                    ["Validity", quality.validity],
                    ["Uniqueness", quality.uniqueness],
                    ["Timeliness", quality.timeliness],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <span><CheckCircle2 className="mr-2 inline size-4 text-green-400" />{label}</span>
                      <span>{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`${CARD} p-5`}>
              <h2 className="text-lg font-semibold text-white">Insights & Recommendations</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {insights.map((insight) => (
                  <div key={insight.id} className="rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4">
                    <p className="font-semibold text-white">{insight.title}</p>
                    <p className="mt-2 text-sm text-slate-400">{insight.description}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4">
                  <p className="font-semibold text-white">Correlation coverage</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {buildCorrelationMatrix(filteredRows).length ? "Numeric columns are available for correlation analysis." : "Add at least two numeric columns to enable correlation analysis."}
                  </p>
                </div>
              </div>
            </section>
          </main>

          {showAi && (
            <SchemaDashboardChat
              dataset={{ id: dataset.id, name: dataset.name, rows, columns: dataset.columns }}
              currentDashboard={{ filters, charts, kpis }}
              onCommand={(command) => {
                if (command.filters) setFilters((current) => ({ ...current, ...command.filters }));
              }}
              collapsible
            />
          )}
>>>>>>> origin/main
        </div>
      </div>
    </div>
  );
}
