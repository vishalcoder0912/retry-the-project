import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/features/data/context/useData';
import KPICard from '@/features/dashboard/components/KPICard';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import DashboardFilters, { FilterState } from '@/features/dashboard/components/DashboardFilters';
import { generateDemoKPIs, generateDemoCharts } from '@/features/data/model/dataStore';
import { Sparkles, Table2, ArrowRight, Download } from 'lucide-react';
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

  const kpis = generateDemoKPIs(filteredDataset);
  const charts = generateDemoCharts(filteredDataset);

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyzing <span className="font-mono text-primary">{dataset.name}</span> &middot; {filteredDataset.rowCount.toLocaleString()} of {dataset.rowCount.toLocaleString()} records
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportDatasetCSV(filteredDataset)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <Link
            to="/chat"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Ask AI
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </motion.div>

      <DashboardFilters dataset={dataset} filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={kpi.label} kpi={kpi} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Table2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Data Preview</h3>
          <span className="text-xs text-muted-foreground font-mono ml-auto">
            {filteredDataset.columns.length} columns &middot; first 10 rows
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {filteredDataset.columns.map((col) => (
                  <th key={col.name} className="text-left py-2 px-3 font-mono text-muted-foreground font-medium">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDataset.rows.slice(0, 10).map((row, index) => (
                <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  {filteredDataset.columns.map((col) => (
                    <td key={col.name} className="py-2 px-3 font-mono text-foreground">
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
      </motion.div>
    </div>
  );
};

export default DashboardPage;
