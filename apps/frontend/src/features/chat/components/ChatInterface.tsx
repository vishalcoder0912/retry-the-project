import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, User, Settings } from 'lucide-react';
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
    <div className="mx-10 my-10 flex h-[calc(100vh-14rem)] flex-col overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div>
            <h2 className="text-2xl uppercase tracking-[0.08em] text-foreground">5.0 Artificial Intelligence Interface</h2>
            <p className="mt-2 text-sm uppercase tracking-[0.08em] text-muted-foreground">
              {dataset ? `Analyzing: ${dataset.name} (${dataset.rowCount} rows)` : 'Upload data to start'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="border border-success bg-success/10 px-4 py-3 text-sm uppercase tracking-[0.08em] text-success">Session Active</div>
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        {chatMessages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full flex-col items-center justify-center text-center"
          >
            <h3 className="text-3xl uppercase tracking-[0.08em] text-foreground mb-4">Terminal Access Ready</h3>
            <p className="mb-6 max-w-3xl text-sm uppercase tracking-[0.08em] text-muted-foreground">
              Submit a secure analytical prompt. Responses remain local to the active registry.
            </p>
            {dataset && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedQueries.map((query) => (
                  <button
                    key={query}
                    onClick={() => {
                      void processQuery(query);
                    }}
                    className="border border-border px-4 py-2 text-xs uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
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
              <div className={`max-w-2xl space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`text-xs uppercase tracking-[0.12em] ${msg.role === 'user' ? 'text-accent' : 'text-muted-foreground'}`}>
                  {msg.role === 'user' ? 'Operator // Request' : 'Intel-System // Response'}
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
                  className={`inline-block border border-border px-6 py-5 text-left text-sm leading-8 ${
                    msg.role === 'user'
                      ? 'bg-card text-foreground'
                      : 'bg-card text-foreground'
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
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-secondary">
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
            <div className="border border-border bg-secondary px-4 py-2.5">
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

      <form onSubmit={handleSubmit} className="border-t border-border px-8 py-6">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dataset ? "Enter secure query..." : 'Upload a dataset first'}
            disabled={!dataset || isProcessing}
            className="terminal-input flex-1 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || !dataset || isProcessing}
            className="flex h-14 w-16 items-center justify-center border border-border bg-primary text-primary-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <span>Attach Dataset // Query History</span>
          <span className="text-success">Encryption: AES-256 Active</span>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
