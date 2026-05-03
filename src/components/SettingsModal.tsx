import React, { useState, useEffect } from 'react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { X, Save, Trash2, HardDrive, Cloud, LogIn, LogOut, RefreshCw, FileJson, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { Settings as SettingsType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { data, updateSettings, clearAllData, syncFromCloud, syncToCloud, isSyncing, importData, showToast } = useStorage();
  const { user, signIn, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<SettingsType>(data.settings);
  const [deleteInput, setDeleteInput] = useState('');
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');
  const [isImporting, setIsImporting] = useState(false);

  const handleExportJson = () => {
    const backup = {
      ...data,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NoteVault_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON exported successfully');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        // Basic validation
        if (!imported.workspaces || !imported.notes) {
          throw new Error('Invalid backup file structure');
        }
        
        const confirmMerge = window.confirm('Merge with existing data? (Cancel to replace everything)');
        importData(imported, confirmMerge);
        showToast('Data imported successfully');
        onClose();
      } catch (err) {
        console.error(err);
        showToast('Failed to import JSON: Invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(data.settings);
      setDeleteInput('');
      
      // Calculate storage
      try {
        let total = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2);
          }
        }
        const kb = total / 1024;
        if (kb > 1024) {
          setStorageUsage((kb / 1024).toFixed(2) + ' MB');
        } else {
          setStorageUsage(kb.toFixed(2) + ' KB');
        }
      } catch (e) {
        setStorageUsage('Unknown (Storage Access Denied)');
      }
    }
  }, [isOpen, data.settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleClearData = () => {
    if (deleteInput === 'DELETE') {
      clearAllData();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-lg rounded-xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Theme */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <select 
                  value={localSettings.theme}
                  onChange={e => setLocalSettings(s => ({ ...s, theme: e.target.value as any }))}
                  className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Default Font Size</span>
                <select 
                  value={localSettings.fontSize}
                  onChange={e => setLocalSettings(s => ({ ...s, fontSize: e.target.value as any }))}
                  className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:border-accent"
                >
                  <option value="small">Small (14px)</option>
                  <option value="medium">Medium (16px)</option>
                  <option value="large">Large (18px)</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Editor */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3">Editor</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-medium">Smart Paste</div>
                  <div className="text-xs text-text-muted mt-0.5">Automatically clean AI text on Ctrl+V</div>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={localSettings.smartPaste}
                    onChange={e => setLocalSettings(s => ({ ...s, smartPaste: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                </div>
              </label>
            </div>
          </div>

          <hr className="border-border" />

          {/* Cloud Sync */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
              <Cloud size={16} /> Cloud Sync
            </h3>
            <div className="bg-surface border border-border rounded-lg p-4">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                     <div className="flex flex-col">
                        <span className="font-medium text-text-primary">Signed in as</span>
                        <span className="text-text-muted text-xs">{user.email}</span>
                     </div>
                     <button
                       onClick={signOut}
                       className="text-text-muted hover:text-white transition-colors flex items-center gap-1 text-xs"
                     >
                       <LogOut size={14} /> Sign out
                     </button>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                     <button
                       onClick={() => syncToCloud()}
                       disabled={isSyncing}
                       className="flex-1 bg-surface-active hover:bg-surface-active/80 border border-border disabled:opacity-50 text-sm py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                     >
                       <Cloud size={16} /> Backup to Cloud
                     </button>
                     <button
                       onClick={() => syncFromCloud()}
                       disabled={isSyncing}
                       className="flex-1 bg-surface-active hover:bg-surface-active/80 border border-border disabled:opacity-50 text-sm py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                     >
                       <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> Download Data
                     </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-2 space-y-3">
                  <p className="text-sm text-text-muted">Sign in to securely backup and sync your notes across devices.</p>
                  <button 
                    type="button"
                    onClick={signIn}
                    className="bg-white text-black font-medium hover:bg-gray-200 transition-colors px-4 py-2 rounded-md shadow-sm flex items-center gap-2 text-sm"
                  >
                    <LogIn size={16} /> Sign in with Google
                  </button>
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Data Management */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
              <span>Data & Backup</span>
              <span className="flex items-center gap-1 normal-case font-normal text-xs bg-surface-active px-2 py-1 rounded-md border border-border">
                <HardDrive size={12} />
                Using {storageUsage}
              </span>
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                onClick={handleExportJson}
                className="flex flex-col items-center justify-center p-4 bg-surface border border-border rounded-xl hover:bg-surface-active transition-all group"
              >
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform mb-2">
                  <FileJson className="text-blue-400" size={24} />
                </div>
                <span className="text-xs font-semibold">Export JSON</span>
                <span className="text-[10px] text-text-muted mt-1">Full Backup</span>
              </button>

              <label className="flex flex-col items-center justify-center p-4 bg-surface border border-border rounded-xl hover:bg-surface-active transition-all group cursor-pointer">
                <div className="p-2 bg-purple-500/10 rounded-lg group-hover:scale-110 transition-transform mb-2">
                   <Download className="text-purple-400" size={24} />
                </div>
                <span className="text-xs font-semibold">Import JSON</span>
                <span className="text-[10px] text-text-muted mt-1">Restore / Merge</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
            </div>

            <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4 mt-2">
              <h4 className="text-red-400 font-medium text-sm mb-2 flex items-center gap-2">
                <Trash2 size={16} /> Danger Zone
              </h4>
              <p className="text-xs text-text-muted mb-4">
                This will permanently delete all your workspaces, collections, and notes from this browser. This action cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  className="bg-background border border-border rounded-md px-3 py-1.5 text-sm flex-1 focus:outline-none focus:border-red-500"
                />
                <button 
                  onClick={handleClearData}
                  disabled={deleteInput !== 'DELETE'}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 disabled:opacity-50 disabled:pointer-events-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-border hover:bg-surface-active transition-colors text-sm">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-colors flex items-center gap-2 text-sm shadow-md"
          >
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
