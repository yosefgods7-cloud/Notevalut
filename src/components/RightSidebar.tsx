import React, { useState } from "react";
import { Link2, X, Search, FolderInput, Folder } from "lucide-react";
import { useStorage } from "../context/StorageContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeNoteId: string | null;
  onOpenFind?: () => void;
  onNavigateToNote?: (noteId: string, collectionId: string, workspaceId: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  activeNoteId,
  onOpenFind,
  onNavigateToNote,
}) => {
  const { data, updateNote } = useStorage();

  const currentNote = activeNoteId ? data.notes.find((n) => n.id === activeNoteId) : null;

  const getBacklinks = () => {
    if (!activeNoteId) return [];
    if (!currentNote || !currentNote.title) return [];

    const currentNoteTitle = currentNote.title.toLowerCase();

    // Check all OTHER notes to see if they link to this one
    // Specifically looking for [[Note Title]]
    const linkPattern = new RegExp(`\\[\\[${currentNoteTitle}\\]\\]`, "i");

    return data.notes.filter((n) => {
      if (n.id === activeNoteId || n.isDeleted) return false;
      return linkPattern.test(n.content) || n.content.toLowerCase().includes(currentNoteTitle);
    });
  };

  const backlinks = getBacklinks();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 lg:hidden" // Backdrop for mobile
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 h-[var(--vh,100dvh)] w-80 max-w-[calc(100vw-3rem)] bg-surface border-l border-border shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
              <h2 className="font-bold text-text-primary flex items-center gap-2">
                <Link2 size={18} className="text-accent" /> Notes Context
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-active rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section className="mb-6">
                 <button
                   onClick={() => onOpenFind && onOpenFind()}
                   className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                 >
                   <Search size={16} /> Find in Note
                 </button>
              </section>

              {currentNote && (
                 <section className="mb-6 space-y-3">
                   <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                     <FolderInput size={14} /> Change Folder
                   </h3>
                   
                   <div className="bg-surface-active border border-border rounded-lg p-3 text-sm">
                     <p className="text-text-muted text-xs mb-1">Current Folder</p>
                     <div className="flex items-center gap-2 text-text-primary font-medium">
                       <Folder size={14} className="text-accent" />
                       <span className="truncate">{data.collections.find(c => c.id === currentNote.collectionId)?.name || 'Unknown'}</span>
                       <span className="text-text-muted text-xs font-normal shrink-0">
                         ({data.workspaces.find(w => w.id === currentNote.workspaceId)?.name || 'Unknown'})
                       </span>
                     </div>
                   </div>
                   
                   <div className="bg-background border border-border rounded-lg max-h-56 overflow-y-auto no-scrollbar">
                     {data.workspaces.map(ws => {
                       const wsCollections = data.collections.filter(c => c.workspaceId === ws.id);
                       if (wsCollections.length === 0) return null;
                       return (
                         <div key={ws.id} className="py-2 border-b border-border/50 last:border-0">
                           <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-text-muted uppercase opacity-70">
                             {ws.name}
                           </div>
                           {wsCollections.map(col => {
                              const isCurrent = currentNote.collectionId === col.id;
                              return (
                                <button
                                  key={col.id}
                                  onClick={() => {
                                    if (!isCurrent) {
                                      updateNote(currentNote.id, {
                                        collectionId: col.id,
                                        workspaceId: ws.id,
                                      });
                                    }
                                  }}
                                  disabled={isCurrent}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors
                                    ${isCurrent ? 'bg-accent/10 text-accent cursor-default' : 'text-text-primary hover:bg-surface-active hover:text-accent'}
                                  `}
                                >
                                  <Folder size={14} className={isCurrent ? "text-accent" : "text-text-muted"} />
                                  <span className="truncate">{col.name}</span>
                                  {isCurrent && <span className="ml-auto text-[10px] bg-accent/20 px-1.5 rounded-full text-accent whitespace-nowrap">Current</span>}
                                </button>
                              )
                           })}
                         </div>
                       )
                     })}
                   </div>
                 </section>
              )}

              <section>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Link2 size={14} /> Backlinks {backlinks.length > 0 && `(${backlinks.length})`}
                </h3>
                {backlinks.length === 0 ? (
                  <p className="text-sm text-text-muted italic bg-surface-active p-3 rounded-lg border border-border">
                    No notes currently link to this note.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {backlinks.map((note) => {
                      // Get a snippet
                      const contentText = note.content.replace(/<[^>]*>?/gm, '');
                      const snippet = contentText.length > 80 ? contentText.substring(0, 80) + "..." : contentText;

                      return (
                        <div
                          key={note.id}
                          className="bg-background border border-border rounded-lg p-3 hover:border-accent hover:shadow-md cursor-pointer transition-all"
                          onClick={() => {
                             if (onNavigateToNote) {
                               onNavigateToNote(note.id, note.collectionId, note.workspaceId);
                             }
                          }}
                        >
                          <h4 className="font-medium text-sm text-text-primary mb-1 line-clamp-1">
                            {note.title || "Untitled Note"}
                          </h4>
                          <p className="text-xs text-text-secondary line-clamp-2">
                            {snippet || "Empty note"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
