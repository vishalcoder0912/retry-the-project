import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  File,
  Layers,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { api, type QrUploadSession, type QrUploadStatus } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import {
  buildDataQualityScore,
  buildDatasetProfile,
  cleanDatasetRows,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";

function getPortalBaseUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
}

function fileLabel(fileName?: string | null) {
  if (!fileName) return "Dataset";
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "Dataset";
}

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    dataset,
    analysis,
    uploadFiles,
    retryHydrate,
    isProcessing,
    apiError,
  } = useData();
  const singleInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [qrSession, setQrSession] = useState<QrUploadSession | null>(null);
  const [qrStatus, setQrStatus] = useState<QrUploadStatus | null>(null);

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const activeDataset = qrStatus?.dataset || dataset;
  const activeRows = useMemo(() => cleanDatasetRows((activeDataset?.rows || []) as Row[]), [activeDataset?.rows]);
  const activeProfile = useMemo(() => buildDatasetProfile(activeRows), [activeRows]);

  const generateQr = useCallback(async () => {
    try {
      const session = await api.generateQRSession({
        portalBaseUrl: getPortalBaseUrl(),
        workspaceName: dataset?.name || "InsightFlow Workspace",
      });
      setQrSession(session);
      setQrStatus({
        sessionId: session.sessionId,
        status: session.status,
        workspaceName: session.workspaceName,
        files: [],
        expiresAt: session.expiresAt,
      });
    } catch {
      setQrSession(null);
    }
  }, [dataset?.name]);

  useEffect(() => {
    void generateQr();
  }, [generateQr]);

  useEffect(() => {
    if (!qrSession) return;
    const interval = window.setInterval(async () => {
      try {
        const status = await api.getQRSessionStatus(qrSession.sessionId, qrSession.uploadToken);
        setQrStatus(status);
        if (status.status === "completed" && status.dataset) {
          await retryHydrate();
          setUploadState("success");
          setMessage("Mobile upload synced and schema is ready.");
        }
      } catch {
        // QR polling should not interrupt the upload page.
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [qrSession, retryHydrate]);

  async function handleFiles(files: File[]) {
    if (!files.length || isProcessing) return;
    setUploadState("uploading");
    setMessage("Reading file, detecting schema, and importing rows...");
    try {
      await uploadFiles(files);
      setUploadState("success");
      setMessage("File processed successfully. Review schema and open the dashboard.");
    } catch (error) {
      setUploadState("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files || []));
  }

  const schemaRows = activeProfile.columns.slice(0, 8);
  const previewRows = activeRows.slice(0, 5);
  const columns = activeProfile.columns.map((column) => column.name);
  const ready = Boolean(activeDataset && activeRows.length && columns.length);

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto grid max-w-[1720px] gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <header className="flex items-start gap-4">
            <div className="mt-1 text-[#7C3AED]">
              <Upload className="size-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Upload Data</h1>
              <p className="mt-1 text-sm text-[#64748B]">Import CSV, XLSX, or JSON datasets for AI-powered analysis.</p>
            </div>
          </header>

          <section
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`${CARD} grid min-h-[260px] place-items-center border-dashed p-8 text-center transition ${
              dragging ? "border-[#7C3AED] bg-violet-50/50" : "border-violet-300"
            }`}
          >
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-lg shadow-violet-500/20">
                <Upload className="size-9" />
              </div>
              <h2 className="mt-5 text-xl font-bold text-[#0F172A]">Drag & drop files here</h2>
              <p className="mt-1 text-sm font-medium text-[#7C3AED]">or click to browse</p>
              <p className="mt-3 text-sm text-[#64748B]">Supports CSV, XLSX, JSON. Multiple files are merged into one dataset.</p>
              <button
                type="button"
                onClick={() => multiInputRef.current?.click()}
                className="mt-5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-10 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20"
              >
                Select Files
              </button>
            </div>
          </section>

          {(message || apiError) && (
            <div
              className={`rounded-2xl border p-4 text-sm font-medium ${
                uploadState === "error" || apiError
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="mr-2 inline size-4" />
              {apiError || message}
            </div>
          )}

          <section className="grid gap-4 xl:grid-cols-3">
            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                  <File className="size-7" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A]">Single File Upload</h3>
                  <p className="mt-1 text-sm text-[#64748B]">Upload one dataset file for analysis.</p>
                </div>
              </div>
              <button type="button" onClick={() => singleInputRef.current?.click()} className="mt-5 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-bold text-[#334155]">
                Choose File
              </button>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                  <Layers className="size-7" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A]">Merge Multiple Files</h3>
                  <p className="mt-1 text-sm text-[#64748B]">Combine multiple files into one unified dataset.</p>
                </div>
              </div>
              <button type="button" onClick={() => multiInputRef.current?.click()} className="mt-5 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-bold text-[#334155]">
                Select Multiple Files
              </button>
            </div>

            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-[#22C55E]">
                  <QrCode className="size-7" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A]">Mobile QR Upload</h3>
                  <p className="mt-1 text-sm text-[#64748B]">Upload from your mobile device instantly.</p>
                </div>
              </div>
              <button type="button" onClick={() => qrSession && window.open(qrSession.uploadUrl, "_blank")} className="mt-5 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-bold text-[#334155]">
                Show QR Code
              </button>
            </div>
          </section>

          <section className={`${CARD} grid gap-4 p-4 md:grid-cols-4`}>
            {[
              [ShieldCheck, "Secure Upload", "End-to-end validation"],
              [Database, "Auto Schema Detection", "Smart type detection"],
              [Sparkles, "Real-time Sync", "Instant data availability"],
              [Lock, "Your Data, Your Privacy", "Never shared. Ever."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-[#7C3AED]">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{String(title)}</p>
                  <p className="text-xs text-[#64748B]">{String(copy)}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                <div>
                  <h2 className="font-bold text-[#0F172A]">Dataset Preview</h2>
                  <p className="text-sm text-[#64748B]">{activeDataset?.fileName || activeDataset?.name || "No file processed yet"}</p>
                </div>
                {ready && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">File processed successfully</span>}
              </div>
              {ready ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                      <tr>
                        {columns.slice(0, 6).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={`${activeDataset?.id || "preview"}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155]">
                          {columns.slice(0, 6).map((column) => <td key={column} className="max-w-[170px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-4 text-sm text-[#64748B]">
                    <span>Showing first {previewRows.length} rows</span>
                    <button type="button" onClick={() => navigate("/data")} className="font-bold text-[#7C3AED]">View full data table <ArrowRight className="inline size-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[220px] place-items-center p-8 text-center text-sm text-[#64748B]">Upload data to preview rows here.</div>
              )}
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                <div>
                  <h2 className="font-bold text-[#0F172A]">Detected Schema</h2>
                  <p className="text-sm text-[#64748B]">{schemaRows.length} columns shown</p>
                </div>
                {ready && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Confidence: {Math.round(quality.finalScore)}%</span>}
              </div>
              {ready ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                      <tr>
                        <th className="px-4 py-3">Column Name</th>
                        <th className="px-4 py-3">Data Type</th>
                        <th className="px-4 py-3">Sample Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaRows.map((column) => (
                        <tr key={column.name} className="border-t border-[#E2E8F0] text-[#334155]">
                          <td className="px-4 py-3 font-medium">{column.name}</td>
                          <td className="px-4 py-3">{column.type}</td>
                          <td className="max-w-[180px] truncate px-4 py-3">{column.sampleValues[0] || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-4 text-sm text-[#64748B]">
                    <span>{activeProfile.columns.length} columns detected</span>
                    <button type="button" onClick={() => navigate("/data")} className="font-bold text-[#7C3AED]">View all columns <ArrowRight className="inline size-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[220px] place-items-center p-8 text-center text-sm text-[#64748B]">Detected schema will appear after upload.</div>
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className={`${CARD} p-5`}>
            <h2 className="text-xl font-bold text-[#0F172A]">How InsightFlow analyzes your data</h2>
            <div className="mt-5 space-y-4">
              {[
                ["Read file", "We securely read your file and validate its structure."],
                ["Detect schema", "Automatically detect columns, data types, and relationships."],
                ["Profile columns", "Analyze data quality, distributions, and key patterns."],
                ["Build dashboard", "Generate visualizations and KPIs tailored to your data."],
                ["Enable AI chat", "Ask questions and get instant insights from your data."],
              ].map(([title, copy], index) => (
                <div key={title} className="grid grid-cols-[34px_1fr] gap-3">
                  <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="rounded-2xl border border-[#E2E8F0] p-4">
                    <p className="font-bold text-[#0F172A]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#64748B]">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5 text-center">
            <h2 className="text-xl font-bold text-[#0F172A]">Ready to explore your data?</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              {ready ? "Your dataset is processed and ready. Open it in the dashboard to begin analysis." : "Upload a dataset to unlock dashboard analysis."}
            </p>
            <button
              type="button"
              disabled={!ready}
              onClick={() => navigate("/dashboard")}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50"
            >
              Open in Dashboard
            </button>
            <button type="button" disabled={!ready} onClick={() => navigate("/data")} className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-[#334155] disabled:opacity-50">
              Go to Data Table <ArrowRight className="inline size-4" />
            </button>
          </section>

          {qrSession?.qrDataUrl && (
            <section className={`${CARD} p-5 text-center`}>
              <h3 className="font-bold text-[#0F172A]">Mobile Upload QR</h3>
              <img src={qrSession.qrDataUrl} alt="Mobile upload QR code" className="mx-auto mt-4 size-44 rounded-2xl border border-[#E2E8F0] p-2" />
              <p className="mt-3 text-xs text-[#64748B]">{qrStatus?.files?.length ? `${qrStatus.files.length} file(s) uploaded` : "Waiting for mobile upload"}</p>
            </section>
          )}

          <section className={`${CARD} p-5`}>
            <h3 className="font-bold text-[#0F172A]">Dataset Summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">Dataset</span><span className="font-semibold text-[#0F172A]">{activeDataset?.name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Rows</span><span className="font-semibold text-[#0F172A]">{activeRows.length.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Columns</span><span className="font-semibold text-[#0F172A]">{activeProfile.columns.length}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Type</span><span className="font-semibold text-[#0F172A]">{fileLabel(activeDataset?.fileName || activeDataset?.sourceType)}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">Analysis</span><span className="font-semibold text-[#0F172A]">{analysis?.dataTypeLabel || "Schema-aware"}</span></div>
            </div>
          </section>
        </aside>
      </div>

      <input ref={singleInputRef} aria-label="Upload one dataset file" type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(event) => void handleFiles(Array.from(event.target.files || []).slice(0, 1))} />
      <input ref={multiInputRef} aria-label="Upload one or more dataset files" type="file" multiple accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(event) => void handleFiles(Array.from(event.target.files || []))} />
    </div>
  );
}
