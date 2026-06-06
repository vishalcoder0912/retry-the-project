import { useEffect, useMemo, useRef, useState } from "react";
<<<<<<< HEAD
import {
  CheckCircle2,
  Database,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
  interpretCommand,
  titleCase,
  type InterpretedCommand,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import type { DashboardChart, DashboardKpi, Row } from "@/features/dashboard/utils/dashboardAnalytics";
import {
  loadDashboardState,
  recordDashboardAction,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: DashboardChart;
  kpi?: DashboardKpi;
  table?: Row[];
  action?: InterpretedCommand;
  dashboardAction?: {
    available: boolean;
    type?: "ADD_CHART" | "ADD_KPI" | "APPLY_FILTER" | "CLEAR_FILTER";
    label?: string;
    payload?: {
      chart?: DashboardChart;
      kpi?: DashboardKpi;
      filters?: Array<{ column: string; operator?: string; value: string | number | boolean }>;
    };
  };
  debug?: {
    sql?: string | null;
    queryPlan?: unknown;
    safety?: unknown;
  };
  timestamp: Date;
  loading?: boolean;
  error?: boolean;
};

function makeId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function QuickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155] shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50"
    >
      <Sparkles className="mr-2 inline size-4 text-[#7C3AED]" />
      {label}
    </button>
  );
}

