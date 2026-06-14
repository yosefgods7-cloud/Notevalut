import React, { useState, useEffect } from "react";
import { Link2, X, Search, FolderInput, Folder, ListTree, Merge, ArrowLeft, Check, Presentation, Columns, Rows } from "lucide-react";
import { useStorage } from "../context/StorageContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { PresentationMode } from "./PresentationMode";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeNoteId: string | null;
  onOpenFind?: () => void;
  onNavigateToNote?: (noteId: string, collectionId: string, workspaceId: string) => void;
  onSplitView?: (mode: 'down' | 'left') => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  activeNoteId,
  onOpenFind,
  onNavigateToNote,
  onSplitView,
}) => {
  const { data, updateNote, deleteNote } = useStorage();
  const [activeTab, setActiveTab] = useState<"context" | "outliner">("context");
  const [headings, setHeadings] = useState<{ text: string; level: number; element: HTMLElement }[]>([]);

  // Merge state
  const [mergeStep, setMergeStep] = useState<"none" | "list" | "preview">("none");
  const [mergeDestinationId, setMergeDestinationId] = useState<string | null>(null);

  // Presentation state
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  const currentNote = activeNoteId ? data.notes.find((n) => n.id === activeNoteId) : null;
  const destinationNote = mergeDestinationId ? data.notes.find(n => n.id === mergeDestinationId) : null;

  useEffect(() => {
    if (!isOpen) {
      setMergeStep("none");
      setMergeDestinationId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== "outliner") return;

    const extractHeadings = () => {
      const editorElement = document.querySelector('.ProseMirror');
      if (!editorElement) return;

      const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5');
      const newHeadings = Array.from(headingElements).map(el => ({
        text: (el as HTMLElement).innerText || '',
        level: parseInt(el.tagName.replace('H', ''), 10),
        element: el as HTMLElement
      })).filter(h => h.text.trim() !== '');

      setHeadings(newHeadings);
    };

    extractHeadings();

    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;

    const observer = new MutationObserver(() => {
      extractHeadings();
    });

    observer.observe(editorElement, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [isOpen, activeTab, currentNote]);

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

  const handleConfirmMerge = () => {
    if (!currentNote || !destinationNote) return;

    const mergedContent = `${destinationNote.content}<br><br><h1>${currentNote.title || 'Untitled Section'}</h1><br>${currentNote.content}`;
    
    // Combine tags and remove duplicates
    const combinedTags = Array.from(new Set([...(destinationNote.tags || []), ...(currentNote.tags || [])]));

    updateNote(destinationNote.id, {
      content: mergedContent,
      tags: combinedTags
    });

    deleteNote(currentNote.id);
    setMergeStep("none");
    setMergeDestinationId(null);
    onClose();
  };

  const backlinks = getBacklinks();

  return (
    <>
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
              <div className="flex border border-border rounded-lg overflow-hidden flex-1 mr-4">
                 <button
                   onClick={() => setActiveTab("context")}
                   className={cn(
                     "flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors",
                     activeTab === "context" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary hover:bg-surface-active"
                   )}
                 >
                   Context
                 </button>
                 <button
                   onClick={() => setActiveTab("outliner")}
                   className={cn(
                     "flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors border-l border-border",
                     activeTab === "outliner" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary hover:bg-surface-active"
                   )}
                 >
                   Outliner
                 </button>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-active rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {mergeStep !== "none" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setMergeStep(mergeStep === "preview" ? "list" : "none")} className="p-1 hover:bg-surface-active rounded">
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {mergeStep === "list" ? "Select Destination" : "Merge Preview"}
                    </h3>
                  </div>

                  {mergeStep === "list" && (
                    <div className="space-y-2">
                       <p className="text-xs text-text-muted mb-3">Choose a note to merge this note into. This note will be deleted after.</p>
                       <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
                         {data.notes.filter(n => n.id !== activeNoteId && !n.isDeleted).map(note => (
                           <button
                             key={note.id}
                             onClick={() => {
                               setMergeDestinationId(note.id);
                               setMergeStep("preview");
                             }}
                             className="w-full text-left p-3 rounded-lg border border-border bg-background hover:border-accent hover:shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-accent group flex items-center justify-between"
                           >
                              <div className="flex-1 truncate pr-2">
                                <h4 className="font-medium text-text-primary text-sm truncate">{note.title || "Untitled"}</h4>
                                <p className="text-xs text-text-muted truncate mt-0.5">
                                  {data.workspaces.find(w => w.id === note.workspaceId)?.name} / {data.collections.find(c => c.id === note.collectionId)?.name}
                                </p>
                              </div>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}

                  {mergeStep === "preview" && destinationNote && currentNote && (
                    <div className="space-y-4 flex flex-col h-full">
                       <p className="text-xs text-text-muted">Review merged content. Tags will be combined without duplicates.</p>
                       <div className="flex-1 bg-background border border-border rounded-lg overflow-y-auto p-3 text-sm text-text-secondary prose prose-sm dark:prose-invert max-h-[50vh]">
                         <div dangerouslySetInnerHTML={{ __html: destinationNote.content || "<i>Empty destination note</i>" }} />
                         <hr className="my-4 border-t border-border" />
                         <h1 className="text-lg font-bold text-text-primary mb-2 mt-4">{currentNote.title || 'Untitled Section'}</h1>
                         <div dangerouslySetInnerHTML={{ __html: currentNote.content || "<i>Empty current note</i>" }} />
                       </div>
                       <div className="flex gap-2 pt-4">
                         <button onClick={() => setMergeStep("list")} className="flex-1 py-2 px-3 border border-border text-text-primary rounded-lg hover:bg-surface-active transition-colors text-sm font-medium">Cancel</button>
                         <button onClick={handleConfirmMerge} className="flex-1 py-2 px-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
                           <Check size={16} /> Confirm
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              ) : activeTab === "context" ? (
                <>
                  <section className="mb-6 space-y-2">
                     <button
                       onClick={() => setMergeStep("list")}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <Merge size={16} /> Merge Note
                     </button>
                     <button
                       onClick={() => {
                         onSplitView?.("down");
                         onClose();
                       }}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <Rows size={16} /> Split Down
                     </button>
                     <button
                       onClick={() => {
                         onSplitView?.("left");
                         onClose();
                       }}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <Columns size={16} /> Split Left
                     </button>
                     <button
                       onClick={() => onOpenFind && onOpenFind()}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <Search size={16} /> Find in Note
                     </button>
                     <button
                       onClick={() => setIsPresentationOpen(true)}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <Presentation size={16} /> Presentation Mode
                     </button>
                     <button
                       onClick={() => setActiveTab("outliner")}
                       className="w-full bg-surface-active hover:bg-border text-text-primary border border-border flex items-center justify-center gap-2 p-3 rounded-lg transition-colors font-medium text-sm shadow-sm"
                     >
                       <ListTree size={16} /> Outliner
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
                </>
              ) : (
                <section>
                   <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                     <ListTree size={14} /> Document Outline
                   </h3>
                   {headings.length === 0 ? (
                     <p className="text-sm text-text-muted italic bg-surface-active p-3 rounded-lg border border-border">
                       No headings found in this document. Add some H1-H5 headers to see the outline.
                     </p>
                   ) : (
                     <div className="space-y-1">
                       {headings.map((heading, i) => (
                         <button
                           key={i}
                           onClick={() => {
                             heading.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                             // Avoid highlighting but we can do a brief pulse effect on the dom element
                             heading.element.style.transition = 'color 0.3s ease';
                             const oldColor = heading.element.style.color;
                             heading.element.style.color = 'var(--accent, #3b82f6)';
                             setTimeout(() => {
                               heading.element.style.color = oldColor;
                             }, 800);
                           }}
                           className={cn(
                             "w-full text-left text-sm py-1.5 px-2 rounded hover:bg-surface-active hover:text-accent transition-colors truncate text-text-primary",
                           )}
                           style={{
                             paddingLeft: `${(heading.level - 1) * 12 + 8}px`,
                             fontWeight: heading.level === 1 ? 600 : heading.level === 2 ? 500 : 400,
                             opacity: Math.max(1 - (heading.level - 1) * 0.15, 0.6)
                           }}
                         >
                           {heading.text}
                         </button>
                       ))}
                     </div>
                   )}
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    <PresentationMode 
      isOpen={isPresentationOpen} 
      onClose={() => setIsPresentationOpen(false)} 
      content={currentNote ? `${currentNote.title ? `<h1>${currentNote.title}</h1>\n` : ''}${currentNote.content || ''}` : ''} 
    />
  </>
  );
};
