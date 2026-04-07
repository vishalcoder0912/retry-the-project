import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { Dataset } from '@/features/data/model/dataStore';

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
  const stringColumns = useMemo(
    () => dataset.columns.filter((column) => column.type === 'string'),
    [dataset.columns],
  );

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};

    stringColumns.forEach((column) => {
      map[column.name] = [...new Set(dataset.rows.map((row) => String(row[column.name] ?? '')))]
        .filter(Boolean)
        .sort();
    });

    return map;
  }, [dataset.rows, stringColumns]);

  const activeCount =
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    Object.values(filters.columns).filter(Boolean).length;

  const clearAll = () => onChange({ dateRange: { from: undefined, to: undefined }, columns: {} });

  const setColumnFilter = (columnName: string, value: string) =>
    onChange({ ...filters, columns: { ...filters.columns, [columnName]: value } });

  const removeColumnFilter = (columnName: string) => {
    const nextColumns = { ...filters.columns };
    delete nextColumns[columnName];
    onChange({ ...filters, columns: nextColumns });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-wrap items-center gap-3"
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-9 gap-2 font-mono text-xs border-border bg-card hover:bg-secondary',
              filters.dateRange.from && 'border-primary/40 text-primary',
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {filters.dateRange.from
              ? `${format(filters.dateRange.from, 'MMM d')}${filters.dateRange.to ? ` - ${format(filters.dateRange.to, 'MMM d')}` : ''}`
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

      {stringColumns.map((column) => (
        <Select
          key={column.name}
          value={filters.columns[column.name] || ''}
          onValueChange={(value) => setColumnFilter(column.name, value)}
        >
          <SelectTrigger
            className={cn(
              'h-9 w-auto min-w-[120px] gap-2 font-mono text-xs border-border bg-card',
              filters.columns[column.name] && 'border-primary/40 text-primary',
            )}
          >
            <SelectValue placeholder={column.name} />
          </SelectTrigger>
          <SelectContent>
            {uniqueValues[column.name]?.map((value) => (
              <SelectItem key={value} value={value} className="text-xs font-mono">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {activeCount > 0 && (
        <div className="flex items-center gap-2 ml-1">
          {Object.entries(filters.columns)
            .filter(([, value]) => value)
            .map(([columnName, value]) => (
              <Badge
                key={columnName}
                variant="secondary"
                className="gap-1 text-xs font-mono cursor-pointer hover:bg-destructive/20"
                onClick={() => removeColumnFilter(columnName)}
              >
                {columnName}: {value}
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