export default function ChatInterface() {
  const { dataset } = useData();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
=======
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
>>>>>>> origin/main
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const stored = dataset?.id ? loadDashboardState(dataset.id) : { filters: {}, manualCharts: [], manualKpis: [] };
  const model = useMemo(
    () => buildCommandCenterModel(dataset, stored.filters, stored.manualCharts, stored.manualKpis),
    [dataset, stored.filters, stored.manualCharts, stored.manualKpis],
  );

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const suggestions = useMemo(() => generateDynamicQuestionSuggestions({ id: dataset?.id, name: dataset?.name, rows, columns: dataset?.columns }, 5), [dataset, rows]);

  useEffect(() => {
<<<<<<< HEAD
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history from the backend on mount or when the dataset changes
  useEffect(() => {
    if (!dataset?.id) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Welcome to AI Data Copilot! Please upload a dataset to start. You can ask general questions here.",
          timestamp: new Date()
        }
      ]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/datasets/${dataset.id}/chat/history`);
        if (!response.ok) throw new Error("Failed to load history");
        const data = await response.json();
        if (active && data.success && Array.isArray(data.data?.messages)) {
          const mapped = data.data.messages.map((msg: any) => {
            const localResult = msg.role === "assistant" ? interpretCommand(msg.content, model.filteredRows.length ? model.filteredRows : model.rows) : null;
            return {
              id: msg.id || makeId(),
              role: msg.role,
              content: msg.content,
              chart: msg.chart || localResult?.chart || undefined,
              kpi: msg.kpi || localResult?.kpi || undefined,
              table: msg.table || (msg.role === "assistant" && /table|top|anomal/i.test(msg.content) ? model.filteredRows.slice(0, 6) : undefined),
              timestamp: new Date(msg.timestamp)
            };
          });

          // Prepend history messages safely to any newly added messages in the state
          setMessages((prev) => {
            const newMessages = prev.filter((m) => m.id !== "welcome" && !m.loading);
            if (newMessages.length > 0) {
              return [...mapped, ...newMessages];
            }
            return mapped.length > 0 ? mapped : [
              {
                id: "welcome",
                role: "assistant",
                content: `I am ready. Ask questions about the ${dataset.name} dataset, or give commands to create charts or KPIs.`,
                timestamp: new Date()
              }
            ];
          });
        }
      } catch (err) {
        console.warn("Failed to load history:", err);
      }
    };
    void loadHistory();
    return () => { active = false; };
  }, [dataset?.id, model.filteredRows, model.rows]);

  function persistAction(result: InterpretedCommand) {
    if (!dataset?.id) return;
    const current = loadDashboardState(dataset.id);
    const nextState = {
      ...current,
      filters: result.filters ? { ...current.filters, ...result.filters } : current.filters,
      manualCharts: result.chart ? [result.chart, ...current.manualCharts].slice(0, 8) : current.manualCharts,
      manualKpis: result.kpi ? [result.kpi, ...current.manualKpis].slice(0, 8) : current.manualKpis,
      geoActive: result.geoRequested || current.geoActive,
    };
    saveDashboardState(dataset.id, nextState);
    recordDashboardAction(dataset.id, result.auditLabel, "chat", nextState);
  }

  async function persistDashboardAction(action: NonNullable<Message["dashboardAction"]>) {
    if (!dataset?.id || !action.available) return;
    try {
      await fetch("/api/dashboard/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          action: {
            type: action.type,
            chart: action.payload?.chart,
            kpi: action.payload?.kpi,
            filters: action.payload?.filters,
          },
        }),
      });
    } catch (error) {
      console.warn("Dashboard action endpoint unavailable; saving locally.", error);
    }
    const current = loadDashboardState(dataset.id);
    const filtersFromAction = action.type === "APPLY_FILTER"
      ? Object.fromEntries((action.payload?.filters || []).map((filter) => [filter.column, filter.value]))
      : {};
    const nextState = {
      ...current,
      filters: action.type === "CLEAR_FILTER" ? {} : { ...current.filters, ...filtersFromAction },
      manualCharts: action.payload?.chart ? [action.payload.chart, ...current.manualCharts].slice(0, 8) : current.manualCharts,
      manualKpis: action.payload?.kpi ? [action.payload.kpi, ...current.manualKpis].slice(0, 8) : current.manualKpis,
    };
    saveDashboardState(dataset.id, nextState);
    recordDashboardAction(dataset.id, action.label || action.type || "Chat action", "chat", nextState);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: makeId(),
        role: "assistant",
        content: action.type === "ADD_CHART"
          ? "Chart added to the dashboard."
          : action.type === "ADD_KPI"
            ? "KPI added to the dashboard."
            : action.type === "CLEAR_FILTER"
              ? "Dashboard filters cleared."
              : "Dashboard filter applied.",
        timestamp: new Date(),
      },
    ]);
  }

  async function sendPrompt(prompt = input) {
    const query = prompt.trim();
    if (!query) return;

    // Empty state: no dataset is active
    if (!dataset) {
      const userMsg: Message = {
        id: makeId(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };
      let reply = "No dataset is currently loaded. Please upload a dataset first.";
      if (/help|what is|how to/i.test(query)) {
        reply = "I am InsightFlow AI Copilot. You can upload CSV/Excel/JSON datasets and ask me questions, create charts, or analyze metrics.";
      }
      const assistantMsg: Message = {
        id: makeId(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((current) => [...current, userMsg, assistantMsg]);
      setInput("");
      return;
    }

    const userMsgId = makeId();
    const assistantMsgId = makeId();

    setInput("");
    setLoading(true);

    // Insert user message and temporary thinking indicator
    setMessages((current) => [
      ...current.filter((m) => m.id !== "welcome"),
      {
        id: userMsgId,
        role: "user",
        content: query,
        timestamp: new Date(),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "Thinking...",
        loading: true,
        timestamp: new Date(),
      },
    ]);

    try {
      const response = await fetch(`/api/chat/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dataset.id,
          message: query,
          activeFilters: stored.filters || {},
          mode: "analysis",
        }),
      });

      const data = await response.json();
      const chatData = data.data || data;

      if (!response.ok || !data.success || chatData.success === false) {
        throw new Error(chatData.answer || data.error?.message || "I could not process that chat request.");
      }

      const localResult = !chatData.chart && !chatData.kpi
        ? interpretCommand(query, model.filteredRows.length ? model.filteredRows : model.rows)
        : null;
      if (localResult && (localResult.chart || localResult.kpi || localResult.filters || localResult.geoRequested)) {
        persistAction(localResult);
      }

      setMessages((current) =>
        current.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              id: chatData.messageId || makeId(),
              role: "assistant",
              content: chatData.answer || "I prepared a schema-safe analytics response.",
              chart: chatData.chart || localResult?.chart || undefined,
              kpi: chatData.kpi || localResult?.kpi || undefined,
              table: chatData.result?.rows && /table/i.test(query) ? chatData.result.rows : undefined,
              dashboardAction: chatData.dashboardAction?.available ? chatData.dashboardAction : undefined,
              debug: {
                sql: chatData.sql,
                queryPlan: chatData.queryPlan,
                safety: chatData.safety,
              },
              timestamp: new Date(),
            };
          }
          return msg;
        })
      );
    } catch (err: any) {
      setMessages((current) =>
        current.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              id: makeId(),
              role: "assistant",
              content: err.message || "Failed to communicate with AI.",
              error: true,
              timestamp: new Date(),
            };
          }
          return msg;
        })
      );
