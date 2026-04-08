import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ScatterChart,
  Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Legend,
} from 'recharts';
import { ChartConfig } from '@/features/data/model/dataStore';

const PALETTES = {
  cyan: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
  amber: ['#fcd34d', '#f59e0b', '#d97706', '#b45309', '#78350f'],
  emerald: ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#166534'],
  rose: ['#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#881337'],
  mixed: ['#f5f5f5', '#ff5a5f', '#4cc24f', '#9ca3af', '#525252'],
} as const;

type PaletteKey = keyof typeof PALETTES;
type LocalChartType = ChartConfig['type'];

interface TooltipEntry {
  value?: string | number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <p className="mb-1 uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono uppercase tracking-[0.08em] text-foreground">
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

interface AnalyticsChartProps {
  config: ChartConfig;
  index: number;
}

const AnalyticsChart = ({ config, index }: AnalyticsChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<LocalChartType>(config.type);
  const [xLabel, setXLabel] = useState(config.xKey);
  const [yLabel, setYLabel] = useState(config.yKey);
  const [palette, setPalette] = useState<PaletteKey>('mixed');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(chartType === 'pie');
  const [curved, setCurved] = useState(true);

  const colors = PALETTES[palette];
  const isPieChart = chartType === 'pie';
  const chartData = useMemo(() => config.data, [config.data]);

  useEffect(() => {
    setShowLegend(chartType === 'pie');
  }, [chartType]);

  const exportPng = async () => {
    if (!chartRef.current) return;
    try {
      const url = await toPng(chartRef.current, { backgroundColor: '#0d0f14', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title.replace(/\s+/g, '_').toLowerCase()}.png`;
      a.click();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error occurred';
      console.error('Export failed:', errorMsg);
      alert(`Failed to export chart: ${errorMsg}`);
    }
  };

  const renderChart = () => {
    const commonProps = { data: chartData };
    const curveType = curved ? 'monotone' : 'linear';
    const grid = showGrid ? <CartesianGrid strokeDasharray="0" stroke="hsl(0 0% 32%)" /> : null;
    const legend = showLegend ? <Legend wrapperStyle={{ textTransform: 'uppercase', fontSize: '11px' }} /> : null;

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[1]} stopOpacity={0.9} />
                <stop offset="95%" stopColor={colors[1]} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'hsl(0 0% 60%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(0 0% 60%)' }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Area type={curveType} dataKey={config.yKey} stroke={colors[1]} fill={`url(#gradient-${index})`} strokeWidth={2} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'hsl(0 0% 60%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(0 0% 60%)' }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[index % colors.length]} radius={[0, 0, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'hsl(0 0% 60%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(0 0% 60%)' }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Line type={curveType} dataKey={config.yKey} stroke={colors[1]} strokeWidth={2} dot={{ fill: colors[1], strokeWidth: 0, r: 4 }} />
          </LineChart>
        );
      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {grid}
            <XAxis type="number" dataKey={config.xKey} name={xLabel} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'hsl(0 0% 60%)' }} />
            <YAxis type="number" dataKey={config.yKey} name={yLabel} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(0 0% 60%)' }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            {legend}
            <Scatter data={chartData} fill={colors[1]} />
          </ScatterChart>
        );
      case 'radar':
        return (
          <RadarChart outerRadius="70%" data={chartData}>
            <PolarGrid stroke="hsl(0 0% 32%)" />
            <PolarAngleAxis dataKey={config.xKey} tick={{ fill: 'hsl(0 0% 70%)', fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: 'hsl(0 0% 55%)', fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Radar dataKey={config.yKey} stroke={colors[1]} fill={colors[1]} fillOpacity={0.35} />
          </RadarChart>
        );
      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: xLabel, position: 'insideBottom', offset: -4, fill: 'hsl(0 0% 60%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'hsl(0 0% 60%)' }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[0]} />
            <Line type={curveType} dataKey={config.yKey} stroke={colors[1]} strokeWidth={2} dot={false} />
          </ComposedChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={chartData} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" innerRadius={45} outerRadius={82}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {legend}
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 + 0.12, duration: 0.2 }}
      className="terminal-panel group p-5"
      ref={chartRef}
    >
      <div className="mb-4 border border-border bg-background p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="terminal-label mb-2">Chart Type</p>
            <div className="flex flex-wrap gap-2">
              {(['bar', 'line', 'area', 'pie', 'scatter', 'radar', 'composed'] as LocalChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`border px-3 py-2 text-xs uppercase tracking-[0.08em] ${
                    chartType === type ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="terminal-label mb-2">Color Palette</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setPalette(key)}
                  className={`flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.08em] ${
                    palette === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  <span className="flex gap-1">{PALETTES[key].slice(0, 3).map((color) => <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />)}</span>
                  {key}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="terminal-label mb-2">X Label</p>
            <input value={xLabel} onChange={(e) => setXLabel(e.target.value)} className="terminal-input w-full" />
          </div>
          <div>
            <p className="terminal-label mb-2">Y Label</p>
            <input value={yLabel} onChange={(e) => setYLabel(e.target.value)} className="terminal-input w-full" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.08em] text-foreground">
          <label className="flex items-center gap-2"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} /> Legend</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={curved} onChange={(e) => setCurved(e.target.checked)} /> Curved</label>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="terminal-label">Data Visualization</p>
          <h3 className="mt-2 text-xl uppercase tracking-[0.08em] text-foreground">{config.title}</h3>
        </div>
        <button
          onClick={exportPng}
          className="border border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          title="Download as PNG"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`${isPieChart ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]' : 'h-72'}`}>
        <div className={isPieChart ? 'h-72' : 'h-full'}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        {isPieChart && (
          <div className="border border-border p-4">
            <p className="terminal-label mb-4">Degree Count</p>
            <div className="space-y-3">
              {chartData.map((datum, datumIndex) => (
                <div key={`${String(datum[config.xKey])}-${datumIndex}`} className="flex items-center justify-between gap-3 text-sm uppercase tracking-[0.08em]">
                  <div className="flex items-center gap-3">
                    <span
                      className="block h-3 w-3 border border-border"
                      style={{ backgroundColor: colors[datumIndex % colors.length] }}
                    />
                    <span className="text-foreground">{String(datum[config.xKey])}</span>
                  </div>
                  <span className="text-success">
                    {typeof datum[config.yKey] === 'number'
                      ? Number(datum[config.yKey]).toLocaleString()
                      : String(datum[config.yKey])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnalyticsChart;
