import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Package, Percent, Star, Table2, Columns3, BarChart3 } from 'lucide-react';
import { KPI } from '@/features/data/model/dataStore';

const iconMap: Record<string, React.ElementType> = {
  dollar: DollarSign,
  package: Package,
  percent: Percent,
  star: Star,
  rows: Table2,
  columns: Columns3,
  chart: BarChart3,
};

interface KPICardProps {
  kpi: KPI;
  index: number;
}

const KPICard = ({ kpi, index }: KPICardProps) => {
  const Icon = iconMap[kpi.icon] || DollarSign;
  const isPositive = (kpi.change ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="terminal-panel p-6"
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="terminal-label">{kpi.label}</div>
        {kpi.change !== undefined && (
          <div className={`flex items-center gap-1 text-xs uppercase tracking-[0.08em] ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(kpi.change)}%
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-4">
        <p className="text-4xl uppercase tracking-[0.06em] text-foreground">{kpi.value}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </motion.div>
  );
};

export default KPICard;
