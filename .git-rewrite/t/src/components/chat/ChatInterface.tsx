import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, BarChart3, Lightbulb, Code } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { ChatMessage, ChartConfig, generateDemoCharts } from '@/lib/data-store';
import AnalyticsChart from '@/components/charts/AnalyticsChart';

const suggestedQueries = [
  'Show revenue by category',
  'What is the monthly trend?',
  'Top performing region',
  'Compare profit margins',
];

const ChatInterface = () => {
  const { dataset, chatMessages, addChatMessage, isProcessing, setIsProcessing } = useData();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const processQuery = async (query: string) => {
    if (!dataset) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    addChatMessage(userMsg);
    setIsProcessing(true);

    // Simulate AI processing with local data analysis
    await new Promise(r => setTimeout(r, 1200));

    const charts = generateDemoCharts(dataset);
    const queryLower = query.toLowerCase();

    let chart: ChartConfig | undefined;
    let insights: string[] = [];
    let sql = '';
    let content = '';

    if (queryLower.includes('revenue') && queryLower.includes('category')) {
      chart = charts[1];
      sql = 'SELECT category, SUM(revenue) as revenue FROM sales GROUP BY category ORDER BY revenue DESC';
      insights = [
        'Electronics leads with the highest revenue share',
        'Software category shows strong growth potential',
        'Consider focusing marketing on top 3 categories',
      ];
      content = 'Here\'s the revenue breakdown by category. Electronics dominates the portfolio.';
    } else if (queryLower.includes('trend') || queryLower.includes('monthly')) {
      chart = charts[0];
      sql = 'SELECT month, SUM(revenue) as revenue FROM sales GROUP BY month ORDER BY month';
      insights = [
        'Revenue shows seasonal patterns with Q4 peaks',
        'Month-over-month growth averaging 8.3%',
        'Consider inventory planning for peak months',
      ];
      content = 'Here\'s the monthly revenue trend showing clear seasonal patterns.';
    } else if (queryLower.includes('region')) {
      chart = charts[2];
      sql = 'SELECT region, SUM(units_sold) as units FROM sales GROUP BY region ORDER BY units DESC';
      insights = [
        'Regional performance varies significantly',
        'Top region outperforms bottom by 2.3x',
        'Expansion opportunity in underperforming regions',
      ];
      content = 'Regional performance analysis shows significant variance across territories.';
    } else if (queryLower.includes('margin') || queryLower.includes('profit')) {
      chart = charts[3];
      sql = 'SELECT month, AVG(profit_margin)*100 as margin FROM sales GROUP BY month';
      insights = [
        'Margins trending upward over the period',
        'Average margin of 25% is above industry benchmark',
        'Cost optimization could push margins to 30%+',
      ];
      content = 'Profit margin analysis reveals a healthy upward trend.';
    } else {
      chart = charts[0];
      sql = `SELECT * FROM sales WHERE ... LIMIT 100`;
      insights = [
        `Dataset contains ${dataset.rowCount} records across ${dataset.columns.length} dimensions`,
        'Multiple analysis angles available: revenue, units, margins, ratings',
        'Try asking about specific metrics or comparisons',
      ];
      content = `I've analyzed your query against the ${dataset.name} dataset. Here's what I found:`;
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content,
      sql,
      chart,
      insights,
      timestamp: new Date(),
    };

    addChatMessage(assistantMsg);
    setIsProcessing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    processQuery(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] m-4 glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Data Analyst</h2>
            <p className="text-xs text-muted-foreground">
              {dataset ? `Analyzing: ${dataset.name} (${dataset.rowCount} rows)` : 'Upload data to start'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {chatMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-primary">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Ask anything about your data</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              I can generate charts, run analysis, and provide business insights from your dataset.
            </p>
            {dataset && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedQueries.map(q => (
                  <button
                    key={q}
                    onClick={() => processQuery(q)}
                    className="px-3 py-1.5 text-xs rounded-full bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {chatMessages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-2xl space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-4 py-2.5 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {msg.content}
                </div>

                {msg.sql && (
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Generated SQL</span>
                    </div>
                    <code className="text-xs font-mono text-primary block">{msg.sql}</code>
                  </div>
                )}

                {msg.chart && (
                  <div className="w-full">
                    <AnalyticsChart config={msg.chart} index={0} />
                  </div>
                )}

                {msg.insights && msg.insights.length > 0 && (
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-3 h-3 text-warning" />
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Insights</span>
                    </div>
                    {msg.insights.map((insight, i) => (
                      <p key={i} className="text-xs text-secondary-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {insight}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
            <div className="bg-secondary rounded-xl px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-border/50">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={dataset ? 'Ask about your data...' : 'Upload a dataset first'}
            disabled={!dataset || isProcessing}
            className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !dataset || isProcessing}
            className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
