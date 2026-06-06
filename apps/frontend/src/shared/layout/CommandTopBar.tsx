import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Download,
  Filter,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { useData } from "@/features/data/context/useData";
import {
  extractRows,
  interpretCommand,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  exportRowsToCsv,
} from "@/features/dashboard/utils/dashboardAnalytics";
import {
  loadDashboardState,
  recordDashboardAction,
  saveDashboardState,
} from "@/features/dashboard/utils/dashboardStateStorage";

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CommandTopBar() {
  const navigate = useNavigate();
  const { dataset, retryHydrate, isProcessing } = useData();
  const [command, setCommand] = useState("");
  const rows = useMemo(() => extractRows(dataset), [dataset]);

  function runCommand(event: FormEvent) {
    event.preventDefault();
    if (!dataset?.id || !command.trim()) {
      if (!dataset) navigate("/upload");
      return;
    }

    const result = interpretCommand(command, rows);
    const stored = loadDashboardState(dataset.id);
    const nextState = {
      ...stored,
      filters: result.filters ? { ...stored.filters, ...result.filters } : stored.filters,
      manualCharts: result.chart ? [result.chart, ...stored.manualCharts].slice(0, 8) : stored.manualCharts,
      manualKpis: result.kpi ? [result.kpi, ...stored.manualKpis].slice(0, 8) : stored.manualKpis,
      geoActive: result.geoRequested || stored.geoActive,
    };
    saveDashboardState(dataset.id, nextState);
    recordDashboardAction(dataset.id, result.auditLabel, "command-bar", nextState);
    setCommand("");
    navigate("/dashboard");
  }

  function exportDataset() {
    if (!dataset) return;
    downloadFile(`${dataset.name || "dataset"}.csv`, exportRowsToCsv(rows), "text/csv;charset=utf-8");
  }

  async function shareDataset() {
    const summary = dataset
      ? `Dataset: ${dataset.name}\nRows: ${rows.length.toLocaleString()}\nColumns: ${dataset.columns.length.toLocaleString()}`
      : "InsightFlow";
    await navigator.clipboard?.writeText(summary);
  }

  return (
    <div className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
      <div className="flex h-[84px] items-center gap-4 px-5 xl:px-8">
        <button
          type="button"
          onClick={() => navigate(dataset ? "/data" : "/upload")}
          className="hidden min-w-[240px] items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-left shadow-sm transition hover:border-violet-200 md:flex"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#0F172A]">
              {dataset?.name || "Upload a dataset"}
            </span>
            <span className="mt-1 inline-flex items-center gap-2 text-xs text-[#64748B]">
              <span className={`size-2 rounded-full ${dataset ? "bg-[#22C55E]" : "bg-[#F59E0B]"}`} />
              {dataset ? `${rows.length.toLocaleString()} rows` : "No active data"}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#64748B]" />
        </button>

        <form onSubmit={runCommand} className="relative min-w-0 flex-1">
          <Sparkles className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#7C3AED]" />
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Ask InsightFlow AI anything about your data..."
            className="h-12 w-full rounded-2xl border border-violet-200 bg-white pl-12 pr-24 text-sm text-[#0F172A] shadow-[0_0_0_4px_rgba(124,58,237,0.04)] outline-none transition placeholder:text-[#94A3B8] focus:border-[#7C3AED]"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-lg shadow-violet-500/20"
            aria-label="Run AI command"
          >
            {command.trim() ? <Send className="size-4" /> : <Filter className="size-4" />}
          </button>
        </form>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={() => void retryHydrate()}
            className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC]"
          >
            <RefreshCw className={`mr-2 inline size-4 ${isProcessing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportDataset}
            disabled={!dataset}
            className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            <Download className="mr-2 inline size-4" />
            Export
          </button>
          <button
            type="button"
            onClick={shareDataset}
            className="rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
          >
            <Share2 className="mr-2 inline size-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

