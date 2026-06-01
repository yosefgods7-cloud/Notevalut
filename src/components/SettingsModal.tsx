import React, { useState, useEffect } from 'react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { X, Save, Trash2, HardDrive, Cloud, LogIn, LogOut, RefreshCw, FileJson, Download, Puzzle, Plus, Folder, ChevronDown, ChevronUp, Monitor, Code, Cpu, Database, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Settings as SettingsType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenExport }) => {
  const { data, updateSettings, clearAllData, syncFromCloud, syncToCloud, isSyncing, importData, showToast, addNote, addWorkspace, updateWorkspace, deleteWorkspace, addCollection, updateCollection, deleteCollection } = useStorage();
  const { user, signIn, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<SettingsType>(data.settings);
  const [deleteInput, setDeleteInput] = useState('');
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');
  
  const [importPendingFile, setImportPendingFile] = useState<{name: string, content: string} | null>(null);
  const [importTargetWorkspace, setImportTargetWorkspace] = useState(data.workspaces[0]?.id || '');
  const [importTargetCollection, setImportTargetCollection] = useState(data.collections[0]?.id || '');
  
  const [expandedSection, setExpandedSection] = useState<string | null>('Appearance');

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

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

  const handleDataImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        let htmlContent = content;
        
        // Basic Markdown to HTML conversion if it's md
        if (file.name.endsWith('.md')) {
          htmlContent = content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\n\n/g, '<p></p>')
            .replace(/\n/g, '<br/>');
        } else {
          htmlContent = `<p>${content.replace(/\n/g, '<br/>')}</p>`;
        }
        
        let initialWorkspace = data.workspaces[0]?.id || '';
        let initialCollection = initialWorkspace ? (data.collections.find(c => c.workspaceId === initialWorkspace)?.id || '') : '';
        
        setImportTargetWorkspace(initialWorkspace);
        setImportTargetCollection(initialCollection);
        
        setImportPendingFile({
          name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
          content: htmlContent
        });
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // Default JSON backup restore
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
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
    e.target.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(data.settings);
      setDeleteInput('');
      
      const calculateSize = async () => {
        try {
          const { entries } = await import('idb-keyval');
          const allEntries = await entries();
          let total = 0;
          for (const [key, value] of allEntries) {
            const keyStr = String(key);
            const valStr = typeof value === 'string' ? value : JSON.stringify(value);
            total += ((valStr.length + keyStr.length) * 2);
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
      };
      
      calculateSize();
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
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 backdrop-blur-sm sm:items-center p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-active transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          
          {/* File Manager */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('FileManager')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Folder size={18} className="text-yellow-500" />
                <span className="font-medium text-text-primary text-sm">File Manager</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'FileManager' && "rotate-180")} />
            </button>
            {expandedSection === 'FileManager' && (
              <div className="p-4 border-t border-border space-y-4 bg-surface/30">
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span>Holders</span>
                      <button 
                        onClick={() => {
                          const name = prompt('New Holder Name:');
                          if (name) {
                            const icon = prompt('New Holder Icon/Emoji:', '🧠');
                            addWorkspace(name, icon || '🧠');
                          }
                        }}
                        className="p-1 hover:bg-surface rounded text-accent transition-colors"
                        title="Add Holder"
                      >
                        <Plus size={14} />
                      </button>
                    </h4>
                    <div className="space-y-2">
                      {data.workspaces.map(w => (
                        <div key={w.id} className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{w.icon}</span>
                            <span className="text-sm font-medium text-text-primary">{w.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const newName = prompt('Update Holder Name:', w.name);
                                if (newName === null) return;
                                const newIcon = prompt('Update Holder Icon:', w.icon);
                                updateWorkspace(w.id, { name: newName || w.name, icon: newIcon || w.icon });
                              }}
                              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                              title="Edit Holder"
                            >
                              <Code size={14} className="hidden" /> 
                              <span className="text-xs font-medium">Edit</span>
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to completely delete the holder "${w.name}" and ALL its folders and notes? This cannot be undone.`)) {
                                  deleteWorkspace(w.id);
                                }
                              }}
                              className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete Holder"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span>Folders</span>
                      <button 
                        onClick={() => {
                           // Pick a random workspace if there are none, though not likely. Best to offer a select if we wanted, but prompt is simple.
                           const ws = data.workspaces[0]; 
                           if (!ws) {
                              alert("Create a holder first."); return;
                           }
                           const name = prompt('New Folder Name:');
                           if (name) {
                             const icon = prompt('New Folder Icon/Emoji:', '📁');
                             // Find active workspace if possible, else use first.
                             addCollection(ws.id, name, icon || '📁');
                           }
                        }}
                        className="p-1 hover:bg-surface rounded text-accent transition-colors"
                        title="Add Folder"
                      >
                        <Plus size={14} />
                      </button>
                    </h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {data.collections.map(c => {
                        const ws = data.workspaces.find(w => w.id === c.workspaceId);
                        return (
                          <div key={c.id} className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-lg shrink-0">{c.icon}</span>
                              <div className="flex flex-col truncate">
                                <span className="text-sm font-medium text-text-primary truncate">{c.name}</span>
                                <span className="text-[10px] text-text-muted truncate">in {ws?.name || 'Unknown'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  const newName = prompt('Update Folder Name:', c.name);
                                  if (newName === null) return;
                                  const newIcon = prompt('Update Folder Icon:', c.icon);
                                  updateCollection(c.id, { name: newName || c.name, icon: newIcon || c.icon });
                                }}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                                title="Edit Folder"
                              >
                                <span className="text-xs font-medium">Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to completely delete the folder "${c.name}" and ALL its notes? This cannot be undone.`)) {
                                    deleteCollection(c.id);
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Folder"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Appearance */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('Appearance')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Monitor size={18} className="text-accent" />
                <span className="font-medium text-text-primary text-sm">Appearance</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'Appearance' && "rotate-180")} />
            </button>
            {expandedSection === 'Appearance' && (
              <div className="p-4 border-t border-border space-y-4 bg-surface/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Theme</span>
                  <select 
                    value={localSettings.theme}
                    onChange={e => setLocalSettings(s => ({ ...s, theme: e.target.value as any }))}
                    className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Note Output Font Size</span>
                  <select 
                    value={localSettings.fontSize}
                    onChange={e => setLocalSettings(s => ({ ...s, fontSize: e.target.value as any }))}
                    className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="ultralarge">Ultra Large</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Plugins */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('Plugins')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Puzzle size={18} className="text-pink-500" />
                <span className="font-medium text-text-primary text-sm">Plugins</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'Plugins' && "rotate-180")} />
            </button>
            {expandedSection === 'Plugins' && (
              <div className="p-4 border-t border-border space-y-4 bg-surface/30">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium">Auto-Categorize</div>
                    <div className="text-xs text-text-muted mt-0.5">Move notes to folders automatically based on tags</div>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={localSettings.plugins?.autoCategorize?.enabled || false}
                      onChange={e => {
                         const checked = e.target.checked;
                         setLocalSettings(s => ({
                            ...s,
                            plugins: {
                               ...s.plugins,
                               autoCategorize: {
                                  rules: s.plugins?.autoCategorize?.rules || [],
                                  enabled: checked
                               }
                            }
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
                       <span className="text-xs font-medium text-text-secondary">Routing Rules</span>
                       <button
                          type="button"
                          onClick={() => {
                             setLocalSettings(s => ({
                                ...s,
                                plugins: {
                                   ...s.plugins,
                                   autoCategorize: {
                                      enabled: true,
                                      rules: [...(s.plugins?.autoCategorize?.rules || []), { tag: '', workspaceId: data.workspaces[0]?.id || '', collectionId: data.collections[0]?.id || '' }]
                                   }
                                }
                             }));
                          }}
                          className="text-pink-500 hover:text-pink-400 text-xs flex items-center gap-1 font-medium bg-pink-500/10 px-2 py-1 rounded"
                       >
                          <Plus size={12} /> Add Rule
                       </button>
                     </div>
                     
                     {localSettings.plugins.autoCategorize.rules.map((rule, idx) => (
                        <div key={idx} className="flex flex-col gap-2 bg-surface p-3 rounded-lg border border-border">
                           <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                 <input 
                                    type="text" 
                                    placeholder="Tag (e.g. todo)" 
                                    value={rule.tag}
                                    onChange={e => {
                                       const newRules = [...(localSettings.plugins?.autoCategorize?.rules || [])];
                                       newRules[idx].tag = e.target.value.toLowerCase().replace('#', '');
                                       setLocalSettings(s => ({ ...s, plugins: { ...s.plugins, autoCategorize: { ...(s.plugins?.autoCategorize as any), enabled: true, rules: newRules } } }));
                                    }}
                                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                 />
                              </div>
                              <div className="flex-1">
                                 <select
                                    value={rule.collectionId}
                                    onChange={e => {
                                       const newRules = [...(localSettings.plugins?.autoCategorize?.rules || [])];
                                       newRules[idx].collectionId = e.target.value;
                                       const targetCol = data.collections.find(c => c.id === e.target.value);
                                       newRules[idx].workspaceId = targetCol?.workspaceId || '';
                                       setLocalSettings(s => ({ ...s, plugins: { ...s.plugins, autoCategorize: { ...(s.plugins?.autoCategorize as any), enabled: true, rules: newRules } } }));
                                    }}
                                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                 >
                                    {data.collections.map(c => (
                                       <option key={c.id} value={c.id}>
                                         {data.workspaces.find(w => w.id === c.workspaceId)?.name} &gt; {c.name}
                                       </option>
                                    ))}
                                 </select>
                              </div>
                              <button 
                                 onClick={() => {
                                    const newRules = localSettings.plugins?.autoCategorize?.rules.filter((_, i) => i !== idx) || [];
                                    setLocalSettings(s => ({ ...s, plugins: { ...s.plugins, autoCategorize: { ...(s.plugins?.autoCategorize as any), enabled: true, rules: newRules } } }));
                                 }}
                                 className="text-text-muted hover:text-red-400 p-1"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
                )}
              </div>
            )}
          </div>

         {/* Editor Settings */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('Editor')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Code size={18} className="text-orange-500" />
                <span className="font-medium text-text-primary text-sm">Editor Settings</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'Editor' && "rotate-180")} />
            </button>
            {expandedSection === 'Editor' && (
              <div className="p-4 border-t border-border space-y-6 bg-surface/30">
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
                    <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </div>
                </label>

                <div className="border-t border-border pt-4">
                  <div className="text-sm font-medium mb-1">Bottom Bar Button Configuration</div>
                  <div className="text-xs text-text-muted mb-4">Reorder, add, or remove tools from the editor toolbar.</div>
                  
                  <div className="flex flex-col gap-2">
                    {(localSettings.toolbarItems || []).map((item, idx) => {
                       if (item === '|') return null;
                       return (
                         <div key={`${item}-${idx}`} className="flex items-center justify-between bg-surface p-2 border border-border rounded-md">
                           <span className="text-sm text-text-primary capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</span>
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => {
                                 const items = [...(localSettings.toolbarItems || [])];
                                 const withoutSeps = items.filter(x => x !== '|');
                                 const selfIdx = withoutSeps.indexOf(item);
                                 if (selfIdx > 0) {
                                   const tmp = withoutSeps[selfIdx - 1];
                                   withoutSeps[selfIdx - 1] = item;
                                   withoutSeps[selfIdx] = tmp;
                                   setLocalSettings(s => ({ ...s, toolbarItems: withoutSeps }));
                                 }
                               }}
                               className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                               disabled={idx === 0}
                             >
                               <ArrowUp size={14} />
                             </button>
                             <button
                               onClick={() => {
                                 const items = [...(localSettings.toolbarItems || [])];
                                 const withoutSeps = items.filter(x => x !== '|');
                                 const selfIdx = withoutSeps.indexOf(item);
                                 if (selfIdx < withoutSeps.length - 1) {
                                   const tmp = withoutSeps[selfIdx + 1];
                                   withoutSeps[selfIdx + 1] = item;
                                   withoutSeps[selfIdx] = tmp;
                                   setLocalSettings(s => ({ ...s, toolbarItems: withoutSeps }));
                                 }
                               }}
                               className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                             >
                               <ArrowDown size={14} />
                             </button>
                             <div className="w-px h-4 bg-border mx-1"></div>
                             <button 
                               onClick={() => {
                                 const items = [...(localSettings.toolbarItems || [])].filter(x => x !== '|');
                                 setLocalSettings(s => ({ ...s, toolbarItems: items.filter(x => x !== item) }));
                               }}
                               className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                             >
                               <Minus size={14} />
                             </button>
                           </div>
                         </div>
                       );
                    })}

                    {['undo', 'redo', 'h1', 'h2', 'h3', 'bold', 'italic', 'underline', 'link', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'code', 'codeBlock', 'table', 'hr', 'attachment', 'chart', 'image'].filter(item => !(localSettings.toolbarItems || []).includes(item)).length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Available Features</div>
                        {['undo', 'redo', 'h1', 'h2', 'h3', 'bold', 'italic', 'underline', 'link', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'code', 'codeBlock', 'table', 'hr', 'attachment', 'chart', 'image'].filter(item => !(localSettings.toolbarItems || []).includes(item)).map(item => (
                           <div key={`avail-${item}`} className="flex items-center justify-between bg-surface-active p-2 rounded-md mb-2 opacity-70 hover:opacity-100 transition-opacity border border-dashed border-border">
                             <span className="text-sm text-text-muted capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</span>
                             <button 
                               onClick={() => {
                                 const items = [...(localSettings.toolbarItems || [])].filter(x => x !== '|');
                                 items.push(item);
                                 setLocalSettings(s => ({ ...s, toolbarItems: items }));
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
            )}
          </div>

          {/* AI Features */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('AI')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Cpu size={18} className="text-blue-500" />
                <span className="font-medium text-text-primary text-sm">AI Features</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'AI' && "rotate-180")} />
            </button>
            {expandedSection === 'AI' && (
              <div className="p-4 border-t border-border space-y-4 bg-surface/30">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Gemini API Key</span>
                    <span className="text-xs text-text-muted font-normal bg-surface-active px-2 py-0.5 rounded">Optional</span>
                  </label>
                  <input 
                    type="password"
                    value={localSettings.geminiApiKey || ''}
                    onChange={e => setLocalSettings(s => ({ ...s, geminiApiKey: e.target.value }))}
                    placeholder="Paste your API key here..."
                    className="bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full"
                  />
                  <p className="text-xs text-text-muted leading-relaxed">
                    The app uses the free tier Gemini API by default. Add your own key to customize or bypass rate limits.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Data Management */}
          <div className="border border-border bg-background rounded-xl overflow-hidden">
            <button onClick={() => toggleSection('Data')} className="w-full flex items-center justify-between p-4 hover:bg-surface-active transition-colors">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-green-500" />
                <span className="font-medium text-text-primary text-sm">Data Management</span>
              </div>
              <ChevronDown size={16} className={cn("text-text-muted transition-transform", expandedSection === 'Data' && "rotate-180")} />
            </button>
            {expandedSection === 'Data' && (
              <div className="p-4 border-t border-border space-y-5 bg-surface/30">
                
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
                              <span className="font-medium text-text-primary text-sm">Signed in</span>
                              <span className="text-text-muted text-[11px] truncate w-32">{user.email}</span>
                           </div>
                           <button
                             onClick={signOut}
                             className="text-text-muted hover:bg-surface-active p-1.5 rounded transition-colors text-xs font-medium"
                           >
                             Sign out
                           </button>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                           <button onClick={() => syncToCloud()} disabled={isSyncing} className="flex-1 bg-background hover:bg-surface-active border border-border disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium">
                             <Cloud size={14} /> Backup
                           </button>
                           <button onClick={() => syncFromCloud()} disabled={isSyncing} className="flex-1 bg-background hover:bg-surface-active border border-border disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium">
                             <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} /> Restore
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-1 space-y-3">
                        <p className="text-xs text-text-muted">Sign in to securely backup layout.</p>
                        <button type="button" onClick={signIn} className="bg-white text-black font-medium hover:bg-gray-200 transition-colors w-full px-3 py-1.5 rounded-md flex items-center justify-center gap-2 text-sm shadow-sm">
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
                         <div className="text-sm font-medium">Enable Auto-Sync</div>
                         <div className="text-[11px] text-text-muted mt-0.5">Automatically save NoteVault_Backup.json</div>
                       </div>
                       <div className="relative inline-flex items-center cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={localSettings.driveBackup?.enabled || false}
                           onChange={async e => {
                               const enabled = e.target.checked;
                               if (enabled) {
                                 // Request auth scope immediately upon enabling
                                 try {
                                    await signIn();
                                 } catch (err) {
                                    console.error(err);
                                    showToast("Google Drive authentication failed");
                                    return;
                                 }
                               }
                               
                               setLocalSettings(s => ({
                                  ...s,
                                  driveBackup: { ...s.driveBackup, enabled, frequency: s.driveBackup?.frequency || 'daily' }
                               }));
                           }}
                           className="sr-only peer"
                         />
                         <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                       </div>
                     </label>

                     {localSettings.driveBackup?.enabled && (
                       <div className="pt-3 border-t border-border flex flex-col gap-3">
                         <div className="flex flex-col gap-1.5">
                           <span className="text-xs text-text-secondary">Sync Frequency</span>
                           <select
                             value={localSettings.driveBackup?.frequency || 'daily'}
                             onChange={e => {
                               setLocalSettings(s => ({
                                 ...s,
                                 driveBackup: { ...s.driveBackup!, frequency: e.target.value as any }
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
                       </div>
                     )}
                  </div>
                </div>

                {/* Local Backup */}
                <div>
                  <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2"><HardDrive size={14}/> Local Backup</span>
                    <span className="normal-case font-normal text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                      {storageUsage}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { onClose(); onOpenExport(); }} className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all">
                      <FileJson size={16} />
                      <span className="text-xs font-medium">Export</span>
                    </button>
                    <label className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all cursor-pointer">
                      <Download size={16} />
                      <span className="text-xs font-medium">Import</span>
                      <input type="file" accept=".json,.txt,.md" onChange={handleDataImport} className="hidden" />
                    </label>
                  </div>
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
                      onChange={e => setDeleteInput(e.target.value)}
                      className="bg-background border border-border rounded w-24 px-2 py-1 text-xs focus:outline-none focus:border-red-500"
                    />
                    <button 
                      onClick={handleClearData}
                      disabled={deleteInput !== 'DELETE'}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:pointer-events-none px-3 py-1 rounded text-xs font-medium transition-colors"
                    >
                      Clear Data
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0 bg-surface rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-border hover:bg-surface-active transition-colors text-sm font-medium">
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
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">Workspace</label>
                  <div className="relative">
                    <select
                      value={importTargetWorkspace}
                      onChange={e => {
                         setImportTargetWorkspace(e.target.value);
                         setImportTargetCollection(data.collections.find(c => c.workspaceId === e.target.value)?.id || '');
                      }}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                    >
                      {data.workspaces.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 text-text-muted pointer-events-none" size={16} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">Folder (Collection)</label>
                  <div className="relative">
                    <select
                      value={importTargetCollection}
                      onChange={e => setImportTargetCollection(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                      disabled={!importTargetWorkspace}
                    >
                      {data.collections.filter(c => c.workspaceId === importTargetWorkspace).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-2.5 text-text-muted pointer-events-none" size={16} />
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
                      addNote(importTargetWorkspace, importTargetCollection, importPendingFile.name, importPendingFile.content);
                      showToast('✓ Note imported');
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

      </div>
    </div>
  );
};
