import React, { useState, useEffect } from "react";
import { useStorage } from "../context/StorageContext";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, RefreshCw, AlertCircle, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { getSelectedApiKey } from "../hooks/useAI";

export const DailyDigestCard: React.FC<{
  onOpenNote: (noteId: string) => void;
}> = ({ onOpenNote }) => {
  const { data, saveData } = useStorage();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const settings = data.settings.plugins?.dailyDigest;
  
  // Create an effect to auto-generate if needed and configured time passed
  // Wait, the prompt says "each morning by bundling...". 
  // We can just check on component mount if it needs generation according to the rules.

  const getEditedNotesSince = (timestamp: number) => {
    return data.notes.filter(n => !n.isDeleted && new Date(n.updatedAt || n.createdAt).getTime() > timestamp);
  };

  const getEditedNotesLast24Hours = () => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return getEditedNotesSince(dayAgo);
  };

  const getDigestKeyId = () => {
    const keyInfo = getSelectedApiKey(data.settings, 'digest');
    return keyInfo ? keyInfo.id : 'legacy';
  };

  const getApiUsageTotal = () => {
    const today = new Date().toISOString().split('T')[0];
    const keyId = getDigestKeyId();
    const u = data.settings.apiUsageByKey?.[keyId] || (keyId === "legacy" ? data.settings.apiUsage : undefined);
    
    if (u?.date === today) {
      return (u.embeddingCount || 0) + (u.answerCount || 0) + (u.digestCount || 0) + (u.editorCount || 0);
    }
    return 0;
  };

  const checkApiLimit = () => {
    const currentUsage = getApiUsageTotal();
    if (currentUsage >= 1400) {
      throw new Error("Daily API limit reached (1400/1500 buffer). Wait until tomorrow.");
    }
    return currentUsage;
  };

  const incrementApiLimit = () => {
    const today = new Date().toISOString().split('T')[0];
    const keyId = getDigestKeyId();
    const keyUsageMap = data.settings.apiUsageByKey || {};
    const u = keyUsageMap[keyId] || (keyId === 'legacy' ? data.settings.apiUsage : {
      date: today, embeddingCount: 0, answerCount: 0, digestCount: 0, editorCount: 0
    });
    
    const newUsage = {
      date: today,
      embeddingCount: u.date === today ? (u.embeddingCount || 0) : 0,
      answerCount: u.date === today ? (u.answerCount || 0) : 0,
      digestCount: (u.date === today ? (u.digestCount || 0) : 0) + 1,
      editorCount: u.date === today ? (u.editorCount || 0) : 0,
    };
    
    const updatedMap = { ...keyUsageMap, [keyId]: newUsage };
    const updates: any = { apiUsageByKey: updatedMap };
    if (keyId === 'legacy') updates.apiUsage = newUsage;
    
    saveData({
      ...data,
      settings: {
        ...data.settings,
        ...updates
      }
    });
  };

  const generateDigest = async (force: boolean = false) => {
    try {
      setIsGenerating(true);
      setError(null);

      const lastDigestTime = data.dailyDigest?.timestamp || 0;
      const minNotes = settings?.minNotesRequired || 3;
      
      const editedSinceLast = getEditedNotesSince(lastDigestTime);
      
      if (!force && editedSinceLast.length < minNotes) {
        setIsGenerating(false);
        return; // we don't generate, we just show the gentile message in render
      }

      if (force && editedSinceLast.length === 0) {
        setError("No notes have been edited since the last digest.");
        setIsGenerating(false);
        return;
      }

      const notesToSummarize = force ? editedSinceLast : getEditedNotesLast24Hours();
      if (notesToSummarize.length === 0) {
         setError("No notes to summarize.");
         setIsGenerating(false);
         return;
      }

      checkApiLimit();

      // Retrieve Gemini API Key
      const keyInfo = getSelectedApiKey(data.settings, 'digest');
      const apiKey = keyInfo?.key || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
      }

      const gemini = new GoogleGenAI({ apiKey });
      const prompt = `You are an AI assistant. Review the following notes edited in the last 24 hours and provide a brief, engaging daily digest that identifies patterns, connections, and ideas across these notes. Keep it concise.

Notes:
${notesToSummarize.map(n => `Title: ${n.title}\nContent: ${n.content}`).join("\n\n---\n\n")}`;

      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const summary = response.text || "No summary generated.";

      incrementApiLimit();

      saveData({
        ...data,
        dailyDigest: {
          timestamp: Date.now(),
          summary,
          includedNoteIds: notesToSummarize.map(n => n.id)
        }
      });
      
    } catch (err: any) {
      setError(err.message || "Failed to generate digest");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!settings?.enabled) return;

    const timeOfDay = settings.timeOfDay || "09:00";
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(":").map(Number);
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);

    const lastDigestTime = data.dailyDigest?.timestamp || 0;
    const isOlderThan24HRs = (Date.now() - lastDigestTime) > 24 * 60 * 60 * 1000;
    const editedSinceLast = getEditedNotesSince(lastDigestTime);
    const minNotes = settings?.minNotesRequired || 3;

    // Check if it's currently past the target time and we haven't generated one yet in the last 24h
    if (isOlderThan24HRs && now >= targetTime && editedSinceLast.length >= minNotes) {
      generateDigest();
    }
  }, [settings?.enabled, data.dailyDigest?.timestamp]);

  if (!settings?.enabled) return null;

  const lastDigestTime = data.dailyDigest?.timestamp || 0;
  const isOlderThan24HRs = (Date.now() - lastDigestTime) > 24 * 60 * 60 * 1000;
  const editedSinceLast = getEditedNotesSince(lastDigestTime);
  const minNotes = settings?.minNotesRequired || 3;

  const currentUsage = getApiUsageTotal();
  
  const handleManualRefresh = () => {
     if (editedSinceLast.length === 0) {
        setError("No notes edited since last digest.");
        return;
     }
     if (window.confirm("Generating a new digest will consume 1 free tier API call. Proceed?")) {
        generateDigest(true);
     }
  };

  return (
    <div className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-lg p-6 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-accent"></div>
      
      <div className="flex items-center justify-between mb-4">
         <h3 className="text-lg font-bold flex items-center gap-2 text-text-primary">
            <Sparkles className="text-accent" size={20} />
            Daily Digest
         </h3>
         <button 
           onClick={handleManualRefresh}
           disabled={isGenerating}
           className="p-2 hover:bg-surface-hover rounded-full text-text-muted transition-colors disabled:opacity-50"
           title="Force refresh digest (consumes 1 API call)"
         >
            <RefreshCw size={16} className={isGenerating ? "animate-spin text-accent" : ""} />
         </button>
      </div>

      <AnimatePresence mode="wait">
         {isGenerating ? (
            <motion.div 
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center justify-center text-text-muted"
            >
               <Sparkles className="animate-pulse text-accent mb-4" size={32} />
               <p>Analyzing notes & mapping ideas...</p>
            </motion.div>
         ) : error ? (
            <motion.div 
               key="error"
               className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-start gap-3"
            >
               <AlertCircle size={20} className="shrink-0 mt-0.5" />
               <p>{error}</p>
            </motion.div>
         ) : isOlderThan24HRs && editedSinceLast.length < minNotes ? (
            <motion.div 
               key="empty"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="py-8 text-center"
            >
               <p className="text-text-muted">
                 Not enough activity to generate a new digest today. 
                 <br />
                 Keep writing! ({editedSinceLast.length} / {minNotes} notes edited since last digest)
               </p>
            </motion.div>
         ) : data.dailyDigest ? (
            <motion.div 
               key="content"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="space-y-6"
            >
               <div className="text-sm text-text-primary leading-relaxed bg-surface-active p-4 rounded-lg">
                  {data.dailyDigest.summary}
               </div>
               
               <div>
                  <h4 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Analyzed Notes</h4>
                  <div className="flex flex-col gap-2">
                     {data.dailyDigest.includedNoteIds.map(id => {
                        const note = data.notes.find(n => n.id === id);
                        if (!note) return null;
                        return (
                           <button 
                             key={id} 
                             onClick={() => onOpenNote(id)}
                             className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-hover border border-transparent hover:border-border transition-colors text-left"
                           >
                              <div className="flex items-center gap-2 overflow-hidden">
                                 <FileText size={14} className="text-text-muted shrink-0" />
                                 <span className="text-sm font-medium text-text-primary truncate">{note.title || "Untitled"}</span>
                              </div>
                              <ChevronRight size={14} className="text-text-muted" />
                           </button>
                        );
                     })}
                  </div>
               </div>
            </motion.div>
         ) : (
            <motion.div key="none" className="py-8 text-center text-text-muted">
               <p>No digest available yet.</p>
            </motion.div>
         )}
      </AnimatePresence>

      <div className="w-full mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-text-muted">
         <span>
            {data.dailyDigest?.timestamp ? `Cached: ${new Date(data.dailyDigest.timestamp).toLocaleString()}` : 'No cache'}
         </span>
         <span className={currentUsage > 1300 ? "text-orange-400 font-medium" : ""}>
            API Uses Today: {currentUsage} / 1500
         </span>
      </div>
    </div>
  );
};
