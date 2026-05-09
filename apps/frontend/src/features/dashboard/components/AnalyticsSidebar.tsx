import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Bot, BarChart3, Loader2, RefreshCw, Filter, PieChart, LineChart, BarChart3 as BarIcon } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { ChartConfig } from '@/features/data/model/dataStore';
import { processQuery } from '@/features/dashboard/utils/dashboardController';

interface AnalyticsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChartGenerated?: (chart: ChartConfig) => void;
  onChartModified?: (chart: ChartConfig) => void;
  onFilterChange?: (filters: Record<string, string>) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'chart' | 'insight' | 'action' | 'error';
  chartConfig?: ChartConfig;
  chartAction?: 'generate' | 'modify' | 'delete';
  insightData?: InsightData;
}

interface InsightData {
  metric?: string;
  value?: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  comparisons?: string[];
}

const AnalyticsSidebar = ({ isOpen, onClose, onChartGenerated, onChartModified, onFilterChange }: AnalyticsSidebarProps) => {
  const { dataset, analysis } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedCharts, setGeneratedCharts] = useState<ChartConfig[]>([]);
  const [currentFilters, setCurrentFilters] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Hi! I'm your AI analytics assistant with full dashboard control. I can:

**Chart Commands:**
• "Create a bar chart for salary by country"
• "Change chart to line"
• "Show scatter plot"
• "Delete last chart"

**Data Commands:**
• "Filter by country = USA"
• "Show only senior roles"
• "Clear all filters"

**Analysis Commands:**
• "Show top 5 by revenue"
• "Compare metrics"
• "What are the trends?"

