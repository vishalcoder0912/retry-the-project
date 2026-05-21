import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Search,
  Send,
  Share2,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
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

type PdfMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: PdfAskResult["sources"];
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
      return;
    }

    setAsking(true);
    setQuery("");
    setMessages((current) => [...current, { role: "user", content: text }]);

    try {
      const response = await api.askPdf(result.pdf.id, text);
      setMessages((current) => [...current, { role: "assistant", content: response.answer, sources: response.sources }]);
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Could not answer PDF question.", sources: [] }]);
    } finally {
      setAsking(false);
    }
  }

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
            <button onClick={exportCsv} disabled={!rows.length} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm disabled:opacity-50">
              <Download className="mr-2 inline h-4 w-4" />
              Export Data
            </button>
            <button onClick={shareSummary} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm">
              <Share2 className="mr-2 inline h-4 w-4" />
              Share
            </button>
            <button onClick={() => inputRef.current?.click()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm">
              <Upload className="mr-2 inline h-4 w-4" />
              Upload New PDF
            </button>
          </div>
        </header>

        <section className={`${CARD} p-5`}>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_repeat(4,180px)]">
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/40 p-5">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
                <FileText className="h-10 w-10 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">{file?.name || result?.pdf.fileName || activeDataset?.fileName || "No PDF selected"}</p>
                <p className="mt-1 text-sm text-slate-400">{formatBytes(file?.size)} - {pageCount} page(s)</p>
                {activeDataset && <span className="mt-3 inline-block rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-300">Processed</span>}
              </div>
            </div>

            <button
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border border-dashed p-5 text-center text-sm ${dragging ? "border-violet-400 bg-violet-500/10" : "border-slate-700/60 bg-slate-950/40"}`}
            >
              {isProcessing ? <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> : <Upload className="mx-auto mb-2 h-6 w-6" />}
              Drag and drop PDF here or click to browse
            </button>

            {[
              ["Total Pages", pageCount],
              ["Tables Found", tableGroups.length || result?.pdf.tableCount || 0],
              ["Charts Found", charts.length],
              ["Data Points", rows.length * Math.max(visibleColumns.length, 1)],
            ].map(([label, value], index) => (
              <div key={String(label)} className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-5">
                <div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${index === 0 ? "bg-blue-500/20 text-blue-300" : index === 1 ? "bg-green-500/20 text-green-300" : index === 2 ? "bg-violet-500/20 text-violet-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {index === 1 ? <Table2 className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
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
                <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm ${activeTab === tab ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
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
                  <button onClick={() => void askPdf("What are the key insights?")} disabled={!result?.pdf.id || asking} className="rounded-xl border border-violet-500/50 px-3 py-2 text-xs text-violet-200 disabled:opacity-50">
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
                  <Maximize2 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="grid h-64 place-items-center rounded-2xl border border-slate-700/60 bg-slate-950/50">
                  <div className="w-36 rounded-xl bg-slate-200 p-4 text-slate-900 shadow-xl">
                    <p className="text-xs font-semibold">PDF Page</p>
                    <p className="mt-2 text-lg font-bold">{page}</p>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 rounded bg-slate-400" />
                      <div className="h-2 w-2/3 rounded bg-slate-400" />
                      <div className="h-16 rounded bg-slate-300" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-sm text-slate-300">
                  <button onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-5 w-5" /></button>
                  <span>{page} / {pageCount}</span>
                  <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight className="h-5 w-5" /></button>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className={`${CARD} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 p-4">
                  <h2 className="text-lg font-semibold text-white">Extracted Tables</h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
                  <button onClick={exportMarkdown} className="rounded-xl border border-slate-700 px-3 py-2 text-xs">Markdown Report</button>
                </div>
                <div className="grid gap-4">
                  {charts.length ? charts.slice(0, 2).map((chart) => <SmartChartCard key={chart.id} chart={chart} />) : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No extracted table data available for charts.</div>}
                </div>
              </div>
            </section>
          </main>

          <aside className={`${CARD} h-fit p-5`}>
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-300" />
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
              {asking && <div className="mr-8 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Reading PDF sources...</div>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {promptChips.map((prompt) => (
                <button key={prompt} onClick={() => void askPdf(prompt)} className="rounded-full border border-violet-500/40 px-3 py-1 text-xs text-violet-200">
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void askPdf()} placeholder="Ask anything about this PDF..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500" />
              <button onClick={() => void askPdf()} disabled={!query.trim() || asking} className="rounded-xl bg-violet-600 p-3 disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={exportJson} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">JSON</button>
              <button onClick={exportCsv} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">CSV</button>
              <button onClick={exportMarkdown} disabled={!rows.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">Report</button>
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">All answers are generated from extracted content. Verify important data.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
