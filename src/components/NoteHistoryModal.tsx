import React, { useState, useEffect } from 'react';
import { X, Clock, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface NoteHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onRestore: (content: string) => void;
}

export const NoteHistoryModal: React.FC<NoteHistoryModalProps> = ({ isOpen, onClose, noteId, onRestore }) => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(`notevault_history_${noteId}`);
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    }
  }, [isOpen, noteId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2"><Clock size={20} className="text-accent"/> Version History</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {history.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No version history available.</p>
          ) : (
            history.map((version, idx) => (
              <div key={idx} className="p-3 bg-surface-active border border-border rounded-lg flex items-center justify-between group">
                <div>
                  <div className="text-sm font-medium">{format(new Date(version.timestamp), 'MMM d, yyyy h:mm a')}</div>
                  <div className="text-xs text-text-muted">{version.wordCount} words</div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Restore this version? Current changes will be overwritten.')) {
                      onRestore(version.content);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded text-xs font-medium text-text-secondary hover:text-accent hover:border-accent transition-colors opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
