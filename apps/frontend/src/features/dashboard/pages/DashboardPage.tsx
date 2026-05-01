import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/features/data/context/useData';
import KPICard from '@/features/dashboard/components/KPICard';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import DashboardFilters, { FilterState } from '@/features/dashboard/components/DashboardFilters';
import DataQualityPanel from '@/features/dashboard/components/DataQualityPanel';
import AnalyticsSidebar from '@/features/dashboard/components/AnalyticsSidebar';
import { generateDemoKPIs, generateDemoCharts, ChartConfig, KPI, analyzeDataQuality } from '@/features/data/model/dataStore';
import { Download, Sparkles, Layers, MessageSquare } from 'lucide-react';
import { exportDatasetCSV } from '@/features/data/utils/exportUtils';
import { AnimatePresence, motion } from 'framer-motion';
import StatusPanel from '@/shared/layout/StatusPanel';

const DashboardPage = () => {
  const { dataset, analysis, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {},
    columns: {},
  });
  const [showSidebar, setShowSidebar] = useState(false);
  const [aiGeneratedCharts, setAiGeneratedCharts] = useState<ChartConfig[]>([]);

  const handleChartGenerated = (chart: ChartConfig) => {
    setAiGeneratedCharts(prev => {
      const exists = prev.some(c => c.title === chart.title);
      if (exists) return prev;
      return [...prev, chart];
    });
  };

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

  const kpis = useMemo(() => {
    if (!filteredDataset) return [];
    if (analysis?.insights && analysis.insights.length > 0) {
      const aiKPIs: KPI[] = [];
      analysis.insights.forEach((insight: Record<string, unknown>) => {
        if (insight.type === 'summary' && insight.metrics) {
          const metrics = insight.metrics as Record<string, unknown>;
          if (metrics.totalRecords !== undefined) {
            aiKPIs.push({ label: 'Total Records', value: String(metrics.totalRecords), icon: 'rows' });
          }
          if (metrics.totalValue !== undefined) {
            aiKPIs.push({ label: `Total ${metrics.primaryMetric || 'Value'}`, value: String(metrics.totalValue), icon: 'chart' });
          }
          if (metrics.averageValue !== undefined) {
            aiKPIs.push({ label: `Avg ${metrics.primaryMetric || 'Value'}`, value: String(metrics.averageValue), icon: 'chart' });
          }
        }
        if (insight.type === 'top_performer' && insight.category) {
          aiKPIs.push({ label: `Top Performer`, value: String(insight.category), icon: 'star' });
        }
      });
      if (aiKPIs.length > 0) return aiKPIs;
    }
    return generateDemoKPIs(filteredDataset);
  }, [filteredDataset, analysis]);

  const charts = useMemo(() => {
    if (!filteredDataset) return [];
    const baseCharts = analysis?.chartRecommendations && analysis.chartRecommendations.length > 0
      ? analysis.chartRecommendations as ChartConfig[]
      : generateDemoCharts(filteredDataset);
    
    if (aiGeneratedCharts.length > 0) {
      return [...baseCharts, ...aiGeneratedCharts];
    }
    return baseCharts;
  }, [filteredDataset, analysis, aiGeneratedCharts]);

  const qualityReport = useMemo(() => {
    if (!dataset) return null;
    return analyzeDataQuality(dataset);
  }, [dataset]);

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
    <div className="min-h-screen bg-background p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {analysis && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Sparkles className="h-3 w-3" />
                  AI Insights
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {dataset.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {analysis ? (
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  {analysis.dataTypeLabel} • {filteredDataset.rowCount.toLocaleString()} records
                </span>
              ) : (
                `Analyzing ${dataset.name} • ${filteredDataset.rowCount.toLocaleString()} records`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportDatasetCSV(filteredDataset)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all text-sm font-medium text-muted-foreground"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <DashboardFilters dataset={dataset} filters={filters} onChange={setFilters} />

      {qualityReport && qualityReport.summary.qualityScore < 100 && (
        <DataQualityPanel qualityReport={qualityReport} />
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Key Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => (
            <KPICard key={kpi.label} kpi={kpi} index={index} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Visualizations</h3>
          <span className="text-sm text-muted-foreground">
            {charts.length} chart{charts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {charts.map((chart, index) => (
            <AnalyticsChart key={chart.title} config={chart} index={index} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showSidebar && (
          <AnalyticsSidebar 
            isOpen={showSidebar} 
            onClose={() => setShowSidebar(false)}
            onChartGenerated={handleChartGenerated}
            currentCharts={aiGeneratedCharts}
          />
        )}
      </AnimatePresence>

      {!showSidebar && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSidebar(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
        >
          <MessageSquare className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  );
};

export default DashboardPage;