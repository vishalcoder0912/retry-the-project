import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, User, Sparkles, MessageSquare } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import AnalyticsChart from '@/features/dashboard/components/AnalyticsChart';

const suggestedQueries = [
  'Show revenue by category',
  'What is the monthly trend?',
  'Top performing region',
  'Compare profit margins',
];

const extractFollowUpQuestions = (insights?: string[]) =>
  (insights || [])
    .filter((insight) => insight.startsWith('Try asking: '))
    .map((insight) => insight.replace('Try asking: ', '').trim());

const ChatInterface = () => {
  const { dataset, chatMessages, isProcessing, sendChatQuery } = useData();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const processQuery = async (query: string) => {
    if (!dataset) return;
    try {
      await sendChatQuery(query);
    } catch {
      // The page-level error state is rendered by the parent route.
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    void processQuery(input.trim());
    setInput('');
  };

  return (
    <div className="mx-8 my-6 flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">AI Chat</h2>
              <p className="text-sm text-muted-foreground">
                {dataset ? `${dataset.name} • ${dataset.rowCount.toLocaleString()} rows` : 'Upload data to start'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {chatMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full flex-col items-center justify-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20 mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">AI Assistant Ready</h3>
            <p className="mb-6 max-w-lg text-sm text-muted-foreground">
              Ask questions about your data, generate charts, or get insights. I'm here to help!
            </p>
            {dataset && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedQueries.map((query) => (
                  <button
                    key={query}
                    onClick={() => {
                      void processQuery(query);
                    }}
                    className="rounded-full bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
                  >
                    {query}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-2xl space-y-2 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`text-xs font-medium ${msg.role === 'user' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                
                {/* AI Badge - show if usedAI flag exists */}
                {msg.role === 'assistant' && msg.usedAI !== undefined && (
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      msg.usedAI
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${msg.usedAI ? "bg-green-400" : "bg-gray-400"}`}></span>
                      {msg.usedAI ? "AI-Powered" : "Local Analysis"}
                    </span>
                    {msg.model && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {msg.model}
                      </span>
                    )}
                    {msg.confidence !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        Confidence: {(msg.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {msg.intent && (
                      <span className="text-xs text-muted-foreground uppercase">
                        [{msg.intent}]
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={`inline-block rounded-2xl px-5 py-4 text-left text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/50 bg-muted/30 text-foreground'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Insights */}
                {msg.insights && msg.insights.length > 0 && (
                  <div className="border border-border bg-secondary/30 p-3 text-xs space-y-1">
                    {msg.insights.map((insight, i) => (
                      <p key={i} className="text-muted-foreground">
                        {insight}
                      </p>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && extractFollowUpQuestions(msg.insights).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {extractFollowUpQuestions(msg.insights).map((question) => (
                      <button
                        key={question}
                        onClick={() => {
                          void processQuery(question);
                        }}
                        disabled={isProcessing}
                        className="border border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}

                {msg.sql && (
                  <div className="w-full border border-border bg-secondary/50 p-4 text-xs font-mono text-foreground">
                    <p className="text-muted-foreground mb-2 uppercase tracking-wider text-[10px]">Generated SQL</p>
                    <pre className="whitespace-pre-wrap">{msg.sql}</pre>
                  </div>
                )}
                {msg.chart && (
                  <div className="w-full">
                    <AnalyticsChart config={msg.chart} index={0} />
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border/50 px-6 py-4">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dataset ? "Ask anything..." : 'Upload a dataset first'}
            disabled={!dataset || isProcessing}
            className="flex-1 rounded-xl border border-border/50 bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !dataset || isProcessing}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;