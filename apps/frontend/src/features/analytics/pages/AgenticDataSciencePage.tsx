import { useEffect, useMemo, useState } from "react";
import { AgenticAuditTrail } from "@/features/dashboard/components/AgenticAuditTrail";
import { DataScienceSummaryCards } from "@/features/dashboard/components/DataScienceSummaryCards";
import { useMlAnalytics } from "@/features/dashboard/hooks/useMlAnalytics";
import { useData } from "@/features/data/context/useData";
import { Sparkles, Terminal, FileCode, Play } from "lucide-react";

export default function AgenticDataSciencePage() {
  const { dataset } = useData();
  const [datasetId, setDatasetId] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("Find insights, quality issues, anomalies, and model readiness.");
  const activeDatasetId = dataset?.id || "local-dataset";
  const activeDatasetName = dataset?.name || "Uploaded Dataset";
  
  const { profile, fullAnalysis, measures, dimensions, loadProfile, runFullAnalysis } = useMlAnalytics(datasetId);

  // Auto-select current dataset ID on mount / change
  useEffect(() => {
    if (dataset?.id || dataset?.name) {
      setDatasetId(dataset.id || dataset.name || activeDatasetId);
    }
  }, [activeDatasetId, dataset?.id, dataset?.name]);

  const result = (fullAnalysis.data as any)?.result;
  const profileResult = result?.profile ?? (profile.data as any)?.result;
  const targetOptions = useMemo(() => [...measures, ...dimensions], [measures, dimensions]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%)]" />

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">InsightFlow Analytics</p>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Agentic Data Science</h1>
          <p className="text-sm text-slate-400">Advanced model training, automated profile summaries, and LLM orchestration trail logs.</p>
        </div>
        <div className="rounded-full bg-violet-500/10 border border-violet-400/20 px-3.5 py-1 text-xs font-semibold text-violet-300">
          Agent Sandbox Mode
        </div>
      </header>

      <div className="rounded-2xl border border-violet-400/20 bg-slate-950/70 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-violet-300">
          Active Dataset
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {activeDatasetName}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Dataset ID: {dataset?.id || datasetId || activeDatasetId}
        </p>
      </div>

      {/* Control Configuration Panel */}
      <section className="grid gap-4 rounded-2xl border border-indigo-400/20 bg-slate-950/70 p-5 shadow-[0_0_24px_rgba(124,58,237,0.12)] backdrop-blur-xl lg:grid-cols-[1.2fr_1fr_2fr_auto] items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400" htmlFor="dataset-id-input">Dataset ID</label>
          <input
            id="dataset-id-input"
            className="h-11 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 text-sm text-white outline-none focus:border-cyan-400 transition"
            placeholder="Dataset ID"
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400" htmlFor="target-select">Predict Target (Y)</label>
          <select
            id="target-select"
            className="h-11 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 text-sm text-white outline-none focus:border-cyan-400 transition"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">No target selected</option>
            {targetOptions.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400" htmlFor="goal-input">Analytical Goal</label>
          <input
            id="goal-input"
            className="h-11 rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 text-sm text-white outline-none focus:border-cyan-400 transition"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
        </div>
        <div className="flex gap-2.5">
          <button
            className="h-11 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition px-5 text-sm font-semibold disabled:opacity-40"
            onClick={loadProfile}
            disabled={!datasetId || profile.loading}
          >
            {profile.loading ? "Profiling..." : "Load Profile"}
          </button>
          <button
            className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-95 shadow-[0_0_18px_rgba(124,58,237,.35)] text-white transition px-6 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"
            onClick={() => runFullAnalysis(target || undefined, goal)}
            disabled={!datasetId || fullAnalysis.loading}
          >
            <Play className="size-3.5 fill-current" />
            {fullAnalysis.loading ? "Running..." : "Execute"}
          </button>
        </div>
      </section>

      {profile.error || fullAnalysis.error ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {profile.error || fullAnalysis.error}
        </div>
      ) : null}

      {profileResult ? (
        <DataScienceSummaryCards
          profile={profileResult}
          correlations={result?.correlations}
          anomalies={result?.anomalies}
          model={result?.model}
        />
      ) : null}

      <AgenticAuditTrail steps={(fullAnalysis.data as any)?.auditTrail ?? []} />

      {result?.dashboardPlan ? (
        <section className="rounded-2xl border border-indigo-400/20 bg-slate-950/70 p-5 shadow-xl backdrop-blur-xl">
          <h2 className="mb-4 text-base font-bold text-white flex items-center gap-2">
            <FileCode className="size-4 text-violet-400" />
            Dashboard Guardian Recommendation Plan
          </h2>
          <pre className="max-h-96 overflow-auto rounded-xl bg-[#020617] border border-slate-800 p-4 text-xs font-mono text-cyan-300 leading-relaxed">
            {JSON.stringify(result.dashboardPlan, null, 2)}
          </pre>
        </section>
      ) : null}

      {result?.trainingMemory ? (
        <section className="rounded-2xl border border-indigo-400/20 bg-slate-950/70 p-5 shadow-xl backdrop-blur-xl">
          <h2 className="mb-4 text-base font-bold text-white flex items-center gap-2">
            <Terminal className="size-4 text-violet-400" />
            Trained Model Schema Memory
          </h2>
          <pre className="max-h-96 overflow-auto rounded-xl bg-[#020617] border border-slate-800 p-4 text-xs font-mono text-emerald-300 leading-relaxed">
            {JSON.stringify(result.trainingMemory, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
