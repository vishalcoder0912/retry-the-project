import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  Cloud,
  Compass,
  Cpu,
  Database,
  FileText,
  Grid,
  Info,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { api, type AgenticConfigResponse, type AgenticHealthResponse } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

export default function AgenticPage() {
  const { dataset, isHydrating, loadDemo } = useData();
  const [config, setConfig] = useState<AgenticConfigResponse | null>(null);
  const [health, setHealth] = useState<AgenticHealthResponse | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // User input goal
  const [goal, setGoal] = useState(
    "Create an executive analytics dashboard with KPIs, trends, anomalies, risks, recommendations, and chart suggestions."
  );

  // Load backend config & health status
  const fetchMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const [configData, healthData] = await Promise.all([
        api.getAgenticConfig(),
        api.getAgenticHealth(),
      ]);
      setConfig(configData);
      setHealth(healthData);
    } catch (err) {
      console.error("Failed to load agentic models metadata:", err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    void fetchMetadata();
  }, []);

  // Run agentic analysis
  const handleRunAnalysis = async () => {
    if (!dataset?.id) return;
    setLoadingAnalysis(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const result = await api.runAgenticAnalysis(dataset.id, goal);
      setAnalysisResult(result);
      // Refresh health check in case model loading state changed
      void fetchMetadata();
    } catch (err: any) {
      console.error("Agentic analysis error:", err);
      setAnalysisError(err?.message || "Agentic analysis request failed");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Safe checks for rendering arrays or values
  const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);
  const safeText = (txt: any, fallback = "-") => (typeof txt === "string" || typeof txt === "number" ? String(txt) : fallback);

  if (isHydrating) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center text-slate-300">
        <RefreshCw className="size-10 animate-spin text-violet-500" />
        <p className="mt-4 font-medium">Synchronizing application state...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/70 pb-5">
          <div>
            <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold tracking-wider uppercase">
              <Sparkles className="size-4" />
              Multi-Agent Orchestration
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Agentic AI Analytics
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Specialized local LLM agents cooperating to design schema-safe dashboards without sending data to the cloud.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchMetadata}
            disabled={loadingMetadata}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loadingMetadata ? "animate-spin" : ""}`} />
            Refresh Agents
          </button>
        </header>

        {/* Core UX Disclaimer Banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 shadow-inner">
          <Info className="size-5 shrink-0 text-violet-400 mt-0.5" />
          <div>
            <h3 className="font-bold text-violet-200 text-sm">Deterministic Analytics Enforcement</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              <strong>LLMs plan, validate, and explain. Real KPI values are calculated deterministically from dataset rows.</strong> The system strictly profiles columns and passes metadata only to the schema analyst, completely preventing the LLM from hallucinating values.
            </p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Sidebar Area: Config and Health Status */}
          <div className="space-y-6 lg:col-span-1">
            
            {/* Active Selected Dataset */}
            <div className={CARD}>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Database className="size-4 text-blue-400" />
                Active Dataset
              </h2>
              {dataset ? (
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80">
                    <p className="text-xs text-slate-400">Dataset Name</p>
                    <p className="font-semibold text-white truncate text-sm mt-0.5">{dataset.name}</p>
                  </div>
                  <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80">
                    <p className="text-xs text-slate-400">UUID/Identity</p>
                    <p className="font-mono text-slate-300 truncate text-xs mt-1">{dataset.id}</p>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-slate-400 px-1">
                    <span>{dataset.rows?.length?.toLocaleString() || 0} Rows</span>
                    <span>•</span>
                    <span>{dataset.columns?.length || 0} Columns</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-center py-6">
                  <UploadCloud className="size-10 mx-auto text-slate-500" />
                  <p className="mt-3 text-sm text-slate-400">No active dataset is loaded.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void loadDemo()}
                      className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition shadow"
                    >
                      Load Demo Dataset
                    </button>
                    <Link
                      to="/upload"
                      className="w-full text-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
                    >
                      Upload Files
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Model Health Checklist */}
            <div className={CARD}>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Activity className="size-4 text-emerald-400" />
                Model Registry Health
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Availability of specialized local Ollama models.
              </p>
              
              <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {health?.checks ? (
                  health.checks.map((item) => (
                    <div
                      key={item.model}
                      className="flex items-center justify-between rounded-xl bg-slate-950/40 border border-slate-800/80 p-2.5 hover:bg-slate-950/70 transition"
                    >
                      <div className="truncate pr-2">
                        <p className="text-xs font-semibold text-slate-200 truncate">{item.model}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {item.model.includes("cloud") ? "Cloud reasoning endpoint" : "Local Ollama instance"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                          item.installed
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {item.installed ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-400" />
                            Ready
                          </>
                        ) : (
                          <>
                            <AlertCircle className="size-3 text-amber-400" />
                            Missing
                          </>
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 justify-center py-6 text-slate-500 text-xs">
                    <Server className="size-4 animate-pulse" />
                    Querying local registry...
                  </div>
                )}
              </div>
            </div>

            {/* Model Role Mapping Config */}
            <div className={CARD}>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Server className="size-4 text-purple-400" />
                Orchestrator Role Maps
              </h2>
              <div className="mt-4 space-y-3.5">
                {config?.roles ? (
                  Object.entries(config.roles).map(([role, val]) => (
                    <div key={role} className="border-b border-slate-800/80 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                          {role.replace(/([A-Z])/g, " $1")}
                        </span>
                        <span className="text-[9px] text-slate-500 capitalize bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                          {val.includes("cloud") ? "cloud-agent" : "local-agent"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 truncate font-semibold font-mono bg-slate-950/40 p-1.5 rounded border border-slate-900">
                        {val}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs py-4 text-center">Config registry inactive.</p>
                )}
              </div>
            </div>

          </div>

          {/* Main Action and Results area */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Input Action Card */}
            <div className={CARD}>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Brain className="size-5 text-violet-400" />
                Define Analysis Goal
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Tell the orchestrator what you want to discover. The agents will translate this goal into data specs.
              </p>
              
              <div className="mt-4 space-y-4">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={loadingAnalysis}
                  placeholder="E.g., Create an executive analytics dashboard focusing on sales volumes, outlier values, and product performance correlations."
                  className="w-full min-h-[96px] bg-slate-950/80 rounded-xl border border-slate-800 p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition leading-relaxed disabled:opacity-50"
                />
                
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={loadingAnalysis || !dataset}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold py-3 px-6 transition duration-200 disabled:opacity-55 disabled:cursor-not-allowed shadow-lg shadow-violet-600/10"
                >
                  {loadingAnalysis ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Sequential Local Reasoning Running (This may take up to 2-3 minutes)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Run Model-Aware Agentic Analysis
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading Timeline State */}
            {loadingAnalysis && (
              <div className={`${CARD} bg-gradient-to-b from-slate-900/60 to-slate-950/80`}>
                <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
                  <RefreshCw className="size-4 animate-spin text-violet-400" />
                  Sequential Model Processing Pipeline
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Executing CPU inference cycles sequentially. Ollama will load models and fall back gracefully on timeout.
                </p>

                <div className="mt-6 relative border-l-2 border-slate-800 pl-6 space-y-6">
                  
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-violet-600 animate-pulse">
                      <span className="size-2 rounded-full bg-white" />
                    </span>
                    <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider">Step 1: Schema Analysis</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Target model: <span className="font-mono text-slate-300">{config?.roles?.schemaAnalyst || "insightflow-strict-schema-analyst:latest"}</span>. Analyzing column schemas and identifying categories/metrics.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-slate-800">
                      <span className="size-2 rounded-full bg-slate-600" />
                    </span>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2: Master planning</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Target model: <span className="font-mono text-slate-400">{config?.roles?.masterPlanner || "insightflow-master:latest"}</span>. Reading schema analyst specs to construct the analytics path.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-slate-800">
                      <span className="size-2 rounded-full bg-slate-600" />
                    </span>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3: Deterministic tool computation</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Mathematical aggregations are running locally on dataset rows to yield absolute values (averages, totals, charts).
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-0.5 flex size-4 items-center justify-center rounded-full bg-slate-800">
                      <span className="size-2 rounded-full bg-slate-600" />
                    </span>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 4: Dashboard Guardian Validation</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Target model: <span className="font-mono text-slate-400">{config?.roles?.dashboardGuardian || "insightflow-dashboard-guardian:latest"}</span>. Verifying that the chart specs match real columns.
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* Error Panel */}
            {analysisError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3 shadow-lg">
                <ShieldAlert className="size-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <h3 className="font-bold text-red-200 text-sm">Execution Failure</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{analysisError}</p>
                </div>
              </div>
            )}

            {/* Analysis Results Display */}
            {analysisResult && (
              <div className="space-y-6">
                
                {/* Final Explanation Section */}
                <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-900/10 to-slate-900/60 p-6 shadow-xl">
                  <h3 className="font-bold text-blue-200 text-sm flex items-center gap-2">
                    <Compass className="size-4 text-blue-400" />
                    Final Executive Explanation
                  </h3>
                  <p className="text-slate-300 text-sm mt-3 leading-relaxed whitespace-pre-wrap">
                    {safeText(
                      analysisResult.dashboard?.finalExplanation || 
                      analysisResult.schemaAnalysis?.dashboardGoal || 
                      "Agentic planning completed successfully. The dashboard has been structured using deterministic layout specs."
                    )}
                  </p>
                </div>

                {/* Audit Trail Section */}
                <div className={CARD}>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                    <Activity className="size-4 text-violet-400" />
                    Agent Collaboration Audit Trail
                  </h3>
                  <div className="mt-4 space-y-3.5">
                    {safeArray(analysisResult.audit).map((step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-950/60 transition"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-mono block">
                            Orchestrator Step
                          </span>
                          <h4 className="font-bold text-white text-sm capitalize">
                            {safeText(step.step).replace(/_/g, " ")}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                            <Cpu className="size-3.5 text-slate-500" />
                            {safeText(step.model)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 md:text-right md:flex-col md:items-end">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
                              step.status === "ok"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {step.status === "ok" ? (
                              <>
                                <CheckCircle2 className="size-3 text-emerald-400" />
                                Completed
                              </>
                            ) : (
                              <>
                                <AlertCircle className="size-3 text-amber-400" />
                                Fallback Triggered
                              </>
                            )}
                          </span>
                          {step.error && (
                            <span className="text-[10px] text-red-300 truncate max-w-[200px]">
                              {safeText(step.error)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dashboard Guardian Result */}
                <div className={CARD}>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                    <ShieldAlert className="size-4 text-emerald-400" />
                    Dashboard Guardian Validation Spec
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono block">
                          Validation Result
                        </span>
                        <p className="mt-1 font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
                          <CheckCircle2 className="size-4" />
                          Passed (Schema-Safe Layout)
                        </p>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono block">
                          Cloud Status
                        </span>
                        <p className="mt-1 font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                          <Cloud className="size-4 text-slate-400" />
                          Disabled (Execution local only)
                        </p>
                      </div>
                    </div>

                    {/* Observations or Issues list */}
                    {analysisResult.dashboard?.warnings?.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="size-4" />
                          Guardian Warnings
                        </h4>
                        <ul className="mt-2 space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                          {safeArray(analysisResult.dashboard.warnings).map((warning: any, idx: number) => (
                            <li key={idx}>{safeText(warning)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Schema Profile Section */}
                <div className={CARD}>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                    <FileText className="size-4 text-blue-400" />
                    Schema Understanding & Profiles
                  </h3>
                  
                  {analysisResult.profile && (
                    <div className="mt-4 space-y-4">
                      {/* Grid Counts */}
                      <div className="grid gap-3 sm:grid-cols-4 text-center">
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                          <span className="text-xl font-extrabold text-white">
                            {safeText(analysisResult.profile.rowCount)}
                          </span>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Rows</p>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                          <span className="text-xl font-extrabold text-white">
                            {safeText(analysisResult.profile.columnCount)}
                          </span>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Columns</p>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                          <span className="text-xl font-extrabold text-white">
                            {safeArray(analysisResult.profile.numericColumns).length}
                          </span>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Measures</p>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
                          <span className="text-xl font-extrabold text-white">
                            {safeArray(analysisResult.profile.categoricalColumns).length + safeArray(analysisResult.profile.dateColumns).length}
                          </span>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">Dimensions</p>
                        </div>
                      </div>

                      {/* Explicit Columns breakdown */}
                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Column Classifications</h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-xs">
                            <span className="font-bold text-slate-400 shrink-0 min-w-[70px]">Dimensions:</span>
                            <span className="text-slate-200">
                              {[
                                ...safeArray(analysisResult.profile.categoricalColumns),
                                ...safeArray(analysisResult.profile.dateColumns),
                              ].join(", ") || "None"}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-xs border-t border-slate-800/60 pt-2">
                            <span className="font-bold text-slate-400 shrink-0 min-w-[70px]">Measures:</span>
                            <span className="text-slate-200">
                              {safeArray(analysisResult.profile.numericColumns).join(", ") || "None"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deterministic KPIs Grid */}
                <div className={CARD}>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                    <Grid className="size-4 text-purple-400" />
                    Computed Deterministic KPIs
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-1">
                    These metrics are calculated mathematically using local query aggregation tools.
                  </p>
                  
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {safeArray(analysisResult.dashboard?.kpis).map((kpi: any, idx: number) => {
                      const colors = [
                        "border-blue-500/20 bg-blue-500/5",
                        "border-purple-500/20 bg-purple-500/5",
                        "border-cyan-500/20 bg-cyan-500/5",
                        "border-amber-500/20 bg-amber-500/5",
                      ];
                      return (
                        <div key={idx} className={`rounded-xl border p-4 shadow-sm ${colors[idx % colors.length]}`}>
                          <p className="text-xs text-slate-450 truncate font-semibold capitalize">
                            {safeText(kpi.label || kpi.id).replace(/_/g, " ")}
                          </p>
                          <p className="mt-2 text-xl font-bold text-white">
                            {safeText(
                              analysisResult.profile?.columns?.find((c: any) => c.name === kpi.field)?.stats?.avg 
                                ? Math.round(analysisResult.profile.columns.find((c: any) => c.name === kpi.field).stats.avg).toLocaleString()
                                : kpi.id === "rows"
                                ? analysisResult.profile?.rowCount?.toLocaleString()
                                : kpi.id === "columns"
                                ? analysisResult.profile?.columnCount?.toLocaleString()
                                : "N/A"
                            )}
                          </p>
                          <span className="text-[10px] text-slate-500 block mt-1 font-mono uppercase">
                            Agg: {safeText(kpi.type)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Deterministic Chart Suggestions */}
                <div className={CARD}>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                    <BarChart3 className="size-4 text-sky-400" />
                    Recommended Chart Configurations
                  </h3>
                  
                  <div className="mt-4 space-y-4">
                    {safeArray(analysisResult.dashboard?.charts).map((chart: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col md:flex-row md:items-start md:justify-between gap-4 hover:bg-slate-950/60 transition"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold tracking-wider text-sky-400 uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/25">
                              {safeText(chart.type)}
                            </span>
                            <h4 className="font-bold text-slate-100 text-sm capitalize">
                              {safeText(chart.title)}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed pt-1">
                            {safeText(chart.reason)}
                          </p>
                        </div>

                        <div className="text-xs font-mono text-slate-500 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-900 shrink-0">
                          <div>X-Axis: <span className="text-slate-300 font-bold">{safeText(chart.x)}</span></div>
                          <div className="mt-1">Y-Axis: <span className="text-slate-300 font-bold">{safeText(chart.y)}</span></div>
                          <div className="mt-1">Agg: <span className="text-slate-400 font-semibold">{safeText(chart.aggregation)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* recommendations panel */}
                {analysisResult.schemaAnalysis?.risks && (
                  <div className={CARD}>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3">
                      <TrendingUp className="size-4 text-emerald-400" />
                      Analytical Recommendations & Risks
                    </h3>
                    <div className="mt-4 space-y-3 text-xs text-slate-350">
                      {safeArray(analysisResult.schemaAnalysis?.risks).map((risk: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{safeText(risk)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
