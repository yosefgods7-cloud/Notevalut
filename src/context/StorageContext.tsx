import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NoteVaultData, Workspace, Collection, Note, Settings, DEFAULT_SETTINGS } from '../types';
import { generateId } from '../lib/utils';

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
  const [data, setData] = useState<NoteVaultData>(() => {
    try {
      const stored = safeStorage.getItem(STORAGE_KEY);
      if (stored) {
        let parsed = JSON.parse(stored) as Partial<NoteVaultData>;
        
        const now = new Date().toISOString();
        const defaultWsId = generateId();

        // Ensure that all properties exist to prevent undefined property errors
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
    
    // First launch initialization
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

  const deleteWorkspace = useCallback((id: string) => {
    saveData({
      ...data,
      workspaces: data.workspaces.filter(w => w.id !== id),
      collections: data.collections.filter(c => c.workspaceId !== id),
      notes: data.notes.filter(n => n.workspaceId !== id)
    });
  }, [data, saveData]);

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

  const deleteCollection = useCallback((id: string) => {
    saveData({
      ...data,
      collections: data.collections.filter(c => c.id !== id),
      notes: data.notes.filter(n => n.collectionId !== id)
    });
  }, [data, saveData]);

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

  const deleteNote = useCallback((id: string) => {
    saveData({
      ...data,
      notes: data.notes.filter(n => n.id !== id)
    });
  }, [data, saveData]);

  const deleteNotes = useCallback((ids: string[]) => {
    saveData({
      ...data,
      notes: data.notes.filter(n => !ids.includes(n.id))
    });
  }, [data, saveData]);

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
