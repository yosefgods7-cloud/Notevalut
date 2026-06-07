import React, { useState, useEffect } from "react";
import { useStorage } from "../context/StorageContext";
import { useAI, getSelectedApiKey } from "../hooks/useAI";
import { Activity, RefreshCw, Trash2, Database, AlertCircle, CheckCircle2 } from "lucide-react";

export const VaultHealthDashboard: React.FC = () => {
  const { data, updateNote } = useStorage();
  const { generateEmbeddingForNote } = useAI();
  const [dbStatus, setDbStatus] = useState<"checking" | "ok" | "error">("checking");
  const [dbErrorMsg, setDbErrorMsg] = useState("");
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(0);
  const [totalToReindex, setTotalToReindex] = useState(0);

  const [cacheSize, setCacheSize] = useState<string>("Calculating...");
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    checkDBIntegrity();
    calculateImageCacheSize();
  }, [data.notes]);

  const checkDBIntegrity = async () => {
    setDbStatus("checking");
    try {
      const { entries } = await import("idb-keyval");
      await entries();
      setDbStatus("ok");
    } catch (e: any) {
      setDbStatus("error");
      setDbErrorMsg(e.message || "Unknown error accessing IndexedDB");
    }
  };

  const calculateImageCacheSize = () => {
    let size = 0;
    data.notes.forEach(note => {
      if (note.images) {
        note.images.forEach(img => {
          if (img.base64) {
            size += img.base64.length;
          }
        });
      }
      if (note.attachments) {
        note.attachments.forEach(att => {
          if (att.base64) {
            size += att.base64.length;
          }
        });
      }
    });
    
    const kb = size / 1024;
    setCacheSize(kb > 1024 ? (kb / 1024).toFixed(2) + " MB" : kb.toFixed(2) + " KB");
  };

  const clearImageCache = () => {
    if (!window.confirm("Are you sure you want to clear all images and large assets from your notes? This cannot be undone and will remove all inline images and attachments.")) return;
    
    setIsClearingCache(true);
    let count = 0;
    data.notes.forEach(note => {
      if ((note.images && note.images.length > 0) || (note.attachments && note.attachments.length > 0)) {
        updateNote(note.id, { images: [], attachments: [] });
        count++;
      }
    });

    setTimeout(() => {
      setIsClearingCache(false);
      alert(`Cleared assets from ${count} notes.`);
      calculateImageCacheSize();
    }, 500);
  };

  const handleReindexEmbeddings = async () => {
    const keyInfo = getSelectedApiKey(data.settings, 'embedding');
    if (!keyInfo) {
      alert("Please configure an embedding API key in Settings -> AI Features first.");
      return;
    }

    const notesToProcess = data.notes.filter(n => !n.isDeleted && n.content); // Simplified scope check
    if (notesToProcess.length === 0) {
      alert("No notes to reindex.");
      return;
    }

    if (!window.confirm(`Are you sure you want to re-index all ${notesToProcess.length} notes? This will consume your daily quota.`)) return;

    setIsReindexing(true);
    setTotalToReindex(notesToProcess.length);
    setReindexProgress(0);

    for (let i = 0; i < notesToProcess.length; i++) {
        const note = notesToProcess[i];
        
        try {
            await generateEmbeddingForNote({ ...note, contentHash: "force-reindex" });
        } catch(e) {
            console.error("Reindex error:", e);
        }
        
        setReindexProgress(i + 1);
    }
    setIsReindexing(false);
    alert("Re-indexing complete.");
  };

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
        <Activity className="text-emerald-500" /> Vault Health
      </h3>

      {/* IndexedDB Integrity */}
      <div className="bg-surface border border-border p-4 rounded-xl">
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Database size={16} /> IndexedDB Integrity
        </h4>
        <div className="flex items-center gap-2 text-sm">
          {dbStatus === "checking" && <span className="text-text-muted">Checking...</span>}
          {dbStatus === "ok" && (
            <>
              <CheckCircle2 size={16} className="text-green-500" />
              <span className="text-text-primary font-medium">Healthy</span>
            </>
          )}
          {dbStatus === "error" && (
            <>
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-red-500 font-medium whitespace-nowrap">Error:</span>
              <span className="text-text-muted text-xs truncate" title={dbErrorMsg}>{dbErrorMsg}</span>
            </>
          )}
        </div>
      </div>

      {/* Embedding Re-indexing */}
      <div className="bg-surface border border-border p-4 rounded-xl">
        <h4 className="text-sm font-semibold flex items-center justify-between mb-2">
          <span>Embeddings</span>
        </h4>
        <p className="text-xs text-text-muted mb-4">
          Manually trigger a full re-index of all your notes. Useful if AI search is returning inaccurate results.
        </p>
        <div className="flex items-center justify-between gap-4">
            {isReindexing ? (
                <div className="flex-1 flex items-center gap-3">
                    <div className="w-full bg-background rounded-full h-2.5">
                        <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${(reindexProgress / totalToReindex) * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-medium">{reindexProgress} / {totalToReindex}</span>
                </div>
            ) : (
                <button
                onClick={handleReindexEmbeddings}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                <RefreshCw size={14} /> Force Re-index
                </button>
            )}
        </div>
      </div>

      {/* Cache & Assets */}
      <div className="bg-surface border border-border p-4 rounded-xl">
        <h4 className="text-sm font-semibold flex items-center justify-between mb-2">
          <span>Cache & Assets</span>
          <span className="font-normal text-xs bg-background px-2 py-1 rounded border border-border">
            {cacheSize}
          </span>
        </h4>
        <p className="text-xs text-text-muted mb-4">
          Clear cache space used by inline images and covers to drastically optimize RAM usage. Use cautiously.
        </p>
        <button
          onClick={clearImageCache}
          disabled={isClearingCache || cacheSize === "0.00 KB"}
          className="bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Trash2 size={14} /> Clear Image Cache
        </button>
      </div>

    </div>
  );
};
