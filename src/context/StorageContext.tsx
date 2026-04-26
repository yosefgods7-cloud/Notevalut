import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { NoteVaultData, Workspace, Collection, Note, Settings, DEFAULT_SETTINGS } from '../types';
import { generateId } from '../lib/utils';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, deleteDoc, writeBatch, collection, onSnapshot, query, getDocs } from 'firebase/firestore';

const STORAGE_KEY = 'notevault_data';

const DEFAULT_DATA: NoteVaultData = {
  version: 1,
  workspaces: [],
  collections: [],
  notes: [],
  tags: [],
  settings: DEFAULT_SETTINGS,
};

// Safe wrapper to prevent DOMExceptions in strict iframes (e.g., Safari/Incognito)
const safeStorage = {
  getItem: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch (e) { console.warn('localStorage write failed, using memory'); }
  },
  removeItem: (key: string): void => {
    try { localStorage.removeItem(key); } catch (e) {}
  }
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
  addCollection: (workspaceId: string, name: string, icon: string) => Collection;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  // Notes
  addNote: (workspaceId: string, collectionId: string, title?: string, content?: string) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  deleteNotes: (ids: string[]) => void;
  // Global actions
  clearAllData: () => void;
  importData: (importedData: NoteVaultData, merge: boolean) => void;
  syncToCloud: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
  isSyncing: boolean;
  // UI
  toast: string | null;
  showToast: (msg: string) => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) throw new Error('useStorage must be used within StorageProvider');
  return context;
};

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();

  const [data, setData] = useState<NoteVaultData>(() => {
    try {
      const stored = safeStorage.getItem(STORAGE_KEY);
      if (stored) {
        let parsed = JSON.parse(stored) as Partial<NoteVaultData>;
        
        const now = new Date().toISOString();
        const defaultWsId = generateId();

        const migratedData: NoteVaultData = {
          version: parsed.version || 1,
          workspaces: parsed.workspaces?.length ? parsed.workspaces : [{ id: defaultWsId, name: 'My Notes', icon: '🧠', createdAt: now, order: 0 }],
          collections: parsed.collections || [],
          notes: parsed.notes || [],
          tags: parsed.tags || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
        
        return migratedData;
      }
    } catch (e) {
      console.error('Failed to parse NoteVault data from localStorage', e);
    }
    
    const workspaceId = generateId();
    const collectionId = generateId();
    const now = new Date().toISOString();
    
    const initialData: NoteVaultData = {
      ...DEFAULT_DATA,
      workspaces: [{ id: workspaceId, name: 'My Notes', icon: '🧠', createdAt: now, order: 0 }],
      collections: [{ id: collectionId, workspaceId, name: 'Quick Notes', icon: '⚡', createdAt: now, order: 0 }],
      settings: { ...DEFAULT_SETTINGS, defaultWorkspace: workspaceId },
      notes: [{
        id: generateId(),
        workspaceId,
        collectionId,
        title: 'Welcome to NoteVault',
        content: '<p>This is your private, offline-first note system.</p><p>Try the <strong>Smart Paste</strong> capability using <code>Cmd/Ctrl + Shift + V</code> to instantly clean up AI-generated text.</p>',
        tags: ['welcome'],
        pinned: true,
        starred: true,
        createdAt: now,
        updatedAt: now,
        wordCount: 20,
      }]
    };
    
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  });

  const saveData = useCallback((newData: NoteVaultData) => {
    setData(newData);
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  const syncToCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const batch = writeBatch(db);
      
      batch.set(doc(db, `users/${user.uid}/settings/default`), {
        userId: user.uid,
        settings: data.settings,
        tags: data.tags,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      data.workspaces.forEach(w => {
        batch.set(doc(db, `users/${user.uid}/workspaces/${w.id}`), { ...w, userId: user.uid }, { merge: true });
      });
      data.collections.forEach(c => {
        batch.set(doc(db, `users/${user.uid}/collections/${c.id}`), { ...c, userId: user.uid }, { merge: true });
      });
      data.notes.forEach(n => {
        batch.set(doc(db, `users/${user.uid}/notes/${n.id}`), { ...n, userId: user.uid }, { merge: true });
      });

      await batch.commit();
      showToast('Successfully backed up to cloud');
    } catch (e) {
      console.error(e);
      showToast('Failed to sync to cloud');
    } finally {
      setIsSyncing(false);
    }
  }, [user, data]);

  const syncFromCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const settingsSnap = await getDocs(collection(db, `users/${user.uid}/settings`));
      const workspacesSnap = await getDocs(collection(db, `users/${user.uid}/workspaces`));
      const collectionsSnap = await getDocs(collection(db, `users/${user.uid}/collections`));
      const notesSnap = await getDocs(collection(db, `users/${user.uid}/notes`));

      const cloudSettings = settingsSnap.docs[0]?.data();
      const workspaces = workspacesSnap.docs.map(d => d.data() as Workspace);
      const collections = collectionsSnap.docs.map(d => d.data() as Collection);
      const notes = notesSnap.docs.map(d => d.data() as Note);

      if (workspaces.length === 0 && notes.length === 0) {
        showToast('No cloud data found. Uploading local data...');
        await syncToCloud();
        return;
      }

      // Merge avoiding duplicates by ID, cloud takes precedence
      const mergeArrays = <T extends {id: string}>(local: T[], remote: T[]) => {
        const map = new Map<string, T>();
        local.forEach(i => map.set(i.id, i));
        remote.forEach(i => map.set(i.id, i)); // remote overrides
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
      showToast('Data downloaded from cloud');
    } catch (e) {
      console.error(e);
      showToast('Failed to download from cloud');
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

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    saveData({ ...data, settings: { ...data.settings, ...updates } });
  }, [data, saveData]);

  // --- Workspaces ---
  const addWorkspace = useCallback((name: string, icon: string) => {
    const newWs: Workspace = { id: generateId(), name, icon, createdAt: new Date().toISOString(), order: data.workspaces.length };
    saveData({ ...data, workspaces: [...data.workspaces, newWs] });
    return newWs;
  }, [data, saveData]);

  const updateWorkspace = useCallback((id: string, updates: Partial<Workspace>) => {
    saveData({
      ...data,
      workspaces: data.workspaces.map(w => w.id === id ? { ...w, ...updates } : w)
    });
  }, [data, saveData]);

  const deleteWorkspace = useCallback(async (id: string) => {
    // Determine collections and notes to delete
    const collectionsToDelete = data.collections.filter(c => c.workspaceId === id);
    const notesToDelete = data.notes.filter(n => n.workspaceId === id);
    
    saveData({
      ...data,
      workspaces: data.workspaces.filter(w => w.id !== id),
      collections: data.collections.filter(c => c.workspaceId !== id),
      notes: data.notes.filter(n => n.workspaceId !== id)
    });

    if (user) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/workspaces/${id}`));
        collectionsToDelete.forEach(c => batch.delete(doc(db, `users/${user.uid}/collections/${c.id}`)));
        notesToDelete.forEach(n => batch.delete(doc(db, `users/${user.uid}/notes/${n.id}`)));
        await batch.commit();
      } catch (e) {
        console.error("Failed to delete workspace from cloud", e);
      }
    }
  }, [data, saveData, user]);

  // --- Collections ---
  const addCollection = useCallback((workspaceId: string, name: string, icon: string) => {
    const newCol: Collection = { id: generateId(), workspaceId, name, icon, createdAt: new Date().toISOString(), order: data.collections.filter(c => c.workspaceId === workspaceId).length };
    saveData({ ...data, collections: [...data.collections, newCol] });
    return newCol;
  }, [data, saveData]);

  const updateCollection = useCallback((id: string, updates: Partial<Collection>) => {
    saveData({
      ...data,
      collections: data.collections.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  }, [data, saveData]);

  const deleteCollection = useCallback(async (id: string) => {
    const notesToDelete = data.notes.filter(n => n.collectionId === id);
    saveData({
      ...data,
      collections: data.collections.filter(c => c.id !== id),
      notes: data.notes.filter(n => n.collectionId !== id)
    });

    if (user) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/collections/${id}`));
        notesToDelete.forEach(n => batch.delete(doc(db, `users/${user.uid}/notes/${n.id}`)));
        await batch.commit();
      } catch (e) {
        console.error("Failed to delete collection from cloud", e);
      }
    }
  }, [data, saveData, user]);

  // --- Notes ---
  const addNote = useCallback((workspaceId: string, collectionId: string, title = 'Untitled Note', content = '<p></p>') => {
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
        source: '',
        summary: '',
        date: now
      }
    };
    saveData({ ...data, notes: [newNote, ...data.notes] });
    return newNote;
  }, [data, saveData]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    saveData({
      ...data,
      notes: data.notes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)
    });
  }, [data, saveData]);

  const deleteNote = useCallback(async (id: string) => {
    saveData({
      ...data,
      notes: data.notes.filter(n => n.id !== id)
    });

    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/notes/${id}`));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/notes/${id}`);
      }
    }
  }, [data, saveData, user]);

  const deleteNotes = useCallback(async (ids: string[]) => {
    saveData({
      ...data,
      notes: data.notes.filter(n => !ids.includes(n.id))
    });

    if (user) {
      try {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, `users/${user.uid}/notes/${id}`)));
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/notes`);
      }
    }
  }, [data, saveData, user]);

  const clearAllData = useCallback(() => {
    safeStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const importData = useCallback((importedData: NoteVaultData, merge: boolean) => {
    if (merge) {
      saveData({
        ...data,
        workspaces: [...data.workspaces, ...importedData.workspaces],
        collections: [...data.collections, ...importedData.collections],
        notes: [...data.notes, ...importedData.notes],
        tags: Array.from(new Set([...data.tags, ...importedData.tags]))
      });
    } else {
      saveData(importedData);
    }
  }, [data, saveData]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  return (
    <StorageContext.Provider value={{
      data, saveData, updateSettings,
      addWorkspace, updateWorkspace, deleteWorkspace,
      addCollection, updateCollection, deleteCollection,
      addNote, updateNote, deleteNote, deleteNotes,
      clearAllData, importData,
      syncToCloud, syncFromCloud, isSyncing,
      toast, showToast
    }}>
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
