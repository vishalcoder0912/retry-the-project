import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  FileText,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { API_BASE_URL } from "@/config/apiConfig";

type Props = {
  onNavigate?: () => void;
  className?: string;
};

type ProvidersHealth = {
  success?: boolean;
  mode?: string;
  providers?: {
    gemini?: { available?: boolean; warning?: string | null };
    ollama?: { available?: boolean };
  };
};

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/data", label: "Data Table", icon: Table2 },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/pdf", label: "PDF Intelligence", icon: FileText },
  { path: "/analytics", label: "Analytics", icon: LineChart },
  { path: "/chat", label: "AI Chat", icon: MessageSquare },
  { path: "/agentic", label: "Agentic AI", icon: Sparkles },
  { path: "/agentic-data-science", label: "Data Science", icon: BrainCircuit },
];

function ProviderPill({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[72px] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        online
          ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
          : "border-rose-400/20 bg-rose-500/15 text-rose-300",
      )}
    >
      <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-300" : "bg-rose-300")} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

export default function AppSidebar({ onNavigate, className }: Props) {
  const location = useLocation();
  const [health, setHealth] = useState<ProvidersHealth | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkHealth() {
    setChecking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/providers/health`);
      setHealth(await response.json());
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void checkHealth();
    const interval = window.setInterval(() => void checkHealth(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const geminiOnline = Boolean(health?.providers?.gemini?.available);
  const ollamaOnline = Boolean(health?.providers?.ollama?.available);
  const mode = health?.mode ? health.mode.replace(/_/g, " ") : "Hybrid";
  const fallback = geminiOnline ? "Gemini Ready" : "Local AI";
  const warning = health?.providers?.gemini?.warning || "Gemini API key is missing or invalid.";

  return (
    <aside
      className={cn(
        "relative flex h-screen w-64 flex-col overflow-hidden border-r border-[rgba(148,163,184,0.16)] bg-[#081225] text-[#F8FAFC] shadow-2xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(124,58,237,0.16),transparent_30%),radial-gradient(circle_at_100%_22%,rgba(37,99,235,0.13),transparent_28%)]" />

      <div className="relative border-b border-[rgba(148,163,184,0.16)] px-5 py-5">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] shadow-lg shadow-violet-900/35 ring-1 ring-white/15">
            <Sparkles className="size-5 text-[#FFFFFF]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-[#F8FAFC]">InsightFlow</h1>
            <p className="mt-0.5 truncate text-xs font-medium text-[#94A3B8]">Agentic AI Analytics</p>
          </div>
        </Link>
      </div>

      <div className="relative px-5 pb-2 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64748B]">Menu</p>
      </div>

      <nav className="relative flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path === "/dashboard" && location.pathname === "/") ||
            (item.path === "/pdf" && location.pathname === "/pdf-upload");
          return (
            <Link key={item.path} to={item.path} onClick={onNavigate} className="block">
              <div
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition duration-200",
                  active
                    ? "bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-[#FFFFFF] shadow-lg shadow-violet-900/30"
                    : "text-[#CBD5E1] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#FFFFFF]",
                )}
              >
                <span className="grid size-5 shrink-0 place-items-center">
                  <item.icon className={cn("size-5", active ? "text-[#FFFFFF]" : "text-[#94A3B8] group-hover:text-[#F8FAFC]")} />
                </span>
                <span className="truncate leading-none">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-4 p-3.5 pt-2">
        <div className="rounded-2xl border border-[rgba(148,163,184,0.28)] bg-[rgba(15,23,42,0.88)] p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F8FAFC]">AI Engine Status</p>
            <button
              type="button"
              onClick={() => void checkHealth()}
              disabled={checking}
              className="grid size-8 place-items-center rounded-lg text-[#94A3B8] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-[#FFFFFF] disabled:opacity-70"
              title="Refresh AI engine status"
              aria-label="Refresh AI engine status"
            >
              <RefreshCw className={cn("size-4", checking && "animate-spin")} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#CBD5E1]">Gemini</span>
              <ProviderPill online={geminiOnline} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#CBD5E1]">Ollama</span>
              <ProviderPill online={ollamaOnline} />
            </div>
            <div className="border-t border-dashed border-[rgba(148,163,184,0.22)]" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94A3B8]">Mode</span>
              <span className="max-w-[120px] truncate text-right font-semibold capitalize text-[#F8FAFC]">{mode || "Hybrid"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94A3B8]">Fallback</span>
              <span className="max-w-[120px] truncate text-right font-semibold text-[#F8FAFC]">{fallback}</span>
            </div>
          </div>

          {!geminiOnline && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-medium leading-5 text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <span>{warning}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
