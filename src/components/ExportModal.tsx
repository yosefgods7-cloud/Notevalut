import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { exportToJSON, exportToMarkdown, exportToPlainText, printNotes } from '../lib/export';
import { X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCollectionId: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, activeCollectionId }) => {
  const { data } = useStorage();
  const [scope, setScope] = useState<'all' | 'collection' | 'selected'>('all');
  const [format, setFormat] = useState<'json' | 'markdown' | 'pdf' | 'text'>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  
  if (!isOpen) return null;

  // Simplified: For now we'll just allow exporting ALL or CURRENT COLLECTION
  // Multi-select requires NoteList integration which we can skip for brevity if 'all' is sufficient
  
  const getSelectedIds = () => {
    if (scope === 'collection' && activeCollectionId) {
      return data.notes.filter(n => n.collectionId === activeCollectionId).map(n => n.id);
    }
    return data.notes.map(n => n.id);
  };
  
  const notesCount = getSelectedIds().length;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const ids = getSelectedIds();
      if (format === 'json') await exportToJSON(data, ids);
      if (format === 'markdown') await exportToMarkdown(data, ids);
      if (format === 'text') await exportToPlainText(data, ids);
      if (format === 'pdf') printNotes(data, ids);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Export Notes</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-6">
          {/* Scope Selection */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Selection</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-accent w-4 h-4" />
                <span>All {data.notes.length} notes</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="scope" checked={scope === 'collection'} onChange={() => setScope('collection')} disabled={!activeCollectionId} className="accent-accent w-4 h-4" />
                <span className={cn(!activeCollectionId && "opacity-50")}>Current collection</span>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Format</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['markdown', 'json', 'pdf', 'text'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-4 py-3 border rounded-lg text-left transition-colors flex flex-col gap-1",
                    format === f 
                      ? "border-accent bg-accent/10" 
                      : "border-border hover:border-border-strong bg-surface-active"
                  )}
                >
                  <span className="font-semibold capitalize">{f === 'json' ? 'JSON Backup' : f}</span>
                  <span className="text-xs text-text-muted">
                    {f === 'markdown' && "Zip of .md files"}
                    {f === 'json' && "Raw data restore"}
                    {f === 'pdf' && "Print format"}
                    {f === 'text' && "Plain .txt files"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-border hover:bg-surface-active transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleExport} 
            disabled={isExporting || notesCount === 0}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none text-white font-medium rounded-md transition-colors flex items-center gap-2"
          >
            {isExporting ? 'Exporting...' : `Export ${notesCount} notes`}
          </button>
        </div>
      </div>
    </div>
  );
};
