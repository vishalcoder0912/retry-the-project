<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
=======
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
>>>>>>> origin/main
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
<<<<<<< HEAD
  RefreshCw,
  Search,
  Send,
=======
  Maximize2,
  Search,
  Send,
  Share2,
>>>>>>> origin/main
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
<<<<<<< HEAD
import { api, type PdfAskResult, type PdfImportResult, type PdfPipelineStatus } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import {
  buildCommandCenterModel,
  titleCase,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  buildDefaultCharts,
  cleanDatasetRows,
  exportRowsToCsv,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";

const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";
=======
import { api, type PdfAskResult, type PdfImportResult } from "@/features/data/api/dataApi";
import { useData } from "@/features/data/context/useData";
import SmartChartCard from "@/features/dashboard/components/SmartChartCard";
import {
  buildDefaultCharts,
  buildDatasetProfile,
  cleanDatasetRows,
  exportRowsToCsv,
  generateDynamicInsights,
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";

const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";
>>>>>>> origin/main

type PdfMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: PdfAskResult["sources"];
<<<<<<< HEAD
  warnings?: string[];
=======
>>>>>>> origin/main
};

function downloadFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

<<<<<<< HEAD
export default function PdfUploadPage() {
  const { dataset } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<PdfImportResult | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState("");
  const [messages, setMessages] = useState<PdfMessage[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<PdfPipelineStatus | null>(null);
  const uploadingRef = useRef(false);
  const activeDataset = result?.dataset || (dataset?.sourceType === "pdf" ? dataset : null);
  const activePdfDocumentId = result?.pdf?.id || pipelineStatus?.documentId || activeDataset?.pdf?.id || "";
  const readiness = pipelineStatus?.readiness || result?.pdfIntelligence?.readiness;

  const rows = useMemo(() => cleanDatasetRows((activeDataset?.rows || []) as Row[]), [activeDataset?.rows]);
  const model = useMemo(() => buildCommandCenterModel(activeDataset), [activeDataset]);
  const charts = useMemo(() => buildDefaultCharts(rows).slice(0, 3), [rows]);
  const columns = model.columns.filter((column) => !column.startsWith("__"));
  const tableCount = result?.pdf.tableCount || new Set(rows.map((row) => String(row.__tableId || row.__source_table || ""))).size || 0;
  const maxExtractedPage = rows.reduce((maxPage, row) => {
    const pageNumber = Number(row.__pageNumber);
    return Number.isFinite(pageNumber) ? Math.max(maxPage, pageNumber) : maxPage;
  }, 0);
  const pageCount = Math.max(result?.pdf.pageCount || 0, result?.knowledgeBaseSummary.chunkCount ? 1 : 0, maxExtractedPage, result ? 1 : 0);
  const dataPoints = rows.length * Math.max(columns.length, 1);
  const visibleRows = rows.filter((row) => search.trim() ? columns.some((column) => String(row[column] ?? "").toLowerCase().includes(search.toLowerCase())) : true);
  const documentSummary = result?.pdfIntelligence?.summary;
  const extractionWarnings = result?.pdf.warnings || (result?.pdfIntelligence?.quality?.warnings as string[] | undefined) || [];
  const ocrStatus = result?.pdf.ocrUsed ? "OCR used" : extractionWarnings.some((warning) => /ocr recommended|ocr.*risk|corruption/i.test(warning)) ? "OCR recommended" : "OCR not needed";
  const pipelineCards = [
    ["Preview", "pdf.preview"],
    ["Text Extraction", "pdf.extractText"],
    ["OCR", "pdf.ocr"],
    ["Tables", "pdf.extractTables"],
    ["Cleaning", "pdf.clean"],
    ["Indexing", "pdf.index"],
    ["Summary", "pdf.summarize"],
    ["Visualizations", "pdf.visualize"],
    ["Query Ready", "query.ready"],
  ].map(([label, key]) => {
    const status = pipelineStatus?.pipelines?.[key];
    if (key === "query.ready") {
      return {
        label,
        key,
        status: readiness?.canAskQuestions ? readiness.hasVectorIndex ? "yes" : "partial" : "no",
        progress: readiness?.canAskQuestions ? readiness.hasVectorIndex ? 100 : 65 : 0,
        error: null,
      };
    }
    return {
      label,
      key,
      status: status?.status || (key === "pdf.ocr" && !result?.pdf.ocrUsed ? "skipped" : result?.pdf.id ? "queued" : "waiting"),
      progress: status?.progress ?? 0,
      error: status?.error,
    };
  });

  useEffect(() => {
    if (!activePdfDocumentId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await api.getPdfPipelineStatus(activePdfDocumentId);
        if (cancelled) return;
        setPipelineStatus(status);
        const document = await api.getPdfIntelligenceDocument(activePdfDocumentId).catch(() => null);
        if (document && !cancelled) {
          setResult((current) => {
            if (current) {
              return {
                ...current,
                pdf: {
                  ...current.pdf,
                  fileName: document.fileName || current.pdf.fileName,
                  pageCount: document.pageCount || current.pdf.pageCount,
                  tableCount: document.tableCount ?? current.pdf.tableCount,
                  chunkCount: document.chunkCount ?? current.pdf.chunkCount,
                  textElementCount: document.pages?.length ?? current.pdf.textElementCount,
                  documentType: document.documentType || current.pdf.documentType,
                  qualityScore: typeof document.quality?.overallScore === "number" ? document.quality.overallScore : current.pdf.qualityScore,
                  warnings: document.quality?.warnings || current.pdf.warnings,
                },
                pdfIntelligence: document,
                knowledgeBaseSummary: {
                  tableCount: document.tableCount || 0,
                  chunkCount: document.chunkCount || 0,
                  textElementCount: document.pages?.length || 0,
                },
              };
            }
            return {
              pdf: {
                id: activePdfDocumentId,
                datasetId: activeDataset?.id || "",
                fileName: document.fileName || activeDataset?.fileName || "",
                jobId: activePdfDocumentId,
                pageCount: document.pageCount || 0,
                tableCount: document.tableCount || 0,
                chunkCount: document.chunkCount || 0,
                textElementCount: document.pages?.length || 0,
                documentType: document.documentType,
                qualityScore: document.quality?.overallScore,
                warnings: document.quality?.warnings || [],
              },
              dataset: activeDataset,
              analysis: null,
              pdfIntelligence: document,
              knowledgeBaseSummary: {
                tableCount: document.tableCount || 0,
                chunkCount: document.chunkCount || 0,
                textElementCount: document.pages?.length || 0,
              },
              privacy: {
                rawPdfSentToLLM: false,
                extractedTextCanBeUsedForRAG: true,
                dashboardValuesCalculatedLocally: true,
              },
            } as any;
          });
        }
      } catch {
        // keep the last known status visible
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePdfDocumentId]);

  async function uploadPdf(file?: File) {
    if (!file || uploadingRef.current) return;
    setError("");
    setMessages([]);
    uploadingRef.current = true;
    try {
      const uploaded = await api.uploadPdfIntelligence(file);
      const data = {
        pdf: {
          id: uploaded.documentId,
          datasetId: "",
          fileName: file.name,
          jobId: uploaded.documentId,
          pageCount: 0,
          tableCount: 0,
          chunkCount: 0,
          textElementCount: 0,
          warnings: [],
        },
        dataset: null,
        analysis: null,
        knowledgeBaseSummary: { tableCount: 0, chunkCount: 0, textElementCount: 0 },
        privacy: {
          rawPdfSentToLLM: false,
          extractedTextCanBeUsedForRAG: true,
          dashboardValuesCalculatedLocally: true,
        },
        pdfIntelligence: {
          documentId: uploaded.documentId,
          fileName: file.name,
          status: uploaded.status,
          progress: 0,
        },
      } as unknown as PdfImportResult;
      setResult(data);
      setPage(1);
      setPipelineStatus({ documentId: uploaded.documentId, status: uploaded.status, progress: 0, message: uploaded.message });
      setMessages([{ role: "assistant", content: `${file.name} uploaded. Text extraction, summaries, tables, and indexing are running as separate background pipelines.` }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed.");
    } finally {
      uploadingRef.current = false;
    }
  }

  async function askPdf(prompt = query) {
    const text = prompt.trim();
    if (!text || asking) return;
    setQuery("");
    setMessages((current) => [...current, { role: "user", content: text }]);

    if (!activePdfDocumentId) {
      setMessages((current) => [...current, { role: "assistant", content: "Upload a PDF before asking questions about it." }]);
=======
function formatBytes(size?: number) {
  if (!size) return "Unknown size";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PdfUploadPage() {
  const { importPdfFile, isProcessing, dataset } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<PdfMessage[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const activeDataset = result?.dataset || (dataset?.sourceType === "pdf" ? dataset : null);
  const rows = useMemo(() => cleanDatasetRows((activeDataset?.rows || []) as Row[]), [activeDataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const charts = useMemo(() => buildDefaultCharts(rows).slice(0, 4), [rows]);
  const insights = useMemo(() => generateDynamicInsights(rows), [rows]);
  const tableGroups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    rows.forEach((row, index) => {
      const tableId = String(row.__tableId || row.__source_table || `table_${Math.floor(index / Math.max(rows.length, 1)) + 1}`);
      if (!groups.has(tableId)) groups.set(tableId, []);
      groups.get(tableId)?.push(row);
    });
    return Array.from(groups.entries()).map(([id, tableRows]) => ({ id, rows: tableRows }));
  }, [rows]);
  const pageNumbers = rows
    .map((row) => Number(row.__pageNumber))
    .filter((value) => Number.isFinite(value));
  const pageCount = Math.max(...pageNumbers, result?.knowledgeBaseSummary?.chunkCount ? 1 : 0, 1);
  const visibleColumns = profile.columns.map((column) => column.name).filter((column) => !column.startsWith("__"));
  const filteredTableRows = rows.filter((row) =>
    search.trim()
      ? visibleColumns.some((column) => String(row[column] ?? "").toLowerCase().includes(search.toLowerCase()))
      : true,
  );

  async function uploadPdf(selectedFile = file) {
    if (!selectedFile || isProcessing) return;
    setError("");
    setMessages([]);

    try {
      const data = await importPdfFile(selectedFile);
      setResult(data);
      setPage(1);
      setMessages([
        {
          role: "assistant",
          content: `Processed ${data.pdf.fileName}. Extracted ${data.pdf.tableCount} table(s) and ${data.pdf.textElementCount} text element(s).`,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed.");
    }
  }

  function handleFiles(files: FileList | File[]) {
    const nextFile = Array.from(files)[0];
    if (!nextFile) return;
    setFile(nextFile);
    void uploadPdf(nextFile);
  }

  function exportJson() {
    downloadFile(
      `${activeDataset?.name || "pdf-extraction"}.json`,
      JSON.stringify({ pdf: result?.pdf, dataset: activeDataset, insights }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    downloadFile(`${activeDataset?.name || "pdf-extraction"}.csv`, exportRowsToCsv(rows), "text/csv;charset=utf-8");
  }

  function exportMarkdown() {
    const report = [
      `# ${result?.pdf.fileName || activeDataset?.name || "PDF Intelligence Report"}`,
      "",
      `Rows: ${rows.length}`,
      `Tables: ${tableGroups.length}`,
      `Columns: ${visibleColumns.length}`,
      "",
      "## Insights",
      ...insights.map((insight) => `- ${insight.title}: ${insight.description}`),
    ].join("\n");
    downloadFile(`${activeDataset?.name || "pdf-report"}.md`, report, "text/markdown;charset=utf-8");
  }

  async function shareSummary() {
    const summary = `PDF: ${result?.pdf.fileName || activeDataset?.name || "No PDF"}\nRows: ${rows.length}\nTables: ${tableGroups.length}\nColumns: ${visibleColumns.length}`;
    await navigator.clipboard?.writeText(summary);
  }

  async function askPdf(prompt = query) {
    const text = prompt.trim();
    if (!text || asking) return;

    if (/export all data/i.test(text)) {
      exportJson();
      setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: "Exported extracted PDF data as JSON from the local dataset." }]);
      setQuery("");
      return;
    }

    if (!result?.pdf?.id) {
      setMessages((current) => [...current, { role: "assistant", content: "Upload and process a PDF before asking questions about it." }]);
>>>>>>> origin/main
      return;
    }

    setAsking(true);
<<<<<<< HEAD
    try {
      const isExplanation = /\b(explain|overview|summarize|summary|what is this pdf about)\b/i.test(text);
      const response = isExplanation
        ? await api.explainPdf(activePdfDocumentId)
        : await api.askPdfIntelligence(activePdfDocumentId, text);
      setMessages((current) => [...current, { role: "assistant", content: response.answer, sources: response.sources, warnings: response.warnings }]);
=======
    setQuery("");
    setMessages((current) => [...current, { role: "user", content: text }]);

    try {
      const response = await api.askPdf(result.pdf.id, text);
      setMessages((current) => [...current, { role: "assistant", content: response.answer, sources: response.sources }]);
>>>>>>> origin/main
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Could not answer PDF question.", sources: [] }]);
    } finally {
      setAsking(false);
    }
  }

<<<<<<< HEAD
  async function runPdfMaintenance(action: "reindex" | "force-ocr") {
    if (!activePdfDocumentId || maintenanceBusy) return;
    setMaintenanceBusy(action);
    try {
      if (action === "force-ocr") {
        await api.forceOcrPdf(activePdfDocumentId);
        setMessages((current) => [...current, { role: "assistant", content: "Forced OCR was queued. This runs separately and will update the pipeline status as pages finish." }]);
      } else {
        await api.reindexPdf(activePdfDocumentId);
        setMessages((current) => [...current, { role: "assistant", content: "PDF vector reindex was queued from stored chunks. OCR will not run." }]);
      }
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "PDF maintenance action failed." }]);
    } finally {
      setMaintenanceBusy("");
    }
  }

  function exportCsv() {
    downloadFile(`${activeDataset?.name || "pdf-extraction"}.csv`, exportRowsToCsv(rows), "text/csv;charset=utf-8");
  }

  const ready = Boolean(result?.pdf?.id);

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto grid max-w-[1720px] gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Sparkles className="mt-1 size-8 text-[#7C3AED]" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">PDF Intelligence</h1>
                <p className="mt-1 text-sm text-[#64748B]">Extract, analyze, and visualize data from your PDF documents.</p>
              </div>
            </div>
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
              <Upload className="mr-2 inline size-4" />
              Upload New PDF
            </button>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className={`${CARD} p-5 xl:col-span-2`}>
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                  <FileText className="size-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Document</p>
                  <p className="mt-1 truncate font-bold text-[#0F172A]">{result?.pdf.fileName || activeDataset?.fileName || "No PDF uploaded"}</p>
                  <p className="mt-1 text-sm text-[#64748B]">{ready ? pipelineStatus?.message || "Processing pipelines started" : "Upload a PDF to begin"}</p>
                </div>
              </div>
            </div>
            {[
              ["Total Pages", pageCount || "-", "Pages", FileText],
              ["Tables Found", ready ? tableCount : "-", "Tables", Table2],
              ["Charts Found", ready ? charts.length : "-", "Charts", BarChart3],
              ["Data Points", ready ? dataPoints.toLocaleString() : "-", "Extracted", DatabaseIcon],
            ].map(([title, value, subtitle, Icon]) => (
              <div key={String(title)} className={`${CARD} p-5`}>
                <div className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-[#7C3AED]">
                  <Icon className="size-5" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#64748B]">{String(title)}</p>
                <p className="mt-1 text-2xl font-bold text-[#0F172A]">{String(value)}</p>
                <p className="mt-1 text-sm text-[#64748B]">{String(subtitle)}</p>
              </div>
            ))}
          </section>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

          {result?.pdf.id ? (
            <section className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-bold text-[#0F172A]">Pipeline Status</h2>
                <span className="text-sm font-semibold text-[#64748B]">{pipelineStatus?.status || result.pdfIntelligence?.status || "uploaded"}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {pipelineCards.map((item) => (
                  <div key={item.key} className="rounded-xl border border-[#E2E8F0] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#334155]">{item.label}</span>
                      <span className={`text-xs font-bold ${item.status === "failed" ? "text-rose-600" : item.status === "completed" ? "text-emerald-600" : "text-[#64748B]"}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${Math.min(Math.max(item.progress, item.status === "completed" ? 100 : 0), 100)}%` }} />
                    </div>
                    {item.error ? <p className="mt-2 text-xs text-rose-600">{item.error}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!ready && (
            <section className={`${CARD} grid min-h-[260px] place-items-center border-dashed border-violet-300 p-8 text-center`}>
              <div>
                <Upload className="mx-auto size-12 text-[#7C3AED]" />
                <h2 className="mt-4 text-xl font-bold text-[#0F172A]">Upload a PDF to extract tables and insights</h2>
                <p className="mt-2 text-sm text-[#64748B]">Stats and answers appear only after real extracted content is available.</p>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-8 py-3 text-sm font-bold text-white">
                  Select PDF
                </button>
              </div>
            </section>
          )}

          {ready && (
            <>
              <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] pb-2">
                {["Overview", "Extracted Data", "Visualizations", "Pages", "AI Insights"].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-bold ${activeTab === tab ? "bg-violet-50 text-[#7C3AED]" : "text-[#64748B]"}`}>
                    {tab}
                  </button>
                ))}
              </div>

              <section className="grid gap-5 xl:grid-cols-[0.85fr_1fr_0.85fr]">
                <div className={`${CARD} p-5`}>
                  <h2 className="font-bold text-[#0F172A]">Document Information</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    {[
                      ["File Name", result?.pdf.fileName || activeDataset?.fileName],
                      ["Pages", String(pageCount)],
                      ["Status", "Processed"],
                      ["PDF Type", result?.pdf.documentType ? titleCase(result.pdf.documentType.replace(/_/g, " ")) : "-"],
                      ["OCR Used", result?.pdf.ocrUsed ? "Yes" : "No"],
                      ["OCR Status", result ? ocrStatus : "-"],
                      ["Quality", typeof result?.pdf.qualityScore === "number" ? `${Math.round(result.pdf.qualityScore * 100)}%` : "-"],
                      ["OCR Confidence", typeof result?.pdf.ocrConfidence === "number" ? `${Math.round(result.pdf.ocrConfidence * 100)}%` : "-"],
                      ["Tables", String(tableCount)],
                      ["Columns", String(columns.length)],
                      ["Primary Metric", model.profile.primaryMetric ? titleCase(model.profile.primaryMetric.name) : "-"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4"><span className="text-[#64748B]">{label}</span><span className="text-right font-semibold text-[#0F172A]">{value || "-"}</span></div>
                    ))}
                  </div>
                </div>

                <div className={`${CARD} p-5`}>
                  <h2 className="font-bold text-[#0F172A]">Document Summary</h2>
                  <div className="mt-4 space-y-3">
                    {documentSummary?.shortSummary || documentSummary?.short ? (
                      <div className="rounded-2xl border border-[#E2E8F0] p-4">
                        <p className="font-bold text-[#0F172A]">{String(documentSummary.documentTitle || "PDF Overview")}</p>
                        <p className="mt-2 text-sm leading-6 text-[#64748B]">{String(documentSummary.shortSummary || documentSummary.short)}</p>
                      </div>
                    ) : null}
                    {(documentSummary?.keyPoints?.length ? documentSummary.keyPoints : model.insights.map((item) => item.description)).slice(0, 4).map((insight: any, index: number) => (
                      <div key={typeof insight === "string" ? `summary-point-${index}` : insight.id || `summary-point-${index}`} className="rounded-2xl border border-[#E2E8F0] p-4">
                        <p className="font-bold text-[#0F172A]">{typeof insight === "string" ? `Point ${index + 1}` : insight.title}</p>
                        <p className="mt-2 text-sm leading-6 text-[#64748B]">{typeof insight === "string" ? insight : insight.description}</p>
                      </div>
                    ))}
                    {extractionWarnings.length ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Some content may be uncertain due to OCR/extraction quality. {extractionWarnings.slice(0, 2).join(" ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`${CARD} p-5`}>
                  <h2 className="font-bold text-[#0F172A]">Page Preview</h2>
                  <div className="mt-4 grid h-64 place-items-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
                    <div className="w-44 rounded-xl bg-white p-5 text-[#0F172A] shadow-xl">
                      <p className="text-sm font-bold">PDF Page {page}</p>
                      <div className="mt-4 space-y-2">
                        <div className="h-2 rounded bg-slate-200" />
                        <div className="h-2 rounded bg-slate-200" />
                        <div className="h-20 rounded bg-violet-100" />
                        <div className="h-2 rounded bg-slate-200" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-4 text-sm text-[#64748B]">
                    <button type="button" aria-label="Previous PDF page" onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-5" /></button>
                    <span>Page {page} of {pageCount}</span>
                    <button type="button" aria-label="Next PDF page" onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight className="size-5" /></button>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
                    <h2 className="font-bold text-[#0F172A]">Extracted Tables</h2>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        value={search}
                        aria-label="Search extracted PDF tables"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search tables..."
                        className="w-full rounded-xl border border-[#E2E8F0] py-2 pl-9 pr-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="sticky top-0 bg-[#F8FAFC] text-xs text-[#64748B]">
                        <tr>{columns.slice(0, 5).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
                      </thead>
                      <tbody>
                        {visibleRows.slice(0, 10).map((row) => (
                          <tr key={`${activeDataset?.id || "pdf-row"}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155]">
                            {columns.slice(0, 5).map((column) => <td key={column} className="max-w-[170px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-[#E2E8F0] px-5 py-4">
                    <button type="button" onClick={exportCsv} className="text-sm font-bold text-[#7C3AED]"><Download className="mr-2 inline size-4" />Export extracted data</button>
                  </div>
                </div>

                <div className={`${CARD} p-5`}>
                  <h2 className="font-bold text-[#0F172A]">Extracted Charts</h2>
                  <div className="mt-4 grid gap-4">
                    {charts.length ? charts.slice(0, 2).map((chart) => <SmartChartCard key={chart.id} chart={chart} />) : <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-8 text-center text-sm text-[#64748B]">No chartable table data found.</div>}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>

        <aside className={`${CARD} h-fit p-5`}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#7C3AED]" />
            <h2 className="font-bold text-[#0F172A]">AI Assistant</h2>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-[#7C3AED]">Beta</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#64748B]">Ask questions about your PDF document and get cited answers from extracted content.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Explain the PDF", "List all tables", "Summarize page 1", "What are the key insights?", "Show extracted metrics"].map((prompt) => {
              const disabled = prompt === "Show extracted metrics" && readiness?.canShowMetrics === false;
              return (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void askPdf(prompt)}
                  disabled={disabled}
                  title={disabled ? "No real analyzable PDF tables are ready yet." : undefined}
                  className="rounded-full border border-violet-200 px-3 py-1 text-xs font-semibold text-[#7C3AED] disabled:border-slate-200 disabled:text-[#94A3B8]"
                >
                  {prompt}
                </button>
              );
            })}
          </div>

          {result?.pdf.id ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void runPdfMaintenance("reindex")} disabled={Boolean(maintenanceBusy)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#334155] disabled:opacity-50">
                <RefreshCw className={`mr-1 inline size-3 ${maintenanceBusy === "reindex" ? "animate-spin" : ""}`} />
                Rebuild PDF Index
              </button>
              <button type="button" onClick={() => void runPdfMaintenance("force-ocr")} disabled={Boolean(maintenanceBusy)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#334155] disabled:opacity-50">
                <RefreshCw className={`mr-1 inline size-3 ${maintenanceBusy === "force-ocr" ? "animate-spin" : ""}`} />
                Force OCR and Re-index
              </button>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {activePdfDocumentId && readiness?.canAskQuestions && readiness?.hasVectorIndex === false ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                PDF is processing. I can answer from available extracted text if ready.
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={`${message.role}-${message.content.slice(0, 80)}`} className={message.role === "user" ? "ml-8 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-[#0F172A]" : "mr-4 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#334155]"}>
                <p className="whitespace-pre-line leading-6">{message.content}</p>
                {message.warnings?.length ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    {message.warnings.slice(0, 3).join(" ")}
                  </div>
                ) : null}
                {message.sources?.length ? (
                  <div className="mt-3 space-y-2">
                    {message.sources.map((source) => (
                      <div key={source.id} className="rounded-xl bg-[#F8FAFC] p-2 text-xs text-[#64748B]">
                        Source {source.source}
                        {source.pageNumber ? ` page ${source.pageNumber}` : ""}
                        {source.chunkId || source.id ? ` chunk ${source.chunkId || source.id}` : ""}
                        {source.chunkType ? ` ${source.chunkType}` : ""}
                        {typeof source.confidence === "number" ? ` confidence ${Math.round(source.confidence * 100)}%` : ""}
                        {typeof source.score === "number" ? ` score ${source.score.toFixed(2)}` : ""}: {source.preview}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {asking && <div className="rounded-2xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#64748B]"><Loader2 className="mr-2 inline size-4 animate-spin" />Reading PDF sources...</div>}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-violet-200 bg-white p-2">
            <input aria-label="Ask a question about the uploaded PDF" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void askPdf()} placeholder="Ask anything about this PDF..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={() => void askPdf()} disabled={!query.trim() || asking} className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white disabled:opacity-50"><Send className="size-4" /></button>
          </div>
          <p className="mt-4 text-center text-xs text-[#94A3B8]">All answers come from extracted PDF content when available.</p>
        </aside>
      </div>

      <input ref={inputRef} aria-label="Upload PDF document" type="file" accept="application/pdf" className="hidden" onChange={(event) => void uploadPdf(event.target.files?.[0])} />
    </div>
  );
}

function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return <Table2 {...props} />;
}
=======
  const promptChips = [
    "List all tables",
    "What are the key insights?",
    "Export all data",
    profile.primaryMetric ? `Show ${profile.primaryMetric.name} trend` : "",
  ].filter(Boolean);

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">PDF Intelligence</h1>
            <p className="mt-1 text-sm text-slate-400">Extract, analyze and visualize data from your PDF documents.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} disabled={!rows.length} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm disabled:opacity-50">
              <Download className="mr-2 inline size-4" />
              Export Data
            </button>
            <button type="button" onClick={shareSummary} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Share2 className="mr-2 inline size-4" />
              Share
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm">
              <Upload className="mr-2 inline size-4" />
              Upload New PDF
            </button>
          </div>
        </header>

        <section className={`${CARD} p-5`}>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_repeat(4,180px)]">
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/40 p-5">
              <div className="grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
                <FileText className="size-10 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">{file?.name || result?.pdf.fileName || activeDataset?.fileName || "No PDF selected"}</p>
                <p className="mt-1 text-sm text-slate-400">{formatBytes(file?.size)} - {pageCount} page(s)</p>
                {activeDataset && <span className="mt-3 inline-block rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-300">Processed</span>}
              </div>
            </div>

            <button type="button"
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border border-dashed p-5 text-center text-sm ${dragging ? "border-violet-400 bg-violet-500/10" : "border-slate-700/60 bg-slate-950/40"}`}
            >
              {isProcessing ? <Loader2 className="mx-auto mb-2 size-6 animate-spin" /> : <Upload className="mx-auto mb-2 size-6" />}
              Drag and drop PDF here or click to browse
            </button>

            {[
              ["Total Pages", pageCount],
              ["Tables Found", tableGroups.length || result?.pdf.tableCount || 0],
              ["Charts Found", charts.length],
              ["Data Points", rows.length * Math.max(visibleColumns.length, 1)],
            ].map(([label, value], index) => (
              <div key={String(label)} className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-5">
                <div className={`mb-4 grid size-10 place-items-center rounded-xl ${index === 0 ? "bg-blue-500/20 text-blue-300" : index === 1 ? "bg-green-500/20 text-green-300" : index === 2 ? "bg-violet-500/20 text-violet-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {index === 1 ? <Table2 className="size-5" /> : <BarChart3 className="size-5" />}
                </div>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{String(value)}</p>
              </div>
            ))}
          </div>

          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(event) => event.target.files && handleFiles(event.target.files)} />
          {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </section>

        <div className="grid gap-5 2xl:grid-cols-[1fr_350px]">
          <main className="space-y-5">
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
              {["Overview", "Extracted Data", "Visualizations", "Pages", "Insights"].map((tab) => (
                <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm ${activeTab === tab ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                  {tab}
                </button>
              ))}
            </div>

            <section className="grid gap-5 xl:grid-cols-[0.7fr_1.2fr_0.8fr]">
              <div className={`${CARD} p-5`}>
                <h2 className="text-lg font-semibold text-white">Document Information</h2>
                <div className="mt-5 space-y-3 text-sm">
                  {[
                    ["File Name", result?.pdf.fileName || activeDataset?.fileName || "-"],
                    ["File Size", formatBytes(file?.size)],
                    ["Pages", String(pageCount)],
                    ["Uploaded", activeDataset?.uploadedAt ? new Date(activeDataset.uploadedAt).toLocaleString() : "-"],
                    ["Status", activeDataset ? "Processed Successfully" : "Waiting for upload"],
                    ["OCR", activeDataset ? "High Accuracy" : "-"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-right text-slate-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${CARD} p-5`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Key Insights</h2>
                  <button type="button" onClick={() => void askPdf("What are the key insights?")} disabled={!result?.pdf.id || asking} className="rounded-xl border border-violet-500/50 px-3 py-2 text-xs text-violet-200 disabled:opacity-50">
                    Summarize
                  </button>
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-300">
                  {insights.length ? insights.map((insight) => <p key={insight.id}>{insight.description}</p>) : <p>Upload a PDF to extract insights from its tables and text.</p>}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {insights.map((insight) => (
                    <span key={insight.id} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">{insight.title}</span>
                  ))}
                </div>
              </div>

              <div className={`${CARD} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Page Preview</h2>
                  <Maximize2 className="size-4 text-slate-400" />
                </div>
                <div className="grid h-64 place-items-center rounded-2xl border border-slate-700/60 bg-slate-950/50">
                  <div className="w-36 rounded-xl bg-slate-200 p-4 text-slate-900 shadow-xl">
                    <p className="text-xs font-semibold">PDF Page</p>
                    <p className="mt-2 text-lg font-bold">{page}</p>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 rounded bg-slate-400" />
                      <div className="size-2/3 rounded bg-slate-400" />
                      <div className="h-16 rounded bg-slate-300" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-300">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-5" /></button>
                  <span>{page} / {pageCount}</span>
                  <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight className="size-5" /></button>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className={`${CARD} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 p-4">
                  <h2 className="text-lg font-semibold text-white">Extracted Tables</h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tables..." className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-10 pr-3 text-sm outline-none" />
                  </div>
                </div>
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-950 text-xs text-slate-400">
                      <tr>
                        {visibleColumns.slice(0, 6).map((column) => <th key={column} className="px-4 py-3">{column}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTableRows.slice(0, 12).map((row, index) => (
                        <tr key={index} className="border-t border-slate-800 text-slate-200">
                          {visibleColumns.slice(0, 6).map((column) => <td key={column} className="max-w-[180px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-700/60 p-4">
                  <Link to="/dashboard" className="rounded-xl bg-violet-600 px-4 py-2 text-sm">Use Extracted Data in Dashboard</Link>
                </div>
              </div>

              <div className={`${CARD} p-4`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Extracted Charts</h2>
                  <button type="button" onClick={exportMarkdown} className="rounded-xl border border-slate-700 px-3 py-2 text-xs">Markdown Report</button>
                </div>
                <div className="grid gap-4">
                  {charts.length ? charts.slice(0, 2).map((chart) => <SmartChartCard key={chart.id} chart={chart} />) : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No extracted table data available for charts.</div>}
                </div>
              </div>
            </section>
          </main>

          <aside className={`${CARD} h-fit p-5`}>
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="size-5 text-violet-300" />
              <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] uppercase text-violet-200">Beta</span>
            </div>
            <p className="mb-4 text-sm text-slate-400">Ask questions about your PDF document and get cited answers from extracted content.</p>

            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "ml-8 rounded-2xl bg-violet-600 px-4 py-3 text-sm" : "mr-8 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"}>
                  <p className="whitespace-pre-line">{message.content}</p>
                  {message.sources?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.sources.map((source) => (
                        <div key={source.id} className="rounded-xl border border-slate-700 p-2 text-xs text-slate-400">
                          Source {source.source}: {source.preview}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {asking && <div className="mr-8 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm"><Loader2 className="mr-2 inline size-4 animate-spin" />Reading PDF sources...</div>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {promptChips.map((prompt) => (
                <button type="button" key={prompt} onClick={() => void askPdf(prompt)} className="rounded-full border border-violet-500/40 px-3 py-1 text-xs text-violet-200">
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void askPdf()} placeholder="Ask anything about this PDF..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500" />
              <button type="button" onClick={() => void askPdf()} disabled={!query.trim() || asking} className="rounded-xl bg-violet-600 p-3 disabled:opacity-50"><Send className="size-4" /></button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={exportJson} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">JSON</button>
              <button type="button" onClick={exportCsv} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">CSV</button>
              <button type="button" onClick={exportMarkdown} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">Report</button>
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">All answers are generated from extracted content. Verify important data.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
>>>>>>> origin/main
