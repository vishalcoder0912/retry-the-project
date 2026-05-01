import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '@/features/data/context/useData';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Pencil, Check, X, Search, Download, Filter } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import StatusPanel from '@/shared/layout/StatusPanel';

const PAGE_SIZES = [10, 25, 50, 100];

const DataTablePage = () => {
  const { dataset, isHydrating, apiError, loadDemo, updateDatasetCell, retryHydrate } = useData();

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const filtered = useMemo(() => {
    if (!dataset) return [];
    if (!search.trim()) return dataset.rows;
    const query = search.toLowerCase();
    return dataset.rows.filter((row) =>
      dataset.columns.some((col) => String(row[col.name]).toLowerCase().includes(query))
    );
  }, [dataset, search]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      const comparison = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  };

  const startEdit = (rowIdx: number, col: string) => {
    const globalIdx = page * pageSize + rowIdx;
    setEditingCell({ row: globalIdx, col });
    setEditValue(String(sorted[globalIdx]?.[col] ?? ''));
  };

  const commitEdit = useCallback(async () => {
    if (!editingCell || !dataset) return;

    const { row, col } = editingCell;
    const actualRow = sorted[row];
    if (!actualRow) {
      setEditingCell(null);
      return;
    }

    const columnDef = dataset.columns.find((column) => column.name === col);
    let newValue: unknown = editValue;
    if (columnDef?.type === 'number') {
      const parsed = Number(editValue);
      if (!Number.isNaN(parsed)) {
        newValue = parsed;
      }
    }

    const rowId = Number(actualRow.__rowId);
    if (!Number.isFinite(rowId)) {
      setEditingCell(null);
      return;
    }

    try {
      await updateDatasetCell(rowId, col, newValue);
    } catch {
      return;
    }
    setEditingCell(null);
  }, [editingCell, editValue, dataset, sorted, updateDatasetCell]);

  const cancelEdit = () => setEditingCell(null);

  if (isHydrating) {
    return (
      <StatusPanel
        title="Loading table"
        message="Connecting to the local API and preparing the dataset table."
      />
    );
  }

  if (apiError) {
    return (
      <StatusPanel
        title="Table unavailable"
        message={apiError}
        actionLabel="Retry"
        onAction={() => {
          void retryHydrate();
        }}
      />
    );
  }

  if (!dataset) {
    return (
      <StatusPanel
        title="No dataset loaded"
        message="Load the demo dataset or upload a file before opening the data table."
        actionLabel="Load Demo Dataset"
        onAction={() => {
          void loadDemo().catch(() => undefined);
        }}
      />
    );
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="flex h-full flex-col space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Data Table</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {sorted.length.toLocaleString()} records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search..."
              className="h-10 rounded-lg border-border/50 bg-background pl-10"
            />
          </div>
          <Button variant="outline" className="rounded-lg gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" className="rounded-lg gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50">
              <tr className="border-b border-border/50">
                <th className="w-12 py-3 px-4 text-left text-xs font-medium text-muted-foreground">#</th>
                {dataset.columns.map((col) => (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {col.name}
                      <SortIcon col={col.name} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, rowIdx) => {
                const globalIdx = page * pageSize + rowIdx;
                return (
                  <tr key={globalIdx} className="border-b border-border/30 hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 text-muted-foreground/80">{globalIdx + 1}</td>
                    {dataset.columns.map((col) => {
                      const isEditing = editingCell?.row === globalIdx && editingCell?.col === col.name;

                      if (isEditing) {
                        return (
                          <td key={col.name} className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void commitEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background outline-none focus:border-primary"
                              />
                              <button onClick={() => { void commitEdit(); }} className="p-1 hover:text-green-600 text-muted-foreground">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={cancelEdit} className="p-1 hover:text-red-500 text-muted-foreground">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.name}
                          onClick={() => startEdit(rowIdx, col.name)}
                          className="relative cursor-pointer px-4 py-3 text-sm group/cell hover:text-foreground"
                        >
                          <span>{typeof row[col.name] === 'number' ? row[col.name].toLocaleString() : String(row[col.name])}</span>
                          <Pencil className="w-3 h-3 text-muted-foreground/0 group-hover/cell:text-muted-foreground/50 absolute right-3 top-1/2 -translate-y-1/2 transition-colors" />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(0); }}>
              <SelectTrigger className="h-8 w-[80px] rounded-md border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {(page * pageSize + 1).toLocaleString()}-{Math.min((page + 1) * pageSize, sorted.length).toLocaleString()} of {sorted.length.toLocaleString()}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" disabled={page >= totalPages - 1} onClick={() => setPage((current) => current + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTablePage;