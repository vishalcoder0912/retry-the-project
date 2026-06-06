import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import AppSidebar from "@/shared/layout/AppSidebar";
import CommandTopBar from "@/shared/layout/CommandTopBar";
import { useData } from "@/features/data/context/useData";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dataset } = useData();

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-[#0F172A]">
      <div className="fixed inset-0 -z-10 bg-[#F6F8FC]" />

      <div className="hidden xl:fixed xl:inset-y-0 xl:left-0 xl:z-40 xl:block">
        <AppSidebar />
      </div>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur xl:hidden shadow-sm">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl border bg-white p-2 text-gray-700 shadow-sm"
        >
          <Menu className="size-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{dataset?.name || "InsightFlow"}</p>
          <p className="text-xs text-gray-500">
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
            className="absolute inset-0 bg-black/30"
            aria-label="Close sidebar"
          />
          <div className="relative h-full w-64">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border bg-white p-2 text-gray-700 shadow-sm"
              >
                <X className="size-5" />
              </button>
            </div>
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-h-screen xl:pl-64">
        <CommandTopBar />
        <Outlet />
      </main>
    </div>
  );
}
