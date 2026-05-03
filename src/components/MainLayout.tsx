import React, { useState, useEffect } from 'react';
import { useStorage } from '../context/StorageContext';
import { cn } from '../lib/utils';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { EditorArea } from './EditorArea';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { SettingsModal } from './SettingsModal';

export const MainLayout: React.FC = () => {
  const { data, addNote } = useStorage();
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(data.settings.defaultWorkspace || data.workspaces[0]?.id);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

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
    <div className={cn("flex h-screen w-full overflow-hidden bg-background relative", 
      data.settings.fontSize === 'small' ? 'text-xs md:text-sm' : 
      data.settings.fontSize === 'large' ? 'text-base md:text-lg' : 'text-sm'
    )}>
      
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
          "fixed inset-y-0 left-0 z-30 flex h-full transition-[transform,opacity] duration-300 ease-in-out border-r border-border overflow-x-auto overflow-y-hidden bg-background shadow-2xl",
          isSidebarOpen ? "translate-x-0 w-full max-w-[540px] opacity-100" : "-translate-x-full w-full max-w-[540px] opacity-0 pointer-events-none"
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
      
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {activeCollectionId && activeNoteId ? (
          <EditorArea 
            noteId={activeNoteId} 
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
        className="fixed bottom-8 right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_8px_30px_rgba(124,106,247,0.3)] flex items-center justify-center z-40 transition-transform hover:scale-105 active:scale-95 no-print"
        title="Quick Capture"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    </div>
  );
};
