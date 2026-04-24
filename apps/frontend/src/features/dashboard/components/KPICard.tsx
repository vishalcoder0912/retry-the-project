import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, DollarSign, Package, Percent, Star, Table2, Columns3, BarChart3, Shield, Globe, Code, AlertTriangle, Siren } from 'lucide-react';
import { KPI } from '@/features/data/model/dataStore';

const iconMap: Record<string, React.ElementType> = {
  dollar: DollarSign,
  package: Package,
  percent: Percent,
  star: Star,
  rows: Table2,
  columns: Columns3,
  chart: BarChart3,
  shield: Shield,
  globe: Globe,
  code: Code,
  alert: AlertTriangle,
  risk: Siren,
};

const statusColors: Record<string, string> = {
  good: 'border-success/40 bg-success/10 text-success',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const trendColors: Record<string, string> = {
  up: 'text-success',
  down: 'text-destructive',
  stable: 'text-muted-foreground',
};

interface KPICardProps {
  kpi: KPI;
  index: number;
}

const KPICard = ({ kpi, index }: KPICardProps) => {
  const Icon = iconMap[kpi.icon] || DollarSign;
  const trend = kpi.trend ?? 'stable';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const statusClass = kpi.status ? statusColors[kpi.status] : 'border-border bg-card text-muted-foreground';
  const sparklineValues = kpi.sparkline ?? [];
  const maxValue = sparklineValues.length > 0 ? Math.max(...sparklineValues) : 0;
  const minValue = sparklineValues.length > 0 ? Math.min(...sparklineValues) : 0;
  const range = maxValue - minValue || 1;
  const points = sparklineValues.map((value, pointIndex) => {
    const x = sparklineValues.length === 1 ? 100 : (pointIndex / Math.max(sparklineValues.length - 1, 1)) * 100;
    const y = 28 - (((value - minValue) / range) * 24);
    return `${x},${y}`;
  }).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="terminal-panel p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="terminal-label flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {kpi.title}
          </div>
          {kpi.insight && (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {kpi.insight}
            </p>
          )}
        </div>
        {kpi.status && (
          <div className={`shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClass}`}>
            {kpi.status}
          </div>
        )}
      </div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl uppercase tracking-[0.06em] text-foreground">{kpi.value}</p>
          {kpi.change !== undefined ? (
            <div className={`mt-3 flex items-center gap-1 text-xs uppercase tracking-[0.08em] ${trendColors[trend]}`}>
              <TrendIcon className="h-3 w-3" />
              {trend} {Math.abs(kpi.change).toFixed(2)}%
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">
              <Minus className="h-3 w-3" />
              Baseline
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {sparklineValues.length > 1 && (
            <svg viewBox="0 0 100 30" className="h-8 w-24">
              <polyline
                fill="none"
                stroke={kpi.status === 'good' ? 'hsl(var(--success))' : kpi.status === 'critical' ? 'hsl(var(--destructive))' : '#eab308'}
                strokeWidth="2"
                points={points}
              />
            </svg>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default KPICard;
