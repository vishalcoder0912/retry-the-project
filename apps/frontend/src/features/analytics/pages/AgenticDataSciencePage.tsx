<<<<<<< HEAD
import MLPage from "@/features/ml/pages/MLPage";

export default MLPage;

=======
import { useMemo, useState } from "react";
import { AgenticAuditTrail } from "@/features/dashboard/components/AgenticAuditTrail";
import { DataScienceSummaryCards } from "@/features/dashboard/components/DataScienceSummaryCards";
import { useMlAnalytics } from "@/features/dashboard/hooks/useMlAnalytics";

export default function AgenticDataSciencePage() {
  const [datasetId, setDatasetId] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("Find insights, quality issues, anomalies, and model readiness.");
  const { profile, fullAnalysis, measures, dimensions, loadProfile, runFullAnalysis } = useMlAnalytics(datasetId);

  const result = (fullAnalysis.data as any)?.result;
  const profileResult = result?.profile ?? (profile.data as any)?.result;
  const targetOptions = useMemo(() => [...measures, ...dimensions], [measures, dimensions]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">InsightFlow</p>
          <h1 className="text-2xl font-semibold text-slate-950">Agentic Data Science</h1>
        </div>
        <div className="text-sm text-slate-500">Python tools + agent audit</div>
      </header>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr_2fr_auto]">
        <input
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          placeholder="Dataset ID"
          value={datasetId}
          onChange={(event) => setDatasetId(event.target.value)}
        />
        <select
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">No target</option>
          {targetOptions.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            onClick={loadProfile}
            disabled={!datasetId || profile.loading}
          >
            {profile.loading ? "Profiling" : "Profile"}
          </button>
          <button
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => runFullAnalysis(target || undefined, goal)}
            disabled={!datasetId || fullAnalysis.loading}
          >
            {fullAnalysis.loading ? "Running" : "Run"}
          </button>
        </div>
      </section>

      {profile.error || fullAnalysis.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-950">Dashboard Guardian Plan</h2>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-sm text-white">
            {JSON.stringify(result.dashboardPlan, null, 2)}
          </pre>
        </section>
      ) : null}

      {result?.trainingMemory ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-950">Training Memory</h2>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-sm text-white">
            {JSON.stringify(result.trainingMemory, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
>>>>>>> origin/main
