import React, { useState, useEffect, Suspense, lazy } from "react";
import {
  X,
  ArrowLeft,
  XCircle,
  Plus,
  FilePlus,
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useStorage } from "../context/StorageContext";
import { useAuth } from "../context/AuthContext";
import {
  shouldRunBackup,
  uploadToDrive,
  calculateNextBackupDate,
} from "../lib/drive";
import { cn } from "../lib/utils";
import { Sidebar } from "./Sidebar";
import { NoteList } from "./NoteList";
import { EditorArea } from "./EditorArea";

const ExportModal = lazy(() => import("./ExportModal").then(module => ({ default: module.ExportModal })));
const ImportModal = lazy(() => import("./ImportModal").then(module => ({ default: module.ImportModal })));
const SettingsModal = lazy(() => import("./SettingsModal").then(module => ({ default: module.SettingsModal })));
const BrainMap = lazy(() => import("./BrainMap").then(module => ({ default: module.BrainMap })));
const ReviewArea = lazy(() => import("./ReviewArea").then(module => ({ default: module.ReviewArea })));
const TagManagerModal = lazy(() => import("./TagManagerModal").then(module => ({ default: module.TagManagerModal })));
const BackgroundAIProcessor = lazy(() => import("./BackgroundAIProcessor").then(module => ({ default: module.BackgroundAIProcessor })));
const SecondBrainSidebar = lazy(() => import("./SecondBrainSidebar").then(module => ({ default: module.SecondBrainSidebar })));
const DailyDigestCard = lazy(() => import("./DailyDigestCard").then(module => ({ default: module.DailyDigestCard })));

