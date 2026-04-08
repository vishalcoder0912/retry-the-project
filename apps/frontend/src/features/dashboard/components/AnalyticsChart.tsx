import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { ChartConfig } from '@/features/data/model/dataStore';

const COLORS = [
  'hsl(0 0% 94%)',
  'hsl(0 92% 64%)',
  'hsl(124 47% 52%)',
  'hsl(0 0% 72%)',
  'hsl(0 0% 30%)',
];

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
  const isPieChart = config.type === 'pie';

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
    const commonProps = { data: config.data };

    switch (config.type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.9} />
                <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="hsl(0 0% 32%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={config.yKey} stroke={COLORS[1]} fill={`url(#gradient-${index})`} strokeWidth={2} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="0" stroke="hsl(0 0% 32%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={config.yKey} fill={COLORS[index % COLORS.length]} radius={[0, 0, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="0" stroke="hsl(0 0% 32%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 60%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={config.yKey} stroke={COLORS[1]} strokeWidth={2} dot={{ fill: COLORS[1], strokeWidth: 0, r: 4 }} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={config.data} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" innerRadius={45} outerRadius={82}>
              {config.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
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
              {config.data.map((datum, datumIndex) => (
                <div key={`${String(datum[config.xKey])}-${datumIndex}`} className="flex items-center justify-between gap-3 text-sm uppercase tracking-[0.08em]">
                  <div className="flex items-center gap-3">
                    <span
                      className="block h-3 w-3 border border-border"
                      style={{ backgroundColor: COLORS[datumIndex % COLORS.length] }}
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
