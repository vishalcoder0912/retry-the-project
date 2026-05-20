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
import {
  applyFilters,
  average,
  buildChartFromSpec,
  buildCorrelationMatrix,
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
  type DashboardFilters,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Gauge({ score }: { score: number }) {
  return (
    <div
      className="grid h-44 w-44 place-items-center rounded-full"
      style={{ background: `conic-gradient(#22c55e ${score * 3.6}deg, rgba(51,65,85,0.9) 0deg)` }}
    >
      <div className="grid h-32 w-32 place-items-center rounded-full bg-slate-950 text-center">
        <div>
          <p className="text-4xl font-semibold text-white">{Math.round(score)}%</p>
          <p className="text-sm text-slate-400">Excellent</p>
        </div>
      </div>
    </div>
  );
}

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
        }),
      );
    }

    return list;
  }, [analyticsRows, category, dateKey, metric, profile.dateColumn, profile.locationColumn, profile.numericColumns]);

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
      "application/json;charset=utf-8",
    );
  }

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
                <Calendar className="h-4 w-4 text-slate-400" />
                <input type="date" value={String(filters.dateStart || "")} onChange={(event) => setFilters((current) => ({ ...current, dateStart: event.target.value }))} className="bg-transparent outline-none" />
                <input type="date" value={String(filters.dateEnd || "")} onChange={(event) => setFilters((current) => ({ ...current, dateEnd: event.target.value }))} className="bg-transparent outline-none" />
              </div>
            )}
            <button onClick={exportReport} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm hover:bg-slate-800">
              <Download className="mr-2 inline h-4 w-4" />
              Export
            </button>
            <button onClick={() => setShowAi((current) => !current)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm hover:bg-violet-500">
              <Bot className="mr-2 inline h-4 w-4" />
              AI Chat
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["Overview", "Trends", "Segments", "Correlation", profile.locationColumn ? "Geography" : "Data Quality", "Data Quality"].filter((item, index, list) => list.indexOf(item) === index).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm ${activeTab === tab ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <RefreshCw className="h-4 w-4" />
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
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
              <Sparkline values={kpi.spark.length ? kpi.spark : [1]} />
            </div>
          ))}
        </section>

        <div className={showAi ? "grid gap-5 2xl:grid-cols-[1fr_360px]" : ""}>
          <main className="space-y-5">
            <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {charts.map((chart) => (
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
                      <span><CheckCircle2 className="mr-2 inline h-4 w-4 text-green-400" />{label}</span>
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
        </div>
      </div>
    </div>
  );
}
