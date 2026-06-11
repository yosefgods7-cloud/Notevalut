import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Bot, User, Brain, AlertCircle } from 'lucide-react';
import { useAI } from '../hooks/useAI';
import { useStorage } from '../context/StorageContext';
import { DEFAULT_SETTINGS } from '../types';
import { cn } from '../lib/utils';
import { marked } from 'marked';

export const SecondBrainSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, sources?: string[] }[]>([]);
  const [lastQueryEmbedding, setLastQueryEmbedding] = useState<number[] | undefined>(undefined);
  const [lastTrimmedBundle, setLastTrimmedBundle] = useState<any[] | undefined>(undefined);
  const { askSecondBrain, isGenerating, aiError, setAiError } = useAI();
  const { data } = useStorage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatKeyId = data.settings.featureApiConfigs?.chatKeyId;
  const legacyKey = data.settings.geminiApiKey;
  const allKeys = data.settings.apiKeys || [];
  
  let hasApiKey = false;
  if (chatKeyId) hasApiKey = allKeys.some(k => k.id === chatKeyId && k.key);
  else hasApiKey = (allKeys.length > 0 && !!allKeys[0].key) || !!legacyKey;

  const getUsage = () => {
    let keyId = 'legacy';
    if (chatKeyId) keyId = chatKeyId;
    else if (allKeys.length > 0) keyId = allKeys[0].id;

    const today = new Date().toISOString().split('T')[0];
    const u = data.settings.apiUsageByKey?.[keyId] || (keyId === 'legacy' ? data.settings.apiUsage : undefined);
    
    if (u?.date === today) {
       return (u.embeddingCount || 0) + (u.answerCount || 0) + (u.digestCount || 0) + (u.editorCount || 0);
    }
    return 0;
  };
  
  const currentUsage = getUsage();
  const isEnabled = data.settings.plugins?.askYourVault?.enabled !== false;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isGenerating, aiError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isGenerating) return;

    const userQuery = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);

    const askSettings = data.settings.plugins?.askYourVault;
    const topK = askSettings?.sourceNotesCount || 5;
    const conversationMode = askSettings?.conversationMode !== false;

    const response = await askSecondBrain(userQuery, {
      history: messages,
      lastQueryEmbedding,
      lastTrimmedBundle,
      topK,
      conversationMode
    });

    if (response) {
      if (response.queryEmbedding) {
         setLastQueryEmbedding(response.queryEmbedding);
      }
      if (response.trimmedBundle) {
         setLastTrimmedBundle(response.trimmedBundle);
      }
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: response.answer,
        sources: response.sources
      }]);
    }
  };

  if (!isEnabled) return null;

  const showBtn = data.settings.floatButtons?.aiAssistant ?? DEFAULT_SETTINGS.floatButtons?.aiAssistant ?? true;

  if (!showBtn) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-24 left-6 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex items-center justify-center z-[70] transition-all hover:scale-105 active:scale-95 no-print border",
          isOpen ? "bg-surface text-text-primary border-border" : "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent"
        )}
        style={{ width: "var(--float-btn-size, 3.5rem)", height: "var(--float-btn-size, 3.5rem)" }}
        title="AI Second Brain"
      >
        {isOpen ? <X style={{ width: "var(--float-icon-size, 1.5rem)", height: "var(--float-icon-size, 1.5rem)" }} /> : <Sparkles style={{ width: "var(--float-icon-size, 1.5rem)", height: "var(--float-icon-size, 1.5rem)" }} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className="fixed bottom-[10.5rem] left-6 w-[380px] h-[550px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-8rem)] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col z-[70] overflow-hidden no-print"
          >
            <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-active/50 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                  <Brain size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ask Your Vault</h3>
                  <p className="text-xs text-text-muted">Chat with your Second Brain</p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className={cn("text-xs font-semibold", currentUsage > 1300 ? "text-orange-400" : "text-text-muted")}>
                  {currentUsage} / 1500 API Calls
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-muted">
                  <Brain size={48} className="mb-4 opacity-50" />
                  <p className="text-sm">Ask questions about your knowledge base. I will search intelligently and synthesize an answer.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-accent/20 text-accent" : "bg-blue-500/20 text-blue-500"
                  )}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl p-3 text-sm",
                    msg.role === 'user' ? "bg-accent text-white rounded-tr-sm" : "bg-surface-hover text-text-primary rounded-tl-sm"
                  )}>
                    {msg.role === 'ai' ? (
                      <div 
                        className="markdown-body text-sm bg-transparent !text-inherit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 text-text-primary"
                        dangerouslySetInnerHTML={{ __html: marked(msg.content) as string }}
                      />
                    ) : (
                      msg.content
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-text-muted flex flex-col gap-1">
                        <span className="font-semibold text-text-secondary">Based on:</span>
                        <ul className="list-disc pl-3">
                          {msg.sources.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isGenerating && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="bg-surface-hover text-text-primary rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              
              {aiError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-3 text-red-500 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {aiError}
                    {!hasApiKey && (
                      <p className="mt-1 text-xs opacity-80">Go to Settings &gt; AI Features to set up your free API key.</p>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-surface border-t border-border">
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={isGenerating}
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-accent disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isGenerating}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent hover:bg-accent-hover disabled:bg-surface-active text-white disabled:text-text-muted rounded-lg transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
