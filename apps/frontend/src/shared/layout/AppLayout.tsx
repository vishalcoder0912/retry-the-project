import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/shared/layout/AppSidebar";
import { useData } from "@/features/data/context/useData";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const { dataset } = useData();

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { method: "GET", cache: "no-store" });
        if (res.ok) {
          if (active) setIsOffline(false);
        } else {
          if (active) setIsOffline(true);
        }
      } catch (err) {
        if (active) setIsOffline(true);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 max-w-full overflow-x-hidden">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.06),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.03),transparent_30%),linear-gradient(180deg,#09090b_0%,#09090b_100%)]" />

      {isOffline && (
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-rose-500/20 bg-rose-950/85 px-4 py-2.5 text-xs font-semibold text-rose-300 backdrop-blur shadow-[0_0_20px_rgba(244,63,94,0.1)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-ping rounded-full bg-rose-500" />
            Backend Server Offline (127.0.0.1 Refused Connection) — AI, RAG & ML services are temporarily disabled. Please start the backend.
          </span>
          <button 
            onClick={() => {
              fetch("/api/health").then(res => { if(res.ok) setIsOffline(false); }).catch(()=>{});
            }} 
            className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 hover:bg-rose-500/20 transition"
          >
            Reconnect
          </button>
        </div>
      )}

      <div className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:block">
        <AppSidebar />
      </div>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/70 bg-[#081121]/90 px-4 py-3 backdrop-blur xl:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 text-slate-100"
        >
          <Menu className="size-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-white">{dataset?.name || "InsightFlow"}</p>
          <p className="text-xs text-slate-400">
            {dataset ? `${dataset.rowCount.toLocaleString()} rows` : "Analytics Platform"}
          </p>
        </div>

        <div className="size-9" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Close sidebar"
          />
          <div className="relative h-full w-[18rem]">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 text-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-h-screen xl:pl-72 max-w-full overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
