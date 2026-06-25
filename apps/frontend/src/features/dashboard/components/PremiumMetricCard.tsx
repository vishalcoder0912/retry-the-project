import { BarChart3, BadgeCheck, Gauge, Landmark, Maximize2, Rows3 } from "lucide-react";
import type { PremiumKpi } from "@/features/dashboard/types/premiumDashboardTypes";

const iconMap = {
  rows: Rows3,
  average: BarChart3,
  median: Gauge,
  max: Maximize2,
  segments: Landmark,
  quality: BadgeCheck,
};

export function PremiumMetricCard({ kpi, featured = false }: { kpi: PremiumKpi; featured?: boolean }) {
  const Icon = iconMap[kpi.icon || "average"];

  return (
    <article className={`group rounded-2xl border transition ${
      featured 
        ? "border-cyan-400/40 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 p-5 shadow-[0_0_34px_rgba(6,182,212,0.18)]" 
        : "border-indigo-400/20 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(124,58,237,0.12)]"
    } hover:border-cyan-300/40 hover:shadow-[0_0_32px_rgba(34,211,238,0.22)]`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl border p-2 ${
          featured
            ? "border-cyan-400/30 bg-cyan-500/20 text-cyan-200"
            : "border-violet-400/20 bg-violet-500/10 text-violet-100"
        }`}>
          <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
        </div>
        {kpi.delta && (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            {kpi.delta}
          </span>
        )}
      </div>
      <p className={`mt-4 text-xs font-semibold uppercase tracking-wider ${featured ? "text-cyan-200" : "text-slate-400"}`}>{kpi.title}</p>
      <p className={`mt-1 font-black text-white ${featured ? "text-3xl leading-tight" : "text-2xl"}`}>{kpi.value}</p>
      <p className="mt-1 text-xs text-slate-500">{kpi.subtitle}</p>
    </article>
  );
}
