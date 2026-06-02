import { useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";
import { generateDynamicQuestionSuggestions } from "@/features/dashboard/utils/dynamicQuestionSuggestions";
import type { useDashboardAiController } from "@/features/dashboard/hooks/useDashboardAiController";
import { api } from "@/features/data/api/dataApi";

type DatasetLike = {
  id?: string;
  name?: string;
  rows?: any[];
  columns?: any[];
};

type Props = {
  dataset: DatasetLike;
  controller?: ReturnType<typeof useDashboardAiController>;
  currentDashboard?: unknown;
  onCommand: (command: any) => void;
  onSend?: (query: string) => void;
  collapsible?: boolean;
};

const modes = [
  { id: "Build", icon: Wand2, prompt: "Build dashboard automatically" },
  { id: "Fix", icon: Wrench, prompt: "fix dashboard and generate 7 useful charts" },
  { id: "Explain", icon: MessageSquareText, prompt: "Explain this dashboard" },
  { id: "Train", icon: BrainCircuit, prompt: "Train memory from this dashboard pattern" },
] as const;

export default function SchemaDashboardChat({
  dataset,
  controller,
  currentDashboard,
  onCommand,
  onSend,
}: Props) {
  const [input, setInput] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [provider, setProvider] = useState("schema-safe");
  const [activeMode, setActiveMode] =
    useState<(typeof modes)[number]["id"]>("Build");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content:
        "Schema-trained assistant ready. I can build, fix, explain, or train dashboard patterns without sending raw rows to the LLM.",
    },
  ]);
  const loading = controller?.loading || localLoading;
  const visibleMessages = controller?.messages || messages;

  const suggestions = useMemo(() => {
    const dynamic = generateDynamicQuestionSuggestions(dataset as any, 8);
    const merged = [...(dynamic || []), "Build dashboard automatically", "fix dashboard and generate useful charts"];

    return [...new Set(merged)].slice(0, 10);
  }, [dataset]);

  const dashboardChartCount = useMemo(() => {
    const dashboard = currentDashboard as { charts?: unknown[] } | undefined;
    return Array.isArray(dashboard?.charts) ? dashboard.charts.length : 0;
  }, [currentDashboard]);

  async function submit(explicitQuery?: string) {
    const query = (explicitQuery || input).trim();
    if (!query || loading) return;

    setInput("");
    setLocalLoading(true);

    if (!controller) {
      setMessages((current) => [...current, { role: "user", content: query }]);
    }

    let resultMessage = "";
    try {
      if (controller) {
        if (/explain|why|summary|describe/i.test(query)) {
          await controller.askChat(query);
        } else {
          await controller.runCommand(query);
        }
      } else {
        onSend?.(query);
        const safeDatasetId = dataset?.id || dataset?.name || "local-dataset";
        const safeDatasetPayload = {
          id: safeDatasetId,
          name: dataset?.name || "Uploaded Dataset",
          rows: Array.isArray(dataset?.rows) ? dataset.rows : [],
          columns: Array.isArray(dataset?.columns) ? dataset.columns : [],
        };

        if (!safeDatasetPayload.rows.length && !safeDatasetPayload.columns.length) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content:
                "I can see no active dataset context. Please upload or select a dataset first.",
            },
          ]);
          setLocalLoading(false);
          return;
        }

        const command = await api.sendDashboardCommand(
          safeDatasetId,
          query,
          currentDashboard,
          {
            rows: safeDatasetPayload.rows,
            columns: safeDatasetPayload.columns,
            pageContext: "premium-agentic-dashboard",
            dashboardChartCount,
          },
        );
        setProvider(command.provider || "schema-safe");
        onCommand(command);
        resultMessage = command.message || "";
      }

      if (!controller) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              resultMessage ||
              (!controller && /explain|why|summary|describe/i.test(query)
                ? "Explanation request sent to schema chat."
                : "Dashboard command sent. Values will be calculated locally."),
          },
        ]);
      }
    } catch (error) {
      if (!controller) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: error instanceof Error ? error.message : "Command failed.",
          },
        ]);
      }
    } finally {
      setLocalLoading(false);
    }
  }

  return (
    <aside className="sticky top-5 h-fit rounded-2xl border border-slate-700/70 bg-slate-950/90 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-violet-600/20 text-violet-200">
            <Bot className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white">Schema AI Studio</h3>
            <p className="mt-1 text-xs text-slate-400">{dataset?.name || "Current dataset"}</p>
          </div>

          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
            Schema-only
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setActiveMode(mode.id);
                  void submit(mode.prompt);
                }}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs transition ${
                  activeMode === mode.id
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-violet-500/60"
                }`}
              >
                <Icon className="size-3.5" />
                {mode.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-slate-800 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300">
          <Sparkles className="size-3.5 text-violet-300" />
          Trained prompts
        </div>

        <div className="grid gap-2">
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              disabled={loading}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-100 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {controller?.dashboardHealth && (
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Guardian health</span>
            <span className={controller.dashboardHealth.status === "failed" ? "text-red-300" : controller.dashboardHealth.status === "warning" ? "text-amber-300" : "text-emerald-300"}>
              {controller.dashboardHealth.status} {controller.dashboardHealth.score}/100
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              style={{ width: `${Math.max(12, Math.min(100, controller.dashboardHealth.score || 0))}%` }}
            />
          </div>
        </div>
      )}

      <div className="max-h-72 space-y-3 overflow-y-auto p-4">
        {visibleMessages.map((message, index) => (
          <div
            key={`${(message as any).id || message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-6 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white"
                : "mr-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200"
            }
          >
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="mr-6 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Processing schema-safe command...
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask: build dashboard, add KPI, or analyze data..."
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500"
          />

          <button
            type="submit"
            aria-label="Send dashboard command"
            disabled={loading || !input.trim()}
            className="grid size-10 place-items-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Mode: {activeMode}</span>
          <span>{controller?.error ? "Backend fallback active" : dashboardChartCount ? `${dashboardChartCount} charts` : `Provider: ${provider}`}</span>
        </div>

        <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-300">
          <ShieldCheck className="size-3.5" />
          Schema-only AI enabled
        </div>
      </div>
    </aside>
  );
}
