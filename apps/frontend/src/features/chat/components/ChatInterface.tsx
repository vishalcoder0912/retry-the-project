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

function findColumn(columns: string[], text: string) {
  const normalizedText = normalize(text);
  return (
    columns.find((column) => normalize(column) === normalizedText) ||
    columns.find((column) => normalizedText.includes(normalize(column))) ||
    columns.find((column) => normalize(column).includes(normalizedText))
  );
}

function localCommand(query: string, rows: Row[]): DashboardCommandResponse | null {
  const profile = buildDatasetProfile(rows);
  const columns = profile.columns.map((column) => column.name);
  const lower = query.toLowerCase();
  const metric =
    columns.find((column) => lower.includes(normalize(column).replace(/_/g, " "))) ||
    profile.primaryMetric?.name;
  const category =
    profile.categoryColumns.find((column) => lower.includes(normalize(column.name).replace(/_/g, " ")))?.name ||
    profile.primaryCategory?.name;

  if (/filter\s+(.+?)\s*=\s*(.+)$/i.test(query)) {
    const match = query.match(/filter\s+(.+?)\s*=\s*(.+)$/i);
    const column = match ? findColumn(columns, match[1]) : undefined;
    if (column && match) {
      return { action: "FILTER", message: `Filtered ${column} to ${match[2].trim()}.`, filters: { [column]: match[2].trim() }, schemaOnly: true };
    }
  }

  if (/kpi|cards/.test(lower)) {
    return { action: "GENERATE_KPI", message: "Generated schema-aware KPI cards.", schemaOnly: true };
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendPrompt(prompt = input) {
    const query = prompt.trim();
    if (!query || !dataset?.id || loading) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: query }]);

    const planned = localCommand(query, rows);

    try {
      if (planned || /chart|kpi|filter|dashboard|distribution|scatter|pie|donut/i.test(query)) {
        const response = await api.sendDashboardCommand(dataset.id, query, { schemaOnly: true });
        const command = response.action === "ANSWER" && planned ? planned : response.chartSpec || response.kpiSpec || response.filters ? response : planned;

        if (command) {
          const chart = command.chartSpec ? buildChartFromSpec(rows, command.chartSpec) : undefined;
          const kpis = command.kpiSpec ? [buildKpiFromSpec(rows, command.kpiSpec)] : /kpi|cards/i.test(query) ? buildKpis(rows).slice(0, 5) : undefined;
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.assistantMessage.content,
          takeaway: "Schema-only answer. Raw rows were not sent to the LLM.",
        },
      ]);
    } catch (error) {
      if (planned) {
        const chart = planned.chartSpec ? buildChartFromSpec(rows, planned.chartSpec) : undefined;
        const kpis = planned.kpiSpec ? [buildKpiFromSpec(rows, planned.kpiSpec)] : /kpi|cards/i.test(query) ? buildKpis(rows).slice(0, 5) : undefined;
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
  }

  function exportChat() {
    const blob = JSON.stringify({ dataset: dataset?.name, messages }, null, 2);
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${dataset?.name || "chat"}-conversation.json`;
    link.click();
    URL.revokeObjectURL(url);
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
            <button onClick={shareChat} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Share2 className="mr-2 inline h-4 w-4" />
              Share
            </button>
            <button onClick={exportChat} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Download className="mr-2 inline h-4 w-4" />
              Export
            </button>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-100">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-400" />
              Qwen3:8B Online
            </div>
            <button className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-5 2xl:grid-cols-[1fr_350px]">
          <main className={`${CARD} flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden`}>
            <div className="border-b border-slate-700/60 p-5">
              <div className="flex gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">Hi! I'm your AI Data Analyst</h2>
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] uppercase text-violet-200">Beta</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">I can answer schema questions, generate local charts and KPIs, filter records, and explain data quality.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button key={suggestion} onClick={() => void sendPrompt(suggestion)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
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
                        <Brain className="mr-2 inline h-4 w-4" />
                        {message.takeaway}
                      </div>
                    )}

                    {(message.chart || message.kpis?.length) && (
                      <button onClick={() => addToDashboard(message)} className="mt-3 rounded-xl border border-violet-500/50 px-4 py-2 text-sm text-violet-200">
                        <Grid3X3 className="mr-2 inline h-4 w-4" />
                        Add to Dashboard
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <Bot className="mr-2 inline h-4 w-4 animate-pulse text-violet-300" />
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
                  className="h-20 w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-xl border border-slate-700 px-3 py-2"><Database className="mr-2 inline h-4 w-4" />Schema only</span>
                    <span className="rounded-xl border border-slate-700 px-3 py-2">Qwen3:8B</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-xl border border-slate-700 p-3"><Paperclip className="h-4 w-4" /></button>
                    <button onClick={() => void sendPrompt("Generate chart")} className="rounded-xl border border-slate-700 p-3"><BarChart3 className="h-4 w-4" /></button>
                    <button onClick={() => void sendPrompt("Filter data")} className="rounded-xl border border-slate-700 p-3"><Filter className="h-4 w-4" /></button>
                    <button onClick={() => void sendPrompt("Summarize dataset")} className="rounded-xl border border-slate-700 p-3"><Table2 className="h-4 w-4" /></button>
                    <button disabled={!input.trim() || loading} onClick={() => void sendPrompt()} className="rounded-xl bg-violet-600 p-3 disabled:opacity-50"><Send className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/20 text-violet-200">
                  <FileText className="h-6 w-6" />
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
                  className="grid h-32 w-32 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#22c55e ${quality.finalScore * 3.6}deg, rgba(51,65,85,0.9) 0deg)` }}
                >
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-950">
                    <span className="text-3xl font-semibold">{Math.round(quality.finalScore)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="font-semibold text-white">Quick Actions</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["Generate Chart", "Build Dashboard", "Find Anomalies", "Summarize Dataset"].map((action) => (
                  <button key={action} onClick={() => void sendPrompt(action)} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-3 text-left text-xs text-slate-200">
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
                  <button key={title} onClick={() => void sendPrompt(title)} className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-3 text-left">
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
                    <Trophy className="mr-2 inline h-4 w-4 text-amber-300" />
                    {insight.description}
                  </p>
                ))}
                <p>
                  <ShieldCheck className="mr-2 inline h-4 w-4 text-green-300" />
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
