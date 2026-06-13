import React, { useState, useEffect, useRef } from "react";
import { useStorage } from "../context/StorageContext";
import { useAuth } from "../context/AuthContext";
import {
  X,
  Save,
  Trash2,
  HardDrive,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  FileJson,
  Download,
  Puzzle,
  Plus,
  Folder,
  ChevronDown,
  ChevronUp,
  Monitor,
  Code,
  Cpu,
  Database,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Upload,
  FolderPlus,
  BookText,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Settings as SettingsType, DEFAULT_SETTINGS } from "../types";
import { uploadToDrive, listDriveFolders, createFolder, ensureBackupHierarchy, listJsonBackups, downloadJsonBackup } from "../lib/drive";
import { appPrompt, appConfirm } from "./GlobalDialogs";
import {
  getPersonalDictionary,
  addWordToDictionary,
  removeWordFromDictionary,
  clearPersonalDictionary,
} from "../lib/dictionary";

import { AISearchScopeSettings } from "./AISearchScopeSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport: () => void;
}

import { AutoStructureSettingsPanel } from "./AutoStructureSettings";
import { BrainMapSettingsPanel } from "./BrainMapSettingsPanel";
import { DailyDigestSettingsPanel } from "./DailyDigestSettingsPanel";
import { AskYourVaultSettingsPanel } from "./AskYourVaultSettingsPanel";
import { ApiKeysSettingsPanel } from "./ApiKeysSettingsPanel";
import { VaultHealthDashboard } from "./VaultHealthDashboard";
import { GithubSyncSettingsPanel } from "./GithubSyncSettingsPanel";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenExport,
}) => {
  const {
    data,
    updateSettings,
    clearAllData,
    getCloudBackupPreview,
    applyCloudBackup,
    syncToCloud,
    isSyncing,
    importData,
    showToast,
    addNote,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addCollection,
    updateCollection,
    deleteCollection,
  } = useStorage();
  const { user, accessToken, signIn, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<SettingsType>(
    data.settings,
  );
  const [deleteInput, setDeleteInput] = useState("");
  const [storageUsage, setStorageUsage] = useState<string>("0 KB");

  const [importPendingFile, setImportPendingFile] = useState<{
    name: string;
    content: string;
  } | null>(null);

  const [cloudPreview, setCloudPreview] = useState<{
    backupDate: string | undefined;
    noteCount: number;
    payload: any;
  } | null>(null);
  const [importTargetWorkspace, setImportTargetWorkspace] = useState(
    data.workspaces[0]?.id || "",
  );
  const [importTargetCollection, setImportTargetCollection] = useState(
    data.collections[0]?.id || "",
  );

  const [expandedSection, setExpandedSection] = useState<string | null>(
    "Appearance",
  );

  const [personalDictionary, setPersonalDictionary] = useState<string[]>([]);
  const [newDictWord, setNewDictWord] = useState("");
  const [dictSearchTerm, setDictSearchTerm] = useState("");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDriveFolderPicker, setShowDriveFolderPicker] = useState(false);
  const [driveFolders, setDriveFolders] = useState<{id: string, name: string}[]>([]);
  const [loadingDriveFolders, setLoadingDriveFolders] = useState(false);
  const [newDriveFolderName, setNewDriveFolderName] = useState("NoteVault Backups");
  
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [driveBackups, setDriveBackups] = useState<{id: string, name: string, createdTime: string, size?: string, description?: string}[]>([]);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);
  const [selectedRestoreBackup, setSelectedRestoreBackup] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<'full' | 'selective'>('full');
  const [downloadedBackup, setDownloadedBackup] = useState<any | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [selectedNotesToRestore, setSelectedNotesToRestore] = useState<Set<string>>(new Set());
  const [selectedCollectionsToRestore, setSelectedCollectionsToRestore] = useState<Set<string>>(new Set());
  const [selectiveRestoreItems, setSelectiveRestoreItems] = useState<{ notes: boolean, folders: boolean }>({ notes: true, folders: true });

  // MD Vault Restore State
  const [showMdRestoreModal, setShowMdRestoreModal] = useState(false);
  const [mdVaultBackups, setMdVaultBackups] = useState<{id: string, name: string, createdTime: string}[]>([]);
  const [loadingMdVaultBackups, setLoadingMdVaultBackups] = useState(false);
  const [selectedMdVault, setSelectedMdVault] = useState<any | null>(null);
  
  // Browsing a specific vault
  const [mdVaultContents, setMdVaultContents] = useState<{id: string, name: string, mimeType: string}[]>([]);
  const [loadingMdVaultContents, setLoadingMdVaultContents] = useState(false);
  // Stack for folder navigation inside the vault
  const [mdFolderStack, setMdFolderStack] = useState<{id: string, name: string}[]>([]); 
  
  const [mdRestoreProgress, setMdRestoreProgress] = useState<{current: number, total: number, status: string} | null>(null);

  useEffect(() => {
    if (expandedSection === "Dictionary") {
      getPersonalDictionary().then(setPersonalDictionary).catch(console.error);
    }
  }, [expandedSection]);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleExportJson = () => {
    const backup = {
      ...data,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NoteVault_Backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup JSON exported successfully");
  };

  const handleDataImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".html")) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        let htmlContent = content;

        if (file.name.endsWith(".html")) {
           try {
              const TurndownService = (await import('turndown')).default;
              const { gfm } = await import('turndown-plugin-gfm');
              
              const turndownService = new TurndownService({
                 headingStyle: 'atx',
                 hr: '---',
                 bulletListMarker: '-',
                 codeBlockStyle: 'fenced',
                 emDelimiter: '*',
                 strongDelimiter: '**'
              });
              
              turndownService.use(gfm);
              
              turndownService.addRule('strikethrough', {
                filter: ['del', 's', 'strike'],
                replacement: function (content) {
                  return '~~' + content + '~~';
                }
              });

              turndownService.addRule('stripStyles', {
                filter: ['style', 'script', 'title', 'meta'],
                replacement: function () {
                  return '';
                }
              });

              htmlContent = turndownService.turndown(content);
           } catch (e) {
              console.error("HTML conversion failed:", e);
              showToast("Failed to convert HTML cleanly");
           }
        } else if (file.name.endsWith(".md")) {
          htmlContent = content
            .replace(/^### (.*$)/gim, "<h3>$1</h3>")
            .replace(/^## (.*$)/gim, "<h2>$1</h2>")
            .replace(/^# (.*$)/gim, "<h1>$1</h1>")
            .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
            .replace(/\*(.*)\*/gim, "<em>$1</em>")
            .replace(/\n\n/g, "<p></p>")
            .replace(/\n/g, "<br/>");
        } else {
          htmlContent = `<p>${content.replace(/\n/g, "<br/>")}</p>`;
        }

        let initialWorkspace = data.workspaces[0]?.id || "";
        let initialCollection = initialWorkspace
          ? data.collections.find((c) => c.workspaceId === initialWorkspace)
              ?.id || ""
          : "";

        setImportTargetWorkspace(initialWorkspace);
        setImportTargetCollection(initialCollection);

        setImportPendingFile({
          name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
          content: htmlContent,
        });
      };
      reader.readAsText(file);
      e.target.value = "";
      return;
    }

    // Default JSON backup restore
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!imported.workspaces || !imported.notes) {
          throw new Error("Invalid backup file structure");
        }

        const confirmMerge = await appConfirm(
          "Merge with existing data? (Cancel to replace everything)",
        );
        await importData(imported, confirmMerge);
        onClose();
      } catch (err) {
        console.error(err);
        showToast("Failed to import JSON: Invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(data.settings);
      setDeleteInput("");

      const calculateSize = async () => {
        try {
          const { entries } = await import("idb-keyval");
          const allEntries = await entries();
          let total = 0;
          for (const [key, value] of allEntries) {
            const keyStr = String(key);
            const valStr =
              typeof value === "string" ? value : JSON.stringify(value);
            total += (valStr.length + keyStr.length) * 2;
          }
          const kb = total / 1024;
          if (kb > 1024) {
            setStorageUsage((kb / 1024).toFixed(2) + " MB");
          } else {
            setStorageUsage(kb.toFixed(2) + " KB");
          }
        } catch (e) {
          setStorageUsage("Unknown (Storage Access Denied)");
        }
      };

      calculateSize();
    }
  }, [isOpen, data.settings]);

  const [isManualBackingUp, setIsManualBackingUp] = useState(false);
  const [manualBackupProgress, setManualBackupProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleManualDriveBackup = async (type: 'json' | 'md' | 'both') => {
    if (!accessToken) {
      showToast("Please sign in to Google Drive first.");
      return;
    }
    setIsManualBackingUp(true);
    setManualBackupProgress({ current: 0, total: 0 });

    try {
      const { get } = await import("idb-keyval");
      const storedDataStr = await get("notevault_data");
      const fullData = storedDataStr ? JSON.parse(storedDataStr) : data;

      const totalNotes = fullData.notes?.length || 0;
      setManualBackupProgress({ current: 0, total: totalNotes });

      // Simulate step-by-step progress for UX
      for (let i = 0; i < totalNotes; i++) {
        setManualBackupProgress({ current: i + 1, total: totalNotes });
        if (i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 0)); // yield
        }
      }

      let jsonFolderId = undefined;
      const backupFolderId = localSettings.driveBackup?.backupFolderId;
      if (backupFolderId) {
         try {
            const hierarchy = await ensureBackupHierarchy(accessToken, backupFolderId);
            jsonFolderId = hierarchy.jsonFolderId;
         } catch(e) {
            console.error("Failed to ensure hierarchy", e);
         }
      }

      if (type === 'json' || type === 'both') {
        showToast("Starting JSON Backup...");
        await uploadToDrive(
          accessToken,
          fullData,
          undefined,
          `NoteVault_Manual_Backup_${new Date().toISOString().replace(/:/g, "-")}.json`,
          jsonFolderId
        );
        
        // Update JSON backup date
        setLocalSettings(s => ({
          ...s,
          driveBackup: {
            ...s.driveBackup!,
            lastBackupDate: new Date().toISOString(),
            lastJsonNotesCount: totalNotes
          }
        }));
      }

      if (type === 'md' || type === 'both') {
        showToast("Starting MD Vault Backup...");
        setManualBackupProgress({ current: 0, total: totalNotes }); 
        await import("../lib/drive").then(async m => {
            await m.uploadVaultToDrive(accessToken, fullData, backupFolderId);
        });

        // Update MD backup date
        setLocalSettings(s => ({
          ...s,
          driveBackup: {
            ...s.driveBackup!,
            vaultLastBackupDate: new Date().toISOString(),
            lastMdNotesCount: totalNotes
          }
        }));
      }

      setManualBackupProgress({ current: totalNotes, total: totalNotes });
      alert(`Manual ${type === 'both' ? 'Full' : type.toUpperCase()} Backup completed successfully.`);
    } catch (err: any) {
      console.error(err);
      alert(`Backup failed: ${err.message}`);
    } finally {
      setIsManualBackingUp(false);
      setManualBackupProgress(null);
    }
  };

  const handleFetchDriveFolders = async () => {
     if (!accessToken) return;
     setLoadingDriveFolders(true);
     setShowDriveFolderPicker(true);
     try {
       const folders = await listDriveFolders(accessToken);
       setDriveFolders(folders);
     } catch (err) {
       console.error(err);
       showToast("Failed to fetch folders");
     } finally {
       setLoadingDriveFolders(false);
     }
  };

  const handleCreateRootFolder = async () => {
     if (!accessToken || !newDriveFolderName.trim()) return;
     setLoadingDriveFolders(true);
     try {
       const newId = await createFolder(accessToken, newDriveFolderName.trim());
       setLocalSettings(s => ({
         ...s,
         driveBackup: {
           ...s.driveBackup!,
           backupFolderId: newId,
           backupFolderName: newDriveFolderName.trim(),
           enabled: s.driveBackup?.enabled ?? false,
           frequency: s.driveBackup?.frequency || "daily"
         }
       }));
       setShowDriveFolderPicker(false);
       showToast("Created and selected new backup folder");
     } catch(e) {
       console.error(e);
       showToast("Failed to create folder");
     } finally {
       setLoadingDriveFolders(false);
     }
  };

  const loadMdVaultContents = async (folderId: string) => {
    if (!accessToken) return;
    setLoadingMdVaultContents(true);
    try {
      const { listDriveContents } = await import("../lib/drive");
      const contents = await listDriveContents(accessToken, folderId);
      setMdVaultContents(contents);
    } catch(err) {
      console.error(err);
      showToast("Failed to fetch folder contents");
    } finally {
      setLoadingMdVaultContents(false);
    }
  };

  const handleFetchMdVaultBackups = async () => {
     if (!accessToken) {
        showToast("Please sign in to Google Drive first.");
        return;
     }
     
     const folderId = localSettings.driveBackup?.backupFolderId;
     if (!folderId) {
        showToast("Please select a Drive Backup folder first.");
        return;
     }

     setLoadingMdVaultBackups(true);
     setShowMdRestoreModal(true);
     setSelectedMdVault(null);
     setMdFolderStack([]);
     
     try {
       const { listVaultBackups } = await import("../lib/drive");
       const backups = await listVaultBackups(accessToken, folderId);
       setMdVaultBackups(backups);
     } catch(err) {
       console.error(err);
       showToast("Failed to fetch MD Vault backups");
     } finally {
       setLoadingMdVaultBackups(false);
     }
  };

  const handleFetchDriveBackups = async () => {
     if (!accessToken) {
        showToast("Please sign in to Google Drive first.");
        return;
     }
     
     const folderId = localSettings.driveBackup?.backupFolderId;
     if (!folderId) {
        showToast("Please select a Drive Backup folder first.");
        return;
     }

     setLoadingDriveBackups(true);
     setShowRestoreModal(true);
     setSelectedRestoreBackup(null);
     
     try {
       const backups = await listJsonBackups(accessToken, folderId);
       setDriveBackups(backups);
     } catch(err) {
       console.error(err);
       showToast("Failed to fetch backups");
     } finally {
       setLoadingDriveBackups(false);
     }
  };

  const handlePerformRestore = async () => {
    if (!selectedRestoreBackup || !accessToken) return;
    
    try {
      showToast("Downloading backup...");
      const imported = await downloadJsonBackup(accessToken, selectedRestoreBackup.id);
      
      if (!imported.workspaces || !imported.notes) {
        showToast("Invalid NoteVault Backup File\nMissing basic structure required for NoteVault.");
        return;
      }

      // Create local safety snapshot before applying
      const { set, get } = await import("idb-keyval");
      const currentVaultData = await get("notevault_data");
      if (currentVaultData) {
        await set("notevault_snapshot_" + Date.now(), currentVaultData);
        showToast("Created local safety snapshot.");
      }

      const mergedData = { ...data };

      if (restoreMode === 'full') {
         Object.assign(mergedData, {
            notes: imported.notes || [],
            collections: imported.collections || [],
            workspaces: imported.workspaces || [],
            tags: imported.tags || [],
            settings: { ...mergedData.settings, ...(imported.settings || {}) },
         });
      } else {
         // Selective Merge
         const existingNoteIds = new Set(mergedData.notes.map(n => n.id));
         const newNotes = imported.notes?.filter((n: any) => selectedNotesToRestore.has(n.id) && !existingNoteIds.has(n.id)) || [];
         mergedData.notes = [...mergedData.notes, ...newNotes];

         const existingColIds = new Set(mergedData.collections.map(c => c.id));
         const newCols = imported.collections?.filter((c: any) => selectedCollectionsToRestore.has(c.id) && !existingColIds.has(c.id)) || [];
         mergedData.collections = [...mergedData.collections, ...newCols];

         // Always merge workspaces if any folder is selected to prevent orphan folders
         if (newCols.length > 0) {
            const existingWsIds = new Set(mergedData.workspaces.map(w => w.id));
            const newWs = imported.workspaces?.filter((w: any) => !existingWsIds.has(w.id)) || [];
            mergedData.workspaces = [...mergedData.workspaces, ...newWs];
         }
         
         if (imported.tags) {
            const tagSet = new Set([...mergedData.tags, ...imported.tags]);
            mergedData.tags = Array.from(tagSet);
         }
      }

      saveData(mergedData);
      showToast(`Restore completed (${restoreMode}).`);
      setShowRestoreModal(false);
    } catch (err) {
      console.error(err);
      showToast("Restore failed.");
    }
  };

  // MD Restore Conflict State
  const [mdConflict, setMdConflict] = useState<{noteName: string, folderName: string, resolve: (choice: 'keep' | 'replace' | 'both') => void} | null>(null);
  const mdCancelRef = useRef(false);

  const performMdRestore = async (mode: 'file' | 'folder' | 'vault', item: {id: string, name: string}) => {
    if (!accessToken) return;
    mdCancelRef.current = false;
    
    // Create safety snapshot
    const { set: setIDB, get: getIDB } = await import("idb-keyval");
    const currentVaultData = await getIDB("notevault_data");
    if (currentVaultData) {
      await setIDB("notevault_snapshot_" + Date.now(), currentVaultData);
      showToast("Created local safety snapshot.");
    }
    
    setMdRestoreProgress({ current: 0, total: 1, status: "Scanning folders..." });
    
    const { listDriveContents, downloadTextFile, parseMarkdownFile } = await import("../lib/drive");
    const mergedData = { ...data };
    
    // Collect all items to process
    let totalNotesToProcess = 0;
    
    type ImportTarget = { id: string, name: string, path: string[], isFile: boolean };
    const scanQueue: { id: string, name: string, path: string[] }[] = [];
    const filesToImport: ImportTarget[] = [];
    const foldersToImport: ImportTarget[] = [];
    
    if (mode === 'file') {
      filesToImport.push({ id: item.id, name: item.name, path: mdFolderStack.map(f => f.name), isFile: true });
    } else if (mode === 'folder' || mode === 'vault') {
      scanQueue.push({ id: item.id, name: item.name, path: mode === 'vault' ? [] : [...mdFolderStack.map(f => f.name), item.name] });
      foldersToImport.push({ id: item.id, name: item.name, path: mode === 'vault' ? [] : mdFolderStack.map(f => f.name), isFile: false });
    }
    
    // Breadth-first scan
    let scanCount = 0;
    while (scanQueue.length > 0 && !mdCancelRef.current) {
      const current = scanQueue.shift()!;
      setMdRestoreProgress({ current: scanCount, total: scanCount + scanQueue.length, status: `Scanning ${current.name}...` });
      try {
        const contents = await listDriveContents(accessToken, current.id);
        for (const child of contents) {
          if (child.mimeType === 'application/vnd.google-apps.folder') {
             scanQueue.push({ id: child.id, name: child.name, path: [...current.path, child.name] });
             foldersToImport.push({ id: child.id, name: child.name, path: current.path, isFile: false });
          } else if (child.name.endsWith('.md')) {
             filesToImport.push({ id: child.id, name: child.name, path: current.path, isFile: true });
          } else if (mode === 'vault' && child.name === 'tags.json') {
             // Will handle tags.json later
             filesToImport.push({ id: child.id, name: 'tags.json', path: current.path, isFile: true });
          }
        }
      } catch (e) {
        console.error("Scan error on", current.name, e);
      }
      scanCount++;
    }

    if (mdCancelRef.current) {
       setMdRestoreProgress(null);
       showToast("Restore cancelled during scan.");
       return;
    }

    setMdRestoreProgress({ current: 0, total: filesToImport.length, status: "Importing notes..." });
    let importedNotesCount = 0;
    let tagsMap: Record<string, string[]> | null = null;
    
    // Process files
    for (let i = 0; i < filesToImport.length; i++) {
       if (mdCancelRef.current) break;
       const file = filesToImport[i];
       setMdRestoreProgress({ current: i, total: filesToImport.length, status: `Importing ${file.path.join('/')}/${file.name}` });
       
       try {
         const content = await downloadTextFile(accessToken, file.id);
         
         if (file.name === 'tags.json' && file.path.length === 0) {
            tagsMap = JSON.parse(content);
            continue;
         }
         
         const { frontmatter, body } = parseMarkdownFile(content);
         const title = frontmatter.title || file.name.replace('.md', '');
         const titleCleaned = title.replace(/\//g, '_');
         
         // Find target folder (Collection/Workspace)
         let targetWsId: string | undefined = undefined;
         let targetColId: string | undefined = undefined;
         
         if (file.path.length > 0) {
            const wsName = file.path[0];
            let ws = mergedData.workspaces.find(w => w.name === wsName);
            if (!ws) {
               ws = { id: crypto.randomUUID(), name: wsName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
               mergedData.workspaces.push(ws);
            }
            targetWsId = ws.id;
            
            if (file.path.length > 1) {
               const fullColName = file.path.slice(1).join('/'); // We flatten nested folders in UI to simple collection paths or nested if structure allows, but NoteVault currently maps folders to Workspaces->Collections
               // Let's assume path[1] is collection name
               const colName = file.path[1];
               let col = mergedData.collections.find(c => c.name === colName && c.workspaceId === ws!.id);
               if (!col) {
                  col = { id: crypto.randomUUID(), name: colName, workspaceId: ws!.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                  mergedData.collections.push(col);
               }
               targetColId = col.id;
            }
         }
         
         // Conflict check
         const existingNote = mergedData.notes.find(n => n.title === title && n.workspaceId === targetWsId && n.collectionId === targetColId);
         let finalChoice: 'keep' | 'replace' | 'both' = 'replace';
         
         if (existingNote) {
            finalChoice = await new Promise<'keep' | 'replace' | 'both'>((resolve) => {
               setMdConflict({ noteName: title, folderName: file.path.join('/') || 'Root', resolve });
            });
            setMdConflict(null);
         }
         
         if (finalChoice === 'keep') {
            continue;
         }
         
         const newNote: any = {
            id: finalChoice === 'replace' ? existingNote!.id : crypto.randomUUID(),
            title: title,
            content: body,
            createdAt: frontmatter.date || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceId: targetWsId,
            collectionId: targetColId,
            tags: [], // Handled by tagsMap or frontmatter
            headerMeta: {
               date: frontmatter.date,
               source: frontmatter.source,
               summary: frontmatter.summary
            }
         };
         
         if (finalChoice === 'both') {
            newNote.title = `${title} (Imported)`;
         }
         
         if (finalChoice === 'replace') {
            mergedData.notes = mergedData.notes.map(n => n.id === existingNote!.id ? newNote : n);
         } else {
            mergedData.notes.push(newNote);
         }
         importedNotesCount++;
         
       } catch (e) {
         console.error("Failed to import file", file.name, e);
       }
    }
    
    // Apply tags if full vault restore and tags.json exists
    if (mode === 'vault' && tagsMap && !mdCancelRef.current) {
       for (const tagName of Object.keys(tagsMap)) {
          if (!mergedData.tags.includes(tagName)) {
             mergedData.tags.push(tagName);
          }
          const taggedFiles = tagsMap[tagName]; // Array of filenames
          for (const filename of taggedFiles) {
             const titleToMatch = filename.replace('.md', '');
             // Try to find imported note; simplified mapping for now (tags.json just stores filenames in original backup)
             mergedData.notes.filter(n => n.title === titleToMatch || n.title === `${titleToMatch} (Imported)`).forEach(n => {
                if (!n.tags.includes(tagName)) {
                   n.tags.push(tagName);
                }
             });
          }
       }
    }

    if (!mdCancelRef.current) {
       saveData(mergedData);
       showToast(`Imported ${importedNotesCount} MD notes successfully.`);
    } else {
       // if cancelled mid-process, we still save what we got so we don't 'corrupt already imported notes' as requested!
       saveData(mergedData);
       showToast(`Restore cancelled. Saved ${importedNotesCount} complete notes.`);
    }

    setMdRestoreProgress(null);
    setShowMdRestoreModal(false);
  };
  
  const handleSelectRootFolder = (folder: {id: string, name: string}) => {
     setLocalSettings(s => ({
         ...s,
         driveBackup: {
           ...s.driveBackup!,
           backupFolderId: folder.id,
           backupFolderName: folder.name,
           enabled: s.driveBackup?.enabled ?? false,
           frequency: s.driveBackup?.frequency || "daily"
         }
     }));
     setShowDriveFolderPicker(false);
     showToast("Updated backup folder location");
  };

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleClearData = () => {
    if (deleteInput === "DELETE") {
      clearAllData();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[85vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-active transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-border overflow-y-auto p-3 space-y-1 bg-background/50">
            {[
              {
                id: "FileManager",
                label: "File Manager",
                icon: Folder,
                color: "text-yellow-500",
              },
              {
                id: "Appearance",
                label: "Appearance",
                icon: Monitor,
                color: "text-accent",
              },
              {
                id: "Plugins",
                label: "Plugins",
                icon: Puzzle,
                color: "text-pink-500",
              },
              {
                id: "Editor",
                label: "Editor Settings",
                icon: Code,
                color: "text-orange-500",
              },
              {
                id: "Dictionary",
                label: "Dictionary Manager",
                icon: BookText,
                color: "text-emerald-500",
              },
              {
                id: "AI",
                label: "AI Features",
                icon: Cpu,
                color: "text-blue-500",
              },
              {
                id: "Data",
                label: "Data Management",
                icon: Database,
                color: "text-green-500",
              },
              {
                id: "Health",
                label: "Vault Health",
                icon: Activity,
                color: "text-emerald-500",
              },
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setExpandedSection(sec.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-colors font-medium text-sm text-left",
                  expandedSection === sec.id
                    ? "bg-surface-active text-text-primary shadow-sm"
                    : "hover:bg-surface text-text-secondary",
                )}
              >
                <sec.icon size={18} className={sec.color} />
                {sec.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface/30">
            {/* File Manager */}
            {expandedSection === "FileManager" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Folder className="text-yellow-500" /> File Manager
                </h3>
                <div className="flex flex-col gap-6 w-full">
                  <div className="flex items-center justify-between pointer-events-auto">
                    <h4 className="text-sm font-semibold text-text-primary">
                      Holders & Folders
                    </h4>
                    <button
                      onClick={async () => {
                        const name = await appPrompt("New Holder Name:");
                        if (name) {
                          const icon = await appPrompt(
                            "New Holder Icon/Emoji:",
                            "🧠",
                          );
                          const newWs = addWorkspace(name, icon || "🧠");
                          if (
                            data.settings.driveBackup?.enabled &&
                            accessToken
                          ) {
                            const newData = {
                              ...data,
                              workspaces: [...data.workspaces, newWs],
                            };
                            uploadToDrive(
                              accessToken,
                              newData,
                              data.settings.driveBackup.fileId,
                            ).catch(console.error);
                          }
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded font-medium text-xs transition-colors shadow-sm"
                      title="Add New Holder"
                    >
                      <Plus size={14} /> Add Holder
                    </button>
                  </div>

                  <div className="space-y-6">
                    {data.workspaces.map((w) => {
                      const wsCollections = data.collections.filter(
                        (c) => c.workspaceId === w.id,
                      );
                      return (
                        <div key={w.id} className="flex flex-col gap-3">
                          {/* Workspace Row */}
                          <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3 shadow-sm min-h-[3.5rem]">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{w.icon}</span>
                              <span className="text-base font-bold text-text-primary">
                                {w.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  const name = await appPrompt(
                                    `New Folder inside ${w.name}:`,
                                  );
                                  if (name) {
                                    const icon = await appPrompt(
                                      "New Folder Icon/Emoji:",
                                      "📁",
                                    );
                                    const newCol = addCollection(
                                      w.id,
                                      name,
                                      icon || "📁",
                                    );
                                    if (
                                      data.settings.driveBackup?.enabled &&
                                      accessToken
                                    ) {
                                      const newData = {
                                        ...data,
                                        collections: [
                                          ...data.collections,
                                          newCol,
                                        ],
                                      };
                                      uploadToDrive(
                                        accessToken,
                                        newData,
                                        data.settings.driveBackup.fileId,
                                      ).catch(console.error);
                                    }
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-accent hover:bg-surface-active rounded transition-colors"
                                title="Add Folder"
                              >
                                <FolderPlus size={18} />
                              </button>
                              <button
                                onClick={async () => {
                                  const newName = await appPrompt(
                                    "Update Holder Name:",
                                    w.name,
                                  );
                                  if (newName === null) return;
                                  const newIcon = await appPrompt(
                                    "Update Holder Icon:",
                                    w.icon,
                                  );
                                  updateWorkspace(w.id, {
                                    name: newName || w.name,
                                    icon: newIcon || w.icon,
                                  });
                                  if (
                                    data.settings.driveBackup?.enabled &&
                                    accessToken
                                  ) {
                                    const newData = {
                                      ...data,
                                      workspaces: data.workspaces.map((ws) =>
                                        ws.id === w.id
                                          ? {
                                              ...ws,
                                              name: newName || w.name,
                                              icon: newIcon || w.icon,
                                            }
                                          : ws,
                                      ),
                                    };
                                    uploadToDrive(
                                      accessToken,
                                      newData,
                                      data.settings.driveBackup.fileId,
                                    ).catch(console.error);
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                                title="Edit Holder"
                              >
                                <Code size={16} className="hidden" />
                                <span className="text-xs font-medium">
                                  Edit
                                </span>
                              </button>
                              <button
                                onClick={async () => {
                                  if (
                                    await appConfirm(
                                      `Are you sure you want to completely delete the holder "${w.name}" and ALL its folders and notes? This cannot be undone.`,
                                    )
                                  ) {
                                    deleteWorkspace(w.id);
                                    if (
                                      data.settings.driveBackup?.enabled &&
                                      accessToken
                                    ) {
                                      const newData = {
                                        ...data,
                                        workspaces: data.workspaces.filter(
                                          (ws) => ws.id !== w.id,
                                        ),
                                        collections: data.collections.filter(
                                          (c) => c.workspaceId !== w.id,
                                        ),
                                        notes: data.notes.filter(
                                          (n) => n.workspaceId !== w.id,
                                        ),
                                      };
                                      uploadToDrive(
                                        accessToken,
                                        newData,
                                        data.settings.driveBackup.fileId,
                                      ).catch(console.error);
                                    }
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Holder"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Collections list for this Workspace */}
                          {wsCollections.length > 0 && (
                            <div className="flex flex-col gap-2 pl-4 md:pl-6 ml-4 border-l-2 border-border/50">
                              {wsCollections.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5 hover:border-accent/30 transition-colors"
                                >
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-lg shrink-0">
                                      {c.icon}
                                    </span>
                                    <span className="text-sm font-medium text-text-primary truncate">
                                      {c.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={async () => {
                                        const newName = await appPrompt(
                                          "Update Folder Name:",
                                          c.name,
                                        );
                                        if (newName === null) return;
                                        const newIcon = await appPrompt(
                                          "Update Folder Icon:",
                                          c.icon,
                                        );
                                        updateCollection(c.id, {
                                          name: newName || c.name,
                                          icon: newIcon || c.icon,
                                        });
                                        if (
                                          data.settings.driveBackup?.enabled &&
                                          accessToken
                                        ) {
                                          const newData = {
                                            ...data,
                                            collections: data.collections.map(
                                              (col) =>
                                                col.id === c.id
                                                  ? {
                                                      ...col,
                                                      name: newName || c.name,
                                                      icon: newIcon || c.icon,
                                                    }
                                                  : col,
                                            ),
                                          };
                                          uploadToDrive(
                                            accessToken,
                                            newData,
                                            data.settings.driveBackup.fileId,
                                          ).catch(console.error);
                                        }
                                      }}
                                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                                      title="Edit Folder"
                                    >
                                      <span className="text-xs font-medium">
                                        Edit
                                      </span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (
                                          await appConfirm(
                                            `Are you sure you want to completely delete the folder "${c.name}" and ALL its notes? This cannot be undone.`,
                                          )
                                        ) {
                                          deleteCollection(c.id);
                                          if (
                                            data.settings.driveBackup
                                              ?.enabled &&
                                            accessToken
                                          ) {
                                            const newData = {
                                              ...data,
                                              collections:
                                                data.collections.filter(
                                                  (col) => col.id !== c.id,
                                                ),
                                              notes: data.notes.filter(
                                                (n) => n.collectionId !== c.id,
                                              ),
                                            };
                                            uploadToDrive(
                                              accessToken,
                                              newData,
                                              data.settings.driveBackup.fileId,
                                            ).catch(console.error);
                                          }
                                        }
                                      }}
                                      className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                      title="Delete Folder"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Appearance */}
            {expandedSection === "Appearance" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Monitor className="text-accent" /> Appearance
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <span className="text-sm">Theme</span>
                    <select
                      value={localSettings.theme}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          theme: e.target.value as any,
                        }))
                      }
                      className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <span className="text-sm">Note Output Font Size</span>
                    <select
                      value={localSettings.fontSize}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          fontSize: e.target.value as any,
                        }))
                      }
                      className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="ultralarge">Ultra Large</option>
                    </select>
                  </div>

                  <div className="flex flex-col bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Navigation Bar Size</span>
                      <span className="text-xs text-text-secondary capitalize">
                        {localSettings.navBarSize === "xlarge"
                          ? "Extra Large"
                          : localSettings.navBarSize || "medium"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={["small", "medium", "large", "xlarge"].indexOf(
                        localSettings.navBarSize || "medium",
                      )}
                      onChange={(e) => {
                        const val = ["small", "medium", "large", "xlarge"][
                          parseInt(e.target.value)
                        ];
                        const newSettings = {
                          ...localSettings,
                          navBarSize: val as any,
                        };
                        setLocalSettings(newSettings);
                        updateSettings(newSettings);
                      }}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted px-1">
                      <span>S</span>
                      <span>M</span>
                      <span>L</span>
                      <span>XL</span>
                    </div>
                  </div>

                  <div className="flex flex-col bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Toolbar Bar Size</span>
                      <span className="text-xs text-text-secondary capitalize">
                        {localSettings.toolbarSize === "xlarge"
                          ? "Extra Large"
                          : localSettings.toolbarSize || "medium"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={["small", "medium", "large", "xlarge"].indexOf(
                        localSettings.toolbarSize || "medium",
                      )}
                      onChange={(e) => {
                        const val = ["small", "medium", "large", "xlarge"][
                          parseInt(e.target.value)
                        ];
                        const newSettings = {
                          ...localSettings,
                          toolbarSize: val as any,
                        };
                        setLocalSettings(newSettings);
                        updateSettings(newSettings);
                      }}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted px-1">
                      <span>S</span>
                      <span>M</span>
                      <span>L</span>
                      <span>XL</span>
                    </div>
                  </div>

                  <div className="flex flex-col bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Float Buttons Size</span>
                      <span className="text-xs text-text-secondary capitalize">
                        {localSettings.floatBtnSize === "xlarge"
                          ? "Extra Large"
                          : localSettings.floatBtnSize || "medium"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={["small", "medium", "large", "xlarge"].indexOf(
                        localSettings.floatBtnSize || "medium",
                      )}
                      onChange={(e) => {
                        const val = ["small", "medium", "large", "xlarge"][
                          parseInt(e.target.value)
                        ];
                        const newSettings = {
                          ...localSettings,
                          floatBtnSize: val as any,
                        };
                        setLocalSettings(newSettings);
                        updateSettings(newSettings);
                      }}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted px-1">
                      <span>S</span>
                      <span>M</span>
                      <span>L</span>
                      <span>XL</span>
                    </div>
                  </div>

                  <div className="flex flex-col bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">System Bars Size</span>
                      <span className="text-xs text-text-secondary capitalize">
                        {localSettings.systemBarSize === "xlarge"
                          ? "Extra Large"
                          : localSettings.systemBarSize || "medium"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={["small", "medium", "large", "xlarge"].indexOf(
                        localSettings.systemBarSize || "medium",
                      )}
                      onChange={(e) => {
                        const val = ["small", "medium", "large", "xlarge"][
                          parseInt(e.target.value)
                        ];
                        const newSettings = {
                          ...localSettings,
                          systemBarSize: val as any,
                        };
                        setLocalSettings(newSettings);
                        updateSettings(newSettings);
                      }}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted px-1">
                      <span>S</span>
                      <span>M</span>
                      <span>L</span>
                      <span>XL</span>
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div className="border border-border rounded-xl p-4 mt-6 bg-surface">
                    <h4 className="font-semibold text-sm mb-4">
                      Custom Theme Colors
                    </h4>
                    <p className="text-xs text-text-muted mb-4">
                      Set specific colors to override the selected theme. Leave
                      empty to use theme defaults.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "--bg", label: "Background" },
                        { key: "--surface", label: "Nav/Cards Background" },
                        { key: "--surface-hover", label: "Surface Hover" },
                        { key: "--border", label: "Border/Boxed" },
                        { key: "--text-primary", label: "Base & Bold Texts" },
                        { key: "--text-muted", label: "Muted Text" },
                        { key: "--accent", label: "Accent/Underline/Charts" },
                        { key: "--doc-h1", label: "Editor Headlines" },
                      ].map((colorVar) => (
                        <div
                          key={colorVar.key}
                          className="flex flex-col gap-1.5"
                        >
                          <label className="text-xs font-medium">
                            {colorVar.label}{" "}
                            <span className="text-text-muted/50">
                              ({colorVar.key})
                            </span>
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border-0 p-0 cursor-pointer bg-transparent"
                              value={
                                localSettings.customColors?.[colorVar.key] ||
                                "#000000"
                              }
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  customColors: {
                                    ...(s.customColors || {}),
                                    [colorVar.key]: e.target.value,
                                  },
                                }))
                              }
                              title={`Pick ${colorVar.label} Color`}
                            />
                            <input
                              type="text"
                              placeholder="e.g. #000000 or rgb(...)"
                              className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-accent"
                              value={
                                localSettings.customColors?.[colorVar.key] || ""
                              }
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  customColors: {
                                    ...(s.customColors || {}),
                                    [colorVar.key]: e.target.value,
                                  },
                                }))
                              }
                            />
                            {localSettings.customColors?.[colorVar.key] && (
                              <button
                                title="Clear color override"
                                onClick={() =>
                                  setLocalSettings((s) => {
                                    const newColors = {
                                      ...(s.customColors || {}),
                                    };
                                    delete newColors[colorVar.key];
                                    return { ...s, customColors: newColors };
                                  })
                                }
                                className="text-text-muted hover:text-red-500 p-1 font-bold text-lg leading-none flex items-center justify-center w-6 h-6 rounded-full hover:bg-red-500/10"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Font Management */}
                  <div className="border border-border rounded-xl p-4 mt-6 bg-surface">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-sm">Font Management</h4>
                        <p className="text-xs text-text-muted">
                          Choose fonts for the interface, note text, and code blocks.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newSettings = {
                            ...localSettings,
                            fonts: {
                              interface: "DM Sans",
                              note: "Lora",
                              monospace: "Courier New"
                            }
                          };
                          setLocalSettings(newSettings);
                          updateSettings(newSettings);
                        }}
                        className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-surface-active"
                      >
                        Reset Fonts
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium">Interface Font</label>
                        <select
                          value={localSettings.fonts?.interface || "DM Sans"}
                          onChange={(e) => {
                            const newSettings = {
                              ...localSettings,
                              fonts: { ...(localSettings.fonts || { note: "Lora", monospace: "Courier New" }), interface: e.target.value }
                            };
                            setLocalSettings(newSettings);
                            updateSettings(newSettings);
                          }}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        >
                          {["DM Sans", "Inter", "Roboto", "Open Sans", "Poppins", "Outfit", "Space Grotesk", "Plus Jakarta Sans", "Work Sans", "Montserrat"].map(f => (
                            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium">Note Body Font</label>
                        <select
                          value={localSettings.fonts?.note || "Lora"}
                          onChange={(e) => {
                            const newSettings = {
                              ...localSettings,
                              fonts: { ...(localSettings.fonts || { interface: "DM Sans", monospace: "Courier New" }), note: e.target.value }
                            };
                            setLocalSettings(newSettings);
                            updateSettings(newSettings);
                          }}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        >
                          {["Lora", "Merriweather", "Playfair Display", "EB Garamond", "PT Serif", "Noto Serif", "Crimson Pro", "Frank Ruhl Libre", "Literata", "Zilla Slab"].map(f => (
                            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium">Monospace Font (Code)</label>
                        <select
                          value={localSettings.fonts?.monospace || "Courier New"}
                          onChange={(e) => {
                            const newSettings = {
                              ...localSettings,
                              fonts: { ...(localSettings.fonts || { interface: "DM Sans", note: "Lora" }), monospace: e.target.value }
                            };
                            setLocalSettings(newSettings);
                            updateSettings(newSettings);
                          }}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                        >
                          {["Courier New", "JetBrains Mono", "Fira Code", "Space Mono", "Roboto Mono", "Source Code Pro", "IBM Plex Mono", "Inconsolata", "Ubuntu Mono", "PT Mono"].map(f => (
                            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Plugins */}
            {expandedSection === "Plugins" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Puzzle className="text-pink-500" /> Plugins
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Auto-Categorize</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Move notes to folders automatically based on tags
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          localSettings.plugins?.autoCategorize?.enabled ||
                          false
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLocalSettings((s) => ({
                            ...s,
                            plugins: {
                              ...s.plugins,
                              autoCategorize: {
                                rules: s.plugins?.autoCategorize?.rules || [],
                                enabled: checked,
                              },
                            },
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </div>
                  </label>

                  {localSettings.plugins?.autoCategorize?.enabled && (
                    <div className="space-y-3 mt-4 border-t border-border pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-text-secondary">
                          Routing Rules
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSettings((s) => ({
                              ...s,
                              plugins: {
                                ...s.plugins,
                                autoCategorize: {
                                  enabled: true,
                                  rules: [
                                    ...(s.plugins?.autoCategorize?.rules || []),
                                    {
                                      tag: "",
                                      workspaceId: data.workspaces[0]?.id || "",
                                      collectionId:
                                        data.collections[0]?.id || "",
                                    },
                                  ],
                                },
                              },
                            }));
                          }}
                          className="text-pink-500 hover:text-pink-400 text-xs flex items-center gap-1 font-medium bg-pink-500/10 px-2 py-1 rounded"
                        >
                          <Plus size={12} /> Add Rule
                        </button>
                      </div>

                      {localSettings.plugins.autoCategorize.rules.map(
                        (rule, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 bg-surface p-3 rounded-lg border border-border"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Tag (e.g. todo)"
                                  value={rule.tag}
                                  onChange={(e) => {
                                    const newRules = [
                                      ...(localSettings.plugins?.autoCategorize
                                        ?.rules || []),
                                    ];
                                    newRules[idx].tag = e.target.value
                                      .toLowerCase()
                                      .replace("#", "");
                                    setLocalSettings((s) => ({
                                      ...s,
                                      plugins: {
                                        ...s.plugins,
                                        autoCategorize: {
                                          ...(s.plugins?.autoCategorize as any),
                                          enabled: true,
                                          rules: newRules,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <select
                                  value={rule.collectionId}
                                  onChange={(e) => {
                                    const newRules = [
                                      ...(localSettings.plugins?.autoCategorize
                                        ?.rules || []),
                                    ];
                                    newRules[idx].collectionId = e.target.value;
                                    const targetCol = data.collections.find(
                                      (c) => c.id === e.target.value,
                                    );
                                    newRules[idx].workspaceId =
                                      targetCol?.workspaceId || "";
                                    setLocalSettings((s) => ({
                                      ...s,
                                      plugins: {
                                        ...s.plugins,
                                        autoCategorize: {
                                          ...(s.plugins?.autoCategorize as any),
                                          enabled: true,
                                          rules: newRules,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                >
                                  {data.collections.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {
                                        data.workspaces.find(
                                          (w) => w.id === c.workspaceId,
                                        )?.name
                                      }{" "}
                                      &gt; {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => {
                                  const newRules =
                                    localSettings.plugins?.autoCategorize?.rules.filter(
                                      (_, i) => i !== idx,
                                    ) || [];
                                  setLocalSettings((s) => ({
                                    ...s,
                                    plugins: {
                                      ...s.plugins,
                                      autoCategorize: {
                                        ...(s.plugins?.autoCategorize as any),
                                        enabled: true,
                                        rules: newRules,
                                      },
                                    },
                                  }));
                                }}
                                className="text-text-muted hover:text-red-400 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-border mt-6 pt-6">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Smart Linking</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Suggests related notes while typing based on content
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          localSettings.plugins?.smartLinking?.enabled ?? true
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLocalSettings((s) => ({
                            ...s,
                            plugins: {
                              ...s.plugins,
                              smartLinking: {
                                ...(s.plugins?.smartLinking || {
                                  maxSuggestions: 5,
                                  triggerMode: "typing",
                                  minWordCount: 10,
                                  sources: {
                                    keywordMatching: true,
                                    tagOverlap: true,
                                    embeddingSimilarity: false,
                                  },
                                }),
                                enabled: checked,
                              },
                            },
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </div>
                  </label>

                  {localSettings.plugins?.smartLinking?.enabled && (
                    <div className="space-y-4 pl-2 pr-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Max Suggestions
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                            value={
                              localSettings.plugins.smartLinking.maxSuggestions
                            }
                            onChange={(e) =>
                              setLocalSettings((s) => ({
                                ...s,
                                plugins: {
                                  ...s.plugins,
                                  smartLinking: {
                                    ...s.plugins!.smartLinking!,
                                    maxSuggestions: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Min Word Count
                          </label>
                          <input
                            type="number"
                            min={0}
                            className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                            value={
                              localSettings.plugins.smartLinking.minWordCount
                            }
                            onChange={(e) =>
                              setLocalSettings((s) => ({
                                ...s,
                                plugins: {
                                  ...s.plugins,
                                  smartLinking: {
                                    ...s.plugins!.smartLinking!,
                                    minWordCount: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Trigger Mode
                        </label>
                        <select
                          className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                          value={localSettings.plugins.smartLinking.triggerMode}
                          onChange={(e) =>
                            setLocalSettings((s) => ({
                              ...s,
                              plugins: {
                                ...s.plugins,
                                smartLinking: {
                                  ...s.plugins!.smartLinking!,
                                  triggerMode: e.target.value as any,
                                },
                              },
                            }))
                          }
                        >
                          <option value="typing">While Typing</option>
                          <option value="button">On Demand (Button)</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-medium text-text-secondary mb-2">
                          Suggestion Sources
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                localSettings.plugins.smartLinking.sources
                                  .keywordMatching
                              }
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  plugins: {
                                    ...s.plugins,
                                    smartLinking: {
                                      ...s.plugins!.smartLinking!,
                                      sources: {
                                        ...s.plugins!.smartLinking!.sources,
                                        keywordMatching: e.target.checked,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">Keyword Matching</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                localSettings.plugins.smartLinking.sources
                                  .tagOverlap
                              }
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  plugins: {
                                    ...s.plugins,
                                    smartLinking: {
                                      ...s.plugins!.smartLinking!,
                                      sources: {
                                        ...s.plugins!.smartLinking!.sources,
                                        tagOverlap: e.target.checked,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">Tag Overlap</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={
                                localSettings.plugins.smartLinking.sources
                                  .embeddingSimilarity
                              }
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  plugins: {
                                    ...s.plugins,
                                    smartLinking: {
                                      ...s.plugins!.smartLinking!,
                                      sources: {
                                        ...s.plugins!.smartLinking!.sources,
                                        embeddingSimilarity: e.target.checked,
                                      },
                                    },
                                  },
                                }))
                              }
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">
                              Embedding Similarity (IndexedDB)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <AutoStructureSettingsPanel
                    settings={localSettings}
                    onUpdate={setLocalSettings}
                    collections={data.collections}
                  />
                  <BrainMapSettingsPanel
                    settings={localSettings}
                    onUpdate={setLocalSettings}
                  />
                  <AskYourVaultSettingsPanel
                    settings={localSettings}
                    onUpdate={setLocalSettings}
                    apiUsage={(() => {
                      const keyId =
                        localSettings.featureApiConfigs?.chatKeyId ||
                        (localSettings.apiKeys &&
                          localSettings.apiKeys[0]?.id) ||
                        "legacy";
                      return (
                        data.settings.apiUsageByKey?.[keyId] ||
                        (keyId === "legacy"
                          ? data.settings.apiUsage
                          : undefined)
                      );
                    })()}
                  />
                  <DailyDigestSettingsPanel
                    settings={localSettings}
                    onUpdate={setLocalSettings}
                    apiUsageCount={(() => {
                      const keyId =
                        localSettings.featureApiConfigs?.digestKeyId ||
                        (localSettings.apiKeys &&
                          localSettings.apiKeys[0]?.id) ||
                        "legacy";
                      const u =
                        data.settings.apiUsageByKey?.[keyId] ||
                        (keyId === "legacy"
                          ? data.settings.apiUsage
                          : undefined);
                      return u?.date === new Date().toISOString().split("T")[0]
                        ? (u.embeddingCount || 0) +
                            (u.answerCount || 0) +
                            (u.digestCount || 0) +
                            (u.editorCount || 0)
                        : 0;
                    })()}
                  />
                </div>
              </div>
            )}

            {/* Editor Settings */}
            {expandedSection === "Editor" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Code className="text-orange-500" /> Editor Settings
                </h3>
                <div className="space-y-6">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Smart Paste</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Automatically clean AI text on Ctrl+V
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.smartPaste}
                        onChange={(e) =>
                          setLocalSettings((s) => ({
                            ...s,
                            smartPaste: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Spell Check</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Highlight misspelled words and show suggestions
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.spellCheckEnabled !== false}
                        onChange={(e) =>
                          setLocalSettings((s) => ({
                            ...s,
                            spellCheckEnabled: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                  </label>

                  <div className="bg-surface border border-border p-4 rounded-xl mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-semibold mb-1 text-sm">Float Buttons</div>
                        <div className="text-xs text-text-muted">Manage visibility for floating action buttons inside the note editor.</div>
                      </div>
                      <button
                        onClick={() => {
                          setLocalSettings(s => ({
                            ...s,
                            floatButtons: {
                              quickCapture: true,
                              aiAssistant: true,
                              readEdit: true,
                              smartSearch: true,
                            }
                          }));
                        }}
                        className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-surface-active"
                      >
                        Reset Layout
                      </button>
                    </div>

                    <div className="space-y-3">
                      {[
                        { id: 'quickCapture', label: 'Quick Capture' },
                        { id: 'aiAssistant', label: 'AI Second Brain' },
                        { id: 'readEdit', label: 'Read/Edit Toggle' },
                        { id: 'smartSearch', label: 'Smart Search / Brain Map' }
                      ].map((btn) => (
                        <label key={btn.id} className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm">{btn.label}</span>
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={localSettings.floatButtons?.[btn.id as keyof typeof localSettings.floatButtons] ?? DEFAULT_SETTINGS.floatButtons?.[btn.id as keyof typeof DEFAULT_SETTINGS.floatButtons] ?? true}
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  floatButtons: {
                                    ...(s.floatButtons || DEFAULT_SETTINGS.floatButtons || {
                                      quickCapture: true, aiAssistant: true, readEdit: true, smartSearch: true
                                    }),
                                    [btn.id]: e.target.checked,
                                  },
                                }))
                              }
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">
                      Highlight Colors
                    </div>
                    <div className="text-xs text-text-muted mb-4">
                      Customize the background color for ==highlighted text==.
                    </div>
                    <div className="flex gap-2">
                      {[
                        { name: "Yellow", value: "#facc15" },
                        { name: "Green", value: "#4ade80" },
                        { name: "Blue", value: "#60a5fa" },
                        { name: "Pink", value: "#f472b6" },
                        { name: "Orange", value: "#fb923c" },
                      ].map((color) => (
                        <button
                          key={color.value}
                          onClick={() =>
                            setLocalSettings((s) => ({
                              ...s,
                              highlightColor: color.value,
                            }))
                          }
                          className={`w-8 h-8 rounded-full border-2 ${localSettings.highlightColor === color.value ? "border-primary" : "border-transparent"}`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">
                      Callout Styles
                    </div>
                    <div className="text-xs text-text-muted mb-4">
                      Customize colors and icons for each callout type.
                    </div>
                    <div className="space-y-3">
                      {Object.keys(
                        localSettings.calloutStyles ||
                          DEFAULT_SETTINGS.calloutStyles ||
                          {},
                      ).map((type) => {
                        const style = (localSettings.calloutStyles ||
                          DEFAULT_SETTINGS.calloutStyles ||
                          {})[type];
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <div className="w-24 text-sm font-semibold">
                              {type}
                            </div>
                            <input
                              type="color"
                              value={style?.color || "#000000"}
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  calloutStyles: {
                                    ...(s.calloutStyles ||
                                      DEFAULT_SETTINGS.calloutStyles ||
                                      {}),
                                    [type]: {
                                      ...((s.calloutStyles ||
                                        DEFAULT_SETTINGS.calloutStyles ||
                                        {})[type] || {
                                        icon: "Info",
                                        color: "#000",
                                      }),
                                      color: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="w-8 h-8 rounded shrink-0 border border-border bg-transparent p-0 overflow-hidden cursor-pointer"
                            />
                            <select
                              value={style?.icon || "Info"}
                              onChange={(e) =>
                                setLocalSettings((s) => ({
                                  ...s,
                                  calloutStyles: {
                                    ...(s.calloutStyles ||
                                      DEFAULT_SETTINGS.calloutStyles ||
                                      {}),
                                    [type]: {
                                      ...((s.calloutStyles ||
                                        DEFAULT_SETTINGS.calloutStyles ||
                                        {})[type] || {
                                        color: "#000",
                                        icon: "Info",
                                      }),
                                      icon: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="flex-1 bg-surface-active border border-border rounded px-2 py-1.5 text-sm"
                            >
                              <option value="Info">Info</option>
                              <option value="BookOpen">BookOpen</option>
                              <option value="AlertCircle">AlertCircle</option>
                              <option value="HelpCircle">HelpCircle</option>
                              <option value="AlertTriangle">
                                AlertTriangle
                              </option>
                              <option value="Lightbulb">Lightbulb</option>
                              <option value="Star">Star</option>
                              <option value="Zap">Zap</option>
                              <option value="Flag">Flag</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">
                      Default Callout
                    </div>
                    <div className="text-xs text-text-muted mb-2">
                      Select which callout type is used by default when clicking
                      the Callout button.
                    </div>
                    <select
                      value={localSettings.defaultCallout || "NOTE"}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          defaultCallout: e.target.value,
                        }))
                      }
                      className="w-full bg-surface-active border border-border rounded px-3 py-2 text-sm"
                    >
                      {Object.keys(
                        localSettings.calloutStyles ||
                          DEFAULT_SETTINGS.calloutStyles ||
                          {},
                      ).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">
                      Bottom Bar Button Configuration
                    </div>
                    <div className="text-xs text-text-muted mb-4">
                      Reorder, add, or remove tools from the editor toolbar.
                    </div>

                    <div className="flex flex-col gap-2">
                      {(localSettings.toolbarItems || []).map((item, idx) => {
                        if (item === "|") return null;
                        return (
                          <div
                            key={`${item}-${idx}`}
                            className="flex items-center justify-between bg-surface p-2 border border-border rounded-md"
                          >
                            <span className="text-sm text-text-primary capitalize">
                              {item.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ];
                                  const withoutSeps = items.filter(
                                    (x) => x !== "|",
                                  );
                                  const selfIdx = withoutSeps.indexOf(item);
                                  if (selfIdx > 0) {
                                    const tmp = withoutSeps[selfIdx - 1];
                                    withoutSeps[selfIdx - 1] = item;
                                    withoutSeps[selfIdx] = tmp;
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: withoutSeps,
                                    }));
                                  }
                                }}
                                className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                                disabled={idx === 0}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ];
                                  const withoutSeps = items.filter(
                                    (x) => x !== "|",
                                  );
                                  const selfIdx = withoutSeps.indexOf(item);
                                  if (selfIdx < withoutSeps.length - 1) {
                                    const tmp = withoutSeps[selfIdx + 1];
                                    withoutSeps[selfIdx + 1] = item;
                                    withoutSeps[selfIdx] = tmp;
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: withoutSeps,
                                    }));
                                  }
                                }}
                                className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <div className="w-px h-4 bg-border mx-1"></div>
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ].filter((x) => x !== "|");
                                  setLocalSettings((s) => ({
                                    ...s,
                                    toolbarItems: items.filter(
                                      (x) => x !== item,
                                    ),
                                  }));
                                }}
                                className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {[
                        "undo",
                        "redo",
                        "h1",
                        "h2",
                        "h3",
                        "h4",
                        "h5",
                        "bold",
                        "italic",
                        "underline",
                        "highlight",
                        "link",
                        "blockquote",
                        "callout",
                        "foldable",
                        "bulletList",
                        "orderedList",
                        "taskList",
                        "code",
                        "codeBlock",
                        "table",
                        "hr",
                        "dictate",
                        "attachment",
                        "chart",
                        "image",
                      ].filter(
                        (item) =>
                          !(localSettings.toolbarItems || []).includes(item),
                      ).length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                            Available Features
                          </div>
                          {[
                            "undo",
                            "redo",
                            "h1",
                            "h2",
                            "h3",
                            "h4",
                            "h5",
                            "bold",
                            "italic",
                            "underline",
                            "highlight",
                            "link",
                            "blockquote",
                            "callout",
                            "foldable",
                            "bulletList",
                            "orderedList",
                            "taskList",
                            "code",
                            "codeBlock",
                            "table",
                            "hr",
                            "dictate",
                            "attachment",
                            "chart",
                            "image",
                          ]
                            .filter(
                              (item) =>
                                !(localSettings.toolbarItems || []).includes(
                                  item,
                                ),
                            )
                            .map((item) => (
                              <div
                                key={`avail-${item}`}
                                className="flex items-center justify-between bg-surface-active p-2 rounded-md mb-2 opacity-70 hover:opacity-100 transition-opacity border border-dashed border-border"
                              >
                                <span className="text-sm text-text-muted capitalize">
                                  {item.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                <button
                                  onClick={() => {
                                    const items = [
                                      ...(localSettings.toolbarItems || []),
                                    ].filter((x) => x !== "|");
                                    items.push(item);
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: items,
                                    }));
                                  }}
                                  className="p-1 hover:bg-green-500/20 text-green-500 rounded transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dictionary Manager */}
            {expandedSection === "Dictionary" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <BookText className="text-emerald-500" /> Dictionary Manager
                </h3>
                <div className="bg-surface border border-border p-4 rounded-xl">
                  <p className="text-sm text-text-muted mb-4">
                    Manage your personal vocabulary. These words will not be
                    flagged as misspellings by the editor spell checker.
                  </p>

                  <div className="flex gap-2 items-center mb-4">
                    <input
                      type="text"
                      className="flex-1 bg-surface-active rounded border border-border p-2 text-sm focus:outline-none focus:border-accent text-text-primary"
                      placeholder="Add a new custom word..."
                      value={newDictWord}
                      onChange={(e) => setNewDictWord(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDictWord.trim()) {
                          addWordToDictionary(newDictWord.trim()).then(() => {
                            setNewDictWord("");
                            getPersonalDictionary().then(setPersonalDictionary);
                          });
                        }
                      }}
                    />
                    <button
                      className="bg-accent text-bg px-4 py-2 rounded font-medium text-sm hover:opacity-90 transition-opacity"
                      disabled={!newDictWord.trim()}
                      onClick={() => {
                        addWordToDictionary(newDictWord.trim()).then(() => {
                          setNewDictWord("");
                          getPersonalDictionary().then(setPersonalDictionary);
                        });
                      }}
                    >
                      Add
                    </button>
                  </div>

                  <div className="mb-4">
                    <input
                      type="text"
                      className="w-full bg-surface rounded border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted/50"
                      placeholder="Search your dictionary..."
                      value={dictSearchTerm}
                      onChange={(e) => setDictSearchTerm(e.target.value)}
                    />
                  </div>

                  {personalDictionary.length === 0 ? (
                    <div className="text-center text-text-muted text-sm py-4 italic">
                      Your personal dictionary is currently empty.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-border rounded-lg bg-surface divide-y divide-border/50">
                      {personalDictionary
                        .filter((w) =>
                          dictSearchTerm
                            ? w
                                .toLowerCase()
                                .includes(dictSearchTerm.toLowerCase())
                            : true,
                        )
                        .map((word) => (
                          <div
                            key={word}
                            className="flex justify-between items-center px-3 py-2 text-sm text-text-primary group"
                          >
                            <span>{word}</span>
                            <button
                              className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                removeWordFromDictionary(word).then(() => {
                                  getPersonalDictionary().then(
                                    setPersonalDictionary,
                                  );
                                });
                              }}
                              title="Remove word"
                            >
                              <Minus size={14} />
                            </button>
                          </div>
                        ))}
                      {dictSearchTerm &&
                        personalDictionary.filter((w) =>
                          w
                            .toLowerCase()
                            .includes(dictSearchTerm.toLowerCase()),
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-text-muted italic">
                            No words match your search.
                          </div>
                        )}
                    </div>
                  )}

                  {personalDictionary.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <button
                        className="text-xs text-red-500 font-medium hover:underline px-2 py-1 transition-colors"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to clear your entire personal dictionary?",
                            )
                          ) {
                            clearPersonalDictionary().then(() => {
                              setPersonalDictionary([]);
                            });
                          }
                        }}
                      >
                        Clear Dictionary
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Features */}
            {expandedSection === "AI" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Cpu className="text-blue-500" /> AI Features
                </h3>
                <div className="space-y-4">
                  <ApiKeysSettingsPanel
                    localSettings={localSettings}
                    setLocalSettings={setLocalSettings}
                  />

                  {/* Search Scope */}
                  <AISearchScopeSettings
                    localSettings={localSettings}
                    setLocalSettings={setLocalSettings}
                  />
                </div>
              </div>
            )}

            {/* Data Management */}
            {expandedSection === "Data" && (
              <div className="space-y-5">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Database className="text-green-500" /> Data Management
                </h3>
                <div className="space-y-5">
                  {/* Cloud Sync */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> Cloud Sync
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3">
                      {user ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-medium text-text-primary text-sm">
                                Signed in
                              </span>
                              <span className="text-text-muted text-[11px] truncate w-32">
                                {user.email}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowSignOutConfirm(true)}
                              className="text-text-muted hover:bg-surface-active p-1.5 rounded transition-colors text-xs font-medium"
                            >
                              Sign out
                            </button>
                          </div>
                          <div className="flex flex-col gap-2 pt-2 border-t border-border">
                            <div className="flex justify-between items-center text-xs text-text-muted">
                              <span>Last Successful Backup:</span>
                              <span className="font-medium">
                                {localSettings.lastCloudSyncDate
                                  ? new Date(
                                      localSettings.lastCloudSyncDate,
                                    ).toLocaleString()
                                  : "Never"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => syncToCloud()}
                                disabled={isSyncing}
                                className="flex-1 bg-accent hover:bg-accent-hover text-white disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium border border-transparent"
                              >
                                <Cloud size={14} /> Backup Now
                              </button>
                              <button
                                onClick={async () => {
                                  const preview = await getCloudBackupPreview();
                                  if (preview) {
                                    setCloudPreview(preview);
                                  }
                                }}
                                disabled={isSyncing}
                                className="flex-1 bg-background hover:bg-surface-active border border-border disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium"
                              >
                                <RefreshCw
                                  size={14}
                                  className={isSyncing ? "animate-spin" : ""}
                                />{" "}
                                Restore
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center py-1 space-y-3">
                          <p className="text-xs text-text-muted">
                            Sign in to securely backup layout.
                          </p>
                          <button
                            type="button"
                            onClick={signIn}
                            className="bg-white text-black font-medium hover:bg-gray-200 transition-colors w-full px-3 py-1.5 rounded-md flex items-center justify-center gap-2 text-sm shadow-sm"
                          >
                            <LogIn size={14} /> Sign in with Google
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Google Drive Backup */}
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> Google Drive Auto Backup
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3">
                      <label className="flex items-center justify-between cursor-pointer mb-3">
                        <div>
                          <div className="text-sm font-medium">
                            Enable Auto-Sync
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Automatically save NoteVault_Backup.json
                          </div>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              localSettings.driveBackup?.enabled || false
                            }
                            onChange={async (e) => {
                              const enabled = e.target.checked;
                              if (enabled) {
                                // Request auth scope immediately upon enabling
                                try {
                                  await signIn();
                                } catch (err) {
                                  console.error(err);
                                  showToast(
                                    "Google Drive authentication failed",
                                  );
                                  return;
                                }
                              }

                              setLocalSettings((s) => ({
                                ...s,
                                driveBackup: {
                                  ...s.driveBackup,
                                  enabled,
                                  frequency:
                                    s.driveBackup?.frequency || "daily",
                                },
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                      </label>
                    </div>

                    <div className="bg-surface border border-border rounded-lg p-3 mt-2">
                      <label className="flex items-center justify-between cursor-pointer mb-3">
                        <div>
                          <div className="text-sm font-medium">
                            Enable MD Vault Sync
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Automatically back up notes as regular Markdown files
                          </div>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              localSettings.driveBackup?.vaultBackupEnabled || false
                            }
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setLocalSettings((s) => ({
                                ...s,
                                driveBackup: {
                                  enabled: s.driveBackup?.enabled || false,
                                  frequency: s.driveBackup?.frequency || "daily",
                                  ...s.driveBackup,
                                  vaultBackupEnabled: enabled,
                                  vaultBackupFrequency: s.driveBackup?.vaultBackupFrequency || "daily",
                                },
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                      </label>

                      {(localSettings.driveBackup?.enabled || localSettings.driveBackup?.vaultBackupEnabled) && (
                        <div className="pt-3 border-t border-border flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-text-secondary">
                              Backup Location
                            </span>
                            <div className="flex items-center justify-between bg-background border border-border rounded-md px-2 py-1.5 text-sm">
                              <span className="truncate max-w-[150px] text-text-primary">
                                {localSettings.driveBackup?.backupFolderName || "Root Folder"}
                              </span>
                              <button
                                onClick={handleFetchDriveFolders}
                                className="text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                          
                          {localSettings.driveBackup?.enabled && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-xs text-text-secondary">
                                JSON Sync Frequency
                              </span>
                              <select
                                value={
                                  localSettings.driveBackup?.frequency || "daily"
                                }
                                onChange={(e) => {
                                  setLocalSettings((s) => ({
                                    ...s,
                                    driveBackup: {
                                      ...s.driveBackup!,
                                      frequency: e.target.value as any,
                                    },
                                  }));
                                }}
                                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none"
                              >
                                <option value="daily">Daily</option>
                                <option value="3days">Every 3 Days</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="90days">Every 90 Days</option>
                              </select>
                            </div>
                          )}

                          {localSettings.driveBackup?.vaultBackupEnabled && (
                            <div className="flex flex-col gap-1.5 mt-2">
                              <span className="text-xs text-text-secondary">
                                MD Vault Sync Frequency
                              </span>
                              <select
                                value={
                                  localSettings.driveBackup?.vaultBackupFrequency || "daily"
                                }
                                onChange={(e) => {
                                  setLocalSettings((s) => ({
                                    ...s,
                                    driveBackup: {
                                      ...s.driveBackup!,
                                      vaultBackupFrequency: e.target.value as any,
                                    },
                                  }));
                                }}
                                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none"
                              >
                                <option value="daily">Daily</option>
                                <option value="3days">Every 3 Days</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="90days">Every 90 Days</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* JSON Status */}
                    <div className="bg-surface border border-border rounded-lg p-3 mt-2 flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-text-primary">JSON Backup Status</span>
                      <div className="flex justify-between items-center text-xs text-text-muted mt-1">
                          <span>Last Backup:</span>
                          <span className="text-text-primary">{localSettings.driveBackup?.lastBackupDate ? new Date(localSettings.driveBackup.lastBackupDate).toLocaleString() : "Never"}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-text-muted">
                          <span>Notes Backed Up:</span>
                          <span className="text-text-primary">{localSettings.driveBackup?.lastJsonNotesCount || 0}</span>
                      </div>
                    </div>

                    {/* MD Vault Status */}
                    <div className="bg-surface border border-border rounded-lg p-3 mt-2 flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-text-primary">MD Vault Backup Status</span>
                      <div className="flex justify-between items-center text-xs text-text-muted mt-1">
                          <span>Last Backup:</span>
                          <span className="text-text-primary">{localSettings.driveBackup?.vaultLastBackupDate ? new Date(localSettings.driveBackup.vaultLastBackupDate).toLocaleString() : "Never"}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-text-muted">
                          <span>Notes Backed Up:</span>
                          <span className="text-text-primary">{localSettings.driveBackup?.lastMdNotesCount || 0}</span>
                      </div>
                    </div>

                    <div className="bg-surface border border-border rounded-lg p-3 mt-4 flex flex-col gap-3">
                      <span className="text-sm font-medium text-text-primary">Manual Backups</span>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">
                          JSON Backup Only
                        </span>
                        <button
                          onClick={() => handleManualDriveBackup('json')}
                          disabled={isManualBackingUp}
                          className="bg-surface-active hover:bg-border text-text-primary border border-border disabled:opacity-50 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                        >
                          <Upload size={12} /> Run JSON
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">
                          MD Vault Backup Only
                        </span>
                        <button
                          onClick={() => handleManualDriveBackup('md')}
                          disabled={isManualBackingUp}
                          className="bg-surface-active hover:bg-border text-text-primary border border-border disabled:opacity-50 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                        >
                          <Upload size={12} /> Run MD Vault
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs font-medium text-text-secondary">
                          Full Sequential Backup (Both)
                        </span>
                        <button
                          onClick={() => handleManualDriveBackup('both')}
                          disabled={isManualBackingUp}
                          className="bg-accent hover:bg-accent-hover text-white disabled:opacity-50 text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                        >
                          <Upload size={12} /> Run Both
                        </button>
                      </div>

                      {isManualBackingUp && manualBackupProgress && (
                        <div className="space-y-1 mt-1">
                          <div className="flex justify-between text-[10px] text-text-muted">
                            <span>Backing up...</span>
                            <span>
                              {manualBackupProgress.current} /{" "}
                              {manualBackupProgress.total} notes
                            </span>
                          </div>
                          <div className="w-full bg-surface-active rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${(manualBackupProgress.current / (manualBackupProgress.total || 1)) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Drive JSON Restore */}
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> Drive JSON Restore
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-text-primary block">Restore JSON Backup</span>
                          <span className="text-xs text-text-secondary">Load a JSON backup from your selected Drive folder</span>
                        </div>
                        <button
                          onClick={handleFetchDriveBackups}
                          className="bg-accent hover:bg-accent-hover text-white text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                        >
                           Search Backups
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* MD Vault Restore */}
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> MD Vault Folder Restore
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-text-primary block">Restore MD Vault</span>
                          <span className="text-xs text-text-secondary">Browse your Drive Vault backups and import folders/notes</span>
                        </div>
                        <button
                          onClick={handleFetchMdVaultBackups}
                          className="bg-accent hover:bg-accent-hover text-white text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                        >
                           Browse Vaults
                        </button>
                      </div>
                    </div>
                  </div>

                  <GithubSyncSettingsPanel settings={localSettings} updateSettings={(s) => setLocalSettings((prev) => ({ ...prev, ...s }))} />

                  {/* Local Backup */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <HardDrive size={14} /> Local Backup
                      </span>
                      <span className="normal-case font-normal text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                        {storageUsage}
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenExport();
                        }}
                        className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all"
                      >
                        <FileJson size={16} />
                        <span className="text-xs font-medium">Export</span>
                      </button>
                      <label className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all cursor-pointer">
                        <Download size={16} />
                        <span className="text-xs font-medium">Import</span>
                        <input
                          type="file"
                          accept=".json,.txt,.md,.html"
                          onChange={handleDataImport}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <button
                      onClick={async () => {
                        const { get, keys } = await import("idb-keyval");
                        const allKeys = await keys();
                        const snapshotKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith("notevault_snapshot_")).sort().reverse();
                        if (snapshotKeys.length === 0) {
                           showToast("No safety snapshots found.");
                           return;
                        }
                        const latest = snapshotKeys[0];
                        const snapshotData = await get(latest as string);
                        if (snapshotData) {
                           if (window.confirm("Roll back vault to the latest safety snapshot before the last restore? This will overwrite your current vault.")) {
                              saveData(snapshotData);
                              showToast("Rollback completed.");
                           }
                        } else {
                           showToast("Snapshot is empty.");
                        }
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 bg-surface hover:bg-surface-active border border-border p-2 rounded-lg transition-colors text-text-primary text-xs font-medium"
                    >
                       Rollback to Safety Snapshot
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    <h4 className="text-red-400 font-medium text-xs mb-2 flex items-center gap-1.5">
                      <Trash2 size={14} /> Danger Zone
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type DELETE"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        className="bg-background border border-border rounded w-24 px-2 py-1 text-xs focus:outline-none focus:border-red-500"
                      />
                      <button
                        onClick={handleClearData}
                        disabled={deleteInput !== "DELETE"}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:pointer-events-none px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Clear Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vault Health */}
            {expandedSection === "Health" && <VaultHealthDashboard />}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0 bg-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border hover:bg-surface-active transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-colors flex items-center gap-2 text-sm shadow-md"
          >
            <Save size={16} />
            Apply Settings
          </button>
        </div>

        {showSignOutConfirm && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                 Sign Out?
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                Signing out will remove your local cache and offline data. Please ensure any pending changes are synced to Google Drive before proceeding.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium border border-border"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    setShowSignOutConfirm(false);
                    clearAllData();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors text-sm"
                >
                   Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {importPendingFile && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                <FileJson size={18} /> Import Note
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                Select where to save <strong>{importPendingFile.name}</strong>:
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">
                    Workspace
                  </label>
                  <div className="relative">
                    <select
                      value={importTargetWorkspace}
                      onChange={(e) => {
                        setImportTargetWorkspace(e.target.value);
                        setImportTargetCollection(
                          data.collections.find(
                            (c) => c.workspaceId === e.target.value,
                          )?.id || "",
                        );
                      }}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                    >
                      {data.workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-2.5 text-text-muted pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">
                    Folder (Collection)
                  </label>
                  <div className="relative">
                    <select
                      value={importTargetCollection}
                      onChange={(e) =>
                        setImportTargetCollection(e.target.value)
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                      disabled={!importTargetWorkspace}
                    >
                      {data.collections
                        .filter((c) => c.workspaceId === importTargetWorkspace)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-2.5 text-text-muted pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setImportPendingFile(null)}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (importTargetWorkspace && importTargetCollection) {
                      addNote(
                        importTargetWorkspace,
                        importTargetCollection,
                        importPendingFile.name,
                        importPendingFile.content,
                      );
                      showToast("✓ Note imported");
                      setImportPendingFile(null);
                    }
                  }}
                  disabled={!importTargetWorkspace || !importTargetCollection}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-md transition-colors text-sm"
                >
                  Import File
                </button>
              </div>
            </div>
          </div>
        )}

        {showDriveFolderPicker && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm flex flex-col max-h-[80vh]">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                 Select Backup Folder
              </h3>
              
              <div className="flex gap-2 mb-4">
                 <input 
                   type="text"
                   value={newDriveFolderName}
                   onChange={e => setNewDriveFolderName(e.target.value)}
                   className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                   placeholder="New folder name"
                 />
                 <button
                   onClick={handleCreateRootFolder}
                   disabled={loadingDriveFolders || !newDriveFolderName.trim()}
                   className="bg-accent text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
                 >
                   Create
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[100px] border border-border rounded-md bg-background mb-4 p-2">
                 {loadingDriveFolders ? (
                    <div className="text-center text-sm text-text-muted py-4">Loading...</div>
                 ) : driveFolders.length === 0 ? (
                    <div className="text-center text-sm text-text-muted py-4">No backup folders found. Create one.</div>
                 ) : (
                    driveFolders.map(folder => (
                       <button
                         key={folder.id}
                         onClick={() => handleSelectRootFolder(folder)}
                         className="w-full text-left px-3 py-2 text-sm hover:bg-surface-active rounded-md transition-colors flex items-center gap-2"
                       >
                         <Cloud size={14} className="text-accent" />
                         <span className="truncate flex-1">{folder.name}</span>
                       </button>
                    ))
                 )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDriveFolderPicker(false)}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium border border-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showRestoreModal && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm flex flex-col max-h-[90vh]">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                 <Cloud size={18} className="text-accent" /> Select Backup to Restore
              </h3>
              
              <div className="flex-1 overflow-y-auto border border-border rounded-md bg-background mb-4 p-2 min-h-[150px]">
                 {loadingDriveBackups ? (
                    <div className="text-center text-sm text-text-muted py-4">Loading backups...</div>
                 ) : driveBackups.length === 0 ? (
                    <div className="text-center text-sm text-text-muted py-4">No JSON backups found.</div>
                 ) : (
                    driveBackups.map(backup => (
                       <div 
                         key={backup.id}
                         onClick={async () => {
                           setSelectedRestoreBackup(backup);
                           setRestoreMode('full');
                           if (!accessToken) return;
                           setDownloadingBackup(true);
                           setDownloadedBackup(null);
                           try {
                             const imported = await downloadJsonBackup(accessToken, backup.id);
                             setDownloadedBackup(imported);
                             setSelectedNotesToRestore(new Set((imported.notes || []).map((n: any) => n.id)));
                             setSelectedCollectionsToRestore(new Set((imported.collections || []).map((c: any) => c.id)));
                           } catch(e) {
                             console.error(e);
                             showToast("Failed to fetch backup contents for preview");
                           } finally {
                             setDownloadingBackup(false);
                           }
                         }}
                         className={`w-full text-left p-3 text-sm hover:bg-surface-active rounded-md transition-colors cursor-pointer border ${selectedRestoreBackup?.id === backup.id ? 'border-accent bg-accent/10' : 'border-transparent'}`}
                       >
                         <div className="font-medium truncate">{backup.name}</div>
                         <div className="flex justify-between items-center text-xs text-text-muted mt-1">
                           <span>{new Date(backup.createdTime).toLocaleString()}</span>
                           <span>{backup.description ? backup.description : (backup.size ? (parseInt(backup.size) / 1024).toFixed(1) + ' KB' : '')}</span>
                         </div>
                       </div>
                    ))
                 )}
              </div>

              {selectedRestoreBackup && (
                <div className="mb-4 bg-background border border-border rounded-md p-3">
                  <span className="text-sm font-medium mb-2 block">Restore Mode</span>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        name="restoreMode" 
                        checked={restoreMode === 'full'} 
                        onChange={() => setRestoreMode('full')}
                        className="accent-accent"
                      />
                      <div>
                        Full Restore
                        <span className="block text-[10px] text-text-muted">Replaces all vault data. A local safety snapshot will be created.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        name="restoreMode" 
                        checked={restoreMode === 'selective'} 
                        onChange={() => setRestoreMode('selective')}
                        className="accent-accent"
                      />
                      <div>
                        Selective Merge
                        <span className="block text-[10px] text-text-muted">Imports items without deleting existing data.</span>
                      </div>
                    </label>
                  </div>
                  
                  {restoreMode === 'selective' && (
                     <div className="ml-5 mt-2 flex flex-col gap-2 text-xs border-t border-border pt-2">
                       {downloadingBackup ? (
                          <div className="text-text-muted">Loading backup contents...</div>
                       ) : downloadedBackup ? (
                          <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                            <div className="font-semibold text-text-primary underline">Notes ({downloadedBackup.notes?.length || 0})</div>
                            {downloadedBackup.notes?.map((n: any) => (
                               <label key={n.id} className="flex items-center gap-2 cursor-pointer ml-1 truncate">
                                  <input type="checkbox" checked={selectedNotesToRestore.has(n.id)} onChange={e => {
                                      const next = new Set(selectedNotesToRestore);
                                      if (e.target.checked) next.add(n.id); else next.delete(n.id);
                                      setSelectedNotesToRestore(next);
                                  }} />
                                  <span className="truncate">{n.title || 'Untitled Note'}</span>
                               </label>
                            ))}
                            
                            <div className="font-semibold text-text-primary underline mt-2">Folders ({downloadedBackup.collections?.length || 0})</div>
                            {downloadedBackup.collections?.map((c: any) => (
                               <label key={c.id} className="flex items-center gap-2 cursor-pointer ml-1 truncate">
                                  <input type="checkbox" checked={selectedCollectionsToRestore.has(c.id)} onChange={e => {
                                      const next = new Set(selectedCollectionsToRestore);
                                      if (e.target.checked) next.add(c.id); else next.delete(c.id);
                                      setSelectedCollectionsToRestore(next);
                                  }} />
                                  <span className="truncate">{c.name || 'Untitled Folder'}</span>
                               </label>
                            ))}
                          </div>
                       ) : (
                          <div className="text-red-400">Failed to load payload</div>
                       )}
                     </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-auto">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium border border-border"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePerformRestore}
                  disabled={!selectedRestoreBackup || loadingDriveBackups}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  Confirm Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {showMdRestoreModal && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm flex flex-col max-h-[90vh]">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                 <Cloud size={18} className="text-accent" /> MD Vault Restore
              </h3>

              {!selectedMdVault ? (
                 <div className="flex-1 flex flex-col gap-2 min-h-[150px]">
                    <div className="text-sm font-medium mb-1">Select a Vault Backup</div>
                    <div className="flex-1 overflow-y-auto border border-border rounded-md bg-background p-2">
                       {loadingMdVaultBackups ? (
                          <div className="text-center text-sm text-text-muted py-4">Loading vaults...</div>
                       ) : mdVaultBackups.length === 0 ? (
                          <div className="text-center text-sm text-text-muted py-4">No Vaults found.</div>
                       ) : (
                          mdVaultBackups.map(vault => (
                             <div 
                               key={vault.id}
                               onClick={() => {
                                  setSelectedMdVault(vault);
                                  loadMdVaultContents(vault.id);
                               }}
                               className="w-full text-left p-2.5 text-sm hover:bg-surface-active rounded-md transition-colors cursor-pointer border border-transparent hover:border-border"
                             >
                               <div className="font-medium truncate">{vault.name}</div>
                               <div className="text-xs text-text-muted">{new Date(vault.createdTime).toLocaleString()}</div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              ) : (
                 <div className="flex-1 flex flex-col gap-2 min-h-[150px]">
                    
                    <div className="flex items-center gap-2 text-sm bg-surface-active p-1.5 rounded-md mb-2 overflow-x-auto whitespace-nowrap">
                       <button onClick={() => {
                          setMdFolderStack([]);
                          loadMdVaultContents(selectedMdVault.id);
                       }} className="hover:text-accent font-medium text-text-muted transition-colors">
                          {selectedMdVault.name}
                       </button>
                       {mdFolderStack.map((f, i) => (
                           <span key={f.id} className="flex items-center gap-1 text-text-muted">
                              <span>/</span>
                              <button onClick={() => {
                                 const nextStack = mdFolderStack.slice(0, i + 1);
                                 setMdFolderStack(nextStack);
                                 loadMdVaultContents(f.id);
                              }} className="hover:text-accent font-medium transition-colors max-w-[80px] truncate">
                                 {f.name}
                              </button>
                           </span>
                       ))}
                    </div>

                    <div className="flex justify-between items-center mb-1">
                       <div className="text-sm font-medium">Contents</div>
                       <button 
                         onClick={() => performMdRestore(mdFolderStack.length === 0 ? 'vault' : 'folder', mdFolderStack.length === 0 ? selectedMdVault : mdFolderStack[mdFolderStack.length - 1])}
                         className="text-[11px] bg-accent text-white px-2 py-1 rounded"
                       >
                         {mdFolderStack.length === 0 ? "Restore Full Vault" : "Restore This Folder"}
                       </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto border border-border rounded-md bg-background p-2">
                       {loadingMdVaultContents ? (
                          <div className="text-center text-sm text-text-muted py-4">Loading contents...</div>
                       ) : mdVaultContents.length === 0 ? (
                          <div className="text-center text-sm text-text-muted py-4">Folder is empty.</div>
                       ) : (
                          mdVaultContents.map(child => (
                             <div key={child.id} className="flex items-center justify-between p-2 hover:bg-surface-active rounded-md group">
                                <div 
                                   onClick={() => {
                                      if (child.mimeType === 'application/vnd.google-apps.folder') {
                                         setMdFolderStack([...mdFolderStack, {id: child.id, name: child.name}]);
                                         loadMdVaultContents(child.id);
                                      }
                                   }}
                                   className={`flex items-center gap-2 text-sm truncate flex-1 ${child.mimeType === 'application/vnd.google-apps.folder' ? 'cursor-pointer hover:text-accent' : ''}`}
                                >
                                   {child.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'}
                                   <span className="truncate">{child.name}</span>
                                </div>
                                
                                {child.mimeType !== 'application/vnd.google-apps.folder' && child.name.endsWith('.md') && (
                                   <button 
                                      onClick={() => performMdRestore('file', child)}
                                      className="opacity-0 group-hover:opacity-100 text-[10px] bg-surface border border-border px-2 py-0.5 rounded text-text-primary hover:text-accent hover:border-accent transition-all"
                                   >
                                      Import
                                   </button>
                                )}
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              )}

              {mdRestoreProgress && (
                <div className="mt-4 bg-background border border-border rounded-md p-3">
                   <div className="flex justify-between text-xs mb-2">
                      <span className="font-medium text-text-primary truncate mr-2">{mdRestoreProgress.status}</span>
                      <span className="text-text-muted shrink-0">{mdRestoreProgress.current} / {mdRestoreProgress.total}</span>
                   </div>
                   <div className="w-full bg-surface-active rounded-full h-1.5 mb-2">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(mdRestoreProgress.current / (mdRestoreProgress.total || 1)) * 100}%` }}></div>
                   </div>
                   <button 
                     onClick={() => { mdCancelRef.current = true; }} 
                     className="w-full text-xs text-red-500 font-medium py-1 hover:bg-red-500/10 rounded-md transition-colors"
                   >
                     Cancel Restore
                   </button>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowMdRestoreModal(false)}
                  disabled={!!mdRestoreProgress}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium border border-border disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
            
            {mdConflict && (
              <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-6 z-[60]">
                <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm">
                   <h3 className="text-lg font-bold text-red-500 mb-2">Note Conflict</h3>
                   <p className="text-sm text-text-primary mb-1">A note with this title already exists in exactly this location.</p>
                   <p className="text-xs text-text-muted bg-background p-2 rounded border border-border mb-4">
                      Title: {mdConflict.noteName}<br />
                      Location: {mdConflict.folderName}
                   </p>
                   <div className="flex flex-col gap-2">
                      <button onClick={() => mdConflict.resolve('replace')} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md font-medium text-sm transition-colors">Replace Existing Note</button>
                      <button onClick={() => mdConflict.resolve('keep')} className="w-full bg-surface-active border border-border hover:border-text-muted py-2 rounded-md font-medium text-sm transition-colors">Skip (Keep Existing)</button>
                      <button onClick={() => mdConflict.resolve('both')} className="w-full bg-surface-active border border-border hover:border-text-muted py-2 rounded-md font-medium text-sm transition-colors">Keep Both (Rename newly imported)</button>
                   </div>
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
};