What would you like to do?`,
          type: 'text'
        }
      ]);
    }
  }, [isOpen, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateChartFromQuery = useCallback((query: string, existingChart?: ChartConfig): ChartConfig | null => {
    if (!dataset) return null;
    
    const q = query.toLowerCase();
    const colsOriginal = dataset.columns.map(c => c.name);
    const rows = dataset.rows;
    
    let xKey = '';
    let yKey = '';
    let chartType = existingChart?.type || 'bar';
    let aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum';
    
    const numericCols = colsOriginal.filter(c => {
      const col = dataset.columns.find(col => col.name === c);
      return col?.type === 'number';
    });
    const catCols = colsOriginal.filter(c => {
      const col = dataset.columns.find(col => col.name === c);
      return col?.type === 'string';
    });
    
    const findCol = (patterns: string[], list: string[]) => {
      for (const p of patterns) {
        const idx = list.findIndex(c => c.includes(p.toLowerCase()));
        if (idx !== -1) return colsOriginal[idx];
      }
      return list[0];
    };
    
    xKey = findCol(['country', 'region', 'city', 'category', 'education', 'job', 'role', 'gender', 'status'], catCols) || colsOriginal[0];
    yKey = findCol(['salary', 'revenue', 'profit', 'amount', 'value', 'bonus', 'experience', 'count', 'total'], numericCols) || numericCols[1] || colsOriginal[1];
    
    if (q.includes('line') || q.includes('trend') || q.includes('over time') || q.includes('growth')) {
      chartType = 'line';
    } else if (q.includes('pie') || q.includes('distribution') || q.includes('percentage') || q.includes('share')) {
      chartType = 'pie';
    } else if (q.includes('scatter') || q.includes('correlation') || q.includes('vs')) {
      chartType = 'scatter';
    } else if (q.includes('area') || q.includes('growth')) {
      chartType = 'area';
    } else if (q.includes('bar')) {
      chartType = 'bar';
    } else if (q.includes('radar')) {
      chartType = 'radar';
    }
    
    if (q.includes('average') || q.includes('avg') || q.includes('mean')) {
      aggregation = 'avg';
    } else if (q.includes('count') || q.includes('total people') || q.includes('how many')) {
      aggregation = 'count';
    } else if (q.includes('minimum') || q.includes('min')) {
      aggregation = 'min';
    } else if (q.includes('maximum') || q.includes('max')) {
      aggregation = 'max';
    }
    
    const xKeyOriginal = colsOriginal.find(c => c.toLowerCase() === xKey) || colsOriginal[0];
    const yKeyOriginal = numericCols.find(c => c.toLowerCase() === yKey) || numericCols[0] || colsOriginal.find(c => c !== xKeyOriginal);
    
    const dataMap: Record<string, number> = {};
    const yKeyActual = yKeyOriginal;
    
    rows.forEach((row: Record<string, unknown>) => {
      const xVal = String(row[xKeyOriginal] || 'Unknown');
      let yVal = Number(row[yKeyActual]) || 0;
      
      if (aggregation === 'count') {
        yVal = 1;
      } else if (aggregation === 'min') {
        yVal = Number(row[yKeyActual]) || 0;
      } else if (aggregation === 'max') {
        yVal = Number(row[yKeyActual]) || 0;
      }
      
      if (!dataMap[xVal]) dataMap[xVal] = 0;
      
      if (aggregation === 'count') {
        dataMap[xVal] += 1;
      } else if (aggregation === 'avg') {
        dataMap[xVal] += yVal;
      } else {
        dataMap[xVal] += yVal;
      }
    });
    
    let data = Object.entries(dataMap)
      .map(([name, value]) => ({ [xKeyOriginal]: name, [yKeyActual]: aggregation === 'avg' && dataMap[name] > 0 ? value / rows.filter((r: Record<string, unknown>) => String(r[xKeyOriginal]) === name).length : value }))
      .filter(d => d[yKeyActual] !== undefined && d[yKeyActual] !== null);
    
    if (aggregation === 'avg') {
      const counts: Record<string, number> = {};
      rows.forEach((row: Record<string, unknown>) => {
        const xVal = String(row[xKeyOriginal] || 'Unknown');
        counts[xVal] = (counts[xVal] || 0) + 1;
      });
      data = data.map(d => ({
        ...d,
        [yKeyActual]: dataMap[d[xKeyOriginal] as string] / (counts[d[xKeyOriginal] as string] || 1)
      }));
    }
    
    data.sort((a, b) => Number(b[yKeyActual] ?? 0) - Number(a[yKeyActual] ?? 0));
    data = data.slice(0, 10);
    
    if (data.length === 0) return null;
    
    const chartTitle = existingChart 
      ? `Modified: ${yKeyActual.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} by ${xKeyOriginal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`
      : `${aggregation === 'avg' ? 'Average ' : ''}${yKeyActual.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} by ${xKeyOriginal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    
    return {
      type: chartType as ChartConfig['type'],
      title: chartTitle,
      xKey: xKeyOriginal,
      yKey: yKeyActual,
      data,
    };
  }, [dataset]);

  const handleQuery = useCallback(async () => {
    if (!input.trim() || !dataset) return;
    
    const userQuery = input.trim();
    setInput('');
    setIsProcessing(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuery,
      type: 'text'
    };
    setMessages(prev => [...prev, userMessage]);
    
    setTimeout(() => {
      const columnNames = dataset.columns.map(c => c.name);
      const command = processQuery(userQuery, columnNames);
      const q = userQuery.toLowerCase();
      
      let response = '';
      let chartConfig: ChartConfig | undefined = undefined;
      let messageType: ChatMessage['type'] = 'text';
      
      const parseChartCommand = (query: string) => {
        const lowerQ = query.toLowerCase();
        let chartType = 'bar';
        let xAxis = dataset.columns[0]?.name || 'category';
        let yAxis = dataset.columns.find(c => c.type === 'number')?.name || dataset.columns[1]?.name || 'value';
        
        if (lowerQ.includes('line')) chartType = 'line';
        else if (lowerQ.includes('pie')) chartType = 'pie';
        else if (lowerQ.includes('scatter')) chartType = 'scatter';
        else if (lowerQ.includes('area')) chartType = 'area';
        else if (lowerQ.includes('radar')) chartType = 'radar';
        
        const byMatch = lowerQ.match(/by\s+(\w+)/);
        if (byMatch) {
          const targetCol = byMatch[1].toLowerCase();
          const found = dataset.columns.find(c => c.name.toLowerCase().includes(targetCol));
          if (found) xAxis = found.name;
        }
        
        const forMatch = lowerQ.match(/for\s+(\w+)/);
        if (forMatch) {
          const targetCol = forMatch[1].toLowerCase();
          const found = dataset.columns.find(c => c.name.toLowerCase().includes(targetCol));
          if (found) yAxis = found.name;
        }
        
        return { type: chartType, xAxis, yAxis };
      };
      
      const handleDelete = () => {
        const lastIdx = generatedCharts.length - 1;
        if (lastIdx >= 0) {
          setGeneratedCharts(prev => prev.slice(0, -1));
          return `Deleted chart "${generatedCharts[lastIdx].title}". ${generatedCharts.length - 1} charts remaining.`;
        }
        return 'No charts to delete.';
      };
      
      const parseFilter = (query: string) => {
        const filterPatterns = [
          /filter\s+by\s+(\w+)\s*=\s*(.+)/i,
          /filter\s+(\w+)\s*:\s*(.+)/i,
          /show\s+only\s+(\w+)\s*=\s*(.+)/i,
          /show\s+(\w+)\s+is\s+(.+)/i,
        ];
        
        for (const pattern of filterPatterns) {
          const match = query.match(pattern);
          if (match) {
            const colName = match[1].trim();
            const colValue = match[2].trim().replace(/["']/g, '');
            const col = dataset.columns.find(c => c.name.toLowerCase().includes(colName.toLowerCase()));
            if (col) {
              return { column: col.name, value: colValue };
            }
          }
        }
        return null;
      };
      
      if (q.includes('delete') || q.includes('remove') || q.includes('clear chart')) {
        response = handleDelete();
        messageType = 'action';
      }
      else if ((q.includes('change') || q.includes('convert') || q.includes('switch') || q.includes('transform')) && q.includes('chart')) {
        const existingChart = generatedCharts[generatedCharts.length - 1];
        const modQuery = userQuery.replace(/change|convert|switch|transform/g, '').trim();
        chartConfig = generateChartFromQuery(modQuery + ' line', existingChart);
        if (chartConfig && existingChart) {
          const newType = q.includes('line') ? 'line' : q.includes('pie') ? 'pie' : q.includes('scatter') ? 'scatter' : q.includes('area') ? 'area' : 'bar';
          chartConfig = { ...chartConfig, type: newType as ChartConfig['type'] };
        }
        if (chartConfig) {
          response = `Modified chart type. X: ${chartConfig.xKey}, Y: ${chartConfig.yKey}.`;
          messageType = 'chart';
        } else {
          response = 'Could not modify chart. Try specifying a chart type like "change to line chart".';
        }
      }
      else if (command.action === 'FILTER' && command.filter) {
        const filterKey = Object.keys(command.filter)[0];
        const filterVal = command.filter[filterKey];
        const newFilters = { ...currentFilters, [filterKey]: filterVal };
        setCurrentFilters(newFilters);
        onFilterChange?.(newFilters);
        response = `Applied filter: ${filterKey} = ${filterVal}. ${Object.keys(newFilters).length} active filter(s).`;
        messageType = 'action';
      }
      else if (q.includes('filter') || q.includes('show only') || q.includes('where')) {
        const filter = parseFilter(userQuery);
        if (filter) {
          const newFilters = { ...currentFilters, [filter.column]: filter.value };
          setCurrentFilters(newFilters);
          onFilterChange?.(newFilters);
          response = `Filter applied: ${filter.column} = "${filter.value}".`;
          messageType = 'action';
        } else {
          response = 'Could not parse filter. Try: "filter by country = USA" or "show only senior roles".';
          messageType = 'error';
        }
      }
      else if (q.includes('clear') && (q.includes('filter') || q.includes('all'))) {
        setCurrentFilters({});
        onFilterChange?.({});
        response = 'All filters cleared.';
        messageType = 'action';
      }
      else if (q.includes('generate') || q.includes('create') || q.includes('show') || q.includes('draw')) {
        if (q.includes('chart') || q.includes('graph')) {
          chartConfig = generateChartFromQuery(userQuery);
          if (chartConfig) {
            response = `**Chart Generated:** ${chartConfig.title}

Type: ${chartConfig.type}
X-Axis: ${chartConfig.xKey}
Y-Axis: ${chartConfig.yKey}
Data Points: ${chartConfig.data.length}`;
            messageType = 'chart';
          } else {
            response = 'Could not generate chart. Try: "create bar chart for salary by country"';
            messageType = 'error';
          }
        } else {
          chartConfig = generateChartFromQuery(userQuery);
          if (chartConfig) {
            response = `Generated: ${chartConfig.title}`;
            messageType = 'chart';
          }
        }
      }
      else if (q.includes('top') || q.includes('bottom') || q.includes('lowest') || q.includes('highest')) {
        const nMatch = userQuery.match(/top\s+(\d+)|bottom\s+(\d+)|first\s+(\d+)/i);
        const n = nMatch ? (Number(nMatch[1] || nMatch[2] || nMatch[3]) || 5) : 5;
        chartConfig = generateChartFromQuery(userQuery);
        if (chartConfig && chartConfig.data) {
          if (q.includes('bottom') || q.includes('lowest')) {
            chartConfig.data = [...chartConfig.data].reverse().slice(0, n);
          } else {
            chartConfig.data = chartConfig.data.slice(0, n);
          }
          chartConfig.title = `Top ${n} ${chartConfig.xKey}`;
          response = `Showing top ${n} results: ${chartConfig.xKey}`;
          messageType = 'chart';
        } else {
          response = 'Could not generate top/bottom chart.';
          messageType = 'error';
        }
      }
      else if (q.includes('compare') || q.includes('versus') || q.includes('vs')) {
        chartConfig = generateChartFromQuery(userQuery);
        if (chartConfig) {
          chartConfig.title = `Comparison: ${chartConfig.xKey}`;
          response = `Generated comparison chart between ${chartConfig.xKey} values.`;
          messageType = 'chart';
        }
      }
      else if (q.includes('trend') || q.includes('over time') || q.includes('growth')) {
        chartConfig = generateChartFromQuery('line chart ' + userQuery);
        if (chartConfig) {
          response = `**Trend Analysis:** ${chartConfig.title}

Shows data variation over time/sequence.
Type: Line chart with smooth curves.`;
          messageType = 'chart';
        } else {
          response = 'Could not generate trend chart.';
          messageType = 'error';
        }
      }
      else if (q.includes('distribution') || q.includes('spread') || q.includes('percentage')) {
        chartConfig = generateChartFromQuery('pie chart ' + userQuery);
        if (chartConfig) {
          response = `**Distribution:** ${chartConfig.title}

Shows proportion of each category.`;
          messageType = 'chart';
        }
      }
      else if (q.includes('what is the dataset') || q.includes('describe') || q.includes('columns')) {
        response = `**Dataset: ${dataset.name}**

• Total Rows: ${dataset.rowCount.toLocaleString()}
• Total Columns: ${dataset.columns.length}

**Columns:**
${dataset.columns.map(c => `• ${c.name} (${c.type})`).join('\n')}

**Quick Actions:**
• "Create bar chart"
• "Filter by country = USA"
• "Show top 10"`;
        messageType = 'insight';
      }
      else if (q.includes('insight') || q.includes('analyze')) {
        if (analysis?.insights && analysis.insights.length > 0) {
          response = '**AI Insights:**\n\n';
          analysis.insights.forEach((insight: Record<string, unknown>) => {
            response += `• **${insight.title}**: ${insight.message}\n`;
          });
        } else {
          const numCols = dataset.columns.filter(c => c.type === 'number');
          if (numCols.length > 0) {
            const col = numCols[0].name;
            const values = dataset.rows.map((r: Record<string, unknown>) => Number(r[col])).filter(v => !isNaN(v));
            if (values.length > 0) {
              const sum = values.reduce((a, b) => a + b, 0);
              const avg = sum / values.length;
              response = `**Quick Analysis - ${col}:**\n\n• Total: ${sum.toLocaleString()}\n• Average: ${avg.toFixed(2)}\n• Records: ${values.length}\n\nTry "create chart" to visualize this data.`;
            }
          } else {
            response = 'No detailed insights available yet. Upload data to get AI insights.';
          }
        }
        messageType = 'insight';
      }
      else if (q.includes('kpi') || q.includes('metric') || q.includes('summary')) {
        const numCols = dataset.columns.filter(c => c.type === 'number');
        response = '**Key Metrics:**\n\n';
        
        numCols.slice(0, 3).forEach(col => {
          const values = dataset.rows.map((r: Record<string, unknown>) => Number(r[col.name])).filter(v => !isNaN(v));
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            response += `**${col.name}:**\n  Total: ${sum.toLocaleString()}\n  Avg: ${avg.toFixed(2)}\n  Range: ${min.toLocaleString()} - ${max.toLocaleString()}\n\n`;
          }
        });
        messageType = 'insight';
      }
      else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
        response = `Hello! I can help you control the dashboard:

**Charts:**
• "Create bar chart"
• "Change to line chart"
• "Show scatter plot"

**Filters:**
• "Filter by country = USA"
• "Clear filters"

**Data:**
• "Show top 10"
• "Compare metrics"

What would you like?`;
      }
      else {
        chartConfig = generateChartFromQuery(userQuery);
        if (chartConfig) {
          response = `**Generated:** ${chartConfig.title}`;
          messageType = 'chart';
        } else {
          response = `I understood: "${userQuery}"

Try these commands:
• "Create a bar chart"
• "Filter by country = USA"
• "Show top 5"
• "Change to line chart"`;
          messageType = 'error';
        }
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        type: messageType,
        chartConfig
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (chartConfig) {
        // Check for duplicates before adding
        const exists = generatedCharts.some(c => 
          c.title === chartConfig.title && 
          c.xKey === chartConfig.xKey && 
          c.yKey === chartConfig.yKey
        );
        if (!exists) {
          const newCharts = [...generatedCharts, chartConfig];
          setGeneratedCharts(newCharts);
          onChartGenerated?.(chartConfig);
          onChartModified?.(chartConfig);
        }
      }
      
      setIsProcessing(false);
    }, 600);
  }, [input, dataset, analysis, generateChartFromQuery, onChartGenerated, onChartModified, onFilterChange, currentFilters, generatedCharts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-4 top-4 h-[calc(100vh-2rem)] w-full max-w-md rounded-2xl border border-border/50 bg-card z-50 flex flex-col shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI Assistant</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/50 bg-muted/30'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              {msg.chartConfig && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <BarChart3 className="h-3 w-3" />
                    Chart generated
                  </div>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                <span className="text-xs font-medium text-muted-foreground">You</span>
              </div>
            )}
          </motion.div>
        ))}
        
        {isProcessing && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="border border-border/50 bg-muted/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border/50 p-4">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 bg-muted/50 border border-border/50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            disabled={isProcessing}
          />
          <button
            onClick={handleQuery}
            disabled={!input.trim() || isProcessing || !dataset}
            className="rounded-full w-10 h-10 bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {dataset && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setInput('Create bar chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <BarIcon className="h-3 w-3" /> Bar
            </button>
            <button
              onClick={() => setInput('Create line chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <LineChart className="h-3 w-3" /> Line
            </button>
            <button
              onClick={() => setInput('Create pie chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <PieChart className="h-3 w-3" /> Pie
            </button>
            <button
              onClick={() => setInput('Filter by country = USA')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <Filter className="h-3 w-3" /> Filter
            </button>
            <button
              onClick={() => setInput('Clear filters')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Clear
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnalyticsSidebar;