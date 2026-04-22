import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/features/data/context/useData';
import KPICard from '@/features/dashboard/components/KPICard';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import DashboardFilters, { FilterState } from '@/features/dashboard/components/DashboardFilters';
import { useKPIEngine } from '@/features/dashboard/hooks/useKPIEngine';
import { Download, Search } from 'lucide-react';
import { exportDatasetCSV } from '@/features/data/utils/exportUtils';
import { Link } from 'react-router-dom';
import StatusPanel from '@/shared/layout/StatusPanel';

const DashboardPage = () => {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    columns: {},
  });

  const dateColumnName = useMemo(
    () => dataset?.columns.find((column) => column.type === 'date')?.name,
    [dataset],
  );

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  const filteredDataset = useMemo(() => {
    if (!dataset) return null;

    const filtered = dataset.rows.filter((row) => {
      for (const [col, value] of Object.entries(filters.columns)) {
        if (value && String(row[col]) !== value) return false;
      }

      if (dateColumnName && (filters.dateRange.from || filters.dateRange.to)) {
        const rawValue = row[dateColumnName];
        const parsedDate = rawValue == null ? Number.NaN : Date.parse(String(rawValue));

        if (Number.isNaN(parsedDate)) {
          return false;
        }

        if (filters.dateRange.from && parsedDate < filters.dateRange.from.getTime()) {
          return false;
        }

        if (filters.dateRange.to) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (parsedDate > endOfDay.getTime()) {
            return false;
          }
        }
      }

      return true;
    });
    return { ...dataset, rows: filtered, rowCount: filtered.length };
  }, [dataset, filters, dateColumnName]);

  const { analyticsBundle,kpis } = useKPIEngine(filteredDataset);
  const charts = analyticsBundle?.charts ?? [];

  if (isHydrating) {
    return (
      <StatusPanel
        title="Loading dashboard"
        message="Connecting to the local API and restoring your dataset."
      />
    );
  }

  if (apiError) {
    return (
      <StatusPanel
        title="Dashboard unavailable"
        message={apiError}
        actionLabel="Retry"
        onAction={() => {
          void retryHydrate();
        }}
      />
    );
  }

  if (!dataset || !filteredDataset) {
    return (
      <StatusPanel
        title="No dataset loaded"
        message="Load the demo dataset or upload a file to start using the dashboard."
        actionLabel="Load Demo Dataset"
        onAction={() => {
          void loadDemo().catch(() => undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-8 px-10 py-10">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="terminal-label">1.0 Dashboard</p>
          <p className="mt-3 text-sm uppercase tracking-[0.08em] text-muted-foreground">
            Analyzing {dataset.name} // {filteredDataset.rowCount.toLocaleString()} of {dataset.rowCount.toLocaleString()} records
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportDatasetCSV(filteredDataset)}
            className="terminal-button gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <div className="terminal-panel flex items-center gap-3 px-4 py-2 text-sm uppercase tracking-[0.08em] text-muted-foreground">
            <Search className="h-4 w-4" />
            Classified Search
          </div>
        </div>
      </div>

      <DashboardFilters dataset={dataset} filters={filters} onChange={setFilters} />

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">1.1 Summary Metrics</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => (
          <KPICard key={kpi.title} kpi={kpi} index={index} />
        ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">1.2 Data Visualization</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {charts.length > 0 ? (
          charts.map((chart, index) => (
            <AnalyticsChart key={chart.title} config={chart} index={index} />
          ))
        ) : (
          <StatusPanel
            title="No chartable data"
            message="This dataset does not contain enough numeric and categorical information to build dashboard charts yet."
          />
        )}
        </div>
      </section>

      <div className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">1.3 Data Preview</h2>
        <div className="terminal-panel p-0">
          <div className="border-b border-border px-6 py-4 text-sm uppercase tracking-[0.08em] text-muted-foreground">
            Top 10 records // authorization required for full access
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-primary text-primary-foreground">
                  {filteredDataset.columns.map((col) => (
                    <th key={col.name} className="px-6 py-4 text-left font-mono uppercase tracking-[0.08em]">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDataset.rows.slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-b border-border/80">
                    {filteredDataset.columns.map((col) => (
                      <td
                        key={col.name}
                        className={`px-6 py-4 font-mono uppercase tracking-[0.06em] ${
                          col.name.toLowerCase().includes('salary') ? 'text-success' : 'text-foreground'
                        }`}
                      >
                        {typeof row[col.name] === 'number'
                          ? row[col.name].toLocaleString()
                          : String(row[col.name] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm uppercase tracking-[0.08em] text-muted-foreground">
            <span>[END OF PREVIEW - AUTHORIZATION REQUIRED FOR FULL ACCESS]</span>
            <Link to="/data">Page 01 // Open Full Table</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
