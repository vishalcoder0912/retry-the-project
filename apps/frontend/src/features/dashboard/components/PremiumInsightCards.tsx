import { Sparkles } from "lucide-react";
import type { PremiumInsight } from "@/features/dashboard/types/premiumDashboardTypes";

const toneClass = {
  gold: "border-amber-100 bg-amber-50 text-amber-800",
  cyan: "border-sky-100 bg-sky-50 text-sky-800",
  violet: "border-violet-100 bg-violet-50 text-violet-800",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
};

export function PremiumInsightCards({ insights }: { insights: PremiumInsight[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-950">Insights</h3>
          <p className="text-xs text-slate-500">Useful findings from the current view</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((item) => (
          <article key={item.id} className={`rounded-2xl border p-4 ${toneClass[item.tone]}`}>
            <h4 className="text-sm font-bold">{item.title}</h4>
            <p className="mt-2 min-h-12 text-xs leading-5 text-slate-600">{item.message}</p>
            {item.action && <button className="mt-3 rounded-xl border border-current/20 bg-white/60 px-3 py-1.5 text-[11px] font-bold" type="button">{item.action}</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
