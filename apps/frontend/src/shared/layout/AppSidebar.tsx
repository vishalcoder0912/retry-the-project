import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  FileText,
  Grid2X2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { API_BASE_URL } from "@/config/apiConfig";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: Grid2X2 },
  { label: "Data Table", to: "/data", icon: Table2 },
  { label: "Upload", to: "/upload", icon: Upload },
  { label: "PDF Intelligence", to: "/pdf", icon: FileText },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "AI Chat", to: "/chat", icon: MessageSquare },
  { label: "Agentic AI", to: "/agentic", icon: Sparkles },
  { label: "Data Science", to: "/agentic-data-science", icon: BrainCircuit },
];

type ProvidersHealth = {
  mode?: string;
  providers?: {
    gemini?: { available?: boolean; warning?: string | null };
    ollama?: { available?: boolean };
  };
};

function ProviderPill({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-bold",
        online
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-rose-500/15 text-rose-300",
      )}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}

function isActivePath(currentPath: string, itemPath: string) {
  if (itemPath === "/dashboard") return currentPath === "/" || currentPath === "/dashboard";
  if (itemPath === "/pdf") return currentPath === "/pdf" || currentPath === "/pdf-upload";
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export default function AppSidebar() {
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
    <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-[#061A33] text-white">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] shadow-lg shadow-violet-500/30">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-lg font-bold leading-tight">InsightFlow</div>
          <div className="text-xs text-slate-300">Agentic AI Analytics</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Menu
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(location.pathname, item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all",
                active
                  ? "bg-gradient-to-r from-[#7C3AED] to-[#2563EB] text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
            AI Engine Status
          </p>
          <button
            type="button"
            onClick={() => void checkHealth()}
            disabled={checking}
            className="rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-70"
            aria-label="Refresh AI engine status"
          >
            <RefreshCw className={cn("size-4", checking && "animate-spin")} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Gemini</span>
            <ProviderPill online={geminiOnline} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300">Ollama</span>
            <ProviderPill online={ollamaOnline} />
          </div>

          <div className="border-t border-dashed border-white/15 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mode</span>
              <span className="font-bold text-white">{mode}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate-400">Fallback</span>
              <span className="font-bold text-white">{fallback}</span>
            </div>
          </div>

          {!geminiOnline ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
