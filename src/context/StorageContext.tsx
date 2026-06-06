import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useFirebaseConnection } from './FirebaseConnectionManager';
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
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  collection,
  onSnapshot,
  query,
  getDocs,
  deleteField,
} from "firebase/firestore";
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
  syncFromCloud: () => Promise<void>;
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
  const { cloudNotes } = useFirebaseConnection();
  const [history, setHistory] = useState<NoteVaultData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Realtime merge cloudNotes
    if (cloudNotes.length > 0 && isInitialized) {
      setData((prev) => {
        const localIds = new Set(prev.notes.map(n => n.id));
        const newNotes = cloudNotes.filter(cn => !localIds.has(cn.id));
        if (newNotes.length === 0) return prev;
        return {
           ...prev,
           notes: [...prev.notes, ...newNotes]
        };
      });
    }
  }, [cloudNotes, isInitialized]);

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
       
       const batch = writeBatch(db);
       ids.forEach(id => batch.delete(doc(db, `users/${user.uid}/notes/${id}`)));
       batch.commit().catch(e => console.error("Trash cleanup failed", e));
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
        console.warn("Failed to write to IndexedDB, fallback to localStorage");
        // Strip out large vectors for localStorage to avoid crashing 5MB quota
        const safeDataForLs = {
          ...fullData,
          notes: fullData.notes.map(n => {
            const { embedding, ...rest } = n;
            return rest;
          })
        };
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(safeDataForLs));
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

      // Migrate from localStorage to IndexedDB
      if (!storedData) {
        const localStored = safeStorage.getItem(STORAGE_KEY);
        if (localStored) {
          storedData = localStored;
          try {
            await set(STORAGE_KEY, localStored);
            safeStorage.removeItem(STORAGE_KEY);
            console.log("Migrated data from localStorage to IndexedDB");
          } catch (e) {}
        }
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
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
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
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
    }
    showToast("Action Undone");
  }, [history, showToast]);

  const syncToCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const timestamp = new Date().toISOString();
      const updatedSettings = {
        ...data.settings,
        lastCloudSyncDate: timestamp,
      };

      // We'll write workspaces, collections, settings, review notes in a single initial batch
      const initialBatch = writeBatch(db);

      initialBatch.set(
        doc(db, `users/${user.uid}/settings/default`),
        {
          userId: user.uid,
          settings: updatedSettings,
          tags: data.tags,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      data.workspaces.forEach((w) => {
        initialBatch.set(
          doc(db, `users/${user.uid}/workspaces/${w.id}`),
          { ...w, userId: user.uid },
          { merge: true },
        );
      });
      data.collections.forEach((c) => {
        initialBatch.set(
          doc(db, `users/${user.uid}/collections/${c.id}`),
          { ...c, userId: user.uid },
          { merge: true },
        );
      });
      if (data.reviewNotes) {
        data.reviewNotes.forEach((rn) => {
          initialBatch.set(
            doc(db, `users/${user.uid}/reviewNotes/${rn.id}`),
            { ...rn, userId: user.uid },
            { merge: true },
          );
        });
      }

      await initialBatch.commit();
      
      // Batched sync for notes (groups of 10)
      const totalNotes = data.notes.length;
      let syncedCount = 0;
      
      const batchSize = 10;
      for (let i = 0; i < totalNotes; i += batchSize) {
        const notesBatch = data.notes.slice(i, i + batchSize);
        const fbBatch = writeBatch(db);
        
        notesBatch.forEach((n) => {
          fbBatch.set(
            doc(db, `users/${user.uid}/notes/${n.id}`),
            { ...n, userId: user.uid },
            { merge: true },
          );
        });
        
        await fbBatch.commit();
        syncedCount += notesBatch.length;
        
        // Short delay between batches
        if (i + batchSize < totalNotes) {
          showToast(`Syncing notes: ${syncedCount} / ${totalNotes}...`);
          await new Promise(res => setTimeout(res, 200));
        }
      }

      // Update local state to reflect the new sync date without fully pushing to history
      setData((prev) => {
        const newData = { ...prev, settings: updatedSettings };
        try {
          set(STORAGE_KEY, JSON.stringify(newData));
        } catch (e) {
          safeStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
        return newData;
      });

      showToast("Successfully backed up to cloud");
    } catch (e) {
      console.error(e);
      showToast("Failed to sync to cloud");
    } finally {
      setIsSyncing(false);
    }
  }, [user, data]);

  const syncFromCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const settingsSnap = await getDocs(
        collection(db, `users/${user.uid}/settings`),
      );
      const workspacesSnap = await getDocs(
        collection(db, `users/${user.uid}/workspaces`),
      );
      const collectionsSnap = await getDocs(
        collection(db, `users/${user.uid}/collections`),
      );
      const notesSnap = await getDocs(
        collection(db, `users/${user.uid}/notes`),
      );
      const reviewNotesSnap = await getDocs(
        collection(db, `users/${user.uid}/reviewNotes`),
      );

      const cloudSettings = settingsSnap.docs[0]?.data();
      const workspaces = workspacesSnap.docs.map((d) => d.data() as Workspace);
      const collections = collectionsSnap.docs.map(
        (d) => d.data() as Collection,
      );
      const notes = notesSnap.docs.map((d) => d.data() as Note);
      const reviewNotes = reviewNotesSnap.docs.map((d) => d.data() as ReviewNote);

      if (workspaces.length === 0 && notes.length === 0) {
        showToast("No cloud data found. Uploading local data...");
        await syncToCloud();
        return;
      }

      // Merge avoiding duplicates by ID, cloud takes precedence
      const mergeArrays = <T extends { id: string }>(
        local: T[],
        remote: T[],
      ) => {
        const map = new Map<string, T>();
        local.forEach((i) => map.set(i.id, i));
        remote.forEach((i) => map.set(i.id, i)); // remote overrides
        return Array.from(map.values());
      };

      const mergedData: NoteVaultData = {
        ...data,
        settings: cloudSettings?.settings || data.settings,
        tags: cloudSettings?.tags || data.tags,
        workspaces: mergeArrays(data.workspaces, workspaces),
        collections: mergeArrays(data.collections, collections),
        notes: mergeArrays(data.notes, notes),
        reviewNotes: mergeArrays((data.reviewNotes || []), reviewNotes),
      };

      saveData(mergedData);
      showToast("Data downloaded from cloud");
    } catch (e) {
      console.error(e);
      showToast("Failed to download from cloud");
    } finally {
      setIsSyncing(false);
    }
  }, [user, data, saveData, syncToCloud]);

  // Rest of the methods...

  // Auto-sync when user signs in
  useEffect(() => {
    if (user) {
      syncFromCloud();
    }
  }, [user]);

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
      if (user) {
        setDoc(
          doc(db, `users/${user.uid}/workspaces/${newWs.id}`),
          { ...newWs, userId: user.uid },
          { merge: true },
        ).catch((e) => console.error(e));
      }
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
      if (user) {
        setDoc(doc(db, `users/${user.uid}/workspaces/${id}`), updates, {
          merge: true,
        }).catch((e) => console.error(e));
      }
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

      if (user) {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, `users/${user.uid}/workspaces/${id}`));
          collectionsToDelete.forEach((c) =>
            batch.delete(doc(db, `users/${user.uid}/collections/${c.id}`)),
          );
          notesToDelete.forEach((n) =>
            batch.delete(doc(db, `users/${user.uid}/notes/${n.id}`)),
          );
          await batch.commit();
        } catch (e) {
          console.error("Failed to delete workspace from cloud", e);
        }
      }
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
      if (user) {
        setDoc(
          doc(db, `users/${user.uid}/collections/${newCol.id}`),
          { ...newCol, userId: user.uid },
          { merge: true },
        ).catch((e) => console.error(e));
      }
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
      if (user) {
        setDoc(doc(db, `users/${user.uid}/collections/${id}`), updates, {
          merge: true,
        }).catch((e) => console.error(e));
      }
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

      if (user) {
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, `users/${user.uid}/collections/${id}`));
          notesToDelete.forEach((n) =>
            batch.delete(doc(db, `users/${user.uid}/notes/${n.id}`)),
          );
          await batch.commit();
        } catch (e) {
          console.error("Failed to delete collection from cloud", e);
        }
      }
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
      if (user) {
        setDoc(
          doc(db, `users/${user.uid}/notes/${newNote.id}`),
          { ...newNote, userId: user.uid },
          { merge: true },
        ).catch((err) => {
          console.error("Firebase precise add failed", err);
        });
      }
      return newNote;
    },
    [data, saveData, user],
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<Note>) => {
      let finalUpdates: Partial<Note> & { userId?: string } = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      setIsSaving(true);
      setData((prevData) => {
        let targetCollectionId: string | null = null;
        let targetWorkspaceId: string | null = null;

        const noteToUpdate = prevData.notes.find((n) => n.id === id);

        // Auto-categorize only if tags are explicitly being updated
        if (
          updates.tags !== undefined &&
          prevData.settings.plugins?.autoCategorize?.enabled &&
          updates.tags.length > 0
        ) {
          for (const rule of prevData.settings.plugins.autoCategorize.rules) {
            if (updates.tags.includes(rule.tag)) {
              targetCollectionId = rule.collectionId;
              targetWorkspaceId = rule.workspaceId;
              break; // First matching rule wins
            }
          }
        }

        if (targetCollectionId && targetWorkspaceId) {
          finalUpdates.collectionId = targetCollectionId;
          finalUpdates.workspaceId = targetWorkspaceId;
        }

        const newNotes = prevData.notes.map((n) => {
          if (n.id === id) {
            return { ...n, ...finalUpdates };
          }
          return n;
        });

        // Recalculate global tags properly
        const allTags = new Set<string>();
        newNotes.forEach((n: Note) => {
          if (n.tags) {
            n.tags.forEach((t: string) => allTags.add(t));
          }
        });

        const newData = {
          ...prevData,
          notes: newNotes,
          tags: Array.from(allTags),
        };

        // We manually handle saveData's duties here to get the correct prevData
        const safeDataForLs = {
          ...newData,
          notes: newData.notes.map(n => {
            const { embedding, ...rest } = n;
            return rest;
          })
        };
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(safeDataForLs));
        // Also save to indexedDB
        set(STORAGE_KEY, JSON.stringify(newData))
          .catch((e) => {
            console.warn("IndexedDB set failed", e);
          })
          .finally(() => setIsSaving(false));

        return newData;
      });

      // Auto-update specific fields in firebase with precision
      if (user) {
        finalUpdates.userId = user.uid;
        setDoc(doc(db, `users/${user.uid}/notes/${id}`), finalUpdates, {
          merge: true,
        }).catch((err) => {
          console.error("Firebase precise update failed", err);
        });
      }
    },
    [user],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      saveData({
        ...data,
        notes: data.notes.map((n) => (n.id === id ? { ...n, isDeleted: true, deletedAt: now } : n)),
      });

      if (user) {
        setDoc(doc(db, `users/${user.uid}/notes/${id}`), { isDeleted: true, deletedAt: now }, { merge: true }).catch((e) => {
          handleFirestoreError(
            e,
            OperationType.UPDATE,
            `users/${user.uid}/notes/${id}`
          );
        });
      }
      showToast("Note moved to trash");
    },
    [data, saveData, user, showToast],
  );

  const deleteNotes = useCallback(
    async (ids: string[]) => {
      const now = new Date().toISOString();
      saveData({
        ...data,
        notes: data.notes.map((n) => (ids.includes(n.id) ? { ...n, isDeleted: true, deletedAt: now } : n)),
      });

      if (user) {
        try {
          const batch = writeBatch(db);
          ids.forEach((id) =>
            batch.update(doc(db, `users/${user.uid}/notes/${id}`), { isDeleted: true, deletedAt: now }),
          );
          await batch.commit();
        } catch (e) {
          handleFirestoreError(
            e,
            OperationType.UPDATE,
            `users/${user.uid}/notes`,
          );
        }
      }
      showToast(`${ids.length} notes moved to trash`);
    },
    [data, saveData, user, showToast],
  );

  const permanentlyDeleteNote = useCallback(
    async (id: string) => {
      saveData({
        ...data,
        notes: data.notes.filter((n) => n.id !== id),
      });

      if (user) {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/notes/${id}`));
        } catch (e) {
          handleFirestoreError(
            e,
            OperationType.DELETE,
            `users/${user.uid}/notes/${id}`,
          );
        }
      }
    },
    [data, saveData, user],
  );

  const restoreNote = useCallback(
    async (id: string) => {
      saveData({
        ...data,
        notes: data.notes.map((n) => (n.id === id ? { ...n, isDeleted: false, deletedAt: undefined } : n)),
      });

      if (user) {
        try {
          await setDoc(doc(db, `users/${user.uid}/notes/${id}`), { isDeleted: false, deletedAt: deleteField() }, { merge: true });
        } catch (e) {
          handleFirestoreError(
            e,
            OperationType.UPDATE,
            `users/${user.uid}/notes/${id}`,
          );
        }
      }
      showToast("Note restored");
    },
    [data, saveData, user, showToast],
  );

  const emptyTrash = useCallback(
    async () => {
      const deletedNoteIds = data.notes.filter(n => n.isDeleted).map(n => n.id);
      saveData({
        ...data,
        notes: data.notes.filter((n) => !n.isDeleted),
      });

      if (user && deletedNoteIds.length > 0) {
        try {
          // Firestore batches support up to 500 operations
          // If a user has > 500 items in trash, this could fail, but assuming reasonable usage here.
          // For a robust implementation, we would chunk this.
          const batch = writeBatch(db);
          deletedNoteIds.forEach((id) =>
            batch.delete(doc(db, `users/${user.uid}/notes/${id}`)),
          );
          await batch.commit();
        } catch (e) {
          handleFirestoreError(
            e,
            OperationType.DELETE,
            `users/${user.uid}/notes`,
          );
        }
      }
      showToast("Trash emptied");
    },
    [data, saveData, user, showToast],
  );

  const addTemplate = useCallback(
    (name: string, content: string) => {
      const newTemplate = { id: generateId(), name, content };
      saveData({
        ...data,
        templates: [...(data.templates || []), newTemplate],
      });
      return newTemplate;
    },
    [data, saveData],
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      saveData({
        ...data,
        templates: (data.templates || []).filter((t) => t.id !== id),
      });
    },
    [data, saveData],
  );

  // --- Review Notes ---
  const addReviewNote = useCallback(
    (reviewNoteValue: Omit<ReviewNote, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const newReviewNote: ReviewNote = {
        ...reviewNoteValue,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      saveData({
        ...data,
        reviewNotes: [newReviewNote, ...(data.reviewNotes || [])],
      });
      if (user) {
        setDoc(
          doc(db, `users/${user.uid}/reviewNotes/${newReviewNote.id}`),
          { ...newReviewNote, userId: user.uid },
          { merge: true }
        ).catch((e) => console.error(e));
      }
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
      if (user) {
        const finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
        setDoc(doc(db, `users/${user.uid}/reviewNotes/${id}`), finalUpdates, { merge: true })
          .catch((e) => console.error(e));
      }
    },
    [data, saveData, user]
  );

  const deleteReviewNote = useCallback(
    async (id: string) => {
      saveData({
        ...data,
        reviewNotes: (data.reviewNotes || []).filter((n) => n.id !== id),
      });
      if (user) {
        try {
          await deleteDoc(doc(db, `users/${user.uid}/reviewNotes/${id}`));
        } catch (e) {
          console.error("Failed to delete review note", e);
        }
      }
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

      if (user) {
        try {
          const batch = writeBatch(db);
          let batchCount = 0;
          newNotes.forEach((note) => {
            const oldNote = data.notes.find((n) => n.id === note.id);
            if (oldNote?.tags?.includes(oldTag)) {
              batch.set(
                doc(db, `users/${user.uid}/notes/${note.id}`),
                { tags: note.tags, updatedAt: note.updatedAt },
                { merge: true }
              );
              batchCount++;
            }
          });
          if (batchCount > 0) {
            batch.commit().catch(console.error);
          }
        } catch (e) {
          console.error("Firebase bulk update failed", e);
        }
      }
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

      if (user) {
        try {
          const batch = writeBatch(db);
          let batchCount = 0;
          newNotes.forEach((note) => {
            const oldNote = data.notes.find((n) => n.id === note.id);
            if (oldNote?.tags?.includes(tagToRemove)) {
              batch.set(
                doc(db, `users/${user.uid}/notes/${note.id}`),
                { tags: note.tags, updatedAt: note.updatedAt },
                { merge: true }
              );
              batchCount++;
            }
          });
          if (batchCount > 0) {
            batch.commit().catch(console.error);
          }
        } catch (e) {
          console.error("Firebase bulk update failed", e);
        }
      }
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
      if (merge) {
        showToast("Checking for existing notes...");
        let currentNotes = data.notes;
        
        // Fetch from Firebase to ensure zero duplicates against cloud if logged in
        if (user) {
          try {
            const notesSnap = await getDocs(collection(db, `users/${user.uid}/notes`));
            const cloudNotes = notesSnap.docs.map((d) => d.data() as Note);
            currentNotes = [...currentNotes, ...cloudNotes];
          } catch(e) {
            console.error("Could not fetch cloud notes during import", e);
          }
        }
        
        // Unique identifier sets to avoid duplicates
        const existingNoteIdentifiers = new Set(currentNotes.map(n => `${(n.title || "Untitled").trim().toLowerCase()}-${n.createdAt}`));
        
        const newNotes = importedData.notes.filter(n => {
          const idMatch = currentNotes.find(e => e.id === n.id);
          const metaMatch = existingNoteIdentifiers.has(`${(n.title || "Untitled").trim().toLowerCase()}-${n.createdAt}`);
          return !idMatch && !metaMatch;
        });
        
        const newWorkspaces = importedData.workspaces.filter(w => !data.workspaces.find(e => e.id === w.id));
        const newCollections = importedData.collections.filter(c => !data.collections.find(e => e.id === c.id));
        
        saveData({
          ...data,
          workspaces: [...data.workspaces, ...newWorkspaces],
          collections: [...data.collections, ...newCollections],
          notes: [...data.notes, ...newNotes],
          tags: Array.from(new Set([...data.tags, ...importedData.tags])),
        });
        showToast(`Imported ${newNotes.length} new notes (skipped duplicates).`);
      } else {
        saveData(importedData);
        showToast("Restored backup successfully.");
      }
    },
    [data, saveData, user],
  );

  if (!isInitialized) return null;

  return (
    <StorageContext.Provider
      value={{
        data,
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
        syncFromCloud,
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
