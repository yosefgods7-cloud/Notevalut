import React, { useState, useEffect } from 'react';
import { useStorage } from '../context/StorageContext';
import { X, Save, Trash2, HardDrive } from 'lucide-react';
import { cn } from '../lib/utils';
import { Settings as SettingsType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { data, updateSettings, clearAllData } = useStorage();
  const [localSettings, setLocalSettings] = useState<SettingsType>(data.settings);
  const [deleteInput, setDeleteInput] = useState('');
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');

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
                  <div className="text-sm">Smart Paste</div>
                  <div className="text-xs text-text-muted mt-0.5">Automatically clean AI text on Ctrl+V</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={localSettings.smartPaste}
                  onChange={e => setLocalSettings(s => ({ ...s, smartPaste: e.target.checked }))}
                  className="accent-accent w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <hr className="border-border" />

          {/* Data Management */}
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
              <span>Data & Storage</span>
              <span className="flex items-center gap-1 normal-case font-normal text-xs bg-surface-active px-2 py-1 rounded-md border border-border">
                <HardDrive size={12} />
                Using {storageUsage}
              </span>
            </h3>
            
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