export const MainLayout: React.FC = () => {
  const { data, addNote, updateSettings } = useStorage();
  const { accessToken } = useAuth();
  const dataRef = React.useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Google Drive background auto-sync
  useEffect(() => {
    const handleAutoSync = async () => {
      const backupSettings = dataRef.current.settings.driveBackup;
      if (shouldRunBackup(backupSettings)) {
        if (!accessToken) return; // Silent return if not authenticated, they can do it manually in settings
        try {
          const fileId = await uploadToDrive(
            accessToken,
            dataRef.current,
            backupSettings?.fileId,
          );
          updateSettings({
            driveBackup: {
              ...backupSettings!,
              lastBackupDate: new Date().toISOString(),
              nextBackupDate: calculateNextBackupDate(
                new Date(),
                backupSettings!.frequency,
              ).toISOString(),
              fileId,
            },
          });
        } catch (e) {
          console.error("Drive auto sync failed", e);
        }
      }
    };

    // Check on mount/accessToken change
    if (dataRef.current.settings.driveBackup?.enabled) {
      handleAutoSync();
    }

    // And check periodically every hour
    const interval = setInterval(
      () => {
        if (dataRef.current.settings.driveBackup?.enabled) {
          handleAutoSync();
        }
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [accessToken, updateSettings]);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    data.settings.defaultWorkspace || data.workspaces[0]?.id,
  );
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"editor" | "brain_map">(
    "editor",
  );

  // Sync openTabs with activeNoteId if activeNoteId changes and is not in openTabs
  useEffect(() => {
    if (activeNoteId && !openTabs.includes(activeNoteId)) {
      setOpenTabs((prev) => [...prev, activeNoteId]);
    }
  }, [activeNoteId, openTabs]);

  const handleCloseTab = (idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((id) => id !== idToClose);
    setOpenTabs(newTabs);

    if (idToClose === activeNoteId) {
      if (newTabs.length > 0) {
        // Find adjacent tab
        const closedIndex = openTabs.indexOf(idToClose);
        const nextId = newTabs[Math.min(closedIndex, newTabs.length - 1)];
        setActiveNoteId(nextId);
        // We might want to find its collection/workspace but keeping it simple for now
        const nextNote = data.notes.find((n) => n.id === nextId);
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
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Auto-collapse sidebar on very small screens
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    if (data.settings.theme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(data.settings.theme);
    }
    
    // Default variables that can be customized
    const cssVars = [
      "--bg", "--surface", "--surface-hover", "--surface-active",
      "--border", "--border-strong", "--accent", "--accent-hover",
      "--accent-transparent", "--text-primary", "--text-secondary",
      "--text-muted", "--doc-text", "--doc-h1", "--doc-h2", "--doc-h3"
    ];
    
    // Clear previously custom styles
    cssVars.forEach(v => root.style.removeProperty(v));
    
    // Apply custom colors if they exist
    if (data.settings.customColors) {
      Object.entries(data.settings.customColors).forEach(([key, val]) => {
        if (val) {
          root.style.setProperty(key, val);
        }
      });
    }
  }, [data.settings.theme, data.settings.customColors]);

  // Set initial collection if none selected but workspace has collections
  useEffect(() => {
    if (activeWorkspaceId && !activeCollectionId) {
      const wsCollections = data.collections.filter(
        (c) => c.workspaceId === activeWorkspaceId,
      );
      if (wsCollections.length > 0) {
        setActiveCollectionId(wsCollections[0].id);
      }
    }
  }, [activeWorkspaceId, activeCollectionId, data.collections]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K (Search)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Since we don't have a global search modal, focus the collection search bar
        const searchInput = document.querySelector(
          'input[placeholder="Search notes..."]',
        ) as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }

      // Cmd/Ctrl + N (New Note)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        if (activeWorkspaceId && activeCollectionId) {
          const newNote = addNote(activeWorkspaceId, activeCollectionId);
          setActiveNoteId(newNote.id);
        }
      }

      // Escape
      if (e.key === "Escape") {
        if (isExportOpen) setExportOpen(false);
        if (isImportOpen) setImportOpen(false);
        if (isSettingsOpen) setSettingsOpen(false);
        if (isTagManagerOpen) setIsTagManagerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeWorkspaceId,
    activeCollectionId,
    addNote,
    isExportOpen,
    isImportOpen,
    isSettingsOpen,
    isTagManagerOpen,
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        document.documentElement.style.setProperty(
          "--vh",
          `${window.visualViewport.height}px`,
        );
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      handleResize();
    }

    return () => {
      if (window.visualViewport)
        window.visualViewport.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden bg-background relative text-sm",
      )}
      style={{ height: "var(--vh, 100dvh)" }}
    >
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
          isSidebarOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-[600px] opacity-0 pointer-events-none",
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
          onOpenTagManager={() => setIsTagManagerOpen(true)}
          onToggleBrainMap={() => {
            if (!openTabs.includes("brain_map")) {
              setOpenTabs((prev) => [...prev, "brain_map"]);
            }
            setActiveNoteId("brain_map");
          }}
          isBrainMapActive={activeNoteId === "brain_map"}
          onToggleReviews={() => {
            if (!openTabs.includes("review_notes")) {
              setOpenTabs((prev) => [...prev, "review_notes"]);
            }
            setActiveNoteId("review_notes");
          }}
          isReviewsActive={activeNoteId === "review_notes"}
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

      <div className={cn("flex-1 flex flex-col min-w-0 h-full relative transition-[padding] duration-300", isFocusMode ? "pl-0" : "pl-20")}>
        {!isFocusMode && openTabs.length > 0 && (
          <div className="flex items-center w-full overflow-x-auto bg-surface border-b border-border h-12 no-print px-2 select-none shrink-0 no-scrollbar relative z-10 shadow-sm border-t">
            <button
              onClick={() => {
                const currentIndex = openTabs.indexOf(activeNoteId || "");
                if (currentIndex > 0) {
                  const prevId = openTabs[currentIndex - 1];
                  setActiveNoteId(prevId);
                  const note = data.notes.find((n) => n.id === prevId);
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
                  const newTabId = "new-tab-" + Date.now();
                  setOpenTabs((prev) => [...prev, newTabId]);
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
                {openTabs.map((tabId) => {
                  const isNewTab = tabId.startsWith("new-tab-");
                  const note = data.notes.find((n) => n.id === tabId);
                  const isActive = tabId === activeNoteId;
                  return (
                    <motion.div
                      key={tabId}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                        transition: { duration: 0.15 },
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
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
                          : "bg-surface-active text-text-muted hover:bg-surface-hover border-transparent",
                      )}
                    >
                      <span className="truncate flex items-center gap-2">
                        {tabId === "brain_map" ? (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
                            </svg>{" "}
                            Brain Map
                          </>
                        ) : tabId === "review_notes" ? (
                          <>
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>{" "}
                            Reviews
                          </>
                        ) : isNewTab ? (
                          "New Tab"
                        ) : (
                          note?.title || "Untitled"
                        )}
                      </span>
                      <button
                        onClick={(e) => handleCloseTab(tabId, e)}
                        className={cn(
                          "p-0.5 rounded-sm hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0",
                          isActive
                            ? "opacity-100"
                            : "sm:opacity-0 sm:group-hover:opacity-100 opacity-100",
                        )}
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
        {activeNoteId === "brain_map" ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-muted">Loading Graph View...</div>}>
            <BrainMap
              activeWorkspaceId={activeWorkspaceId}
              onNavigateToNote={(noteId, collectionId, workspaceId) => {
                setActiveWorkspaceId(workspaceId);
                setActiveCollectionId(collectionId);
                setActiveNoteId(noteId);
                if (!openTabs.includes(noteId)) {
                  setOpenTabs((prev) => [...prev, noteId]);
                }
              }}
              onClose={() =>
                handleCloseTab("brain_map", { stopPropagation: () => {} } as any)
              }
            />
          </Suspense>
        ) : activeNoteId === "review_notes" ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-text-muted">Loading Learn Area...</div>}>
            <ReviewArea onClose={() => handleCloseTab("review_notes", { stopPropagation: () => {} } as any)} />
          </Suspense>
        ) : activeNoteId?.startsWith("new-tab-") ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background h-full w-full relative z-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute top-4 left-4 p-2 bg-surface hover:bg-surface-hover rounded-md text-text-secondary transition-colors z-10 md:hidden"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2 className="text-2xl font-semibold mb-8 text-text-primary">
              New Tab
            </h2>
            <div className="flex flex-col gap-4 w-full max-w-sm">
              <button
                onClick={() => {
                  if (activeCollectionId && activeWorkspaceId) {
                    const newNote = addNote(
                      activeWorkspaceId,
                      activeCollectionId,
                    );
                    setOpenTabs((prev) =>
                      prev.map((t) => (t === activeNoteId ? newNote.id : t)),
                    );
                    setActiveNoteId(newNote.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  } else if (
                    data.workspaces.length > 0 &&
                    data.collections.length > 0
                  ) {
                    const col = data.collections[0];
                    const newNote = addNote(col.workspaceId, col.id);
                    setActiveWorkspaceId(col.workspaceId);
                    setActiveCollectionId(col.id);
                    setOpenTabs((prev) =>
                      prev.map((t) => (t === activeNoteId ? newNote.id : t)),
                    );
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
            onToggleSidebar={() => {
              const newSidebarOpen = !isSidebarOpen;
              setIsSidebarOpen(newSidebarOpen);
              if (newSidebarOpen && isFocusMode) {
                setIsFocusMode(false);
              }
            }}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => {
              const newMode = !isFocusMode;
              setIsFocusMode(newMode);
              if (newMode) setIsSidebarOpen(false);
            }}
            onOpenExport={() => setExportOpen(true)}
            onDeleteNote={() =>
              handleCloseTab(activeNoteId, { stopPropagation: () => {} } as any)
            }
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            <div className="flex flex-col items-center justify-center p-8 max-h-screen overflow-y-auto no-scrollbar w-full">
               <Suspense fallback={null}>
                  <DailyDigestCard 
                     onOpenNote={(noteId) => {
                        const note = data.notes.find(n => n.id === noteId);
                        if (note) {
                           setActiveWorkspaceId(note.workspaceId);
                           setActiveCollectionId(note.collectionId);
                           setActiveNoteId(noteId);
                           if (!openTabs.includes(noteId)) {
                             setOpenTabs((prev) => [...prev, noteId]);
                           }
                        }
                     }}
                  />
               </Suspense>
               
               {!data.settings.plugins?.dailyDigest?.enabled && (
                  <p className="mt-8">Select a note or create a new one</p>
               )}
            </div>
            
          </div>
        )}
      </div>

      {/* Modals & Background Processes */}
      <Suspense fallback={null}>
        {isExportOpen && (
          <ExportModal
            isOpen={isExportOpen}
            onClose={() => setExportOpen(false)}
            activeCollectionId={activeCollectionId}
            activeNoteId={activeNoteId}
          />
        )}
        {isImportOpen && (
          <ImportModal
            isOpen={isImportOpen}
            onClose={() => setImportOpen(false)}
            activeWorkspaceId={activeWorkspaceId}
            activeCollectionId={activeCollectionId}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setSettingsOpen(false)}
            onOpenExport={() => setExportOpen(true)}
          />
        )}
        {isTagManagerOpen && (
          <TagManagerModal onClose={() => setIsTagManagerOpen(false)} />
        )}
        <BackgroundAIProcessor />
        <SecondBrainSidebar />
      </Suspense>

      {/* Quick Capture Floating Action Button */}
      <button
        onClick={() => {
          if (activeWorkspaceId && activeCollectionId) {
            const newNote = addNote(
              activeWorkspaceId,
              activeCollectionId,
              "Quick Capture",
              "",
            );
            setActiveNoteId(newNote.id);
          }
        }}
        className="fixed bottom-[8.5rem] right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_8px_30px_rgba(124,106,247,0.3)] flex items-center justify-center z-40 transition-transform hover:scale-105 active:scale-95 no-print"
        title="Quick Capture"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <BackgroundAIProcessor />
      <SecondBrainSidebar />
    </div>
  );
};
