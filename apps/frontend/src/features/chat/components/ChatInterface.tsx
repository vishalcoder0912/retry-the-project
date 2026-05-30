import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Brain,
  Database,
  Download,
  FileText,
  Filter,
  Grid3X3,
  Paperclip,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Table2,
  Trophy,
} from "lucide-react";
import { api, type DashboardCommandResponse } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import type { Aggregation } from "@/features/dashboard/types/dashboardTypes";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import {
  buildChartFromSpec,
  buildDataQualityScore,
  buildDatasetProfile,
  buildDefaultCharts,
  buildKpiFromSpec,
  buildKpis,
  cleanDatasetRows,
  generateDynamicInsights,
  safeNumber,
  type DashboardChart,
  type DashboardKpi,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import {
  loadDashboardState,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: DashboardChart;
  kpis?: DashboardKpi[];
  sql?: string;
  takeaway?: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: value % 1 === 0 ? 0 : 2 });
}

function findColumn(columns: string[], text: string) {
  const normalizedText = normalize(text);
  return (
    columns.find((column) => normalize(column) === normalizedText) ||
    columns.find((column) => normalizedText.includes(normalize(column))) ||
    columns.find((column) => normalize(column).includes(normalizedText))
  );
}

function makeMessageId() {
  return globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function firstGroupedChart(rows: Row[], query: string) {
  const profile = buildDatasetProfile(rows);
  const columns = profile.columns.map((column) => column.name);
  const lower = query.toLowerCase();
  const metric =
    columns.find((column) => lower.includes(normalize(column).replace(/_/g, " "))) ||
    profile.primaryMetric?.name ||
    profile.numericColumns[0]?.name;
  const category =
    profile.categoryColumns.find((column) => lower.includes(normalize(column.name).replace(/_/g, " ")))?.name ||
    profile.primaryCategory?.name ||
    profile.columns.find((column) => column.type === "string")?.name;

  if (!metric || !category) return null;

  const aggregation: Aggregation = /total|sum|revenue|sales|units/i.test(lower) ? "sum" : "avg";
  return {
    type: "bar" as const,
    title: `${aggregation === "sum" ? "Total" : "Average"} ${titleCase(metric)} by ${titleCase(category)}`,
    xKey: category,
    yKey: metric,
    aggregation,
    limit: 10,
  };
}

function summarizeDataset(rows: Row[]) {
  const profile = buildDatasetProfile(rows);
  const quality = buildDataQualityScore(rows);
  const metric = profile.primaryMetric?.name;
  const category = profile.primaryCategory?.name;
  const parts = [
    `This dataset has ${rows.length.toLocaleString()} rows and ${profile.columns.length} columns.`,
    `Data quality score is ${Math.round(quality.finalScore)}%.`,
  ];

  if (metric) parts.push(`Primary metric detected: ${titleCase(metric)}.`);
  if (category) parts.push(`Primary grouping column detected: ${titleCase(category)}.`);

  return parts.join(" ");
}

function dataDictionary(rows: Row[]) {
  const profile = buildDatasetProfile(rows);
  return profile.columns
    .slice(0, 8)
    .map((column) => {
      const completeness = Math.max(0, 100 - column.missingPct);
      const role = column.name === profile.primaryMetric?.name ? "primary metric" : column.name === profile.primaryCategory?.name ? "primary category" : column.type;
      return `${column.name}: ${role}, ${completeness}% complete, ${column.uniqueCount} unique values`;
    })
    .join("\n");
}

function anomalySummary(rows: Row[]) {
  const profile = buildDatasetProfile(rows);
  const metric = profile.primaryMetric?.name || profile.numericColumns[0]?.name;
  if (!metric) return "No numeric column was available for anomaly detection.";

  const values = rows
    .map((row, index) => ({ index, value: safeNumber(row[metric]) }))
    .filter((entry) => Number.isFinite(entry.value));
  if (values.length < 3) return `Not enough numeric values in ${metric} to flag anomalies confidently.`;

  const mean = values.reduce((sum, entry) => sum + entry.value, 0) / values.length;
  const variance = values.reduce((sum, entry) => sum + Math.pow(entry.value - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (!stdDev) return `${titleCase(metric)} has no meaningful spread, so no anomalies were detected.`;

  const unusual = values
    .map((entry) => ({ ...entry, z: Math.abs((entry.value - mean) / stdDev) }))
    .filter((entry) => entry.z >= 1.5)
    .sort((a, b) => b.z - a.z)
    .slice(0, 3);

  if (!unusual.length) return `No strong anomalies detected in ${titleCase(metric)}.`;
  return `Potential anomalies in ${titleCase(metric)}: ${unusual
    .map((entry) => `row ${entry.index + 1} (${entry.value.toLocaleString()})`)
    .join(", ")}.`;
}

function thresholdSummary(query: string, rows: Row[]) {
  const profile = buildDatasetProfile(rows);
  const metric = profile.primaryMetric?.name || profile.numericColumns[0]?.name;
  if (!metric) return null;

  const plainNumber = query.trim().match(/^\$?([\d,]+(?:\.\d+)?)$/);
  const comparison = query.match(/\b(above|over|greater than|more than|at least|>=|below|under|less than|<=)\s+\$?([\d,]+(?:\.\d+)?)/i);
  if (!plainNumber && !comparison) return null;

  const rawValue = plainNumber?.[1] || comparison?.[2];
  const threshold = rawValue ? safeNumber(rawValue) : null;
  if (threshold === null) return null;

  const operatorText = comparison?.[1]?.toLowerCase() || "at least";
  const isUpperBound = ["below", "under", "less than", "<="].includes(operatorText);
  const matchedRows = rows.filter((row) => {
    const value = safeNumber(row[metric]);
    if (value === null) return false;
    return isUpperBound ? value <= threshold : value >= threshold;
  });

  const share = rows.length ? Math.round((matchedRows.length / rows.length) * 1000) / 10 : 0;
  return `${matchedRows.length.toLocaleString()} rows have ${titleCase(metric)} ${isUpperBound ? "at or below" : "at or above"} ${formatNumber(threshold)} (${share}% of ${rows.length.toLocaleString()} rows).`;
}

export function localCommand(query: string, rows: Row[]): DashboardCommandResponse | null {
  const profile = buildDatasetProfile(rows);
  const columns = profile.columns.map((column) => column.name);
  const lower = query.toLowerCase();
  const metric =
    columns.find((column) => lower.includes(normalize(column).replace(/_/g, " "))) ||
    profile.primaryMetric?.name;
  const category =
    profile.categoryColumns.find((column) => lower.includes(normalize(column.name).replace(/_/g, " ")))?.name ||
    profile.primaryCategory?.name;
  const thresholdAnswer = thresholdSummary(query, rows);

  if (thresholdAnswer) {
    return { action: "ANSWER", message: thresholdAnswer, schemaOnly: true };
  }

  if (/filter\s+(.+?)\s*=\s*(.+)$/i.test(query)) {
    const match = query.match(/filter\s+(.+?)\s*=\s*(.+)$/i);
    const column = match ? findColumn(columns, match[1]) : undefined;
    if (column && match) {
      return { action: "FILTER", message: `Filtered ${column} to ${match[2].trim()}.`, filters: { [column]: match[2].trim() }, schemaOnly: true };
    }
  }

  if (/^filter data$|apply filters/i.test(lower)) {
    const categoryColumn = profile.primaryCategory?.name || profile.categoryColumns[0]?.name;
    const topValue = categoryColumn ? rows.find((row) => row[categoryColumn] != null)?.[categoryColumn] : undefined;
    if (categoryColumn && topValue != null) {
      return {
        action: "FILTER",
        message: `Applied a sample filter: ${categoryColumn} = ${String(topValue)}.`,
        filters: { [categoryColumn]: String(topValue) },
        schemaOnly: true,
      };
    }
    return { action: "ANSWER", message: "No categorical column is available for a safe sample filter.", schemaOnly: true };
  }

  if (/build dashboard|dashboard automatically|dashboard$/.test(lower)) {
    const chartSpec = firstGroupedChart(rows, query);
    return {
      action: chartSpec ? "GENERATE_CHART" : "GENERATE_KPI",
      message: chartSpec
        ? "Built a starter dashboard with local KPI cards and a schema-aware chart."
        : "Built starter KPI cards from the available schema.",
      chartSpec: chartSpec || undefined,
      schemaOnly: true,
    };
  }

  if (/generate chart|create chart|new chart/.test(lower)) {
    const chartSpec = firstGroupedChart(rows, query);
    return chartSpec
      ? { action: "GENERATE_CHART", message: `Generated ${chartSpec.title}.`, chartSpec, schemaOnly: true }
      : { action: "ANSWER", message: "No metric/category pair was available for a chart.", schemaOnly: true };
  }

  if (/kpi|cards/.test(lower)) {
    return { action: "GENERATE_KPI", message: "Generated schema-aware KPI cards.", schemaOnly: true };
  }

  if (/summarize|summary|takeaway/.test(lower)) {
    return { action: "ANSWER", message: summarizeDataset(rows), schemaOnly: true };
  }

  if (/data quality|quality score|completeness|missing|duplicate/.test(lower)) {
    const quality = buildDataQualityScore(rows);
    return {
      action: "ANSWER",
      message: `Data quality is ${Math.round(quality.finalScore)}%. Completeness is ${Math.round(quality.completeness)}%, uniqueness is ${Math.round(quality.uniqueness)}%, and ${quality.missingCells.toLocaleString()} cells are missing.`,
      schemaOnly: true,
    };
  }

  if (/anomal/.test(lower)) {
    return { action: "ANSWER", message: anomalySummary(rows), schemaOnly: true };
  }

  if (/data dictionary|explain columns|columns and values/.test(lower)) {
    return { action: "ANSWER", message: dataDictionary(rows), schemaOnly: true };
  }

  if (/group|aggregate/.test(lower)) {
    const chartSpec = firstGroupedChart(rows, query);
    return chartSpec
      ? { action: "GENERATE_CHART", message: `Grouped ${chartSpec.yKey} by ${chartSpec.xKey}.`, chartSpec, schemaOnly: true }
      : { action: "ANSWER", message: "No metric/category pair was available for grouping.", schemaOnly: true };
  }

  if (/sql preview|view sql|sql for this dataset/.test(lower)) {
    const chartSpec = firstGroupedChart(rows, query);
    return chartSpec
      ? { action: "GENERATE_CHART", message: "Generated SQL preview for a grouped dataset query.", chartSpec, schemaOnly: true }
      : { action: "ANSWER", message: "SELECT *\nFROM dataset\nLIMIT 25;", schemaOnly: true };
  }

  if (/pie|donut/.test(lower) && category) {
    return {
      action: "GENERATE_CHART",
      message: `Generated records by ${category}.`,
      chartSpec: { type: lower.includes("pie") ? "pie" : "donut", title: `Records by ${titleCase(category)}`, xKey: category, yKey: "count", aggregation: "count", limit: 8 },
      schemaOnly: true,
    };
  }

  if (/distribution|histogram/.test(lower) && metric) {
    return {
      action: "GENERATE_CHART",
      message: `Generated ${metric} distribution.`,
      chartSpec: { type: "histogram", title: `${titleCase(metric)} Distribution`, xKey: "range", yKey: metric, aggregation: "count", limit: 8 },
      schemaOnly: true,
    };
  }

  if (/scatter| vs /.test(lower)) {
    const match = lower.match(/show\s+(.+?)\s+vs\s+(.+?)(\s+as\s+scatter|$)/);
    const xKey = match ? findColumn(columns, match[2]) : profile.secondaryMetric?.name;
    const yKey = match ? findColumn(columns, match[1]) : metric;
    if (xKey && yKey) {
      return {
        action: "GENERATE_CHART",
        message: `Generated ${yKey} vs ${xKey}.`,
        chartSpec: { type: "scatter", title: `${titleCase(yKey)} vs ${titleCase(xKey)}`, xKey, yKey, aggregation: "avg", limit: 200 },
        schemaOnly: true,
      };
    }
  }

  if (/chart|average|avg|by/.test(lower) && metric && category) {
    return {
      action: "GENERATE_CHART",
      message: `Generated average ${metric} by ${category}.`,
      chartSpec: { type: "bar", title: `Average ${titleCase(metric)} by ${titleCase(category)}`, xKey: category, yKey: metric, aggregation: "avg", limit: 10 },
      schemaOnly: true,
    };
  }

  return null;
}

function sqlPreview(command: DashboardCommandResponse) {
  if (command.chartSpec) {
    return `SELECT ${command.chartSpec.xKey}, ${command.chartSpec.aggregation}(${command.chartSpec.yKey}) AS value\nFROM dataset\nGROUP BY ${command.chartSpec.xKey}\nORDER BY value DESC\nLIMIT ${command.chartSpec.limit || 10};`;
  }
  if (command.filters) {
    const [column, value] = Object.entries(command.filters)[0] || [];
    return column ? `SELECT * FROM dataset\nWHERE ${column} = '${value}';` : undefined;
  }
  return undefined;
}

function safeBuildChart(rows: Row[], chartSpec: NonNullable<DashboardCommandResponse["chartSpec"]>) {
  try {
    return buildChartFromSpec(rows, chartSpec);
  } catch {
    return undefined;
  }
}

function safeBuildKpis(rows: Row[], command: DashboardCommandResponse, query: string) {
  try {
    if (command.kpiSpec) return [buildKpiFromSpec(rows, command.kpiSpec)];
    if (/kpi|cards|dashboard/i.test(query)) return buildKpis(rows).slice(0, 5);
  } catch {
    return undefined;
  }

  return undefined;
}

export default function ChatInterface() {
  const { dataset } = useData();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const suggestions = useMemo(() => generateDynamicQuestionSuggestions({ id: dataset?.id, name: dataset?.name, rows, columns: dataset?.columns }, 5), [dataset, rows]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, loading]);

  function pushAssistant(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: makeMessageId(),
        role: "assistant",
        content,
      },
    ]);
  }

  async function sendPrompt(prompt = input) {
    const query = prompt.trim();
    if (!query || !dataset?.id || loading) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [...current, { id: makeMessageId(), role: "user", content: query }]);

    const planned = localCommand(query, rows);

    try {
      if (planned || /chart|kpi|filter|dashboard|distribution|scatter|pie|donut/i.test(query)) {
        const response = await api.sendDashboardCommand(dataset.id, query, { schemaOnly: true });
        const command = response.action === "ANSWER" && planned ? planned : response.chartSpec || response.kpiSpec || response.filters ? response : planned;

        if (command) {
          const chart = command.chartSpec ? safeBuildChart(rows, command.chartSpec) : undefined;
          const kpis = safeBuildKpis(rows, command, query);
          setMessages((current) => [
            ...current,
            {
              id: makeMessageId(),
              role: "assistant",
              content: command.message || "Generated a schema-aware response.",
              chart,
              kpis,
              sql: sqlPreview(command),
              takeaway: chart ? `The chart was calculated locally from ${rows.length.toLocaleString()} rows.` : undefined,
            },
          ]);
          return;
        }
      }

      const response = await api.sendSchemaChat(dataset.id, query);
      setMessages((current) => [
        ...current,
        {
          id: makeMessageId(),
          role: "assistant",
          content: response.assistantMessage.content,
          takeaway: "Schema-only answer. Raw rows were not sent to the LLM.",
        },
      ]);
    } catch (error) {
      if (planned) {
        const chart = planned.chartSpec ? safeBuildChart(rows, planned.chartSpec) : undefined;
        const kpis = safeBuildKpis(rows, planned, query);
        setMessages((current) => [
          ...current,
          {
            id: makeMessageId(),
            role: "assistant",
            content: planned.message || "Generated locally from schema.",
            chart,
            kpis,
            sql: sqlPreview(planned),
            takeaway: "Local fallback used; values were calculated in the browser.",
          },
        ]);
      } else {
        setMessages((current) => [
          ...current,
          {
            id: makeMessageId(),
            role: "assistant",
            content: error instanceof Error ? error.message : "I could not process that request.",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  function addToDashboard(message: LocalMessage) {
    if (!dataset?.id) return;
    const state = loadDashboardState(dataset.id);
    saveDashboardState(dataset.id, {
      ...state,
      manualCharts: message.chart ? [message.chart, ...state.manualCharts] : state.manualCharts,
      manualKpis: message.kpis ? [...message.kpis, ...state.manualKpis] : state.manualKpis,
    });
  }

  async function shareChat() {
    const summary = messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
    await navigator.clipboard?.writeText(summary || "InsightFlow AI Chat");
    pushAssistant("Conversation summary copied to clipboard.");
  }

  function exportChat() {
    const blob = JSON.stringify({ dataset: dataset?.name, messages }, null, 2);
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset?.name || "chat"}-conversation.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushAssistant("Conversation exported as JSON.");
  }

  function openAttachmentGuidance() {
    pushAssistant("Use the Upload or PDF Intelligence page to attach CSV, Excel, JSON, or PDF files. I will analyze the active dataset here after it is loaded.");
  }

  function showSettingsSummary() {
    pushAssistant("Current AI chat settings: schema-only mode, local chart/KPI calculation, Qwen3:8B provider when backend AI is available, and browser fallback when it is not.");
  }

  const visibleMessages = messages.length ? messages : [];
  const schemaPreview = profile.columns.slice(0, 6);
  const insights = generateDynamicInsights(rows);

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-white">{dataset?.name}</span>
              <span>-</span>
              <span>{rows.length.toLocaleString()} rows</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">AI Chat</h1>
            <p className="mt-1 text-sm text-slate-400">Ask questions, generate charts, and build insights from your data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={shareChat} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Share2 className="mr-2 inline size-4" />
              Share
            </button>
            <button type="button" onClick={exportChat} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Download className="mr-2 inline size-4" />
              Export
            </button>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-100">
              <span className="mr-2 inline-block size-2 rounded-full bg-green-400" />
              Qwen3:8B Online
            </div>
            <button type="button" onClick={showSettingsSummary} aria-label="Show AI chat settings" className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">
              <Settings className="size-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-5 2xl:grid-cols-[1fr_350px]">
          <main className={`${CARD} flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden`}>
            <div className="border-b border-slate-700/60 p-5">
              <div className="flex gap-4">
                <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
                  <Sparkles className="size-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">Hi! I'm your AI Data Analyst</h2>
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] uppercase text-violet-200">Beta</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">I can answer schema questions, generate local charts and KPIs, filter records, and explain data quality.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button type="button" key={suggestion} onClick={() => void sendPrompt(suggestion)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {visibleMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-4xl ${message.role === "user" ? "text-right" : "text-left"}`}>
                    <div className={`inline-block rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-violet-600 text-white" : "border border-slate-700/60 bg-slate-950/60 text-slate-100"}`}>
                      {message.content}
                    </div>

                    {message.chart && (
                      <div className="mt-3 text-left">
                        <SmartChartCard chart={message.chart} />
                      </div>
                    )}

                    {message.kpis?.length ? (
                      <div className="mt-3 grid gap-3 text-left sm:grid-cols-2 xl:grid-cols-5">
                        {message.kpis.map((kpi) => (
                          <div key={kpi.id} className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
                            <p className="text-xs text-slate-400">{kpi.title}</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{kpi.value}</p>
                            <p className="mt-1 text-xs text-slate-500">{kpi.subtitle}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.sql && (
                      <pre className="mt-3 overflow-auto rounded-2xl border border-slate-700/60 bg-slate-950/80 p-4 text-left text-xs text-cyan-100">{message.sql}</pre>
                    )}

                    {message.takeaway && (
                      <div className="mt-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-left text-sm text-blue-100">
                        <Brain className="mr-2 inline size-4" />
                        {message.takeaway}
                      </div>
                    )}

                    {(message.chart || message.kpis?.length) && (
                      <button type="button" onClick={() => addToDashboard(message)} className="mt-3 rounded-xl border border-violet-500/50 px-4 py-2 text-sm text-violet-200">
                        <Grid3X3 className="mr-2 inline size-4" />
                        Add to Dashboard
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <Bot className="mr-2 inline size-4 animate-pulse text-violet-300" />
                  Thinking in schema-only mode...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-700/60 p-4">
              <div className="rounded-2xl border border-violet-500/60 bg-slate-950/80 p-3 shadow-[0_0_24px_rgba(124,58,237,0.2)]">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendPrompt();
                    }
                  }}
                  placeholder="Ask anything about your data, charts, filters, or KPIs..."
                  className="h-20 w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-slate-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-xl border border-slate-700 px-3 py-2"><Database className="mr-2 inline size-4" />Schema only</span>
                    <span className="rounded-xl border border-slate-700 px-3 py-2">Qwen3:8B</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={openAttachmentGuidance} aria-label="Attach data guidance" className="rounded-xl border border-slate-700 p-3"><Paperclip className="size-4" /></button>
                    <button type="button" onClick={() => void sendPrompt("Generate chart")} className="rounded-xl border border-slate-700 p-3"><BarChart3 className="size-4" /></button>
                    <button type="button" onClick={() => void sendPrompt("Filter data")} className="rounded-xl border border-slate-700 p-3"><Filter className="size-4" /></button>
                    <button type="button" onClick={() => void sendPrompt("Summarize dataset")} className="rounded-xl border border-slate-700 p-3"><Table2 className="size-4" /></button>
                    <button type="button" disabled={!input.trim() || loading} onClick={() => void sendPrompt()} className="rounded-xl bg-violet-600 p-3 disabled:opacity-50"><Send className="size-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
                  <FileText className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{dataset?.name}</p>
                  <p className="text-sm text-slate-400">{rows.length.toLocaleString()} rows - {profile.columns.length} columns</p>
                </div>
              </div>
              <Link to="/data" className="mt-4 block rounded-xl border border-slate-700/60 px-4 py-2 text-center text-sm text-slate-100">
                View Data Table
              </Link>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="font-semibold text-white">Schema Summary</h3>
              <div className="mt-3 space-y-2">
                {schemaPreview.map((column) => (
                  <div key={column.name} className="grid grid-cols-[1fr_80px_64px] gap-2 text-sm">
                    <span className="truncate text-slate-200">{column.name}</span>
                    <span className="text-slate-400">{column.type}</span>
                    <span className="text-green-300">{Math.max(0, 100 - column.missingPct)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-white">Data Quality</h3>
                <span className="rounded-full bg-green-500/15 px-2 py-1 text-xs text-green-300">Excellent</span>
              </div>
              <div className="grid place-items-center">
                <div
                  className="grid size-32 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#22c55e ${quality.finalScore * 3.6}deg, rgba(51,65,85,0.9) 0deg)` }}
                >
                  <div className="grid size-24 place-items-center rounded-full bg-slate-950">
                    <span className="text-3xl font-semibold">{Math.round(quality.finalScore)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="font-semibold text-white">Quick Actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["Generate Chart", "Build Dashboard", "Find Anomalies", "Summarize Dataset"].map((action) => (
                  <button type="button" key={action} onClick={() => void sendPrompt(action)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-3 text-left text-xs text-slate-200">
                    {action}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="font-semibold text-white">Conversation Tools</h3>
              <div className="mt-3 space-y-2">
                {[
                  ["Filter Data", "Apply filters and conditions"],
                  ["Group & Aggregate", "Group by columns and aggregate"],
                  ["Data Dictionary", "Explain columns and values"],
                  ["SQL Preview", "View SQL for this dataset"],
                ].map(([title, subtitle]) => (
                  <button type="button" key={title} onClick={() => void sendPrompt(title)} className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 p-3 text-left">
                    <p className="text-sm text-slate-200">{title}</p>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="font-semibold text-white">Key Takeaways</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                {insights.slice(0, 3).map((insight) => (
                  <p key={insight.id}>
                    <Trophy className="mr-2 inline size-4 text-amber-300" />
                    {insight.description}
                  </p>
                ))}
                <p>
                  <ShieldCheck className="mr-2 inline size-4 text-green-300" />
                  Schema-only mode is active.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
