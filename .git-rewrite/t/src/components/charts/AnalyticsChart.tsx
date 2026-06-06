import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { ChartConfig } from '@/lib/data-store';

const COLORS = [
  'hsl(190, 95%, 50%)',
  'hsl(270, 60%, 60%)',
  'hsl(150, 70%, 45%)',
  'hsl(38, 92%, 55%)',
  'hsl(340, 75%, 55%)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono text-foreground">
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

  const exportPng = async () => {
    if (!chartRef.current) return;
    try {
      const url = await toPng(chartRef.current, { backgroundColor: '#0d0f14', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title.replace(/\s+/g, '_').toLowerCase()}.png`;
      a.click();
    } catch (e) {
      console.error('Export failed', e);
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
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 16%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={config.yKey} stroke={COLORS[0]} fill={`url(#gradient-${index})`} strokeWidth={2} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 16%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={config.yKey} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 12%, 16%)" />
            <XAxis dataKey={config.xKey} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={config.yKey} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={config.data} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" outerRadius={80}>
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
      transition={{ delay: index * 0.1 + 0.3, duration: 0.4 }}
      className="glass rounded-xl p-5 group"
      ref={chartRef}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{config.title}</h3>
        <button
          onClick={exportPng}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Download as PNG"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()!}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default AnalyticsChart;
