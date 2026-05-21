import { Link, useLocation } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  Upload,
  MessageSquare,
  Table2,
  LineChart,
  Sparkles,
} from "lucide-react";
import ThemeToggle from "@/shared/layout/ThemeToggle";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/data", label: "Data Table", icon: Table2 },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/pdf", label: "PDF Intelligence", icon: FileText },
  { path: "/analytics", label: "Analytics", icon: LineChart },
  { path: "/chat", label: "AI Chat", icon: MessageSquare },
];

type Props = {
  onNavigate?: () => void;
  className?: string;
};

export default function AppSidebar({ onNavigate, className }: Props) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "flex h-full w-72 flex-col border-r border-slate-800/70 bg-[#081121]/95 backdrop-blur",
        className,
      )}
    >
      <div className="border-b border-slate-800/70 px-5 py-5">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] via-[#8b5cf6] to-[#2563eb] shadow-lg shadow-violet-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">InsightFlow</h1>
            <p className="text-xs text-slate-400">Analytics Platform</p>
          </div>
        </Link>
      </div>

      <div className="px-4 py-5">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Menu
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === "/dashboard" && location.pathname === "/");

          return (
            <Link key={item.path} to={item.path} onClick={onNavigate} className="block">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-violet-600/85 to-blue-600/70 text-white shadow-lg shadow-violet-500/10"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-800/70 px-4 py-4">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span>Theme</span>
            <span>Dark / Light</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
            All systems operational
          </div>
          <p className="mt-2 text-xs text-slate-500">Last checked: 2 min ago</p>
        </div>
      </div>
    </aside>
  );
}
