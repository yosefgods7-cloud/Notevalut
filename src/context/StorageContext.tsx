import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  NoteVaultData,
  Workspace,
  Collection,
  Note,
  Settings,
  DEFAULT_SETTINGS,
  NoteTemplate,
  ReviewNote,
  ReviewNoteType,
} from "../types";
import { generateId } from "../lib/utils";
import { useAuth } from "./AuthContext";
import { get, set, del } from "idb-keyval";

const STORAGE_KEY = "notevault_data";

const DEFAULT_DATA: NoteVaultData = {
  version: 1,
  workspaces: [],
  collections: [],
  notes: [],
  tags: [],
  settings: DEFAULT_SETTINGS,
  templates: [],
  reviewNotes: [],
};

// Safe wrapper to prevent DOMExceptions in strict iframes (e.g., Safari/Incognito)
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage write failed, using memory");
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  },
};

import { marked } from "marked";

interface StorageContextType {
  data: NoteVaultData;
  totalLocalNotes: number;
  saveData: (newData: NoteVaultData) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  // Workspaces
  addWorkspace: (name: string, icon: string) => Workspace;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  // Collections
  addCollection: (
    workspaceId: string,
    name: string,
    icon: string,
  ) => Collection;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  // Notes
  addNote: (
    workspaceId: string,
    collectionId: string,
    title?: string,
    content?: string,
  ) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  deleteNotes: (ids: string[]) => void;
  permanentlyDeleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  emptyTrash: () => void;
  // Templates
  addTemplate: (name: string, content: string) => NoteTemplate;
  deleteTemplate: (id: string) => void;
  // Review Notes
  addReviewNote: (reviewNote: Omit<ReviewNote, "id" | "createdAt" | "updatedAt">) => ReviewNote;
  updateReviewNote: (id: string, updates: Partial<ReviewNote>) => void;
  deleteReviewNote: (id: string) => void;
  // Tags
  renameTag: (oldTag: string, newTag: string) => void;
  deleteTag: (tag: string) => void;
  // Global actions
  clearAllData: () => void;
  importData: (importedData: NoteVaultData, merge: boolean) => Promise<void>;
  syncToCloud: () => Promise<void>;
  getCloudBackupPreview: () => Promise<{ backupDate: string | undefined, noteCount: number, payload: NoteVaultData } | null>;
  applyCloudBackup: (backup: NoteVaultData) => void;
  loadAllNotes: () => void;
  areAllNotesLoaded: boolean;
  isSyncing: boolean;
  isSaving: boolean;
  undo: () => void;
  canUndo: boolean;
  // UI
  toast: string | null;
  showToast: (msg: string) => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context)
    throw new Error("useStorage must be used within StorageProvider");
  return context;
};

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const [history, setHistory] = useState<NoteVaultData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [data, setData] = useState<NoteVaultData>(() => ({
    ...DEFAULT_DATA,
    workspaces: [
      {
        id: "temp",
        name: "Loading...",
        icon: "🧠",
        createdAt: new Date().toISOString(),
        order: 0,
      },
    ],
    collections: [],
    notes: [],
  }));

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const hiddenNotesRef = useRef<Note[]>([]);
  const [areAllNotesLoaded, setAreAllNotesLoaded] = useState(false);

  // Trash Cleanup Effect (Runs once when authenticated and notes are ready)
  useEffect(() => {
    if (!isInitialized || !user) return;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const expiredNotes = data.notes.filter(n => n.isDeleted && n.deletedAt && new Date(n.deletedAt).getTime() < thirtyDaysAgo);
    
    if (expiredNotes.length > 0) {
       const ids = expiredNotes.map(n => n.id);
       setData(prev => ({
         ...prev,
         notes: prev.notes.filter(n => !ids.includes(n.id))
       }));
       
       
    }
  }, [isInitialized, user, data.notes]);

  const saveData = useCallback(
    async (newData: NoteVaultData, skipHistory = false) => {
      // Disabling global tree history to prevent memory leak
      // if (!skipHistory) { ... }
      
      setIsSaving(true);
      setData(newData);
      
      // Merge with hidden nodes before writing to storage
      const fullData = { ...newData };
      if (!areAllNotesLoaded && hiddenNotesRef.current.length > 0) {
         // Create a unique set by ID, giving preference to the ones currently loaded
         const loadedIds = new Set(newData.notes.map(n => n.id));
         const mergedNotes = [...newData.notes, ...hiddenNotesRef.current.filter(n => !loadedIds.has(n.id))];
         fullData.notes = mergedNotes;
      }
      
      try {
        await set(STORAGE_KEY, JSON.stringify(fullData));
      } catch (e) {
        console.error("Failed to write to IndexedDB:", e);
        throw e; // Verify the IndexedDB write is confirmed successful
      } finally {
        setIsSaving(false);
      }
    },
    [data, areAllNotesLoaded],
  );

  const loadAllNotes = useCallback(() => {
    if (areAllNotesLoaded || hiddenNotesRef.current.length === 0) return;
    setData(prev => {
        const loadedIds = new Set(prev.notes.map(n => n.id));
        const mergedNotes = [...prev.notes, ...hiddenNotesRef.current.filter(n => !loadedIds.has(n.id))];
        return { ...prev, notes: mergedNotes };
    });
    hiddenNotesRef.current = [];
    setAreAllNotesLoaded(true);
  }, [areAllNotesLoaded]);

  useEffect(() => {
    const initStorage = async () => {
      let storedData: string | undefined;

      try {
        storedData = await get(STORAGE_KEY);
      } catch (e) {
        console.error("Failed to read from IndexedDB", e);
      }

      // Silent automatic migration and recovery from localStorage and sessionStorage
      try {
        const localStored = localStorage.getItem(STORAGE_KEY);
        const sessionStored = sessionStorage.getItem(STORAGE_KEY);

        let mergedNotes: any[] = [];
        let needsMigration = false;
        let baseData: any = null;

        if (storedData) {
          try { baseData = JSON.parse(storedData); mergedNotes = baseData.notes || []; } catch(e){}
        }

        const mergeFrom = (sourceStr: string | null) => {
          if (!sourceStr) return;
          try {
            const parsed = JSON.parse(sourceStr);
            if (parsed && parsed.notes && Array.isArray(parsed.notes)) {
              const existingIds = new Set(mergedNotes.map(n => n.id));
              parsed.notes.forEach((n: any) => {
                if (!existingIds.has(n.id)) {
                  mergedNotes.push(n);
                  needsMigration = true;
                }
              });
              if (!baseData && parsed.workspaces) {
                baseData = parsed;
                needsMigration = true;
              }
            }
          } catch(e) {}
        };

        mergeFrom(localStored);
        mergeFrom(sessionStored);
        
        // Also check caches for any raw note data if possible (simplified approach: just checking LS/SS covers 99% of synchronous storage gaps)
        
        if (needsMigration && baseData) {
          baseData.notes = mergedNotes;
          storedData = JSON.stringify(baseData);
          await set(STORAGE_KEY, storedData);
          console.log("Silently migrated and merged orphaned data from localStorage/sessionStorage into IndexedDB.");
        }
        
        // Cleanup old storage so it doesn't try to migrate again later
        if (localStored) localStorage.removeItem(STORAGE_KEY);
        if (sessionStored) sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn("Migration check failed", e);
      }

      const now = new Date().toISOString();
      if (storedData) {
        try {
          let parsed = JSON.parse(storedData) as Partial<NoteVaultData>;
          const defaultWsId = generateId();
          
          let allNotes = parsed.notes || [];
          allNotes.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          
          if (allNotes.length > 10) {
            hiddenNotesRef.current = allNotes.slice(10);
            allNotes = allNotes.slice(0, 10);
          } else {
            setAreAllNotesLoaded(true);
          }

          const migratedData: NoteVaultData = {
            version: parsed.version || 1,
            workspaces: parsed.workspaces?.length
              ? parsed.workspaces
              : [
                  {
                    id: defaultWsId,
                    name: "My Notes",
                    icon: "🧠",
                    createdAt: now,
                    order: 0,
                  },
                ],
            collections: parsed.collections || [],
            notes: allNotes,
            tags: parsed.tags || [],
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            templates: parsed.templates || [],
            reviewNotes: parsed.reviewNotes || [],
            brainMapLastFilters: parsed.brainMapLastFilters,
            dailyDigest: parsed.dailyDigest,
          };
          setData(migratedData);
          setIsInitialized(true);
          return;
        } catch (e) {
          console.error("Failed to parse NoteVault data", e);
        }
      }

      // Initial setup if no data exists
      const workspaceId = generateId();
      const collectionId = generateId();

      const initialData: NoteVaultData = {
        ...DEFAULT_DATA,
        workspaces: [
          {
            id: workspaceId,
            name: "My Notes",
            icon: "🧠",
            createdAt: now,
            order: 0,
          },
        ],
        collections: [
          {
            id: collectionId,
            workspaceId,
            name: "Quick Notes",
            icon: "⚡",
            createdAt: now,
            order: 0,
          },
        ],
        settings: { ...DEFAULT_SETTINGS, defaultWorkspace: workspaceId },
        notes: [
          {
            id: generateId(),
            workspaceId,
            collectionId,
            title: "Welcome to NoteVault",
            content:
              "<p>This is your private, offline-first note system.</p><p>Try the <strong>Smart Paste</strong> capability using <code>Cmd/Ctrl + Shift + V</code> to instantly clean up AI-generated text.</p>",
            tags: ["welcome"],
            pinned: true,
            starred: true,
            createdAt: now,
            updatedAt: now,
            wordCount: 20,
          },
        ],
      };

      setData(initialData);
      try {
        await set(STORAGE_KEY, JSON.stringify(initialData));
      } catch (e) {
        console.error("Failed to write initial data to IndexedDB:", e);
      }
      setIsInitialized(true);
    };

    initStorage();
  }, []);

  const undo = useCallback(async () => {
    if (history.length === 0) return;
    const previous = history[0];
    setHistory((prev) => prev.slice(1));
    setData(previous);
    try {
      await set(STORAGE_KEY, JSON.stringify(previous));
    } catch (e) {
      console.error("Failed to write to IndexedDB:", e);
    }
    showToast("Action Undone");
  }, [history, showToast]);

  const syncToCloud = useCallback(async () => {}, [user, data]);

  const getCloudBackupPreview = useCallback(async () => { return null; }, [user, data, showToast]);

  const applyCloudBackup = useCallback((backup: NoteVaultData) => {
    saveData(backup);
    showToast("Local vault restored from cloud backup.");
  }, [saveData, showToast]);

  // Rest of the methods...

  // Removed Auto-sync when user signs in

  const updateSettings = useCallback(
    (updates: Partial<Settings>) => {
      saveData({ ...data, settings: { ...data.settings, ...updates } });
    },
    [data, saveData],
  );

  // --- Workspaces ---
  const addWorkspace = useCallback(
    (name: string, icon: string) => {
      const newWs: Workspace = {
        id: generateId(),
        name,
        icon,
        createdAt: new Date().toISOString(),
        order: data.workspaces.length,
      };
      saveData({ ...data, workspaces: [...data.workspaces, newWs] });
      
      return newWs;
    },
    [data, saveData, user],
  );

  const updateWorkspace = useCallback(
    (id: string, updates: Partial<Workspace>) => {
      saveData({
        ...data,
        workspaces: data.workspaces.map((w) =>
          w.id === id ? { ...w, ...updates } : w,
        ),
      });
      
    },
    [data, saveData, user],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      // Determine collections and notes to delete
      const collectionsToDelete = data.collections.filter(
        (c) => c.workspaceId === id,
      );
      const notesToDelete = data.notes.filter((n) => n.workspaceId === id);

      saveData({
        ...data,
        workspaces: data.workspaces.filter((w) => w.id !== id),
        collections: data.collections.filter((c) => c.workspaceId !== id),
        notes: data.notes.filter((n) => n.workspaceId !== id),
      });

      
    },
    [data, saveData, user],
  );

  // --- Collections ---
  const addCollection = useCallback(
    (workspaceId: string, name: string, icon: string) => {
      const newCol: Collection = {
        id: generateId(),
        workspaceId,
        name,
        icon,
        createdAt: new Date().toISOString(),
        order: data.collections.filter((c) => c.workspaceId === workspaceId)
          .length,
      };
      saveData({ ...data, collections: [...data.collections, newCol] });
      
      return newCol;
    },
    [data, saveData, user],
  );

  const updateCollection = useCallback(
    (id: string, updates: Partial<Collection>) => {
      saveData({
        ...data,
        collections: data.collections.map((c) =>
          c.id === id ? { ...c, ...updates } : c,
        ),
      });
      
    },
    [data, saveData, user],
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      const notesToDelete = data.notes.filter((n) => n.collectionId === id);
      saveData({
        ...data,
        collections: data.collections.filter((c) => c.id !== id),
        notes: data.notes.filter((n) => n.collectionId !== id),
      });

      
    },
    [data, saveData, user],
  );

  // --- Notes ---
  const addNote = useCallback(
    (
      workspaceId: string,
      collectionId: string,
      title = "Untitled Note",
      content = "<p></p>",
    ) => {
      let finalContent = content;
      const ds = data.settings.plugins?.autoStructure;
      if (ds?.enabled && content === "<p></p>") {
        let currentId: string | undefined = collectionId;
        let templateContent: string | null = null;
        while (currentId) {
          const templateId = ds.folderTemplates[currentId];
          if (templateId) {
            const template = ds.templates.find((t) => t.id === templateId);
            if (template) {
              templateContent = template.content;
              break;
            }
          }
          const collection = data.collections.find((c) => c.id === currentId);
          currentId = collection?.parentId;
        }

        if (templateContent) {
          let result = templateContent;
          if (ds.activePlaceholders["{{date}}"]) {
            result = result.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
          }
          if (ds.activePlaceholders["{{title}}"]) {
            result = result.replace(/\{\{title\}\}/g, title);
          }
          if (ds.activePlaceholders["{{tags}}"]) {
            result = result.replace(/\{\{tags\}\}/g, "");
          }
          if (ds.activePlaceholders["{{summary}}"]) {
            result = result.replace(/\{\{summary\}\}/g, "");
          }
          for (const [key, value] of Object.entries(ds.customPlaceholders || {})) {
            const keyMatch = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            result = result.replace(keyMatch, value);
          }
          finalContent = marked.parse(result) as string;
        }
      }

      const now = new Date().toISOString();
      const newNote: Note = {
        id: generateId(),
        workspaceId,
        collectionId,
        title,
        content: finalContent,
        tags: [],
        pinned: false,
        starred: false,
        createdAt: now,
        updatedAt: now,
        wordCount: 0,
        headerMeta: {
          source: "",
          summary: "",
          date: now,
        },
      };
      saveData({ ...data, notes: [newNote, ...data.notes] });
      
      return newNote;
    },
    [data, saveData, user]
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<Note>) => {
      saveData({
        ...data,
        notes: data.notes.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
        ),
      });
    },
    [data, saveData, user]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      saveData({
        ...data,
        notes: data.notes.map((n) =>
          n.id === id ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now } : n
        ),
      });
    },
    [data, saveData, user]
  );

  const deleteNotes = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString();
      saveData({
        ...data,
        notes: data.notes.map((n) =>
          ids.includes(n.id) ? { ...n, isDeleted: true, deletedAt: now, updatedAt: now } : n
        ),
      });
    },
    [data, saveData, user]
  );

  const permanentlyDeleteNote = useCallback(
    (id: string) => {
      saveData({
        ...data,
        notes: data.notes.filter((n) => n.id !== id),
      });
    },
    [data, saveData, user]
  );

  const restoreNote = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      saveData({
        ...data,
        notes: data.notes.map((n) => {
          if (n.id === id) {
            const { deletedAt, isDeleted, ...rest } = n;
            return { ...rest, updatedAt: now } as Note;
          }
          return n;
        }),
      });
    },
    [data, saveData, user]
  );

  const emptyTrash = useCallback(() => {
    saveData({
      ...data,
      notes: data.notes.filter((n) => !n.isDeleted),
    });
  }, [data, saveData, user]);

  const addTemplate = useCallback(
    (name: string, content: string) => {
      const template: NoteTemplate = {
        id: generateId(),
        name,
        content,
        createdAt: new Date().toISOString(),
      };
      saveData({ ...data, templates: [...data.templates, template] });
      return template;
    },
    [data, saveData, user]
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      saveData({ ...data, templates: data.templates.filter((t) => t.id !== id) });
    },
    [data, saveData, user]
  );

  const addReviewNote = useCallback(
    (reviewNote: Omit<ReviewNote, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newReviewNote: ReviewNote = {
        ...reviewNote,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      saveData({
        ...data,
        reviewNotes: [...(data.reviewNotes || []), newReviewNote],
      });
      return newReviewNote;
    },
    [data, saveData, user]
  );

  const updateReviewNote = useCallback(
    (id: string, updates: Partial<ReviewNote>) => {
      saveData({
        ...data,
        reviewNotes: (data.reviewNotes || []).map((rn) =>
          rn.id === id ? { ...rn, ...updates, updatedAt: new Date().toISOString() } : rn
        ),
      });
    },
    [data, saveData, user]
  );

  const deleteReviewNote = useCallback(
    async (id: string) => {
      saveData({
        ...data,
        reviewNotes: (data.reviewNotes || []).filter((n) => n.id !== id),
      });
      
    },
    [data, saveData, user]
  );

  const renameTag = useCallback(
    (oldTag: string, newTag: string) => {
      const normalizedNewTag = newTag.toLowerCase().replace(/^#+/, "").trim();
      const newNotes = data.notes.map((note) => {
        if (note.tags?.includes(oldTag)) {
          return {
            ...note,
            tags: Array.from(new Set(note.tags.map((t) => (t === oldTag ? normalizedNewTag : t)))),
            updatedAt: new Date().toISOString(),
          };
        }
        return note;
      });

      const allTags = new Set<string>();
      newNotes.forEach((n) => {
        if (n.tags) n.tags.forEach((t) => allTags.add(t));
      });

      const newData = {
        ...data,
        notes: newNotes,
        tags: Array.from(allTags),
      };

      saveData(newData);
    },
    [data, saveData, user]
  );

  const deleteTag = useCallback(
    (tagToRemove: string) => {
      const newNotes = data.notes.map((note) => {
        if (note.tags?.includes(tagToRemove)) {
          return {
            ...note,
            tags: note.tags.filter((t) => t !== tagToRemove),
            updatedAt: new Date().toISOString(),
          };
        }
        return note;
      });

      const allTags = new Set<string>();
      newNotes.forEach((n) => {
        if (n.tags) n.tags.forEach((t) => allTags.add(t));
      });

      const newData = {
        ...data,
        notes: newNotes,
        tags: Array.from(allTags),
      };

      saveData(newData);
    },
    [data, saveData, user]
  );

  const clearAllData = useCallback(async () => {
    safeStorage.removeItem(STORAGE_KEY);
    try {
      await del(STORAGE_KEY);
    } catch (e) {}
    window.location.reload();
  }, []);

  const importData = useCallback(
    async (importedData: NoteVaultData, merge: boolean) => {
      try {
        if (merge) {
          showToast("Checking for existing notes...");
          let currentNotes = data.notes;
          
          // Unique identifier sets to avoid duplicates
          const existingNoteIdentifiers = new Set(currentNotes.map(n => `${(n.title || "Untitled").trim().toLowerCase()}-${n.createdAt}`));
          
          const newNotes = importedData.notes.filter(n => {
            const idMatch = currentNotes.find(e => e.id === n.id);
            const metaMatch = existingNoteIdentifiers.has(`${(n.title || "Untitled").trim().toLowerCase()}-${n.createdAt}`);
            return !idMatch && !metaMatch;
          });
          
          const newWorkspaces = importedData.workspaces.filter(w => !data.workspaces.find(e => e.id === w.id));
          const newCollections = importedData.collections.filter(c => !data.collections.find(e => e.id === c.id));
          
          await saveData({
            ...data,
            workspaces: [...data.workspaces, ...newWorkspaces],
            collections: [...data.collections, ...newCollections],
            notes: [...data.notes, ...newNotes],
            tags: Array.from(new Set([...data.tags, ...importedData.tags])),
          });
          showToast(`Imported ${newNotes.length} new notes successfully to IndexedDB (skipped duplicates).`);
        } else {
          await saveData(importedData);
          showToast("Restored backup successfully to IndexedDB.");
        }
      } catch (err) {
         console.error("Save failed:", err);
         showToast("Import failed. Could not save to IndexedDB.");
      }
    },
    [data, saveData, user],
  );

  if (!isInitialized) return null;

  return (
    <StorageContext.Provider
      value={{
        data,
        totalLocalNotes: data.notes.length + hiddenNotesRef.current.length,
        saveData,
        updateSettings,
        addWorkspace,
        updateWorkspace,
        deleteWorkspace,
        addCollection,
        updateCollection,
        deleteCollection,
        addNote,
        updateNote,
        deleteNote,
        deleteNotes,
        permanentlyDeleteNote,
        restoreNote,
        emptyTrash,
        addTemplate,
        deleteTemplate,
        addReviewNote,
        updateReviewNote,
        deleteReviewNote,
        renameTag,
        deleteTag,
        clearAllData,
        importData,
        syncToCloud,
        getCloudBackupPreview,
        applyCloudBackup,
        loadAllNotes,
        areAllNotesLoaded,
        isSyncing,
        isSaving,
        undo,
        canUndo: history.length > 0,
        toast,
        showToast,
      }}
    >
      {children}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="bg-surface-active border border-border shadow-2xl rounded-full px-5 py-2.5 text-sm font-medium text-text-primary flex items-center gap-2">
            {toast}
          </div>
        </div>
      )}
    </StorageContext.Provider>
  );
};
