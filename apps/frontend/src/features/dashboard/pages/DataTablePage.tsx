<<<<<<< HEAD
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Filter,
  Search,
  Table2,
} from "lucide-react";
import { useData } from "@/features/data/context/useData";
import {
  buildCommandCenterModel,
} from "@/features/dashboard/utils/commandCenterAnalytics";
import {
  applyFilters,
=======
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  Filter,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useData } from "@/features/data/context/useData";
import type { Dataset } from "@/features/data/model/dataStore";
import {
  applyFilters,
  buildDataQualityScore,
>>>>>>> origin/main
  buildDatasetProfile,
  cleanDatasetRows,
  exportRowsToCsv,
  safeNumber,
<<<<<<< HEAD
  type DashboardFilters,
=======
  type DashboardFilterCondition,
  type DashboardFilters,
  type FilterOperator,
>>>>>>> origin/main
  type Row,
} from "@/features/dashboard/utils/dashboardAnalytics";
import StatusPanel from "@/shared/layout/StatusPanel";

<<<<<<< HEAD
const CARD = "rounded-2xl border border-[#E2E8F0] bg-white shadow-sm";
=======
const CARD = "rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-xl backdrop-blur";
>>>>>>> origin/main
const PAGE_SIZES = [10, 25, 50, 100];
const OPERATORS: Array<{ value: FilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" },
];

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
export default function DataTablePage() {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate, updateDatasetCell } = useData();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<{ row: number; column: string } | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const model = useMemo(() => buildCommandCenterModel(dataset), [dataset]);
  const columns = profile.columns.map((column) => column.name);
  const primaryCategory = profile.primaryCategory?.name;

  const filteredRows = useMemo(() => {
    let next = applyFilters(rows, filters);
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      next = next.filter((row) => columns.some((column) => String(row[column] ?? "").toLowerCase().includes(query)));
    }
    if (sortColumn) {
      next = Array.from(next).sort((left, right) => {
        const leftNumber = safeNumber(left[sortColumn]);
        const rightNumber = safeNumber(right[sortColumn]);
        const comparison = leftNumber !== null && rightNumber !== null
          ? leftNumber - rightNumber
          : String(left[sortColumn] ?? "").localeCompare(String(right[sortColumn] ?? ""));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }
    return next;
  }, [columns, filters, rows, search, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice(page * pageSize, page * pageSize + pageSize);
  const categoryValues = useMemo(() => {
    if (!primaryCategory) return [];
    const values = new Set<string>();
    for (const row of rows) {
      const value = String(row[primaryCategory] ?? "");
      if (value) values.add(value);
      if (values.size >= 50) break;
    }
    return Array.from(values);
  }, [primaryCategory, rows]);

  if (isHydrating) return <StatusPanel title="Loading table" message="Preparing dataset rows." />;
  if (apiError) return <StatusPanel title="Table unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  if (!dataset) return <StatusPanel title="No dataset loaded" message="Upload a file before opening the data table." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;

  function setSort(column: string) {
    if (sortColumn === column) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(0);
  }

  function exportVisible() {
    downloadFile(`${dataset.name || "dataset"}-table.csv`, exportRowsToCsv(filteredRows), "text/csv;charset=utf-8");
  }

  async function commitEdit(rowIndex: number, column: string) {
    const originalRow = pageRows[rowIndex];
    const rowId = Number(originalRow.__rowId ?? rows.indexOf(originalRow));
    setEditing(null);
    if (!Number.isFinite(rowId)) return;
    await updateDatasetCell(rowId, column, draft);
  }

  const typeCounts = [
    ["Numeric", profile.columns.filter((column) => column.type === "number").length],
    ["Categorical", profile.categoryColumns.length],
    ["Date", profile.columns.filter((column) => column.type === "date").length],
    ["Quality", `${Math.round(model.quality.finalScore)}%`],
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FC] px-5 py-6 xl:px-8">
      <div className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Table2 className="mt-1 size-8 text-[#7C3AED]" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Data Table</h1>
              <p className="mt-1 text-sm text-[#64748B]">Explore, sort, filter, edit, and export your active dataset.</p>
            </div>
          </div>
          <button type="button" onClick={exportVisible} className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-bold text-[#334155] shadow-sm">
            <Download className="mr-2 inline size-4" />
            Export
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Rows", rows.length.toLocaleString(), "Loaded records"],
            ["Visible Rows", filteredRows.length.toLocaleString(), "After search/filter"],
            ["Columns", columns.length.toLocaleString(), "Detected schema"],
            ["Data Quality", `${Math.round(model.quality.finalScore)}%`, `${model.quality.completeness}% complete`],
          ].map(([title, value, subtitle]) => (
            <div key={title} className={`${CARD} p-5`}>
              <p className="text-sm font-semibold text-[#64748B]">{title}</p>
              <p className="mt-2 text-2xl font-bold text-[#0F172A]">{value}</p>
              <p className="mt-2 text-xs text-[#64748B]">{subtitle}</p>
            </div>
          ))}
        </section>

        <section className={`${CARD} overflow-hidden`}>
          <div className="space-y-4 border-b border-[#E2E8F0] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={search}
                  aria-label="Search table rows"
                  onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                  placeholder="Search all columns..."
                  className="w-full rounded-2xl border border-[#E2E8F0] bg-white py-3 pl-11 pr-4 text-sm text-[#0F172A] outline-none focus:border-[#7C3AED]"
                />
              </div>
              {primaryCategory && (
                <select
                  value={String(filters[primaryCategory] || "")}
                  aria-label={`Filter by ${primaryCategory}`}
                  onChange={(event) => { setFilters((current) => ({ ...current, [primaryCategory]: event.target.value || undefined })); setPage(0); }}
                  className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-semibold text-[#334155] outline-none"
                >
                  <option value="">All {primaryCategory}</option>
                  {categoryValues.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              )}
              <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155]">
                <Filter className="mr-2 inline size-4" />
                Filters
              </button>
              <button type="button" className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#334155]">
                <Columns3 className="mr-2 inline size-4" />
                Columns
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {typeCounts.map(([label, value]) => (
                <span key={String(label)} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#64748B]">{label}: {String(value)}</span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 bg-[#F8FAFC] text-xs text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  {columns.slice(0, 12).map((column) => (
                    <th key={column} className="px-4 py-3">
                      <button type="button" onClick={() => setSort(column)} className="inline-flex items-center gap-1 font-bold">
                        {column}
                        {sortColumn === column ? (sortDirection === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIndex) => (
                  <tr key={`${dataset.id}-${String(row.__rowId ?? Object.values(row).join("|")).slice(0, 120)}`} className="border-t border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 text-[#94A3B8]">{page * pageSize + rowIndex + 1}</td>
                    {columns.slice(0, 12).map((column) => {
                      const isEditing = editing?.row === rowIndex && editing.column === column;
                      return (
                        <td key={column} className="max-w-[220px] px-4 py-3">
                          {isEditing ? (
                            <input
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              onBlur={() => void commitEdit(rowIndex, column)}
                              onKeyDown={(event) => event.key === "Enter" && void commitEdit(rowIndex, column)}
                              aria-label={`Edit ${column}`}
                              className="w-full rounded-lg border border-violet-200 px-2 py-1 outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEditing({ row: rowIndex, column }); setDraft(String(row[column] ?? "")); }}
                              className="max-w-full truncate text-left"
                            >
                              {String(row[column] ?? "") || "-"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-5 py-4 text-sm text-[#64748B]">
            <span>Page {page + 1} of {pageCount}</span>
            <div className="flex items-center gap-2">
              <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
              </select>
              <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#334155]">Previous</button>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} className="rounded-xl border border-[#E2E8F0] px-4 py-2 font-bold text-[#334155]">Next</button>
            </div>
          </div>
        </section>
      </div>
=======
function QualityRing({ score }: { score: number }) {
  return (
    <div
      className="grid size-24 place-items-center rounded-full"
      style={{ background: `conic-gradient(#22c55e ${score * 3.6}deg, rgba(51,65,85,0.9) 0deg)` }}
    >
      <div className="grid size-16 place-items-center rounded-full bg-slate-950 text-center">
        <span className="text-xl font-bold text-white">{Math.round(score)}%</span>
      </div>
    </div>
  );
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanRowsForPreview(rows: Row[]) {
  const cleaned: Row[] = [];
  let trimmedCells = 0;
  let removedEmptyRows = 0;

  rows.forEach((row) => {
    const next: Row = {};
    let hasValue = false;

    Object.entries(row).forEach(([key, value]) => {
      if (key.startsWith("__")) {
        next[key] = value;
        return;
      }
      const nextValue = typeof value === "string" ? normalizeText(value) : value;
      if (typeof value === "string" && nextValue !== value) trimmedCells += 1;
      if (nextValue !== null && nextValue !== undefined && String(nextValue).trim()) hasValue = true;
      next[key] = nextValue;
    });

    if (hasValue) cleaned.push(next);
    else removedEmptyRows += 1;
  });

  return { rows: cleaned, trimmedCells, removedEmptyRows };
}

export default function DataTablePage() {
  const {
    dataset,
    isHydrating,
    apiError,
    loadDemo,
    retryHydrate,
    replaceDatasetLocally,
  } = useData();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "flagged" | "cleaned" | "schema">("all");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ column: "", operator: "equals" as FilterOperator, value: "" });
  const [filters, setFilters] = useState<DashboardFilters>({ conditions: [] });
  const [cleanPreview, setCleanPreview] = useState<ReturnType<typeof cleanRowsForPreview> | null>(null);
  const [assistantNote, setAssistantNote] = useState("Ready to inspect this table.");

  const rows = useMemo(() => cleanDatasetRows((dataset?.rows || []) as Row[]), [dataset?.rows]);
  const indexedRows = useMemo(
    () => rows.map((row, index) => ({ ...row, __displayId: String(row.__rowId ?? index), __displayIndex: index + 1 })),
    [rows],
  );
  const profile = useMemo(() => buildDatasetProfile(rows), [rows]);
  const quality = useMemo(() => buildDataQualityScore(rows), [rows]);
  const columns = profile.columns.map((column) => column.name);

  useEffect(() => {
    setVisibleColumns(new Set(columns));
    setSelectedRows(new Set());
    setFilters({ conditions: [] });
    setPage(0);
  }, [dataset?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredRows = useMemo(() => {
    const tableFilters = activeTab === "flagged"
      ? {
          ...filters,
          conditions: [
            ...((filters.conditions || []) as DashboardFilterCondition[]),
          ],
        }
      : filters;

    let next = applyFilters(indexedRows, tableFilters);

    if (activeTab === "flagged") {
      next = next.filter((row) => columns.some((column) => row[column] === null || row[column] === undefined || String(row[column]).trim() === ""));
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim().toLowerCase();
      next = next.filter((row) => columns.some((column) => String(row[column] ?? "").toLowerCase().includes(query)));
    }

    return next;
  }, [activeTab, columns, filters, indexedRows, debouncedSearch]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((left, right) => {
      const leftNumber = safeNumber(left[sortCol]);
      const rightNumber = safeNumber(right[sortCol]);
      const comparison =
        leftNumber !== null && rightNumber !== null
          ? leftNumber - rightNumber
          : String(left[sortCol] ?? "").localeCompare(String(right[sortCol] ?? ""));
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);
  const visibleColumnList = columns.filter((column) => visibleColumns.has(column));
  const duplicateCount = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((row) => {
      const signature = JSON.stringify(row);
      seen.set(signature, (seen.get(signature) || 0) + 1);
    });
    return Array.from(seen.values()).reduce((total, count) => total + Math.max(count - 1, 0), 0);
  }, [rows]);

  if (isHydrating) {
    return <StatusPanel title="Loading table" message="Preparing your dataset rows." />;
  }

  if (apiError) {
    return <StatusPanel title="Table unavailable" message={apiError} actionLabel="Retry" onAction={() => void retryHydrate()} />;
  }

  if (!dataset) {
    return <StatusPanel title="No dataset loaded" message="Upload a file or load demo data before opening the table." actionLabel="Load Demo Dataset" onAction={() => void loadDemo()} />;
  }

  function setSort(column: string) {
    if (sortCol === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(column);
      setSortDir("asc");
    }
    setPage(0);
  }

  function rowKey(row: Row) {
    return String(row.__displayId);
  }

  function toggleSelect(row: Row) {
    const key = rowKey(row);
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectPageRows(checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      pageRows.forEach((row) => {
        if (checked) next.add(rowKey(row));
        else next.delete(rowKey(row));
      });
      return next;
    });
  }

  function applyAdvancedFilter() {
    if (!filterDraft.column || !filterDraft.value.trim()) return;
    const condition: DashboardFilterCondition = {
      id: crypto.randomUUID(),
      column: filterDraft.column,
      operator: filterDraft.operator,
      value: filterDraft.value.trim(),
    };
    setFilters((current) => ({ ...current, conditions: [...(current.conditions || []), condition] }));
    setFilterDraft({ column: columns[0] || "", operator: "equals", value: "" });
    setShowAdvancedFilter(false);
    setPage(0);
  }

  function removeCondition(id: string) {
    setFilters((current) => ({ ...current, conditions: (current.conditions || []).filter((condition) => condition.id !== id) }));
  }

  function exportVisibleRows() {
    const rowsToExport = sortedRows.map((row) =>
      Object.fromEntries(visibleColumnList.map((column) => [column, row[column]])),
    );
    downloadFile(`${dataset.name || "dataset"}-table.csv`, exportRowsToCsv(rowsToExport as Row[]), "text/csv;charset=utf-8");
  }

  function deleteSelectedRows() {
    if (!selectedRows.size) return;
    if (!window.confirm(`Delete ${selectedRows.size} selected row(s) from the current table view?`)) return;
    const nextRows = indexedRows.filter((row) => !selectedRows.has(rowKey(row))).map(({ __displayId, __displayIndex, ...row }) => row);
    const nextDataset: Dataset = { ...dataset, rows: nextRows as Dataset["rows"], rowCount: nextRows.length };
    replaceDatasetLocally(nextDataset);
    setSelectedRows(new Set());
  }

  function applyCleanPreview() {
    if (!cleanPreview) return;
    const nextDataset: Dataset = { ...dataset, rows: cleanPreview.rows as Dataset["rows"], rowCount: cleanPreview.rows.length };
    replaceDatasetLocally(nextDataset);
    setCleanPreview(null);
    setAssistantNote(`Applied cleaning: trimmed ${cleanPreview.trimmedCells} cells and removed ${cleanPreview.removedEmptyRows} empty rows.`);
  }

  const typeCounts = {
    numeric: profile.columns.filter((column) => column.type === "number").length,
    text: profile.columns.filter((column) => column.type === "string").length,
    date: profile.columns.filter((column) => column.type === "date").length,
    boolean: profile.columns.filter((column) => column.type === "boolean").length,
  };

  return (
    <div className="min-h-screen px-4 py-6 text-white lg:px-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-white">{dataset.name}</span>
              <span>-</span>
              <span>{rows.length.toLocaleString()} rows</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Data Table</h1>
            <p className="mt-1 text-sm text-slate-400">Explore, clean, filter, and manage your data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm hover:bg-slate-800">
              <Sparkles className="mr-2 inline size-4" />
              Ask AI
            </button>
            <button type="button" onClick={exportVisibleRows} className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-2 text-sm hover:bg-slate-800">
              <Download className="mr-2 inline size-4" />
              Export
            </button>
            <button type="button" className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-2 hover:bg-slate-800">
              <MoreVertical className="size-5" />
            </button>
          </div>
        </header>

        <div className="grid gap-5 2xl:grid-cols-[1fr_350px]">
          <main className="space-y-5">
            <section className={`${CARD} p-5`}>
              <div className="grid gap-5 xl:grid-cols-[1fr_280px_120px] xl:items-center">
                <div className="flex items-center gap-5">
                  <div className="grid size-24 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600">
                    <FileSpreadsheet className="size-11 text-white" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-3xl font-semibold text-white">{dataset.name}</h2>
                      <Pencil className="size-4 text-slate-400" />
                      <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300">Ready</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      CSV - {rows.length.toLocaleString()} rows - {columns.length.toLocaleString()} columns - Uploaded {new Date(dataset.uploadedAt).toLocaleString()}
                    </p>
                    <p className="mt-3 text-sm text-slate-400">Manage this dataset with table operations and local analytics checks.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    ["Numeric", typeCounts.numeric, "#2563eb"],
                    ["Text", typeCounts.text, "#7c3aed"],
                    ["Date", typeCounts.date, "#06b6d4"],
                    ["Boolean", typeCounts.boolean, "#22c55e"],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="grid grid-cols-[72px_1fr_44px] items-center gap-2 text-xs text-slate-300">
                      <span>{label}</span>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${columns.length ? (Number(value) / columns.length) * 100 : 0}%`, background: String(color) }}
                        />
                      </div>
                      <span>{Number(value)}</span>
                    </div>
                  ))}
                </div>

                <QualityRing score={quality.finalScore} />
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ["Total Rows", rows.length, "100% valid"],
                ["Columns", columns.length, "Detected"],
                ["Numeric Columns", typeCounts.numeric, `${columns.length ? Math.round((typeCounts.numeric / columns.length) * 100) : 0}%`],
                ["Text Columns", typeCounts.text, `${columns.length ? Math.round((typeCounts.text / columns.length) * 100) : 0}%`],
                ["Missing Values", quality.missingCells, `${quality.completeness}% complete`],
                ["Data Quality", `${quality.finalScore}%`, "Excellent"],
              ].map(([title, value, subtitle], index) => (
                <div key={String(title)} className={`${CARD} p-4`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{title}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{String(value)}</p>
                      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                    </div>
                    <div className={`rounded-2xl p-3 ${index === 4 ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"}`}>
                      {index === 4 ? <AlertTriangle className="size-5" /> : <Table2 className="size-5" />}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className={`${CARD} overflow-hidden`}>
              <div className="border-b border-slate-700/60 p-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All Rows", sortedRows.length],
                    ["flagged", "Flagged", quality.missingCells],
                    ["cleaned", "Cleaned", cleanPreview?.rows.length || rows.length],
                    ["schema", "Schema", columns.length],
                  ].map(([key, label, count]) => (
                    <button type="button"
                      key={String(key)}
                      onClick={() => setActiveTab(key as typeof activeTab)}
                      className={`rounded-xl px-4 py-2 text-sm transition ${
                        activeTab === key ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {label} <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs">{String(count)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-b border-slate-700/60 p-4">
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[260px] flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                      placeholder="Search all columns..."
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 py-2 pl-10 pr-4 text-sm text-white outline-none"
                    />
                  </div>
                  <button type="button" onClick={() => setShowAdvancedFilter((current) => !current)} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-2 text-sm hover:bg-slate-800">
                    <Filter className="mr-2 inline size-4" />
                    Advanced Filter
                  </button>
                  <button type="button" onClick={() => setSort(columns[0] || "")} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-2 text-sm hover:bg-slate-800">
                    <ArrowUpDown className="mr-2 inline size-4" />
                    Sort
                  </button>
                  <button type="button" onClick={() => setShowColumns((current) => !current)} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-2 text-sm hover:bg-slate-800">
                    <Columns3 className="mr-2 inline size-4" />
                    Columns
                  </button>
                  <button type="button" onClick={() => setCleanPreview(cleanRowsForPreview(rows))} className="rounded-xl border border-violet-500/50 bg-violet-500/15 px-4 py-2 text-sm text-violet-100 hover:bg-violet-500/25">
                    <Wand2 className="mr-2 inline size-4" />
                    AI Clean / Enrich
                  </button>
                  <button type="button" onClick={deleteSelectedRows} className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
                    <Trash2 className="mr-2 inline size-4" />
                    Row Actions
                  </button>
                  <button type="button" onClick={() => { setSearch(""); setFilters({ conditions: [] }); setSelectedRows(new Set()); setPage(0); }} className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-4 py-2 text-sm hover:bg-slate-800">
                    <RefreshCw className="mr-2 inline size-4" />
                    Reset
                  </button>
                </div>

                {showAdvancedFilter && (
                  <div className="grid gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3 md:grid-cols-[1fr_180px_1fr_auto]">
                    <select value={filterDraft.column} onChange={(event) => setFilterDraft((current) => ({ ...current, column: event.target.value }))} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none">
                      <option value="">Column</option>
                      {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                    </select>
                    <select value={filterDraft.operator} onChange={(event) => setFilterDraft((current) => ({ ...current, operator: event.target.value as FilterOperator }))} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none">
                      {OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                    </select>
                    <input value={filterDraft.value} onChange={(event) => setFilterDraft((current) => ({ ...current, value: event.target.value }))} placeholder="Value" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none" />
                    <button type="button" onClick={applyAdvancedFilter} className="rounded-xl bg-violet-600 px-4 py-2 text-sm">Apply</button>
                  </div>
                )}

                {showColumns && (
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3">
                    {columns.map((column) => (
                      <label key={column} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(column)}
                          onChange={(event) => {
                            setVisibleColumns((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(column);
                              else next.delete(column);
                              return next;
                            });
                          }}
                        />
                        {column}
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <span>Active Filters:</span>
                  {(filters.conditions || []).length ? (
                    filters.conditions?.map((condition) => (
                      <button type="button" key={condition.id} onClick={() => removeCondition(condition.id)} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200">
                        {condition.column} {condition.operator} {condition.value}
                        <X className="ml-2 inline size-3" />
                      </button>
                    ))
                  ) : (
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs">No filters applied</span>
                  )}
                  <button type="button" onClick={() => setFilters({ conditions: [] })} className="rounded-full border border-violet-500/40 px-3 py-1 text-xs text-violet-200">Clear all</button>
                </div>
              </div>

              {activeTab === "schema" ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-950 text-xs text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Column</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Missing %</th>
                        <th className="px-4 py-3">Unique</th>
                        <th className="px-4 py-3">Sample Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.columns.map((column) => (
                        <tr key={column.name} className="border-t border-slate-800 text-slate-200">
                          <td className="px-4 py-3 font-medium">{column.name}</td>
                          <td className="px-4 py-3">{column.type}</td>
                          <td className="px-4 py-3">{column.role}</td>
                          <td className="px-4 py-3">{column.missingPct}%</td>
                          <td className="px-4 py-3">{column.uniqueCount}</td>
                          <td className="px-4 py-3 text-slate-400">{column.sampleValues.join(", ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 text-sm text-slate-400">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={pageRows.length > 0 && pageRows.every((row) => selectedRows.has(rowKey(row)))}
                        onChange={(event) => selectPageRows(event.target.checked)}
                      />
                      {selectedRows.size} of {sortedRows.length} rows selected
                    </label>
                    <span>{sortedRows.length.toLocaleString()} rows - {visibleColumnList.length} columns</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="sticky top-0 bg-slate-950 text-xs text-slate-400">
                        <tr>
                          <th className="px-4 py-3"></th>
                          <th className="px-4 py-3">#</th>
                          {visibleColumnList.map((column) => {
                            const columnProfile = profile.columns.find((item) => item.name === column);
                            return (
                              <th key={column} className="px-4 py-3">
                                <button type="button" onClick={() => setSort(column)} className="flex items-center gap-2 text-left">
                                  {column}
                                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px]">{columnProfile?.type || "string"}</span>
                                  {sortCol === column ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3" />}
                                </button>
                              </th>
                            );
                          })}
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => (
                          <tr key={rowKey(row)} className="border-t border-slate-800 text-slate-200 hover:bg-slate-800/40">
                            <td className="px-4 py-3"><input type="checkbox" checked={selectedRows.has(rowKey(row))} onChange={() => toggleSelect(row)} /></td>
                            <td className="px-4 py-3 text-slate-500">{String(row.__displayIndex)}</td>
                            {visibleColumnList.map((column) => (
                              <td key={column} className="max-w-[240px] truncate px-4 py-3">{String(row[column] ?? "") || "-"}</td>
                            ))}
                            <td className="px-4 py-3"><MoreVertical className="size-4 text-slate-500" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-700/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span>Rows per page</span>
                      <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                        {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Showing {sortedRows.length ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, sortedRows.length)} of {sortedRows.length}</span>
                      <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(current - 1, 0))} className="rounded-xl border border-slate-700 bg-slate-950 p-2 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                      <span className="rounded-xl bg-violet-600 px-3 py-2 text-sm">{page + 1}</span>
                      <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))} className="rounded-xl border border-slate-700 bg-slate-950 p-2 disabled:opacity-40"><ChevronRight className="size-4" /></button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>

          <aside className={`${CARD} h-fit p-5`}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="size-5 text-violet-300" />
                  <h2 className="text-lg font-semibold text-white">AI Table Assistant</h2>
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] uppercase text-violet-200">Beta</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">Smart insights and actions for the current visible table.</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                ["Find duplicates", `${duplicateCount} duplicate rows found`],
                ["Detect missing values", `${quality.missingCells} missing cells detected`],
                ["Summarize columns", `${columns.length} columns profiled`],
                ["Create chart from selected rows", `${selectedRows.size} rows selected`],
                ["Clean text values", "Trim and normalize whitespace"],
              ].map(([label, note]) => (
                <button type="button" key={label} onClick={() => setAssistantNote(note)} className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800">
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Quick Insights</h3>
              <div className="rounded-2xl border border-green-500/25 bg-green-500/10 p-4 text-sm text-green-100">
                <CheckCircle2 className="mr-2 inline size-4" />
                {quality.missingCells ? `${quality.missingCells} missing cells need review.` : "No missing values detected."}
              </div>
              <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-100">
                {profile.primaryCategory ? `${profile.primaryCategory.uniqueCount} unique ${profile.primaryCategory.name} values found.` : "No categorical column detected."}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-white">Data Health</span>
                <span className="rounded-full bg-green-500/15 px-2 py-1 text-xs text-green-300">Excellent</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-green-400" style={{ width: `${quality.finalScore}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{assistantNote}</p>
            </div>

            <div className="mt-8 flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-2">
              <input aria-label="Ask anything about this table..." placeholder="Ask anything about this table..." className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500" />
              <button type="button" className="rounded-xl bg-violet-600 p-3"><Send className="size-4" /></button>
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">AI can make mistakes. Verify important results.</p>
          </aside>
        </div>
      </div>

      {cleanPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className={`${CARD} w-full max-w-xl p-5`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Cleaning Preview</h2>
                <p className="mt-1 text-sm text-slate-400">Review local cleaning operations before applying them.</p>
              </div>
              <button type="button" onClick={() => setCleanPreview(null)} className="rounded-xl border border-slate-700 bg-slate-950 p-2"><X className="size-4" /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><p className="text-sm text-slate-400">Trimmed cells</p><p className="mt-2 text-2xl font-semibold">{cleanPreview.trimmedCells}</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><p className="text-sm text-slate-400">Empty rows</p><p className="mt-2 text-2xl font-semibold">{cleanPreview.removedEmptyRows}</p></div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><p className="text-sm text-slate-400">Result rows</p><p className="mt-2 text-2xl font-semibold">{cleanPreview.rows.length}</p></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCleanPreview(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={applyCleanPreview} className="rounded-xl bg-violet-600 px-4 py-2 text-sm">Apply Cleaning</button>
            </div>
          </div>
        </div>
      )}
>>>>>>> origin/main
    </div>
  );
}
