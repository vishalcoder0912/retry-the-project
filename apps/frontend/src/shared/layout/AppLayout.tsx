import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/shared/layout/AppSidebar";
import { useData } from "@/features/data/context/useData";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dataset } = useData();

  return (
    <div className="min-h-screen bg-[#050d18] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_28%),linear-gradient(180deg,#040b16_0%,#07111f_100%)]" />

      <div className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:block">
        <AppSidebar />
      </div>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/70 bg-[#081121]/90 px-4 py-3 backdrop-blur xl:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 text-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-white">{dataset?.name || "InsightFlow"}</p>
          <p className="text-xs text-slate-400">
            {dataset ? `${dataset.rowCount.toLocaleString()} rows` : "Analytics Platform"}
          </p>
        </div>

        <div className="h-9 w-9" />
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
                <X className="h-5 w-5" />
              </button>
            </div>
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-h-screen xl:pl-72">
        <Outlet />
      </main>
    </div>
  );
}
