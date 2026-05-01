import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Download, Sparkles, Loader2, MessageSquare, BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { Dataset, generateAnalyticsHealthSummary, generateDemoCharts, generateDemoKPIs, ChartConfig } from '@/features/data/model/dataStore';
import { api, CorrelationResponse } from '@/features/data/api/dataApi';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import AnalyticsSidebar from '@/features/dashboard/components/AnalyticsSidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import StatusPanel from '@/shared/layout/StatusPanel';
import { Button } from '@/shared/components/ui/button';

const AnalyticsPage = () => {
  const { dataset, analysis, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [isRunningCorrelation, setIsRunningCorrelation] = useState(false);
  const [correlationResults, setCorrelationResults] = useState<CorrelationResponse | null>(null);
  const [correlationError, setCorrelationError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [aiGeneratedCharts, setAiGeneratedCharts] = useState<ChartConfig[]>([]);

  const handleChartGenerated = useCallback((chart: ChartConfig) => {
    setAiGeneratedCharts(prev => {
      const exists = prev.some(c => c.title === chart.title);
      if (exists) return prev;
      return [...prev, chart];
    });
  }, []);

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  const runAICorrelationTest = async () => {
    if (!dataset) return;
    setIsRunningCorrelation(true);
    setCorrelationError(null);
    setCorrelationResults(null);

    try {
      const results = await api.getAICorrelations(dataset.id);
      setCorrelationResults(results);
    } catch (err) {
      setCorrelationError(err instanceof Error ? err.message : 'Failed to run correlation test');
    } finally {
      setIsRunningCorrelation(false);
    }
  };

  const regionColumn = useMemo(
    () => dataset?.columns.find((column) => column.name.toLowerCase() === 'country' || column.name.toLowerCase() === 'region'),
    [dataset],
  );

  const regionOptions = useMemo(() => {
    if (!dataset || !regionColumn) return [];

    return [...new Set(
      dataset.rows
        .map((row) => String(row[regionColumn.name] ?? '').trim())
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right));
  }, [dataset, regionColumn]);

  const analyticsDataset = useMemo<Dataset | null>(() => {
    if (!dataset) return null;
    if (!regionColumn || selectedRegion === 'all') return dataset;

    const filteredRows = dataset.rows.filter((row) => String(row[regionColumn.name] ?? '').trim() === selectedRegion);

    return {
      ...dataset,
      rows: filteredRows,
      rowCount: filteredRows.length,
    };
  }, [dataset, regionColumn, selectedRegion]);

  const charts = useMemo(() => {
    const baseCharts = analysis?.chartRecommendations && analysis.chartRecommendations.length > 0
      ? analysis.chartRecommendations as ChartConfig[]
      : analyticsDataset ? generateDemoCharts(analyticsDataset) : [];
    
    if (aiGeneratedCharts.length > 0) {
      return [...baseCharts, ...aiGeneratedCharts];
    }
    return baseCharts;
  }, [analyticsDataset, analysis, aiGeneratedCharts]);
  const kpis = useMemo(() => (analyticsDataset ? generateDemoKPIs(analyticsDataset) : []), [analyticsDataset]);
  const analyticsHealth = useMemo(
    () => (analyticsDataset ? generateAnalyticsHealthSummary(analyticsDataset) : null),
    [analyticsDataset],
  );

  const downloadDossier = () => {
    if (!analyticsDataset) return;

    const dossier = [
      'INSIGHTFLOW ANALYTICS REPORT',
      `Dataset: ${analyticsDataset.name}`,
      `Region: ${selectedRegion === 'all' ? 'All' : selectedRegion}`,
      `Rows: ${analyticsDataset.rowCount}`,
      `Columns: ${analyticsDataset.columns.length}`,
      '',
      'KPIs',
      ...kpis.map((kpi) => `- ${kpi.label}: ${kpi.value}`),
      '',
      'Charts',
      ...charts.map((chart) => `- ${chart.title}`),
    ].join('\n');

    const blob = new Blob([dossier], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analyticsDataset.name.replace(/\s+/g, '_').toLowerCase()}_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isHydrating) {
    return <StatusPanel title="Loading analytics" message="Preparing comparative visualizations." />;
  }

  if (apiError) {
    return <StatusPanel title="Analytics unavailable" message={apiError} actionLabel="Retry" onAction={() => { void retryHydrate(); }} />;
  }

  if (!dataset) {
    return <StatusPanel title="No dataset loaded" message="Upload a dataset before opening analytics." actionLabel="Load Demo Dataset" onAction={() => { void loadDemo().catch(() => undefined); }} />;
  }

  return (
    <div className="space-y-6 p-8">
      {analysis && (
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Detected Data Type</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold text-foreground">
                {analysis.dataTypeLabel}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                analysis.dataType === 'SALES' ? 'bg-green-100 text-green-700' :
                analysis.dataType === 'MARKETING' ? 'bg-blue-100 text-blue-700' :
                analysis.dataType === 'INVENTORY' ? 'bg-purple-100 text-purple-700' :
                analysis.dataType === 'FINANCE' ? 'bg-amber-100 text-amber-700' :
                analysis.dataType === 'HR' ? 'bg-rose-100 text-rose-700' :
                'bg-muted text-muted-foreground'
              }`}>
                {analysis.dataType}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>{analysis.chartRecommendations?.length || 0} AI-generated charts</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-muted-foreground">Region</p>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[200px] rounded-lg border-border/50 bg-background">
              <SelectValue placeholder="Filter by Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              {regionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={downloadDossier}
            className="rounded-lg"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant={showSidebar ? 'default' : 'outline'}
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-lg"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            AI Chat
          </Button>
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

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Health Overview</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {analyticsHealth && [
            {
              label: 'Valid Rows',
              value: `${analyticsHealth.integrity.analyticsRows}/${analyticsHealth.integrity.totalRows}`,
              icon: CheckCircle2,
              color: 'text-green-600',
              bg: 'bg-green-50',
            },
            {
              label: 'Anomalies',
              value: String(analyticsHealth.integrity.removedEmptyRows + analyticsHealth.integrity.invalidNumericValues),
              icon: AlertTriangle,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
            {
              label: 'Risk Level',
              value: analyticsHealth.risk.level,
              icon: TrendingUp,
              color: analyticsHealth.risk.level === 'LOW' ? 'text-green-600' : 'text-amber-600',
              bg: analyticsHealth.risk.level === 'LOW' ? 'bg-green-50' : 'bg-amber-50',
            },
            {
              label: 'Coverage',
              value: analyticsHealth.branchCoverage.totalGroups > 0
                ? `${analyticsHealth.branchCoverage.includedGroups}/${analyticsHealth.branchCoverage.totalGroups}`
                : 'N/A',
              icon: PieChart,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-semibold text-foreground mt-0.5">{item.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Visualizations</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          {charts.slice(0, 20).map((chart, index) => (
            <AnalyticsChart key={`${chart.title}-${index}`} config={chart} index={index} />
          ))}
          <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
            <h4 className="text-base font-semibold text-foreground mb-4">Observations</h4>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  {analyticsHealth?.risk.metricName
                    ? `${analyticsHealth.risk.rule}. Current average is ${analyticsHealth.risk.average ?? 'N/A'}.`
                    : 'Risk indicator is unavailable.'}
                </p>
              </div>
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  Excluded {analyticsHealth?.branchCoverage.excludedGroups ?? 0} branch group(s) below minimum sample size.
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <p>
                  Data integrity removed {analyticsHealth?.integrity.removedEmptyRows ?? 0} empty rows and {analyticsHealth?.integrity.invalidNumericValues ?? 0} invalid values.
                </p>
              </div>
            </div>
            <Button
              onClick={runAICorrelationTest}
              disabled={isRunningCorrelation}
              className="w-full mt-6 rounded-lg"
            >
              {isRunningCorrelation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run AI Correlation
                </>
              )}
            </Button>

            {correlationError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {correlationError}
              </div>
            )}

            {correlationResults && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">AI Correlation Analysis</h4>
                </div>
                <p className="text-sm text-muted-foreground">{correlationResults.summary}</p>
                {correlationResults.correlations.length > 0 && (
                  <div className="space-y-2">
                    {correlationResults.correlations.map((corr, idx) => (
                      <div key={idx} className="rounded-lg border border-border/50 bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {corr.column1} ↔ {corr.column2}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            corr.strength === 'strong' ? 'bg-green-100 text-green-700' :
                            corr.strength === 'moderate' ? 'bg-amber-100 text-amber-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {corr.strength}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{corr.interpretation}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Coefficient: <span className="font-mono font-medium">{corr.coefficient}</span> (n={corr.sampleSize})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsPage;