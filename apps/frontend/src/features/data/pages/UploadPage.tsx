import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  File,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, QrUploadSession, QrUploadStatus } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";

function getPortalBaseUrl() {
  return import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const {
    dataset,
    analysis,
    loadDemo,
    deleteDataset,
    uploadFiles: uploadDataFiles,
    retryHydrate,
    isProcessing,
  } = useData();

  const singleInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const [qrSession, setQrSession] = useState<QrUploadSession | null>(null);
  const [qrStatus, setQrStatus] = useState<QrUploadStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const generateQr = useCallback(async () => {
    setMessage("");

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

    return session;
  }, [dataset?.name]);

  useEffect(() => {
    generateQr().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to generate QR.");
    });
  }, [generateQr]);

  useEffect(() => {
    if (!qrSession) return;

    const interval = window.setInterval(async () => {
      try {
        const status = await api.getQRSessionStatus(
          qrSession.sessionId,
          qrSession.uploadToken
        );

        setQrStatus(status);

        if (status.status === "completed" && status.dataset) {
          await retryHydrate();
        }
      } catch {
        // silent polling failure
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [qrSession, retryHydrate]);

  async function uploadFiles(files: File[]) {
    if (!files.length || uploading) return;

    setUploading(true);
    setMessage("Generating schema-aware dashboard...");

    try {
      await uploadDataFiles(files);
      setMessage("Dataset uploaded. Opening schema-aware dashboard...");
      navigate("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(event.dataTransfer.files || []));
  }

  const activeDataset = qrStatus?.dataset || dataset;
  const activeAnalysis = qrStatus?.analysis || analysis;

  return (
    <div className="min-h-screen bg-[#07111f] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              {activeDataset?.name || "No dataset selected"}{" "}
              {activeDataset?.rowCount
                ? `• ${activeDataset.rowCount.toLocaleString()} rows`
                : ""}
            </p>
            <h1 className="mt-1 text-3xl font-bold">Upload Data</h1>
            <p className="mt-1 text-sm text-slate-400">
              Import your datasets for analysis
            </p>
          </div>

          <button className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Docs
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.8fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr_250px]">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-xl font-bold">
                    Scan to Upload from Mobile
                  </h2>
                  <span className="rounded-full bg-violet-500/15 px-2 py-1 text-xs text-violet-300">
                    Recommended
                  </span>
                </div>

                <div className="rounded-2xl bg-white p-3">
                  {qrSession?.qrDataUrl ? (
                    <img
                      src={qrSession.qrDataUrl}
                      alt="Upload QR code"
                      className="h-52 w-52 rounded-xl"
                    />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center text-slate-900">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <p className="max-w-sm text-sm leading-6 text-slate-300">
                  Scan this QR code to open the secure upload portal on your
                  phone. Upload one or multiple files and sync them directly to
                  InsightFlow.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    disabled={!qrSession}
                    onClick={() =>
                      qrSession && window.open(qrSession.uploadUrl, "_blank")
                    }
                    className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    Open Upload Portal{" "}
                    <ExternalLink className="ml-2 inline h-4 w-4" />
                  </button>

                  <button
                    onClick={() => generateQr()}
                    className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                  >
                    Generate New QR{" "}
                    <RefreshCw className="ml-2 inline h-4 w-4" />
                  </button>
                </div>

                {message && (
                  <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                    {message}
                  </p>
                )}
              </div>

              <div className="hidden overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 p-4 lg:block">
                <div className="mb-3 flex justify-between text-xs text-slate-400">
                  <span>9:41</span>
                  <span>●●●</span>
                </div>

                <p className="text-sm font-bold">InsightFlow</p>
                <p className="mt-2 text-sm text-slate-300">Upload Files</p>

                <div className="mt-4 rounded-xl border border-dashed border-violet-500/60 p-5 text-center">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-violet-400" />
                  <p className="text-sm font-semibold">Tap to select files</p>
                  <p className="mt-1 text-xs text-slate-400">
                    CSV, XLSX, JSON
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 p-3">
                  <p className="text-xs text-slate-400">Recent upload</p>
                  <p className="mt-1 text-sm">
                    {qrStatus?.files?.[0]?.name || "customer_data.csv"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Mobile uploads auto-sync to this workspace
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                Live
              </span>
            </div>

            {[
              ["Scan QR", "Use your phone camera"],
              ["Select files", "Choose one or multiple files"],
              ["Upload", "Files are securely uploaded"],
              ["Dataset appears here", "Ready for analysis instantly"],
            ].map((step, index) => (
              <div key={step[0]} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold">{step[0]}</p>
                  <p className="text-sm text-slate-400">{step[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="rounded-2xl bg-violet-500/15 p-4">
                <File className="h-7 w-7 text-violet-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Single File</h3>
                <p className="text-sm text-slate-400">
                  Upload one dataset file
                </p>
                <p className="text-sm text-slate-500">CSV, XLSX or JSON</p>
              </div>
            </div>

            <button
              onClick={() => singleInputRef.current?.click()}
              className="w-full rounded-xl border border-slate-700 py-3 text-sm font-semibold hover:bg-slate-800"
            >
              Select File
            </button>

            <input
              ref={singleInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []).slice(0, 1))
              }
            />
          </div>

          <div className="rounded-2xl border border-violet-500/40 bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="rounded-2xl bg-violet-500/15 p-4">
                <Layers className="h-7 w-7 text-violet-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Multiple Files</h3>
                <p className="text-sm text-slate-400">
                  Upload and merge multiple files
                </p>
                <p className="text-sm text-slate-500">CSV, XLSX or JSON</p>
              </div>
            </div>

            <button
              onClick={() => multiInputRef.current?.click()}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500"
            >
              Select Files
            </button>

            <input
              ref={multiInputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(event) =>
                uploadFiles(Array.from(event.target.files || []))
              }
            />
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center ${
              dragging
                ? "border-violet-400 bg-violet-500/10"
                : "border-violet-500/50 bg-slate-900/70"
            }`}
          >
            <Upload className="mb-3 h-10 w-10 text-violet-300" />
            <h3 className="text-lg font-bold">Drag & Drop Files Here</h3>
            <p className="mt-1 text-sm text-slate-400">
              Drop one or more files to upload
            </p>
            <p className="mt-1 text-sm text-slate-500">
              CSV, XLSX, JSON • Multiple files supported
            </p>
          </div>
        </div>

        {uploading && (
          <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-violet-200">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Uploading and syncing dataset...
          </div>
        )}

        {activeDataset && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                <div>
                  <h2 className="text-xl font-bold">{activeDataset.name}</h2>
                  <p className="text-sm text-slate-400">
                    Dataset loaded and ready
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
                Ready
              </span>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-4">
              <div>
                <p className="text-sm text-slate-400">Total Records</p>
                <p className="mt-1 text-2xl font-bold">
                  {activeDataset.rowCount?.toLocaleString?.() ||
                    activeDataset.rows?.length?.toLocaleString?.() ||
                    0}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Columns</p>
                <p className="mt-1 text-2xl font-bold">
                  {activeDataset.columns?.length || 0}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">File Type</p>
                <p className="mt-2 inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-sm">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Dataset
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Uploaded</p>
                <p className="mt-1 text-sm text-slate-200">
                  {activeDataset.uploadedAt
                    ? new Date(activeDataset.uploadedAt).toLocaleString()
                    : "Just now"}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <p className="mb-3 text-sm text-slate-400">Detected Fields</p>

              <div className="flex flex-wrap gap-2">
                {(activeDataset.columns || []).slice(0, 16).map((column: any) => (
                  <span
                    key={column.name}
                    className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {column.name}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={async () => {
                    if (window.confirm(`Delete "${activeDataset.name}"? This cannot be undone.`)) {
                      await deleteDataset();
                    }
                  }}
                  className="rounded-xl border border-red-500/30 px-5 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="mr-2 inline h-4 w-4" />
                  Clear Dataset
                </button>

                <button
                  onClick={() => navigate("/dashboard")}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500"
                >
                  Proceed to Dashboard{" "}
                  <ArrowRight className="ml-2 inline h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!activeDataset && (
          <div className="flex justify-end">
            <button
              onClick={() => loadDemo()}
              disabled={isProcessing}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
            >
              <Database className="mr-2 inline h-4 w-4" />
              Use Demo Data
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-800 pt-5 text-sm text-slate-400 md:flex-row md:justify-between">
          <p>
            <ShieldCheck className="mr-2 inline h-4 w-4 text-emerald-400" />
            All uploads are encrypted and stored securely.
          </p>
          <p>
            <Lock className="mr-2 inline h-4 w-4 text-orange-400" />
            Your data is private and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
