import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  NoteVaultData,
  Workspace,
  Collection,
  Note,
  Settings,
  DEFAULT_SETTINGS,
  NoteTemplate,
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
  // Templates
  addTemplate: (name: string, content: string) => NoteTemplate;
  deleteTemplate: (id: string) => void;
  // Global actions
  clearAllData: () => void;
  importData: (importedData: NoteVaultData, merge: boolean) => void;
  syncToCloud: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
  isSyncing: boolean;
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

  const saveData = useCallback(
    async (newData: NoteVaultData, skipHistory = false) => {
      if (!skipHistory) {
        setHistory((prev) => [data, ...prev].slice(0, 20));
      }
      setData(newData);
      try {
        await set(STORAGE_KEY, JSON.stringify(newData));
      } catch (e) {
        console.warn("Failed to write to IndexedDB, fallback to localStorage");
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      }
    },
    [data],
  );

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
            notes: parsed.notes || [],
            tags: parsed.tags || [],
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            templates: parsed.templates || [],
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

      const batch = writeBatch(db);

      batch.set(
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
        batch.set(
          doc(db, `users/${user.uid}/workspaces/${w.id}`),
          { ...w, userId: user.uid },
          { merge: true },
        );
      });
      data.collections.forEach((c) => {
        batch.set(
          doc(db, `users/${user.uid}/collections/${c.id}`),
          { ...c, userId: user.uid },
          { merge: true },
        );
      });
      data.notes.forEach((n) => {
        batch.set(
          doc(db, `users/${user.uid}/notes/${n.id}`),
          { ...n, userId: user.uid },
          { merge: true },
        );
      });

      await batch.commit();

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

      const cloudSettings = settingsSnap.docs[0]?.data();
      const workspaces = workspacesSnap.docs.map((d) => d.data() as Workspace);
      const collections = collectionsSnap.docs.map(
        (d) => d.data() as Collection,
      );
      const notes = notesSnap.docs.map((d) => d.data() as Note);

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
      const now = new Date().toISOString();
      const newNote: Note = {
        id: generateId(),
        workspaceId,
        collectionId,
        title,
        content,
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
        setHistory((prevHist: NoteVaultData[]) =>
          [prevData, ...prevHist].slice(0, 20),
        );
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
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

  const deleteNotes = useCallback(
    async (ids: string[]) => {
      saveData({
        ...data,
        notes: data.notes.filter((n) => !ids.includes(n.id)),
      });

      if (user) {
        try {
          const batch = writeBatch(db);
          ids.forEach((id) =>
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
    },
    [data, saveData, user],
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

  const clearAllData = useCallback(async () => {
    safeStorage.removeItem(STORAGE_KEY);
    try {
      await del(STORAGE_KEY);
    } catch (e) {}
    window.location.reload();
  }, []);

  const importData = useCallback(
    (importedData: NoteVaultData, merge: boolean) => {
      if (merge) {
        saveData({
          ...data,
          workspaces: [...data.workspaces, ...importedData.workspaces],
          collections: [...data.collections, ...importedData.collections],
          notes: [...data.notes, ...importedData.notes],
          tags: Array.from(new Set([...data.tags, ...importedData.tags])),
        });
      } else {
        saveData(importedData);
      }
    },
    [data, saveData],
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
        addTemplate,
        deleteTemplate,
        clearAllData,
        importData,
        syncToCloud,
        syncFromCloud,
        isSyncing,
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
