import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Filter, Loader2, Sparkles } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { Dataset } from '@/features/data/model/dataStore';
import { useKPIEngine } from '@/features/dashboard/hooks/useKPIEngine';
import { api, CorrelationResponse } from '@/features/data/api/dataApi';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import StatusPanel from '@/shared/layout/StatusPanel';

const AnalyticsPage = () => {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [isRunningCorrelation, setIsRunningCorrelation] = useState(false);
  const [correlationResults, setCorrelationResults] = useState<CorrelationResponse | null>(null);
  const [correlationError, setCorrelationError] = useState<string | null>(null);

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

  const { analyticsBundle,kpis } = useKPIEngine(analyticsDataset);
  const charts = analyticsBundle?.charts ?? [];
  const analyticsHealth = analyticsBundle?.health ?? null;
  const insights = analyticsBundle?.insights ?? [];
  const missingColumnsSummary = analyticsHealth
    ? Object.entries(analyticsHealth.missingByColumn).filter(([,count]) => count > 0).map(([column,count]) => `${column} (${count})`).join(', ') || 'none detected'
    : 'none detected';
  const missingPercentageLabel = analyticsHealth ? analyticsHealth.metrics.missingPercentage.toFixed(2) : '0.00';

  const downloadDossier = () => {
    if (!analyticsDataset) return;

    const dossier = [
      'INSIGHTFLOW ANALYTICS DOSSIER',
      `DATASET: ${analyticsDataset.name}`,
      `REGION FILTER: ${selectedRegion === 'all' ? 'ALL' : selectedRegion}`,
      `ROWS: ${analyticsDataset.rowCount}`,
      `COLUMNS: ${analyticsDataset.columns.length}`,
      '',
      'KPIS',
      ...kpis.map((kpi) => `- ${kpi.title}: ${kpi.value}`),
      '',
      'CHARTS',
      ...charts.map((chart) => `- ${chart.title}`),
    ].join('\n');

    const blob = new Blob([dossier], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analyticsDataset.name.replace(/\s+/g, '_').toLowerCase()}_${selectedRegion === 'all' ? 'all' : selectedRegion.toLowerCase()}_dossier.txt`;
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
    <div className="space-y-8 px-10 py-10">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-3">
          <div className="terminal-label">Region Filter</div>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="h-12 min-w-[220px] rounded-none border-border bg-card text-sm uppercase tracking-[0.08em]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Region" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-border bg-card text-foreground">
              <SelectItem value="all" className="text-xs uppercase tracking-[0.08em]">All Regions</SelectItem>
              {regionOptions.map((option) => (
                <SelectItem key={option} value={option} className="text-xs uppercase tracking-[0.08em]">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button onClick={downloadDossier} className="terminal-button-inverse gap-2">
          <Download className="h-4 w-4" />
          Download Dossier
        </button>
      </div>

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">4.1 Dimensional Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {analyticsHealth && [
            {
              label: 'Integrity Score',
              value: `${analyticsHealth.metrics.integrityScore.toFixed(2)}%`,
            },
            {
              label: 'Missing Data',
              value: `${analyticsHealth.metrics.missingPercentage.toFixed(2)}%`,
            },
            {
              label: 'Risk Indicator',
              value: analyticsHealth.metrics.riskLevel,
            },
            {
              label: 'Validation Load',
              value: `${analyticsHealth.metrics.validRows}/${analyticsHealth.metrics.totalRows}`,
            },
          ].map((item) => (
            <div key={item.label} className="terminal-panel p-6">
              <p className="terminal-label">{item.label}</p>
              <p className="mt-4 text-4xl uppercase tracking-[0.08em] text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">4.2 Comparative Visualization</h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {charts.slice(0, 6).map((chart, index) => (
            <AnalyticsChart key={`${chart.title}-${index}`} config={chart} index={index} />
          ))}
          <div className="terminal-panel p-6">
            <h3 className="text-2xl uppercase tracking-[0.08em] text-foreground">4.3 Cross-Filter Observations</h3>
            <div className="mt-6 space-y-6 border-t border-border pt-6 text-base leading-8 text-muted-foreground">
              <div className="flex gap-4">
                <AlertTriangle className="mt-1 h-5 w-5 text-accent" />
                <p>
                  Risk level is {analyticsHealth?.metrics.riskLevel ?? 'LOW'} with {analyticsHealth?.metrics.duplicateCount ?? 0} duplicate row(s), {analyticsHealth?.metrics.outlierCount ?? 0} outlier row(s), and {missingPercentageLabel}% missing cells.
                </p>
              </div>
              <div className="flex gap-4">
                <AlertTriangle className="mt-1 h-5 w-5 text-accent" />
                <p>
                  Missing values by column: {missingColumnsSummary}.
                </p>
              </div>
              <div className="flex gap-4">
                <CheckCircle2 className="mt-1 h-5 w-5 text-success" />
                <p>
                  Cleaned analytics dataset retained {analyticsHealth?.metrics.validRows ?? 0} valid row(s) from {analyticsHealth?.metrics.totalRows ?? 0} total input row(s) after duplicate and outlier handling.
                </p>
              </div>
              {insights.map((insight) => (
                <div key={insight} className="flex gap-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-success" />
                  <p>{insight}</p>
                </div>
              ))}
            </div>
            <button
              onClick={runAICorrelationTest}
              disabled={isRunningCorrelation}
              className="terminal-button mt-8 w-full justify-center disabled:opacity-50"
            >
              {isRunningCorrelation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Correlations...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run AI Correlation Test
                </>
              )}
            </button>

            {correlationError && (
              <div className="mt-4 rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {correlationError}
              </div>
            )}

            {correlationResults && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 border-t border-border pt-4">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <h4 className="font-semibold uppercase tracking-wider">AI Correlation Analysis</h4>
                </div>
                <p className="text-sm text-muted-foreground">{correlationResults.summary}</p>
                {correlationResults.correlations.length > 0 && (
                  <div className="space-y-3">
                    {correlationResults.correlations.map((corr, idx) => (
                      <div key={idx} className="rounded border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {corr.column1} ↔ {corr.column2}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${
                            corr.strength === 'strong' ? 'bg-success/20 text-success' :
                            corr.strength === 'moderate' ? 'bg-warning/20 text-warning' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {corr.strength}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{corr.interpretation}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
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
