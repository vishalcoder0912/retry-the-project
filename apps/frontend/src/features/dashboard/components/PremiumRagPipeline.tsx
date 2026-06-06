import { Database, FileInput, Layers3, Network, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { RagPipelineStep } from "@/features/dashboard/types/premiumDashboardTypes";

const icons = [FileInput, Layers3, Network, Database, Sparkles];

export function PremiumRagPipeline({ steps }: { steps: RagPipelineStep[] }) {
  return (
    <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">AI Insight Engine</h3>
          <p className="text-xs text-slate-500">Your Data - Data Understanding - Knowledge Index - AI Analysis - Insights</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">Active</span>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = icons[index] || Database;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="relative rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500/20 text-violet-200"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${step.status === "completed" ? "bg-emerald-400/10 text-emerald-300" : step.status === "active" ? "bg-cyan-400/10 text-cyan-300" : step.status === "skipped" ? "bg-slate-800 text-slate-400" : "bg-slate-800 text-slate-500"}`}>{step.status}</span>
              </div>
              <p className="text-xs font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{step.subtitle}</p>
              {index < steps.length - 1 && (
                <span className="pointer-events-none absolute -right-3 top-1/2 hidden h-0.5 w-3 -translate-y-1/2 bg-gradient-to-r from-cyan-400 to-violet-400 md:block" />
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
