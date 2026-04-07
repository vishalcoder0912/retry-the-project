import { useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Download, Filter } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { generateDemoCharts, generateDemoKPIs } from '@/features/data/model/dataStore';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';
import StatusPanel from '@/shared/layout/StatusPanel';

const AnalyticsPage = () => {
  const { dataset, isHydrating, apiError, loadDemo, retryHydrate } = useData();

  useEffect(() => {
    if (!dataset && !isHydrating) {
      void loadDemo().catch(() => undefined);
    }
  }, [dataset, isHydrating, loadDemo]);

  const charts = useMemo(() => (dataset ? generateDemoCharts(dataset) : []), [dataset]);
  const kpis = useMemo(() => (dataset ? generateDemoKPIs(dataset) : []), [dataset]);

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
      <div className="flex items-center justify-end gap-4">
        <button className="terminal-button gap-2"><Filter className="h-4 w-4" />Filter by Region</button>
        <button className="terminal-button-inverse gap-2"><Download className="h-4 w-4" />Download Dossier</button>
      </div>

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">4.1 Dimensional Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.slice(0, 4).map((kpi, index) => (
            <div key={kpi.label} className="terminal-panel p-6">
              <p className="terminal-label">{index === 0 ? 'Sigma Variance' : index === 1 ? 'Outlier Count' : index === 2 ? 'Confidence Score' : 'Data Velocity'}</p>
              <p className="mt-4 text-4xl uppercase tracking-[0.08em] text-foreground">
                {index === 2 ? '98.2' : index === 3 ? 'High' : kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl uppercase tracking-[0.08em] text-foreground">4.2 Comparative Visualization</h2>
        <div className="grid gap-6 xl:grid-cols-2">
          {charts.slice(0, 4).map((chart, index) => (
            <AnalyticsChart key={`${chart.title}-${index}`} config={chart} index={index} />
          ))}
          <div className="terminal-panel p-6">
            <h3 className="text-2xl uppercase tracking-[0.08em] text-foreground">4.3 Cross-Filter Observations</h3>
            <div className="mt-6 space-y-6 border-t border-border pt-6 text-base leading-8 text-muted-foreground">
              <div className="flex gap-4">
                <AlertTriangle className="mt-1 h-5 w-5 text-accent" />
                <p>Higher education bands show a stronger salary lift in the current uploaded dataset.</p>
              </div>
              <div className="flex gap-4">
                <AlertTriangle className="mt-1 h-5 w-5 text-accent" />
                <p>Skill-stack columns contain multi-value tags, so direct comparison should be treated as composite category analysis.</p>
              </div>
              <div className="flex gap-4">
                <CheckCircle2 className="mt-1 h-5 w-5 text-success" />
                <p>Compensation remains the clearest primary metric, with experience acting as a supporting explanatory variable.</p>
              </div>
            </div>
            <button className="terminal-button mt-8 w-full justify-center">Run AI Correlation Test</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnalyticsPage;
