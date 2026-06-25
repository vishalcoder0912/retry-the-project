import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, BrainCircuit, Send, Sparkles, Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { AgentMessage, AgentReasoningStep } from "@/features/dashboard/types/premiumDashboardTypes";
import {
  parseChartCommand,
  extractChartReference,
  extractColumnReferences,
} from "@/features/dashboard/utils/chartCommandProcessor";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

type AvailableColumn =
  | string
  | {
      name?: string;
      key?: string;
      accessorKey?: string;
      label?: string;
      title?: string;
    };

const getColumnName = (column: AvailableColumn) => {
  if (typeof column === "string") return column;
  return column.name || column.key || column.accessorKey || column.label || column.title || "";
};

interface EnhancedAgentPanelProps {
  messages: AgentMessage[];
  reasoning: AgentReasoningStep[];
  loading: boolean;
  onAsk: (query: string) => void;
  charts: PremiumChart[];
  availableColumns: AvailableColumn[];
  onChartCommand?: (command: {
    action: string;
    chartId?: string;
    targetChart?: string;
    params?: Record<string, unknown>;
  }) => void;
  onCreateChart?: () => void;
  deepResearch?: boolean;
  onDeepResearchChange?: (value: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function EnhancedAgentPanel({
  messages,
  reasoning,
  loading,
  onAsk,
  charts,
  availableColumns,
  onChartCommand,
  onCreateChart,
  deepResearch = false,
  onDeepResearchChange,
  isCollapsed = false,
  onToggleCollapse,
}: EnhancedAgentPanelProps) {
  const [tab, setTab] = useState<"chat" | "plan">("chat");
  const [query, setQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const columnNames = useMemo(
    () => availableColumns.map(getColumnName).filter(Boolean),
    [availableColumns],
  );
  const examples = useMemo(() => {
    const lowerColumns = columnNames.map((column) => column.toLowerCase());
    const hasAmount = lowerColumns.some((column) => /amount|sales|revenue|salary|price|total|profit/.test(column));
    const hasCategory = lowerColumns.some((column) => /category|type|segment|department|product/.test(column));
    const hasDate = lowerColumns.some((column) => /date|month|year|time/.test(column));
    const hasGeo = lowerColumns.some((column) => /country|region|state|city|location|territory|geo/.test(column));
    const hasSkill = lowerColumns.some((column) => /skill|language|framework/.test(column));
    const metric = lowerColumns.find((column) => /amount|sales|revenue|salary|price|total|profit/.test(column)) || "metric";
    const category = lowerColumns.find((column) => /category|type|segment|department|product/.test(column)) || "category";

    return [
      hasAmount && hasCategory ? `Show ${metric} by ${category}` : "Summarize this dataset",
      hasDate && hasAmount ? `Show ${metric} trend over time` : "Show distribution",
      hasAmount ? `Find ${metric} outliers` : "Find outliers",
      hasGeo && hasAmount ? `Show ${metric} by location` : null,
      hasSkill && hasAmount ? `Show top skills by ${metric}` : null,
    ].filter(Boolean) as string[];
  }, [columnNames]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDashboardQuery = (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) return;

    // Try to parse chart command
    const command = parseChartCommand(trimmedQuery);
    if (command && command.confidence > 0.4) {
      const columns = extractColumnReferences(trimmedQuery, columnNames);

      // Handle chart commands
      if (command.action === "create") {
        if (onChartCommand) {
          onChartCommand({
            action: "create",
            params: {
              ...command.customization,
              ...columns,
              query: trimmedQuery,
            },
          });
        } else {
          onCreateChart?.();
        }
        return;
      }

      if (command.action === "remove") {
        const chartRef = extractChartReference(trimmedQuery, charts);
        if (chartRef && onChartCommand) {
          onChartCommand({
            action: "remove",
            chartId: chartRef.chartId,
          });
          return;
        }
      }

      if (command.action === "modify") {
        const chartRef = extractChartReference(trimmedQuery, charts);
        if (chartRef && onChartCommand) {
          onChartCommand({
            action: "modify",
            chartId: chartRef.chartId,
            params: {
              ...command.customization,
              ...columns,
              query: trimmedQuery,
            },
          });
          return;
        }
      }

      if (command.action === "duplicate") {
        const chartRef = extractChartReference(trimmedQuery, charts);
        if (chartRef && onChartCommand) {
          onChartCommand({
            action: "duplicate",
            chartId: chartRef.chartId,
          });
          return;
        }
      }

      if (command.action === "toggle_visibility") {
        const chartRef = extractChartReference(trimmedQuery, charts);
        if (chartRef && onChartCommand) {
          onChartCommand({
            action: "toggle_visibility",
            chartId: chartRef.chartId,
          });
          return;
        }
      }
    }

    // If not a chart command, send as regular query
    onAsk(trimmedQuery);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    handleDashboardQuery(query);
    setQuery("");
  };

  if (isCollapsed) {
    return (
      <aside className="w-[60px] flex flex-col items-center py-4 space-y-4 border border-cyan-400/20 bg-slate-950/80 rounded-2xl shadow-[0_0_34px_rgba(6,182,212,.12)] min-h-[500px]">
        <button
          onClick={onToggleCollapse}
          className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 transition-all"
          title="Expand AI panel"
          type="button"
        >
          <Bot className="h-5 w-5" />
        </button>
        <div className="flex-1 flex flex-col items-center space-y-4 pt-6">
          <button
            onClick={() => setTab(tab === "chat" ? "plan" : "chat")}
            className={`grid h-8 w-8 place-items-center rounded-lg hover:text-white transition ${
              tab === "chat" ? "bg-slate-800 text-cyan-400" : "bg-slate-850 text-slate-400"
            }`}
            title={`Switch to ${tab === "chat" ? "Plan" : "Chat"}`}
            type="button"
          >
            <BrainCircuit className="h-4 w-4" />
          </button>
          {onCreateChart && (
            <button
              onClick={onCreateChart}
              className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600/30 text-violet-300 hover:bg-violet-600 transition"
              title="Add Chart"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-[0_0_34px_rgba(6,182,212,.12)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-cyan-200">AI Agent Active</p>
            <p className="text-xs text-slate-500">RAG Enabled + Chart Control</p>
          </div>
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="text-[10px] text-slate-400 hover:text-white border border-slate-700 bg-slate-900/60 rounded-lg px-2.5 py-1 transition hover:bg-slate-800"
                title="Collapse AI panel"
              >
                Collapse
              </button>
            )}
            <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/20 text-violet-200">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">InsightFlow AI Agent</h3>
            <p className="text-xs text-slate-500">Schema + RAG + Chart Control</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
          <button
            className={`rounded-lg py-2 ${
              tab === "chat" ? "bg-violet-500/30 text-white" : "text-slate-400"
            }`}
            onClick={() => setTab("chat")}
            type="button"
          >
            Chat
          </button>
          <button
            className={`rounded-lg py-2 ${
              tab === "plan" ? "bg-violet-500/30 text-white" : "text-slate-400"
            }`}
            onClick={() => setTab("plan")}
            type="button"
          >
            Plan
          </button>
        </div>

        {tab === "chat" ? (
          <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-500 py-4">
                Start a conversation to get insights
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border p-3 text-xs leading-5 ${
                  message.role === "assistant"
                    ? "border-slate-800 bg-slate-900/70 text-slate-300"
                    : "border-violet-400/20 bg-violet-500/10 text-violet-100"
                }`}
              >
                {message.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-300">
            <p>1. Read schema safely</p>
            <p>2. Retrieve RAG memories</p>
            <p>3. Generate dashboard plan</p>
            <p>4. Validate with guardian</p>
            <p>5. Calculate values locally</p>
            <hr className="my-3 border-slate-800" />
            <p className="font-semibold text-white">Chart Commands:</p>
            <p>- "Show salary by country" creates a chart</p>
            <p>- "Remove [chart name]" deletes a chart</p>
            <p>- "Change [chart name] to line chart" updates it</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Suggestions</h3>
          {onCreateChart && (
            <button
              onClick={onCreateChart}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-400 hover:border-violet-400/40 hover:text-violet-300 transition"
              type="button"
              title="Create custom chart"
            >
              <Plus className="h-3 w-3" />
              Chart
            </button>
          )}
        </div>
        <div className="space-y-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                handleDashboardQuery(example);
              }}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-violet-400/40 hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Agent Reasoning</h3>
        <div className="space-y-3">
          {reasoning.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-slate-300">{step.label}</span>
              <motion.span
                animate={step.status === "completed" ? { scale: [1, 1.08, 1] } : undefined}
                className={`rounded-full px-2 py-0.5 ${
                  step.status === "completed"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : step.status === "running"
                      ? "bg-violet-400/10 text-violet-300"
                      : "bg-slate-800 text-slate-500"
                }`}
              >
                {step.status}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
        </div>
      </section>

      <form onSubmit={submit} className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-3">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask anything about your data..."
          className="h-20 w-full resize-none rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(event) => onDeepResearchChange?.(event.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-violet-500"
            />
            Deep Research
          </label>
          <button
            type="submit"
            disabled={loading}
            className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </aside>
  );
}
