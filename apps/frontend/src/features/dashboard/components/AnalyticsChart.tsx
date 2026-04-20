import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, SlidersHorizontal } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ScatterChart,
  Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Legend,
} from 'recharts';
import { ChartConfig } from '@/features/data/model/dataStore';
import { Input } from '@/shared/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { Switch } from '@/shared/components/ui/switch';

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
    <div className="glass rounded-lg px-4 py-3 text-sm">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-muted-foreground">
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
  const chartData = useMemo(() => {
    const data = config.data || [];
    if (chartType === 'bar' || chartType === 'pie') {
      return [...data].sort((a, b) => Number(a[config.yKey] ?? 0) - Number(b[config.yKey] ?? 0));
    }
    return data;
  }, [config.data, chartType, config.yKey]);

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
    const legend = (showLegend && !isPieChart) ? (
      <Legend
        wrapperStyle={{ fontSize: '14px', paddingTop: '20px', paddingBottom: '10px', textTransform: 'none' }}
        iconSize={20}
        iconType="rect"
        align="center"
        verticalAlign="bottom"
        layout="horizontal"
      />
    ) : null;

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps} margin={{ top: 30, right: 30, bottom: 90, left: 90 }}>
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[1]} stopOpacity={0.9} />
                <stop offset="95%" stopColor={colors[1]} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dy: 10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: xLabel, position: 'bottom', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dy: 15 }} />
            <YAxis tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dx: -10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: yLabel, angle: -90, position: 'left', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dx: -15 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Area type={curveType} dataKey={config.yKey} stroke={colors[1]} fill={`url(#gradient-${index})`} strokeWidth={4} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps} margin={{ top: 30, right: 30, bottom: 90, left: 90 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dy: 10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: xLabel, position: 'bottom', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dy: 15 }} />
            <YAxis tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dx: -10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: yLabel, angle: -90, position: 'left', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dx: -15 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[index % colors.length]} radius={[0, 0, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps} margin={{ top: 30, right: 30, bottom: 90, left: 90 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dy: 10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: xLabel, position: 'bottom', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dy: 15 }} />
            <YAxis tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dx: -10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: yLabel, angle: -90, position: 'left', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dx: -15 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Line type={curveType} dataKey={config.yKey} stroke={colors[1]} strokeWidth={4} dot={{ fill: colors[1], strokeWidth: 0, r: 5 }} />
          </LineChart>
        );
      case 'scatter':
        return (
          <ScatterChart {...commonProps} margin={{ top: 30, right: 30, bottom: 90, left: 90 }}>
            {grid}
            <XAxis type="number" dataKey={config.xKey} name={xLabel} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dy: 10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: xLabel, position: 'bottom', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dy: 15 }} />
            <YAxis type="number" dataKey={config.yKey} name={yLabel} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dx: -10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: yLabel, angle: -90, position: 'left', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dx: -15 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            {legend}
            <Scatter data={chartData} fill={colors[1]} />
          </ScatterChart>
        );
      case 'radar':
        return (
          <RadarChart outerRadius="75%" data={chartData} margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
            <PolarGrid stroke="hsl(0 0% 32%)" />
            <PolarAngleAxis dataKey={config.xKey} tick={{ fill: 'hsl(0 0% 75%)', fontSize: 14 }} />
            <PolarRadiusAxis tick={{ fill: 'hsl(0 0% 60%)', fontSize: 13 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Radar dataKey={config.yKey} stroke={colors[1]} fill={colors[1]} fillOpacity={0.35} />
          </RadarChart>
        );
      case 'composed':
        return (
          <ComposedChart {...commonProps} margin={{ top: 30, right: 30, bottom: 90, left: 90 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dy: 10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: xLabel, position: 'bottom', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dy: 15 }} />
            <YAxis tick={{ fontSize: 14, fill: 'hsl(0 0% 70%)', dx: -10 }} axisLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} tickLine={{ stroke: 'hsl(0 0% 40%)', strokeWidth: 1 }} label={{ value: yLabel, angle: -90, position: 'left', offset: 55, fill: 'hsl(0 0% 85%)', fontSize: 15, fontWeight: 500, dx: -15 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[0]} />
            <Line type={curveType} dataKey={config.yKey} stroke={colors[1]} strokeWidth={4} dot={false} />
          </ComposedChart>
        );
      case 'pie':
        return (
          <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
            <Pie data={chartData} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" innerRadius={55} outerRadius={100}>
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
      className="terminal-panel group p-6"
      ref={chartRef}
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex-1">
          <p className="terminal-label">Data Visualization</p>
          <h3 className="mt-2 text-2xl uppercase tracking-[0.08em] text-foreground">{config.title}</h3>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 border border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                title="Customize chart"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Customize
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto border-border bg-card sm:max-w-md">
              <SheetHeader className="border-b border-border pb-6">
                <SheetTitle className="text-xl uppercase tracking-[0.08em] text-foreground">Chart Customization</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Adjust chart type, palette, labels, and display options for this visualization.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 pt-6">
                <div className="border border-border bg-background p-5">
                  <p className="terminal-label mb-4 text-sm">Chart Type</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(['bar', 'line', 'area', 'pie', 'scatter', 'radar', 'composed'] as LocalChartType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setChartType(type);
                        }}
                        className={`border px-4 py-3 text-sm transition-colors ${
                          chartType === type ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-border bg-background p-5">
                  <p className="terminal-label mb-4 text-sm">Color Palette</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPalette(key);
                        }}
                        className={`flex items-center gap-3 border px-4 py-3 text-sm transition-colors ${
                          palette === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        <span className="flex gap-1">
                          {PALETTES[key].slice(0, 3).map((color) => (
                            <span key={color} className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-border bg-background p-5">
                    <p className="terminal-label mb-3 text-sm">X Label</p>
                    <Input
                      value={xLabel}
                      onChange={(e) => {
                        setXLabel(e.target.value);
                      }}
                      className="rounded-none border-border bg-card text-base"
                    />
                  </div>
                  <div className="border border-border bg-background p-5">
                    <p className="terminal-label mb-3 text-sm">Y Label</p>
                    <Input
                      value={yLabel}
                      onChange={(e) => {
                        setYLabel(e.target.value);
                      }}
                      className="rounded-none border-border bg-card text-base"
                    />
                  </div>
                </div>

                <div className="border border-border bg-background p-5">
                  <p className="terminal-label mb-4 text-sm">Display Options</p>
                  <div className="space-y-5 text-sm text-foreground">
                    <label className="flex items-center justify-between gap-4">
                      <span>Grid</span>
                      <Switch checked={showGrid} onCheckedChange={(checked) => setShowGrid(checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>Legend</span>
                      <Switch checked={showLegend} onCheckedChange={(checked) => setShowLegend(checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>Curved</span>
                      <Switch checked={curved} onCheckedChange={(checked) => setCurved(checked)} />
                    </label>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <button
            type="button"
            onClick={exportPng}
            className="border border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            title="Download as PNG"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default AnalyticsChart;
