import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Sparkles, BarChart3, Loader2 } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { ChartConfig } from '@/features/data/model/dataStore';
import { processQuery } from '@/features/dashboard/utils/dashboardController';

interface AnalyticsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChartGenerated?: (chart: ChartConfig) => void;
  currentCharts?: ChartConfig[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'chart' | 'insight' | 'action';
  chartConfig?: ChartConfig;
}

const AnalyticsSidebar = ({ isOpen, onClose, onChartGenerated, currentCharts = [] }: AnalyticsSidebarProps) => {
  const { dataset, analysis } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedCharts, setGeneratedCharts] = useState<ChartConfig[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Hi! I'm your AI analytics assistant. I can help you with:

• **Charts** - "Create a bar chart", "Show trends"
• **Insights** - "What are the top trends?", "Show correlations"
• **Info** - "What columns do we have?", "Dataset summary"

What would you like to explore?`,
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

  const generateChartFromQuery = useCallback((query: string): ChartConfig | null => {
    if (!dataset) return null;
    
    const q = query.toLowerCase();
    const cols = dataset.columns.map(c => c.name.toLowerCase());
    const rows = dataset.rows;
    
    const xKey = cols.find(c => c.includes('country') || c.includes('region') || c.includes('city') || c.includes('category')) || cols[0];
    const yKey = cols.find(c => c.includes('salary') || c.includes('revenue') || c.includes('profit') || c.includes('amount') || c.includes('value')) || cols.find(c => c !== xKey) || cols[1];
    let chartType = 'bar';
    
    if (q.includes('line') || q.includes('trend') || q.includes('over time')) {
      chartType = 'line';
    } else if (q.includes('pie') || q.includes('distribution') || q.includes('percentage')) {
      chartType = 'pie';
    } else if (q.includes('scatter') || q.includes('correlation') || q.includes('vs')) {
      chartType = 'scatter';
    } else if (q.includes('area') || q.includes('growth')) {
      chartType = 'area';
    }
    
    const dataMap: Record<string, number> = {};
    rows.forEach((row: Record<string, unknown>) => {
      const xVal = String(row[Object.keys(row).find(k => k.toLowerCase() === xKey) || ''] || 'Unknown');
      const yVal = Number(row[Object.keys(row).find(k => k.toLowerCase() === yKey) || '']) || 0;
      if (!dataMap[xVal]) dataMap[xVal] = 0;
      dataMap[xVal] += yVal;
    });
    
    const data = Object.entries(dataMap)
      .map(([name, value]) => ({ [xKey]: name, [yKey]: value }))
      .sort((a, b) => (b[yKey] as number) - (a[yKey] as number))
      .slice(0, 10);
    
    if (data.length === 0) return null;
    
    const yKeyDisplay = Object.keys(data[0]).find(k => k !== xKey) || yKey;
    
    return {
      type: chartType as ChartConfig['type'],
      title: `${yKeyDisplay.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} by ${xKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      xKey,
      yKey: yKeyDisplay,
      data
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
      
      if (command.action === 'SHOW_ALL') {
        response = 'Showing all charts on the dashboard!';
        messageType = 'action';
      }
      else if (command.action === 'SHOW_CHART' && command.charts) {
        response = `Showing chart(s): ${command.charts.join(', ')}`;
        messageType = 'action';
        chartConfig = generateChartFromQuery(command.charts[0]);
      }
      else if (command.action === 'FILTER' && command.filter) {
        response = `Applying filter: ${JSON.stringify(command.filter)}`;
        messageType = 'action';
      }
      else if (command.action === 'GENERATE_CHART' && command.chart) {
        const chartType = typeof command.chart === 'object' ? command.chart.type : 'bar';
        const queryWithType = `${chartType} chart ${typeof command.chart === 'object' ? command.chart.y : 'value'} by ${typeof command.chart === 'object' ? command.chart.x : 'category'}`;
        chartConfig = generateChartFromQuery(queryWithType);
        if (chartConfig) {
          response = `Generated new ${chartType} chart! X-axis: ${chartConfig.xKey}, Y-axis: ${chartConfig.yKey}.`;
          messageType = 'chart';
        }
      }
      else if (command.action === 'MODIFY_CHART' && command.chart && command.changes) {
        const chartName = typeof command.chart === 'string' ? command.chart : 'current';
        const newType = command.changes.type as string;
        response = `Modified chart: Changed "${chartName}" to ${newType} type.`;
        messageType = 'action';
      }
      else if (command.action === 'ANSWER' && command.message) {
        response = command.message;
      }
      else if (userQuery.toLowerCase().includes('what is the dataset') || userQuery.toLowerCase().includes('describe') || userQuery.toLowerCase().includes('columns')) {
        response = `**Dataset: ${dataset.name}**

• Total Rows: ${dataset.rowCount.toLocaleString()}
• Total Columns: ${dataset.columns.length}

**Columns:**
${dataset.columns.map(c => `• ${c.name} (${c.type})`).join('\n')}`;
        messageType = 'insight';
      }
      else if (q.includes('chart') || q.includes('graph') || q.includes('visual') || q.includes('create')) {
        chartConfig = generateChartFromQuery(userQuery);
        if (chartConfig) {
          response = `**Generated Chart:** ${chartConfig.title}

Type: ${chartConfig.type}
X-Axis: ${chartConfig.xKey}
Y-Axis: ${chartConfig.yKey}
Data Points: ${chartConfig.data.length}`;
          messageType = 'chart';
        } else {
          response = 'Couldn\'t generate a chart. Try "Create a bar chart for salary by country".';
        }
      }
      else if (q.includes('insight') || q.includes('trend') || q.includes('analysis') || q.includes('summary')) {
        if (analysis?.insights && analysis.insights.length > 0) {
          response = '**AI Insights:**\n\n';
          analysis.insights.forEach((insight: Record<string, unknown>) => {
            response += `• **${insight.title}**: ${insight.message}\n`;
          });
          messageType = 'insight';
        } else {
          response = 'No detailed insights available. Upload a dataset first.';
        }
      }
      else if (q.includes('kpi') || q.includes('metric') || q.includes('overview')) {
        response = '**Key Metrics:**\n\n';
        
        const numericCols = dataset.columns.filter(c => c.type === 'number');
        if (numericCols.length > 0) {
          const primaryMetric = numericCols[0].name;
          const values = dataset.rows.map((r: Record<string, unknown>) => Number(r[primaryMetric])).filter(v => !isNaN(v));
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            response += `• **${primaryMetric}**: Total: ${sum.toLocaleString()}, Avg: ${avg.toFixed(2)}, Max: ${max.toLocaleString()}, Min: ${min.toLocaleString()}\n`;
          }
        }
        
        messageType = 'insight';
      }
      else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
        response = `Hello! I can help you:
1. **Charts** - "Create a bar chart"
2. **Insights** - "Show trends"
3. **Info** - "What is the dataset?"

What would you like?`;
      }
      else {
        response = `I understand you're asking about: "${userQuery}"

Try:
• "Create a chart for X by Y"
• "Show insights and trends"
• "What is the dataset?"`;
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
        setGeneratedCharts(prev => [...prev, chartConfig]);
        onChartGenerated?.(chartConfig);
      }
      
      setIsProcessing(false);
    }, 800);
  }, [input, dataset, analysis, generateChartFromQuery, onChartGenerated]);

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
              onClick={() => setInput('Show all charts')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors"
            >
              Show all
            </button>
            <button
              onClick={() => setInput('Create a bar chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors"
            >
              Bar chart
            </button>
            <button
              onClick={() => setInput('Show insights')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors"
            >
              Insights
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnalyticsSidebar;