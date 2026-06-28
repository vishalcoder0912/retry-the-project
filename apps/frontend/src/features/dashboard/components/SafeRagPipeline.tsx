import { Database, FileInput, Layers3, Network, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { RagPipelineStep } from "@/features/dashboard/types/premiumDashboardTypes";

const icons = [FileInput, Layers3, Network, Database, Sparkles];
const getStatusClass = (status: RagPipelineStep["status"]) => status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "active" ? "bg-violet-50 text-violet-700" : status === "failed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500";
const getStatusLabel = (status: RagPipelineStep["status"]) => status === "completed" ? "Done" : status === "active" ? "Active" : status === "failed" ? "Failed" : status === "pending" ? "Waiting" : "Optional";
const cleanSubtitle = (value: string) => value.replace(/nomic-embed-text/i, "Optional embeddings").replace(/Schema RAG/i, "Optional knowledge index").replace(/Local Analytics/i, "Local analysis ready");

export function PremiumRagPipeline({ steps }: { steps: RagPipelineStep[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950">Analysis Pipeline</h3>
          <p className="text-xs leading-5 text-slate-500">Upload, schema review, optional AI retrieval, local insights</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Ready</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = icons[index] || Database;
          return (
            <motion.div key={step.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="relative min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusClass(step.status)}`}>{getStatusLabel(step.status)}</span>
              </div>
              <p className="text-xs font-black leading-5 text-slate-900">{step.title}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{cleanSubtitle(step.subtitle)}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
