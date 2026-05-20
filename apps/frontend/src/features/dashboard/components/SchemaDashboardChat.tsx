import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { api, type DashboardCommandResponse } from "@/features/data/api/dataApi";
import {
  generateDynamicQuestionSuggestions,
  type SuggestionDataset,
} from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import {
  buildDatasetProfile,
  cleanDatasetRows,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  dataset: SuggestionDataset;
  currentDashboard?: unknown;
  onCommand: (command: DashboardCommandResponse) => void;
  collapsible?: boolean;
};

function buildAssistantText(command: DashboardCommandResponse) {
  return [
    command.message || "Done.",
    command.schemaOnly ? "Schema only" : "",
    command.model ? `Model: ${command.model}` : "",
    command.provider ? `Provider: ${command.provider}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function findColumn(columns: string[], text: string) {
  const normalizedText = normalize(text);
  return (
    columns.find((column) => normalize(column) === normalizedText) ||
    columns.find((column) => normalizedText.includes(normalize(column))) ||
    columns.find((column) => normalize(column).includes(normalizedText))
  );
}

function planLocalCommand(query: string, dataset: SuggestionDataset): DashboardCommandResponse | null {
  const rows = cleanDatasetRows((dataset.rows || []) as Row[]);
  const profile = buildDatasetProfile(rows);
  const columns = profile.columns.map((column) => column.name);
  const lower = query.toLowerCase();

  if (/clear\s+filters|reset\s+filters/.test(lower)) {
    return {
      action: "CLEAR_FILTERS",
      message: "Cleared all dashboard filters.",
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  if (/remove\s+chart|delete\s+chart/.test(lower)) {
    return {
      action: "DELETE_CHART",
      message: "Removed the most recent chart.",
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  const filterMatch = query.match(/filter\s+(.+?)\s*=\s*(.+)$/i);
  if (filterMatch) {
    const column = findColumn(columns, filterMatch[1]);
    if (column) {
      return {
        action: "FILTER",
        message: `Filtered ${column} to ${filterMatch[2].trim()}.`,
        filters: { [column]: filterMatch[2].trim() },
        schemaOnly: true,
        provider: "local-command-planner",
        model: "local",
      };
    }
  }

  const requestedMetric =
    columns.find((column) => lower.includes(normalize(column).replace(/_/g, " "))) ||
    profile.primaryMetric?.name;
  const requestedCategory =
    profile.categoryColumns.find((column) => lower.includes(normalize(column.name).replace(/_/g, " ")))?.name ||
    profile.primaryCategory?.name;

  if (/kpi|highest|max|average|avg|sum|total/.test(lower) && requestedMetric) {
    const aggregation = /highest|max/.test(lower)
      ? "max"
      : /average|avg/.test(lower)
      ? "avg"
      : /sum|total/.test(lower)
      ? "sum"
      : "count";
    return {
      action: "GENERATE_KPI",
      message: `Added a ${aggregation} KPI for ${requestedMetric}.`,
      kpiSpec: {
        title: `${aggregation === "max" ? "Highest" : titleCase(aggregation)} ${titleCase(requestedMetric)}`,
        metric: requestedMetric,
        aggregation,
        format: "number",
      },
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  if (/pie|donut/.test(lower) && requestedCategory) {
    return {
      action: "GENERATE_CHART",
      message: `Created a pie chart of ${requestedCategory}.`,
      chartSpec: {
        type: lower.includes("pie") ? "pie" : "donut",
        title: `Records by ${titleCase(requestedCategory)}`,
        xKey: requestedCategory,
        yKey: "count",
        aggregation: "count",
        limit: 8,
      },
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  if (/distribution|histogram/.test(lower) && requestedMetric) {
    return {
      action: "GENERATE_CHART",
      message: `Created a distribution chart for ${requestedMetric}.`,
      chartSpec: {
        type: "histogram",
        title: `${titleCase(requestedMetric)} Distribution`,
        xKey: "range",
        yKey: requestedMetric,
        aggregation: "count",
        limit: 8,
      },
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  if (/scatter| vs /.test(lower)) {
    const vsMatch = lower.match(/show\s+(.+?)\s+vs\s+(.+?)(\s+as\s+scatter|$)/);
    const xKey = vsMatch ? findColumn(columns, vsMatch[2]) : profile.secondaryMetric?.name;
    const yKey = vsMatch ? findColumn(columns, vsMatch[1]) : requestedMetric;
    if (xKey && yKey) {
      return {
        action: "GENERATE_CHART",
        message: `Created a scatter chart for ${yKey} vs ${xKey}.`,
        chartSpec: {
          type: "scatter",
          title: `${titleCase(yKey)} vs ${titleCase(xKey)}`,
          xKey,
          yKey,
          aggregation: "avg",
          limit: 200,
        },
        schemaOnly: true,
        provider: "local-command-planner",
        model: "local",
      };
    }
  }

  if (/average|avg|by/.test(lower) && requestedMetric && requestedCategory) {
    return {
      action: "GENERATE_CHART",
      message: `Created an average ${requestedMetric} by ${requestedCategory} chart.`,
      chartSpec: {
        type: "bar",
        title: `Average ${titleCase(requestedMetric)} by ${titleCase(requestedCategory)}`,
        xKey: requestedCategory,
        yKey: requestedMetric,
        aggregation: "avg",
        limit: 10,
      },
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  if (/trend/.test(lower) && requestedMetric) {
    return {
      action: "GENERATE_CHART",
      message: `Created a trend chart for ${requestedMetric}.`,
      chartSpec: {
        type: "line",
        title: `${titleCase(requestedMetric)} Trend`,
        xKey: profile.dateColumn?.name || "__row_index__",
        yKey: requestedMetric,
        aggregation: "avg",
        limit: 24,
      },
      schemaOnly: true,
      provider: "local-command-planner",
      model: "local",
    };
  }

  return null;
}

export default function SchemaDashboardChat({
  dataset,
  currentDashboard,
  onCommand,
  collapsible = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const suggestions = useMemo(
    () => generateDynamicQuestionSuggestions(dataset, 8),
    [dataset],
  );

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          suggestions[0]
            ? `Your data is ready. Try: ${suggestions[0]}`
            : "Upload a dataset and I will suggest schema-aware dashboard actions.",
      },
    ]);
  }, [dataset.id, suggestions]);

  async function sendPrompt(prompt: string) {
    const query = prompt.trim();
    if (!query || loading || !dataset.id) return;

    setLoading(true);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: query }]);

    try {
      const responseCommand = await api.sendDashboardCommand(
        dataset.id,
        query,
        currentDashboard,
      );
      const localCommand = planLocalCommand(query, dataset);
      const command =
        responseCommand.action === "ANSWER" && localCommand
          ? localCommand
          : responseCommand;

      onCommand(command);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: buildAssistantText(command),
        },
      ]);
    } catch (error) {
      const localCommand = planLocalCommand(query, dataset);

      if (localCommand) {
        onCommand(localCommand);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: buildAssistantText(localCommand),
          },
        ]);
        setLoading(false);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "I could not process that command.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 shadow-xl backdrop-blur"
      >
        <Sparkles className="h-4 w-4 text-violet-300" />
        AI Assistant
      </button>
    );
  }

  return (
    <aside className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-300" />
            <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Schema-aware actions only. Raw dataset rows are not sent to the LLM.
          </p>
        </div>

        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-2 text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            disabled={loading || !dataset.id}
            onClick={() => void sendPrompt(item)}
            className="rounded-2xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-50"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-10 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm text-white"
                  : "mr-10 rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-100"
              }
            >
              <p className="whitespace-pre-line">{message.content}</p>
            </div>
          ))}

          {loading && (
            <div className="mr-10 flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing schema-only command...
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendPrompt(input);
              }
            }}
            disabled={loading || !dataset.id}
            placeholder={suggestions[0] || "Ask for a chart, KPI, filter, or insight"}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
          />

          <button
            type="button"
            disabled={loading || !input.trim() || !dataset.id}
            onClick={() => void sendPrompt(input)}
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 p-3 text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="rounded-full border border-slate-700/60 bg-slate-950/60 px-2 py-1 text-slate-300">
            Schema only
          </span>
          <span>AI can make mistakes. Verify important results.</span>
        </div>
      </div>
    </aside>
  );
}
