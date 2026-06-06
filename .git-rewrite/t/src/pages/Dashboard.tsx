import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import KPICard from '@/components/kpi/KPICard';
import AnalyticsChart from '@/components/charts/AnalyticsChart';
import DashboardFilters, { FilterState } from '@/components/filters/DashboardFilters';
import { generateDemoKPIs, generateDemoCharts } from '@/lib/data-store';
import { Sparkles, Table2, ArrowRight, Download } from 'lucide-react';
import { exportDatasetCSV } from '@/lib/export-utils';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { dataset, loadDemo } = useData();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    columns: {},
  });

  useEffect(() => {
    if (!dataset) loadDemo();
  }, []);

  const filteredDataset = useMemo(() => {
    if (!dataset) return null;
    const filtered = dataset.rows.filter(row => {
      for (const [col, val] of Object.entries(filters.columns)) {
        if (val && String(row[col]) !== val) return false;
      }
      return true;
    });
    return { ...dataset, rows: filtered, rowCount: filtered.length };
  }, [dataset, filters]);

  if (!dataset || !filteredDataset) return null;

  const kpis = generateDemoKPIs(filteredDataset);
  const charts = generateDemoCharts(filteredDataset);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyzing <span className="font-mono text-primary">{dataset.name}</span> · {filteredDataset.rowCount.toLocaleString()} of {dataset.rowCount.toLocaleString()} records
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

      {/* Filters */}
      <DashboardFilters dataset={dataset} filters={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KPICard key={kpi.label} kpi={kpi} index={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <AnalyticsChart key={chart.title} config={chart} index={i} />
        ))}
      </div>

      {/* Data Preview */}
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
            {filteredDataset.columns.length} columns · first 10 rows
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {filteredDataset.columns.map(col => (
                  <th key={col.name} className="text-left py-2 px-3 font-mono text-muted-foreground font-medium">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDataset.rows.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  {filteredDataset.columns.map(col => (
                    <td key={col.name} className="py-2 px-3 font-mono text-foreground">
                      {typeof row[col.name] === 'number'
                        ? row[col.name].toLocaleString()
                        : String(row[col.name])}
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

export default Dashboard;
