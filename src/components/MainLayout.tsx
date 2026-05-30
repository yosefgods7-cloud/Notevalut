import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, XCircle, Plus, FilePlus, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStorage } from '../context/StorageContext';
import { cn } from '../lib/utils';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { EditorArea } from './EditorArea';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { SettingsModal } from './SettingsModal';
import { BrainMap } from './BrainMap';

export const MainLayout: React.FC = () => {
  const { data, addNote } = useStorage();
  
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(data.settings.defaultWorkspace || data.workspaces[0]?.id);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'editor' | 'brain_map'>('editor');

  // Sync openTabs with activeNoteId if activeNoteId changes and is not in openTabs
  useEffect(() => {
    if (activeNoteId && !openTabs.includes(activeNoteId)) {
      setOpenTabs(prev => [...prev, activeNoteId]);
    }
  }, [activeNoteId, openTabs]);

  const handleCloseTab = (idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(id => id !== idToClose);
    setOpenTabs(newTabs);

    if (idToClose === activeNoteId) {
      if (newTabs.length > 0) {
        // Find adjacent tab
        const closedIndex = openTabs.indexOf(idToClose);
        const nextId = newTabs[Math.min(closedIndex, newTabs.length - 1)];
        setActiveNoteId(nextId);
        // We might want to find its collection/workspace but keeping it simple for now
        const nextNote = data.notes.find(n => n.id === nextId);
        if (nextNote) {
          setActiveCollectionId(nextNote.collectionId);
          setActiveWorkspaceId(nextNote.workspaceId);
        }
      } else {
        setActiveNoteId(null);
      }
    }
  };

  const handleCloseAllTabs = () => {
    setOpenTabs([]);
    setActiveNoteId(null);
  };


  const [isExportOpen, setExportOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto-collapse sidebar on very small screens
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (data.settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(data.settings.theme);
    }
  }, [data.settings.theme]);

  // Set initial collection if none selected but workspace has collections
  useEffect(() => {
    if (activeWorkspaceId && !activeCollectionId) {
      const wsCollections = data.collections.filter(c => c.workspaceId === activeWorkspaceId);
      if (wsCollections.length > 0) {
        setActiveCollectionId(wsCollections[0].id);
      }
    }
  }, [activeWorkspaceId, activeCollectionId, data.collections]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K (Search)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Since we don't have a global search modal, focus the collection search bar
        const searchInput = document.querySelector('input[placeholder="Search notes..."]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      
      // Cmd/Ctrl + N (New Note)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (activeWorkspaceId && activeCollectionId) {
          const newNote = addNote(activeWorkspaceId, activeCollectionId);
          setActiveNoteId(newNote.id);
        }
      }
      
      // Escape
      if (e.key === 'Escape') {
        if (isExportOpen) setExportOpen(false);
        if (isImportOpen) setImportOpen(false);
        if (isSettingsOpen) setSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkspaceId, activeCollectionId, addNote, isExportOpen, isImportOpen, isSettingsOpen]);

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-background relative text-sm")}>
      
      {/* Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebars wrapping div */}
      <div 
        className={cn(
          "fixed top-4 left-4 z-40 flex max-h-[calc(100vh-2rem)] rounded-xl transition-[transform,opacity] duration-300 ease-in-out border border-border overflow-hidden bg-background shadow-2xl drop-shadow-2xl",
          isSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[600px] opacity-0 pointer-events-none"
        )}
      >
        <Sidebar 
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspaceId={setActiveWorkspaceId}
          activeCollectionId={activeCollectionId}
          setActiveCollectionId={setActiveCollectionId}
          onOpenExport={() => setExportOpen(true)}
          onOpenImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleBrainMap={() => setCurrentView(prev => prev === 'brain_map' ? 'editor' : 'brain_map')}
          isBrainMapActive={currentView === 'brain_map'}
        />
        
        {activeCollectionId ? (
          <NoteList 
            activeWorkspaceId={activeWorkspaceId}
            activeCollectionId={activeCollectionId}
            activeNoteId={activeNoteId}
            setActiveNoteId={(id) => {
              setActiveNoteId(id);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
          />
        ) : (
          <div className="w-[300px] bg-surface flex flex-col items-center justify-center text-text-muted text-sm border-l border-border px-8 text-center shrink-0 h-full">
            <p>Select a collection to view notes</p>
          </div>
        )}
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 h-full relative pl-20">
        {openTabs.length > 0 && currentView === 'editor' && (
          <div className="flex items-center w-full overflow-x-auto bg-surface border-b border-border h-12 no-print px-2 select-none shrink-0 no-scrollbar relative z-10 shadow-sm border-t">
            <button 
              onClick={() => {
                const currentIndex = openTabs.indexOf(activeNoteId || '');
                if (currentIndex > 0) {
                     const prevId = openTabs[currentIndex - 1];
                     setActiveNoteId(prevId);
                     const note = data.notes.find(n => n.id === prevId);
                     if (note) {
                       setActiveCollectionId(note.collectionId);
                       setActiveWorkspaceId(note.workspaceId);
                     }
                }
              }}
              className="p-1.5 mx-1 hover:bg-surface-active rounded text-text-muted hover:text-text-primary transition-colors"
              title="Previous Tab"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="relative mx-1">
              <button 
                onClick={() => {
                  const newTabId = 'new-tab-' + Date.now();
                  setOpenTabs(prev => [...prev, newTabId]);
                  setActiveNoteId(newTabId);
                }}
                className="p-1.5 hover:bg-surface-active rounded text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
                title="Open New Tab"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="w-px h-5 bg-border mx-2"></div>
            
            <div className="flex items-end h-full gap-1 pt-1.5">
              <AnimatePresence>
                {openTabs.map(tabId => {
                  const isNewTab = tabId.startsWith('new-tab-');
                  const note = data.notes.find(n => n.id === tabId);
                  const isActive = tabId === activeNoteId;
                  return (
                    <motion.div
                      key={tabId}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      onClick={() => {
                        setActiveNoteId(tabId);
                        if (note) {
                          setActiveCollectionId(note.collectionId);
                          setActiveWorkspaceId(note.workspaceId);
                        }
                      }}
                      className={cn(
                        "group flex items-center justify-between gap-3 px-3 min-w-[120px] max-w-[200px] cursor-pointer text-sm font-medium transition-colors rounded-t-lg border-t border-x border-b-0 h-full",
                        isActive 
                          ? "bg-background text-text-primary border-border border-t-accent" 
                          : "bg-surface-active text-text-muted hover:bg-surface-hover border-transparent"
                      )}
                    >
                      <span className="truncate">{isNewTab ? 'New Tab' : (note?.title || 'Untitled')}</span>
                      <button
                        onClick={(e) => handleCloseTab(tabId, e)}
                        className={cn(
                          "p-0.5 rounded-sm hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0",
                          isActive ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
                        )}
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
        {currentView === 'brain_map' ? (
          <BrainMap 
            activeWorkspaceId={activeWorkspaceId}
             onNavigateToNote={(noteId, collectionId, workspaceId) => {
               setActiveWorkspaceId(workspaceId);
               setActiveCollectionId(collectionId);
               setActiveNoteId(noteId);
               setCurrentView('editor');
             }}
             onClose={() => setCurrentView('editor')}
          />
        ) : activeNoteId?.startsWith('new-tab-') ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background h-full w-full relative z-0">
             <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="absolute top-4 left-4 p-2 bg-surface hover:bg-surface-hover rounded-md text-text-secondary transition-colors z-10 md:hidden"
             >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
             </button>
             <h2 className="text-2xl font-semibold mb-8 text-text-primary">New Tab</h2>
             <div className="flex flex-col gap-4 w-full max-w-sm">
                <button 
                  onClick={() => {
                    if (activeCollectionId && activeWorkspaceId) {
                       const newNote = addNote(activeWorkspaceId, activeCollectionId);
                       setOpenTabs(prev => prev.map(t => t === activeNoteId ? newNote.id : t));
                       setActiveNoteId(newNote.id);
                       if (window.innerWidth < 768) setIsSidebarOpen(false);
                    } else if (data.workspaces.length > 0 && data.collections.length > 0) {
                       const col = data.collections[0];
                       const newNote = addNote(col.workspaceId, col.id);
                       setActiveWorkspaceId(col.workspaceId);
                       setActiveCollectionId(col.id);
                       setOpenTabs(prev => prev.map(t => t === activeNoteId ? newNote.id : t));
                       setActiveNoteId(newNote.id);
                    } else {
                       alert("Please create a workspace and collection first.");
                       setIsSidebarOpen(true);
                    }
                  }}
                  className="p-4 bg-surface hover:bg-surface-hover border border-border rounded-xl flex items-center justify-center gap-3 text-text-primary transition-all hover:border-accent group shadow-sm hover:shadow"
                >
                  <FilePlus className="text-accent group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Create New Note</span>
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-4 bg-surface hover:bg-surface-hover border border-border rounded-xl flex items-center justify-center gap-3 text-text-primary transition-all hover:border-accent group shadow-sm hover:shadow"
                >
                  <FolderOpen className="text-accent group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Open Existing Note</span>
                </button>
                <div className="h-4"></div>
                <button 
                  onClick={handleCloseAllTabs}
                  className="p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/50 rounded-xl flex items-center justify-center gap-3 text-red-500 transition-all group shadow-sm"
                >
                  <XCircle className="group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Close All Tabs</span>
                </button>
             </div>
          </div>
        ) : activeCollectionId && activeNoteId ? (
          <EditorArea 
            noteId={activeNoteId} 
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onNavigateToNote={(noteId, collectionId, workspaceId) => {
              setActiveWorkspaceId(workspaceId);
              setActiveCollectionId(collectionId);
              setActiveNoteId(noteId);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted bg-background h-full relative">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute top-4 left-4 p-2 bg-surface hover:bg-surface-hover rounded-md text-text-secondary transition-colors z-10"
              title="Toggle Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <p>Select a note or create a new one</p>
          </div>
        )}
      </div>

      <ExportModal 

        isOpen={isExportOpen} 
        onClose={() => setExportOpen(false)} 
        activeCollectionId={activeCollectionId} 
      />
      <ImportModal 
        isOpen={isImportOpen} 
        onClose={() => setImportOpen(false)} 
        activeWorkspaceId={activeWorkspaceId} 
        activeCollectionId={activeCollectionId} 
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Quick Capture Floating Action Button */}
      <button 
        onClick={() => {
          if (activeWorkspaceId && activeCollectionId) {
            const newNote = addNote(activeWorkspaceId, activeCollectionId, 'Quick Capture', '');
            setActiveNoteId(newNote.id);
          }
        }}
        className="fixed bottom-[4.5rem] right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_8px_30px_rgba(124,106,247,0.3)] flex items-center justify-center z-40 transition-transform hover:scale-105 active:scale-95 no-print"
        title="Quick Capture"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    </div>
  );
};
