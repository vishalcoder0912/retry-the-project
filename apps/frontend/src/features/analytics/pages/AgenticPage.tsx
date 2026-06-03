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
  Plus,
  Trash2,
  Play,
  Check,
  Award,
} from "lucide-react";
import { api, type AgenticConfigResponse, type AgenticHealthResponse } from "@/features/data/api/dataApi";
import { schemaTrainedApi } from "@/features/data/api/schemaTrainedApi.additions";
import { useData } from "@/features/data/context/useData";
import AgenticAuditPanel from "../components/AgenticAuditPanel";
import AgenticDashboardPanel from "../components/AgenticDashboardPanel";
import AgenticSchemaPanel from "../components/AgenticSchemaPanel";
import AgenticRiskPanel from "../components/AgenticRiskPanel";
import AgenticInsightPanel from "../components/AgenticInsightPanel";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur-md p-6";

export default function AgenticPage() {
  const { dataset, isHydrating, loadDemo } = useData();
  const [config, setConfig] = useState<AgenticConfigResponse | null>(null);
  const [health, setHealth] = useState<AgenticHealthResponse | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // Tab control: "orchestrator" vs "training"
  const [activeTab, setActiveTab] = useState<"orchestrator" | "training">("orchestrator");

  // User input goal
  const [goal, setGoal] = useState(
    "Create an executive analytics dashboard with KPIs, trends, anomalies, risks, recommendations, and chart suggestions."
  );

  // Training Studio States
  const [trainingNotes, setTrainingNotes] = useState("");
  const [trainingRating, setTrainingRating] = useState<"good" | "bad">("good");
  const [isTrainingLlm, setIsTrainingLlm] = useState(false);
  const [isTrainingRag, setIsTrainingRag] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingSuccess, setTrainingSuccess] = useState<string | null>(null);

  // Memory Diagnostics States
  const [schemaMemoryStats, setSchemaMemoryStats] = useState<any>(null);
  const [schemaMemoryRecords, setSchemaMemoryRecords] = useState<any[]>([]);
  const [schemaRagStats, setSchemaRagStats] = useState<any>(null);
  const [schemaRagRecords, setSchemaRagRecords] = useState<any[]>([]);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // Interactive Schema Predictor Simulator States
  const [simName, setSimName] = useState("Custom Workforce Schema");
  const [simColumns, setSimColumns] = useState<Array<{ name: string; type: string; role: string }>>([
    { name: "employee_id", type: "string", role: "id" },
    { name: "salary_usd", type: "number", role: "money_metric" },
    { name: "performance_score", type: "number", role: "score_metric" },
    { name: "experience_years", type: "number", role: "continuous_metric" },
    { name: "department", type: "string", role: "category" },
    { name: "location_country", type: "string", role: "location" }
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);

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

  // Fetch training database info and records
  const fetchTrainingDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const [trainMem, ragMem] = await Promise.all([
        schemaTrainedApi.getSchemaTrainingMemory(),
        schemaTrainedApi.getSchemaRagMemory(),
      ]);
      
      const tStats = (trainMem as any)?.stats || null;
      const tRecords = (trainMem as any)?.memory || [];
      const rStats = (ragMem as any)?.stats || null;
      const rRecords = (ragMem as any)?.memory || [];

      setSchemaMemoryStats(tStats);
      setSchemaMemoryRecords(tRecords);
      setSchemaRagStats(rStats);
      setSchemaRagRecords(rRecords);
    } catch (err) {
      console.error("Failed to fetch memory diagnostics:", err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

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

  // Train LLM Schema Predictor
  const handleTrainLlm = async () => {
    if (!dataset?.id) return;
    setIsTrainingLlm(true);
    setTrainingError(null);
    setTrainingSuccess(null);
    try {
      const planToTrain = analysisResult?.dashboard || { kpis: [], charts: [] };
      await schemaTrainedApi.trainSchemaDashboard(dataset.id, {
        name: dataset.name,
        rows: dataset.rows,
        columns: dataset.columns,
        dashboardPlan: planToTrain,
        rating: trainingRating,
        notes: trainingNotes || `Trained pattern from Active Dataset ${dataset.name}`,
      } as any);
      setTrainingSuccess("Success! LLM Schema Predictor has saved signature and trained mapping rules.");
      void fetchTrainingDiagnostics();
    } catch (err: any) {
      setTrainingError(err.message || "LLM Schema Predictor training failed");
    } finally {
      setIsTrainingLlm(false);
    }
  };

  // Train Schema RAG Memory
  const handleTrainRag = async () => {
    if (!dataset?.id) return;
    setIsTrainingRag(true);
    setTrainingError(null);
    setTrainingSuccess(null);
    try {
      const planToTrain = analysisResult?.dashboard || { kpis: [], charts: [] };
      const checkOllama = health?.checks?.some(c => c.model === "nomic-embed-text:latest" && c.installed) ?? false;
      await schemaTrainedApi.trainCurrentDashboardPattern(dataset.id, {
        dashboardPlan: planToTrain,
        rating: trainingRating,
        notes: trainingNotes || `RAG Embedding saved for ${dataset.name}`,
        useOllama: checkOllama,
      });
      setTrainingSuccess("Success! Schema RAG memory trained and vector generated.");
      void fetchTrainingDiagnostics();
    } catch (err: any) {
      setTrainingError(err.message || "RAG Embedding training failed");
    } finally {
      setIsTrainingRag(false);
    }
  };

  // Run Schema Prediction Simulation (No rows, only schema columns)
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimError(null);
    setSimResult(null);
    try {
      const response = await schemaTrainedApi.generateSchemaDashboard("simulated-dataset", {
        name: simName,
        columns: simColumns.map(c => ({ name: c.name, type: c.type, role: c.role })),
        rows: [], // Zero rows, forces schema-only prediction
        useLlm: true,
      } as any);
      setSimResult(response);
    } catch (err: any) {
      setSimError(err.message || "Simulation prediction failed");
    } finally {
      setIsSimulating(false);
    }
  };

  // Edit simulation columns helpers
  const addSimColumn = () => {
    setSimColumns([...simColumns, { name: "new_field", type: "string", role: "text" }]);
  };

  const removeSimColumn = (index: number) => {
    setSimColumns(simColumns.filter((_, idx) => idx !== index));
  };

  const updateSimColumn = (index: number, key: "name" | "type" | "role", value: string) => {
    setSimColumns(
      simColumns.map((col, idx) => (idx === index ? { ...col, [key]: value } : col))
    );
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
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-100">
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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 gap-1 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("orchestrator")}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
              activeTab === "orchestrator"
                ? "border-violet-500 text-violet-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            } rounded-t-xl`}
          >
            <Sparkles className="size-4" />
            Agent Orchestrator
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("training");
              void fetchTrainingDiagnostics();
            }}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
              activeTab === "training"
                ? "border-violet-500 text-violet-400 bg-slate-900/40"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
            } rounded-t-xl`}
          >
            <Brain className="size-4" />
            RAG & Schema Training Studio
          </button>
        </div>

        {/* Tab Panel Render */}
        {activeTab === "orchestrator" ? (
          /* Main Grid Layout - Orchestrator */
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
                        className="flex items-center justify-between rounded-xl bg-slate-950/40 border border-slate-880 p-2.5 hover:bg-slate-950/70 transition"
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
                  
                  <AgenticInsightPanel insights={analysisResult?.dashboard || {}} analysisResult={analysisResult} />

                  <AgenticAuditPanel audit={analysisResult?.audit || []} />

                  <AgenticSchemaPanel schemaProfile={analysisResult?.profile || null} columns={analysisResult?.profile?.columns || []} />

                  <AgenticDashboardPanel kpis={analysisResult?.dashboard?.kpis || []} charts={analysisResult?.dashboard?.charts || []} />

                  <AgenticRiskPanel risks={analysisResult?.schemaAnalysis?.risks || []} insights={analysisResult?.insights || []} />

                </div>
              )}

            </div>

          </div>
        ) : (
          /* Main Grid Layout - RAG & Schema Training Studio */
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Left Column: Active Schema and Training Controls */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* Active Schema details */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Database className="size-4 text-violet-400" />
                  Active Dataset Schema
                </h2>
                
                {dataset ? (
                  <div className="mt-4 space-y-4">
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850">
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase font-mono">Dataset Identifier</p>
                      <p className="font-mono text-xs text-white truncate mt-1">{dataset.name || "Default Data"}</p>
                    </div>
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850">
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase font-mono">UUID Signature</p>
                      <p className="font-mono text-[10px] text-slate-300 truncate mt-1">{dataset.id}</p>
                    </div>
                    
                    {/* Columns List View */}
                    <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono block mb-2">Column definitions</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {safeArray(dataset.columns).map((col: any, idx: number) => {
                          const name = typeof col === "string" ? col : col.name || col.key;
                          const role = typeof col === "string" ? "text" : col.role || col.type || "text";
                          return (
                            <span key={idx} className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                              {name} <span className="text-slate-500 font-normal">({role})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-550 text-xs py-4 text-center">Please load a dataset to view its schema.</p>
                )}
              </div>

              {/* Training Configurations & Rating */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Award className="size-4 text-emerald-400" />
                  Training Configurations
                </h2>
                <div className="mt-4 space-y-4">
                  
                  {/* Pattern Rating Select */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">Pattern Quality Rating</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTrainingRating("good")}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-xl border transition-all ${
                          trainingRating === "good"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                            : "bg-slate-950/50 border-slate-800 text-slate-550 hover:text-slate-300"
                        }`}
                      >
                        Good Match (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrainingRating("bad")}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-xl border transition-all ${
                          trainingRating === "bad"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                            : "bg-slate-950/50 border-slate-800 text-slate-550 hover:text-slate-300"
                        }`}
                      >
                        Avoid Shape (Negative)
                      </button>
                    </div>
                  </div>

                  {/* Notes input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">Feedback Notes</label>
                    <textarea
                      value={trainingNotes}
                      onChange={(e) => setTrainingNotes(e.target.value)}
                      placeholder="E.g. Workforce salary data containing country details, ideal for bar charts and currency KPIs..."
                      className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                </div>
              </div>

              {/* Action Buttons: LLM training and RAG training */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Brain className="size-4 text-pink-400" />
                  Save and Train Model
                </h2>
                
                <div className="mt-4 space-y-3">
                  {/* Train LLM Predictor */}
                  <button
                    type="button"
                    onClick={handleTrainLlm}
                    disabled={isTrainingLlm || !dataset}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 px-4 transition disabled:opacity-50"
                  >
                    {isTrainingLlm ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Training Schema Mapping Rules...
                      </>
                    ) : (
                      <>
                        <Brain className="size-3.5" />
                        Train LLM Schema Predictor
                      </>
                    )}
                  </button>

                  {/* Train RAG */}
                  <button
                    type="button"
                    onClick={handleTrainRag}
                    disabled={isTrainingRag || !dataset}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 transition disabled:opacity-50"
                  >
                    {isTrainingRag ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Generating RAG Embeddings...
                      </>
                    ) : (
                      <>
                        <Server className="size-3.5" />
                        Train Schema RAG Memory
                      </>
                    )}
                  </button>

                  {/* Feedback Messages */}
                  {trainingSuccess && (
                    <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                      <span>{trainingSuccess}</span>
                    </div>
                  )}

                  {trainingError && (
                    <div className="mt-2 text-xs bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl flex items-start gap-2">
                      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                      <span>{trainingError}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right/Middle Column: Stored Memory Diagnostics & Registry Explorer */}
            <div className="space-y-6 lg:col-span-2">
              
              {/* Memory Diagnostics stats */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="size-4 text-emerald-400" />
                  Live Memory Diagnostics
                </h2>
                
                {loadingDiagnostics ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <RefreshCw className="size-4 animate-spin text-emerald-400" />
                    Connecting to local training databases...
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {/* Schema Predictor DB */}
                    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-200">Schema Predictor DB</h3>
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">Online</span>
                      </div>
                      <div className="text-[10px] text-slate-450 space-y-1">
                        <div>Database path: <span className="font-mono text-slate-300">schema-training-memory.json</span></div>
                        <div>Trained templates: <span className="font-mono text-slate-200 font-bold">{schemaMemoryStats?.count || 0}</span></div>
                        <div>Trained domains: <span className="text-slate-300 italic">{schemaMemoryStats?.domains ? Object.keys(schemaMemoryStats.domains).join(", ") : "None"}</span></div>
                      </div>
                    </div>

                    {/* RAG Embedding DB */}
                    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-200">Schema RAG Store</h3>
                        <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">Vector Ready</span>
                      </div>
                      <div className="text-[10px] text-slate-450 space-y-1">
                        <div>Database path: <span className="font-mono text-slate-300">schema-rag-memory.json</span></div>
                        <div>Vector signatures: <span className="font-mono text-slate-200 font-bold">{schemaRagStats?.total || 0}</span></div>
                        <div>With embeddings: <span className="font-mono text-slate-200 font-bold">{schemaRagStats?.withEmbeddings || 0}</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stored Signature Explorer */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="size-4 text-blue-400" />
                  Trained Schema Signature Registry
                </h2>
                
                <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
                  {schemaMemoryRecords.length > 0 || schemaRagRecords.length > 0 ? (
                    <>
                      {schemaMemoryRecords.map((record) => (
                        <div key={`mem-${record.id}`} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 hover:bg-slate-950/60 transition flex items-center justify-between gap-3 text-xs">
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-250 truncate">{record.name}</h4>
                              <span className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono capitalize">
                                {record.domain || "generic"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-1">
                              Notes: {record.notes || "None"}
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1 font-mono text-[9px]">
                            <span className="text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">LLM Predictor Match</span>
                            <span className="text-slate-500">{new Date(record.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}

                      {schemaRagRecords.map((record) => (
                        <div key={`rag-${record.id}`} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 hover:bg-slate-950/60 transition flex items-center justify-between gap-3 text-xs">
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-250 truncate">{record.name || "Vector signature"}</h4>
                              <span className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono capitalize">
                                {record.domain || "generic"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-1">
                              Notes: {record.notes || "None"}
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1 font-mono text-[9px]">
                            <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">RAG Embedding</span>
                            <span className="text-slate-500">{new Date(record.updatedAt || "").toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      No trained schema signatures registered in local databases.
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Schema Predictor Simulator */}
              <div className={CARD}>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <Play className="size-4 text-pink-400" />
                  Interactive Schema Predictor Simulator
                </h2>
                
                <p className="text-xs text-slate-400 mt-2">
                  Test the trained LLM model's logic! Setup mock columns below and click Predict to generate analytics dashboards entirely from metadata columns.
                </p>

                <div className="mt-4 space-y-4">
                  {/* Schema Info */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5 font-mono">Simulation Title</label>
                      <input
                        type="text"
                        value={simName}
                        onChange={(e) => setSimName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Schema fields builder */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <h4 className="text-xs font-bold text-slate-300">Mock Metadata Fields</h4>
                      <button
                        type="button"
                        onClick={addSimColumn}
                        className="flex items-center gap-1 bg-violet-600/20 text-violet-400 border border-violet-500/20 px-3 py-1 rounded-lg text-xs font-bold hover:bg-violet-600 hover:text-white transition"
                      >
                        <Plus className="size-3" />
                        Add Field
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {simColumns.map((col, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-slate-950 p-2 rounded-xl border border-slate-900">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => updateSimColumn(idx, "name", e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white w-1/3 focus:outline-none"
                            placeholder="field_name"
                          />
                          <select
                            value={col.type}
                            onChange={(e) => updateSimColumn(idx, "type", e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white w-1/4 focus:outline-none"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="date">date</option>
                            <option value="category">category</option>
                          </select>
                          <select
                            value={col.role}
                            onChange={(e) => updateSimColumn(idx, "role", e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white w-1/3 focus:outline-none"
                          >
                            <option value="id">id</option>
                            <option value="date">date</option>
                            <option value="location">location</option>
                            <option value="money_metric">money_metric</option>
                            <option value="score_metric">score_metric</option>
                            <option value="continuous_metric">continuous_metric</option>
                            <option value="count_metric">count_metric</option>
                            <option value="rate_metric">rate_metric</option>
                            <option value="category">category</option>
                            <option value="text">text</option>
                            <option value="target">target</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeSimColumn(idx)}
                            className="text-slate-500 hover:text-red-400 p-1.5"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Run Prediction Button */}
                  <button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={isSimulating || !simColumns.length}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 px-6 transition duration-200 disabled:opacity-50"
                  >
                    {isSimulating ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Generating Analytics Predictions (RAG + Trained LLM Mode matches)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Run Simulation Analytics Prediction
                      </>
                    )}
                  </button>

                  {/* Simulation error panel */}
                  {simError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
                      Error: {simError}
                    </div>
                  )}

                  {/* Simulation results viewer */}
                  {simResult && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex flex-wrap gap-2 items-center justify-between border-b border-slate-850 pb-3">
                        <div>
                          <span className="text-[10px] font-bold tracking-wider text-slate-450 uppercase font-mono block">Predicted Domain</span>
                          <span className="text-xs text-slate-200 font-bold capitalize mt-0.5 block">{simResult.understanding?.domain?.domain || simResult.domain || "generic"}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono">
                            Quality Score: {simResult.quality?.score || 100}/100
                          </span>
                          <span className="text-[10px] bg-violet-600/10 border border-violet-500/25 text-violet-300 px-2.5 py-1 rounded-full font-mono">
                            Provider: {simResult.provider || "trained-ai"}
                          </span>
                        </div>
                      </div>

                      {/* Memory matching feedback */}
                      {simResult.match && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-300 flex items-start gap-2">
                          <Check className="size-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Pattern Match Success:</strong> Simulated signature matched trained database entry for{" "}
                            <span className="font-bold">{simResult.match.dataset}</span> (Similarity Score:{" "}
                            {(simResult.match.score * 100).toFixed(1)}%). Suggested design mapping loaded.
                          </div>
                        </div>
                      )}

                      {simResult.rag?.matches?.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5 text-xs text-blue-300 flex items-start gap-2">
                          <Check className="size-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>RAG Retrieve Successful:</strong> Found matching contexts in vector storage. Best RAG similarity match:{" "}
                            <span className="font-bold">{simResult.rag.matches[0]?.name || "Unlabeled signature"}</span> (Score:{" "}
                            {(simResult.rag.matches[0]?.score * 100).toFixed(1)}%).
                          </div>
                        </div>
                      )}

                      {/* Predicted KPIs */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider font-mono">Predicted KPIs (Schema-Safe suggestions)</h4>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {safeArray(simResult.dashboardPlan?.kpis || simResult.dashboard?.kpis).map((kpi: any, idx: number) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs">
                              <p className="font-semibold text-slate-200 capitalize">{kpi.title?.replace(/_/g, " ") || kpi.metric}</p>
                              <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500 font-mono">
                                <span>AGGREGATION: {kpi.aggregation}</span>
                                <span className="uppercase text-slate-400">{kpi.format || "number"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Predicted Charts */}
                      <div className="space-y-2 border-t border-slate-850 pt-4">
                        <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider font-mono">Predicted Chart Layout Configs</h4>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {safeArray(simResult.dashboardPlan?.charts || simResult.dashboard?.charts).map((chart: any, idx: number) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-200 capitalize">{chart.title}</span>
                                <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-violet-400 font-mono uppercase">{chart.type}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">{chart.reason || "Matched standard design role mapping rules."}</p>
                              <div className="text-[9px] font-mono text-slate-550 flex gap-4 pt-0.5">
                                <span>X: <span className="text-slate-350 font-semibold">{chart.xKey || chart.x}</span></span>
                                <span>Y: <span className="text-slate-350 font-semibold">{chart.yKey || chart.y}</span></span>
                                <span>Agg: <span className="text-slate-400">{chart.aggregation}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
