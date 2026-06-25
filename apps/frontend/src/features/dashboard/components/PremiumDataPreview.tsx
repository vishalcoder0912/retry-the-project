import { useMemo, useState } from "react";
import { ArrowDownUp, Download, Search } from "lucide-react";
import type { Dataset } from "@/features/data/model/dataStore";

const PAGE_SIZE = 8;

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function PremiumDataPreview({
  dataset,
  onViewFullTable,
}: {
  dataset: Dataset;
  onViewFullTable?: () => void;
  onDownload?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(dataset.columns[0]?.name || "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const columns = dataset.columns.slice(0, 8);
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = search
      ? dataset.rows.filter((row) =>
          dataset.columns.some((column) => String(row[column.name] ?? "").toLowerCase().includes(search)),
        )
      : dataset.rows;

    if (!sortColumn) return rows;
    return [...rows].sort((left, right) => {
      const a = left[sortColumn];
      const b = right[sortColumn];
      const leftNumber = Number(String(a ?? "").replace(/[$,%]/g, ""));
      const rightNumber = Number(String(b ?? "").replace(/[$,%]/g, ""));
      const result =
        Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
          ? leftNumber - rightNumber
          : String(a ?? "").localeCompare(String(b ?? ""));
      return sortDirection === "asc" ? result : -result;
    });
  }, [dataset.columns, dataset.rows, query, sortColumn, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const downloadFiltered = () => {
    const headers = dataset.columns.map((column) => column.name);
    const csv = [
      headers.map(csvEscape).join(","),
      ...filteredRows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${dataset.name || "dataset"}-filtered.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const toggleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(columnName);
    setSortDirection("asc");
  };

  return (
    <section className="rounded-2xl border border-violet-400/20 bg-slate-950/80 p-4 shadow-[0_0_30px_rgba(124,58,237,0.1)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Data Preview</h3>
          <p className="text-xs text-slate-500">Viewing {filteredRows.length.toLocaleString()} of {dataset.rows.length.toLocaleString()} rows</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onViewFullTable} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-violet-400/50" type="button">View Full Table</button>
          <button onClick={downloadFiltered} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-violet-400/50" type="button"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <Search className="h-4 w-4 text-cyan-300" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search or filter rows..."
          className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
        />
      </label>

      <div className="overflow-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              {columns.map((column) => (
                <th key={column.name} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.name)}
                    className="inline-flex max-w-36 items-center gap-1 truncate text-left hover:text-slate-200"
                  >
                    <span className="truncate">{column.name}</span>
                    <ArrowDownUp className="h-3 w-3 shrink-0" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.__rowId ?? index} className="border-t border-slate-800 text-slate-300">
                <td className="px-3 py-2 text-slate-500">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                {columns.map((column) => <td key={column.name} className="max-w-44 truncate px-3 py-2">{String(row[column.name] ?? "")}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={columns.length + 1}>No rows match the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Page {safePage} of {pageCount}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300 disabled:opacity-40" disabled={safePage === 1}>Prev</button>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300 disabled:opacity-40" disabled={safePage === pageCount}>Next</button>
        </div>
      </div>
    </section>
  );
}
