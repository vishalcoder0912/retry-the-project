import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dataset } from '@/lib/data-store';

export interface FilterState {
  dateRange: { from?: Date; to?: Date };
  columns: Record<string, string>;
}

interface DashboardFiltersProps {
  dataset: Dataset;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const DashboardFilters = ({ dataset, filters, onChange }: DashboardFiltersProps) => {
  const [open, setOpen] = useState(false);

  const stringColumns = useMemo(
    () => dataset.columns.filter(c => c.type === 'string'),
    [dataset.columns]
  );

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    stringColumns.forEach(col => {
      const vals = [...new Set(dataset.rows.map(r => String(r[col.name])))].sort();
      map[col.name] = vals;
    });
    return map;
  }, [dataset.rows, stringColumns]);

  const activeCount =
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    Object.values(filters.columns).filter(Boolean).length;

  const clearAll = () =>
    onChange({ dateRange: { from: undefined, to: undefined }, columns: {} });

  const setColumnFilter = (col: string, val: string) =>
    onChange({ ...filters, columns: { ...filters.columns, [col]: val } });

  const removeColumnFilter = (col: string) => {
    const next = { ...filters.columns };
    delete next[col];
    onChange({ ...filters, columns: next });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-wrap items-center gap-3"
    >
      {/* Date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 gap-2 font-mono text-xs border-border bg-card hover:bg-secondary',
              filters.dateRange.from && 'border-primary/40 text-primary'
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {filters.dateRange.from
              ? `${format(filters.dateRange.from, 'MMM d')}${filters.dateRange.to ? ` – ${format(filters.dateRange.to, 'MMM d')}` : ''}`
              : 'Date range'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
            onSelect={(range) =>
              onChange({ ...filters, dateRange: { from: range?.from, to: range?.to } })
            }
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Column filters */}
      {stringColumns.map(col => (
        <Select
          key={col.name}
          value={filters.columns[col.name] || ''}
          onValueChange={v => setColumnFilter(col.name, v)}
        >
          <SelectTrigger
            className={cn(
              'h-9 w-auto min-w-[120px] gap-2 font-mono text-xs border-border bg-card',
              filters.columns[col.name] && 'border-primary/40 text-primary'
            )}
          >
            <SelectValue placeholder={col.name} />
          </SelectTrigger>
          <SelectContent>
            {uniqueValues[col.name]?.map(val => (
              <SelectItem key={val} value={val} className="text-xs font-mono">
                {val}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Active filter badges */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 ml-1">
          {Object.entries(filters.columns)
            .filter(([, v]) => v)
            .map(([col, val]) => (
              <Badge
                key={col}
                variant="secondary"
                className="gap-1 text-xs font-mono cursor-pointer hover:bg-destructive/20"
                onClick={() => removeColumnFilter(col)}
              >
                {col}: {val}
                <X className="w-3 h-3" />
              </Badge>
            ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            Clear all
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default DashboardFilters;