=======
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
>>>>>>> origin/main
    } finally {
      setLoading(false);
    }
  }

<<<<<<< HEAD
  function exportConversation() {
=======
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
>>>>>>> origin/main
    const blob = JSON.stringify({ dataset: dataset?.name, messages }, null, 2);
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
<<<<<<< HEAD
    link.download = `${dataset?.name || "insightflow"}-copilot.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const schemaPreview = model.profile?.columns?.slice(0, 6) || [];
  const activeFilters = Object.entries(stored.filters || {}).filter(([key, value]) => key !== "conditions" && value);

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto grid max-w-[1720px] gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <header className="flex items-start gap-4">
            <div className="mt-1 text-[#7C3AED]">
              <Sparkles className="size-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">AI Data Copilot</h1>
              <p className="mt-1 text-sm text-[#64748B]">Ask questions about your dataset and let InsightFlow create analyses, charts, and insights.</p>
            </div>
          </header>

          <section className="space-y-5 pb-28">
            {!messages.length && dataset && (
              <div className="grid gap-4">
                {model.suggestedCommands.slice(0, 3).map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => sendPrompt(command)}
                    className="ml-auto w-full max-w-xl rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-left text-sm font-semibold text-[#0F172A]"
                  >
                    {command}
                    <span className="float-right text-[#64748B]">Ready</span>
                  </button>
                ))}
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={message.role === "user" ? "max-w-3xl" : "w-full max-w-5xl"}>
                  <div
                    className={
                      message.role === "user"
                        ? "rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-semibold text-[#0F172A]"
                        : `rounded-2xl border ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[#E2E8F0] bg-white text-[#334155]'} px-5 py-4 text-sm shadow-sm`
                    }
                  >
                    {message.loading ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="size-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-line leading-6">{message.content}</p>
                    )}
                    <p className="mt-2 text-right text-xs text-[#64748B]">{formatTime(message.timestamp)}</p>
                  </div>

                  {message.kpi && (
                    <div className="mt-3 max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                      <p className="text-sm font-semibold text-[#64748B]">{message.kpi.title}</p>
                      <p className="mt-2 text-3xl font-bold text-[#0F172A]">{message.kpi.value}</p>
                      <p className="mt-2 text-sm text-[#64748B]">{message.kpi.subtitle}</p>
                    </div>
                  )}

                  {message.chart && (
                    <div className="mt-3">
                      <SmartChartCard chart={message.chart} />
                    </div>
                  )}

                  {message.dashboardAction?.available && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void persistDashboardAction(message.dashboardAction!)}
                        className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1E293B]"
                      >
                        {message.dashboardAction.label || "Add to Dashboard"}
                      </button>
                      {message.debug?.sql && (
                        <details className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-xs text-[#64748B]">
                          <summary className="cursor-pointer font-bold text-[#334155]">Query plan</summary>
                          <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap">{JSON.stringify({ sql: message.debug.sql, plan: message.debug.queryPlan, safety: message.debug.safety }, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  {message.table?.length ? (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                          <tr>
                            {model.columns.slice(0, 6).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {message.table.map((row) => (
                            <tr key={`${message.id}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155]">
                              {model.columns.slice(0, 6).map((column) => <td key={column} className="max-w-[160px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </section>

          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#E2E8F0] bg-white/95 p-4 backdrop-blur xl:left-72">
            <div className="mx-auto max-w-[1200px]">
              <div className="flex items-center gap-2 rounded-2xl border border-violet-300 bg-white p-2 shadow-[0_0_0_4px_rgba(124,58,237,0.05)]">
                <input
                  value={input}
                  aria-label="Ask InsightFlow Copilot a question or command"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendPrompt();
                    }
                  }}
                  placeholder={dataset ? "Ask a question or give a command..." : "Ask a general question..."}
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => sendPrompt()}
                  disabled={!input.trim() || loading}
                  className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white disabled:opacity-50"
                  aria-label="Send command"
                >
                  <Send className="size-5" />
                </button>
              </div>
              {dataset && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <QuickButton label="Create Chart" onClick={() => sendPrompt(model.suggestedCommands.find((command) => /chart|compare|top/i.test(command)) || "Create chart")} />
                  <QuickButton label="Explain Trend" onClick={() => sendPrompt("Explain the trend")} />
                  <QuickButton label="Generate Summary" onClick={() => sendPrompt("Generate summary")} />
                  <QuickButton label="Export Report" onClick={exportConversation} />
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-[#0F172A]">
                <Database className="size-5 text-[#7C3AED]" />
                Dataset Context
              </h2>
              {dataset ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Live</span>
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">None</span>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">Dataset</span><span className="font-bold text-[#0F172A]">{dataset?.name || "No dataset loaded"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Rows</span><span className="font-bold text-[#0F172A]">{dataset ? model.rows.length.toLocaleString() : "0"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Columns</span><span className="font-bold text-[#0F172A]">{dataset ? model.columns.length : "0"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Data Quality</span><span className="font-bold text-[#0F172A]">{dataset ? `${Math.round(model.quality.finalScore)}%` : "N/A"}</span></div>
            </div>
          </section>

          {dataset && (
            <>
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Columns Overview</h3>
                <div className="mt-4 space-y-3">
                  {schemaPreview.map((column) => (
                    <div key={column.name} className="flex items-center justify-between text-sm">
                      <span className="truncate text-[#334155]">{column.name}</span>
                      <span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-xs font-semibold text-[#64748B]">{titleCase(column.type)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#0F172A]">Active Filters ({activeFilters.length})</h3>
                  <span className="text-xs font-bold text-[#2563EB]">View all</span>
                </div>
                <div className="mt-3 space-y-2">
                  {activeFilters.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs font-semibold text-[#334155]">
                      <span>{key} is {String(value)}</span>
                      <X className="size-3" />
                    </div>
                  ))}
                  {!activeFilters.length && <p className="text-sm text-[#64748B]">No filters applied.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Suggested Actions</h3>
                <div className="mt-3 space-y-2">
                  {model.suggestedCommands.slice(0, 5).map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => sendPrompt(command)}
                      className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-left text-sm text-[#334155]"
                    >
                      <span><Sparkles className="mr-2 inline size-4 text-[#7C3AED]" />{command}</span>
                      <span aria-hidden="true">{"->"}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <h3 className="font-bold text-[#0F172A]">Recent Commands</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {(dataset?.id ? loadDashboardState(dataset.id).auditTrail || [] : []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[68px_1fr] gap-3">
                      <span className="text-xs text-[#64748B]">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[#334155]">{entry.label}</span>
                    </div>
                  ))}
                  {!(dataset?.id && loadDashboardState(dataset.id).auditTrail || []).length && (
                    <p className="text-sm text-[#64748B]">
                      <CheckCircle2 className="mr-2 inline size-4 text-emerald-500" />
                      Copilot is ready.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </aside>
=======
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
>>>>>>> origin/main
      </div>
    </div>
  );
}
