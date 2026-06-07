import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { uploadToDrive } from '../lib/drive';
import { cn } from '../lib/utils';
import { Plus, Tag, Settings as SettingsIcon, Download, Upload, Star, Undo2, Network, Menu, Folder, Pencil, Trash2, MoreHorizontal, ArrowUp, ArrowDown, Calendar, ChevronRight, ChevronDown } from 'lucide-react';
import { appPrompt, appConfirm } from './GlobalDialogs';

interface SidebarProps {
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  activeCollectionId: string | null;
  setActiveCollectionId: (id: string | null) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onToggleBrainMap: () => void;
  isBrainMapActive: boolean;
  onToggleReviews: () => void;
  isReviewsActive: boolean;
  onOpenTagManager: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspaceId, setActiveWorkspaceId,
  activeCollectionId, setActiveCollectionId,
  onOpenExport, onOpenImport, onOpenSettings,
  onToggleBrainMap, isBrainMapActive,
  onToggleReviews, isReviewsActive,
  onOpenTagManager
}) => {
  const { data, saveData, addCollection, updateCollection, deleteCollection, addWorkspace, updateWorkspace, deleteWorkspace, undo, canUndo } = useStorage();
  const { accessToken } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>([activeWorkspaceId]);

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const syncDrive = async (updatedData: any) => {
    if (accessToken && data.settings.driveBackup?.enabled) {
      try {
        await uploadToDrive(accessToken, updatedData, data.settings.driveBackup.fileId);
      } catch (e) {
        console.error("Failed to sync to Drive", e);
      }
    }
  };

  const handleCreateWorkspace = async () => {
    const name = await appPrompt('Holder Name:');
    if (name) {
      const newWorkspace = addWorkspace(name, '🧠');
      setExpandedWorkspaces(prev => [...prev, newWorkspace.id]);
      setActiveWorkspaceId(newWorkspace.id);
      setActiveCollectionId(null);
      syncDrive({
        ...data,
        workspaces: [...data.workspaces, newWorkspace]
      });
    }
  };

  const handleCreateCollection = async (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    const name = await appPrompt('Folder Name:');
    if (name) {
      const newCol = addCollection(workspaceId, name, '📁');
      if (!expandedWorkspaces.includes(workspaceId)) {
        setExpandedWorkspaces(prev => [...prev, workspaceId]);
      }
      setActiveWorkspaceId(workspaceId);
      setActiveCollectionId(newCol.id);
      syncDrive({
        ...data,
        collections: [...data.collections, newCol]
      });
    }
  };

  const handleEditWorkspace = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ws = data.workspaces.find(w => w.id === id);
    if (!ws) return;
    const name = await appPrompt('Update Holder Name:', ws.name);
    if (name === null) return;
    const icon = await appPrompt('Update Holder Icon/Emoji:', ws.icon);
    if (name || icon) {
      updateWorkspace(id, { name: name || ws.name, icon: icon || ws.icon });
      syncDrive({
        ...data,
        workspaces: data.workspaces.map(w => w.id === id ? { ...w, name: name || w.name, icon: icon || w.icon } : w)
      });
    }
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ws = data.workspaces.find(w => w.id === id);
    if (await appConfirm(`Are you sure you want to completely delete the holder "${ws?.name}" and ALL its folders and notes? This cannot be undone.`)) {
      deleteWorkspace(id);
      syncDrive({
        ...data,
        workspaces: data.workspaces.filter((w) => w.id !== id),
        collections: data.collections.filter((c) => c.workspaceId !== id),
        notes: data.notes.filter((n) => n.workspaceId !== id),
      });
      if (activeWorkspaceId === id) {
         setActiveWorkspaceId(data.workspaces.filter(w => w.id !== id)[0]?.id || '');
         setActiveCollectionId(null);
      }
    }
  };

  const handleEditCollection = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const col = data.collections.find(c => c.id === id);
    if (!col) return;
    const name = await appPrompt('Update Folder Name:', col.name);
    if (name === null) return;
    const icon = await appPrompt('Update Folder Icon/Emoji:', col.icon);
    if (name || icon) {
      updateCollection(id, { name: name || col.name, icon: icon || col.icon });
      syncDrive({
        ...data,
        collections: data.collections.map(c => c.id === id ? { ...c, name: name || c.name, icon: icon || c.icon } : c)
      });
    }
  };

  const handleDeleteCollection = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const col = data.collections.find(c => c.id === id);
    if (await appConfirm(`Are you sure you want to completely delete the folder "${col?.name}" and ALL its notes? This cannot be undone.`)) {
      deleteCollection(id);
      syncDrive({
        ...data,
        collections: data.collections.filter(c => c.id !== id),
        notes: data.notes.filter(n => n.collectionId !== id)
      });
      if (activeCollectionId === id) {
         setActiveCollectionId(null);
      }
    }
  };

  const handleMoveWorkspace = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    const index = data.workspaces.findIndex(w => w.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === data.workspaces.length - 1) return;

    const newWorkspaces = [...data.workspaces];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newWorkspaces[index];
    newWorkspaces[index] = newWorkspaces[targetIndex];
    newWorkspaces[targetIndex] = temp;
    
    // update order properties just in case
    newWorkspaces.forEach((w, i) => w.order = i);

    saveData({ ...data, workspaces: newWorkspaces });
    syncDrive({ ...data, workspaces: newWorkspaces });
  };

  const handleMoveCollection = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    const colToMove = data.collections.find(c => c.id === id);
    if (!colToMove) return;
    
    const wsCollections = data.collections.filter(c => c.workspaceId === colToMove.workspaceId);
    const index = wsCollections.findIndex(c => c.id === id);
    
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === wsCollections.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = wsCollections[index];
    wsCollections[index] = wsCollections[targetIndex];
    wsCollections[targetIndex] = temp;
    
    // Rebuild global collections array with new order for this workspace
    const newCollections = data.collections.map(c => {
      if (c.workspaceId === colToMove.workspaceId) {
        const newIndex = wsCollections.findIndex(wsc => wsc.id === c.id);
        return { ...c, order: newIndex };
      }
      return c;
    }).sort((a, b) => {
      if (a.workspaceId === b.workspaceId) return (a.order || 0) - (b.order || 0);
      return 0; // maintain relative workspace chunk (not actually strict, but good enough since we filter)
    });
    
    // To strictly sort by new order without messing up the array
    const finalList = [
       ...data.collections.filter(c => c.workspaceId !== colToMove.workspaceId),
       ...wsCollections
    ];

    saveData({ ...data, collections: finalList });
    syncDrive({ ...data, collections: finalList });
  };

  return (
    <div className="w-60 bg-surface/90 backdrop-blur-md flex flex-col h-full shrink-0">
      {/* Top Menu Dropdown */}
      <div 
         className="px-3 border-b border-border flex items-center justify-between"
         style={{ height: "var(--system-bar-size, 3rem)" }}
      >
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover text-text-primary font-medium w-full relative h-full"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </div>
      
      {isMenuOpen && (
        <div className="border-b border-border bg-surface-active/50 space-y-1 p-2 text-sm z-50">
          <button 
            onClick={undo} 
            disabled={!canUndo}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Undo2 size={16} />
            <span>Undo Action</span>
          </button>
          <button onClick={onOpenImport} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
            <Upload size={16} />
            <span>Import</span>
          </button>
          <button onClick={onOpenExport} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4 px-2 no-print">
        <div className="mb-6 space-y-2">
          <button
            onClick={onToggleBrainMap}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent shadow-sm",
              isBrainMapActive 
                ? "bg-accent text-white shadow-accent/20" 
                : "bg-surface/50 text-text-primary hover:border-border hover:bg-surface-hover"
            )}
          >
            <Network size={16} className={cn(isBrainMapActive ? "text-white" : "text-accent")} />
            <span>Graph View</span>
          </button>
          
          <button
            onClick={onToggleReviews}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent shadow-sm",
              isReviewsActive 
                ? "bg-accent text-white shadow-accent/20" 
                : "bg-surface/50 text-text-primary hover:border-border hover:bg-surface-hover"
            )}
          >
            <Calendar size={16} className={cn(isReviewsActive ? "text-white" : "text-accent")} />
            <span>Periodic Reviews</span>
          </button>

          <button
            onClick={onOpenTagManager}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent shadow-sm bg-surface/50 text-text-primary hover:border-border hover:bg-surface-hover"
          >
            <Tag size={16} className="text-accent" />
            <span>Tag Manager</span>
          </button>
        </div>

        <div className="mb-6 space-y-0.5">
          <button
            onClick={() => setActiveCollectionId('starred')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
              activeCollectionId === 'starred' ? "bg-surface-active text-text-primary font-medium" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            )}
          >
            <span className="text-lg leading-none shrink-0"><Star size={16} className="text-yellow-500 fill-yellow-500" /></span>
            <span className="truncate">Starred</span>
          </button>
          <button
            onClick={() => setActiveCollectionId('trash')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
              activeCollectionId === 'trash' ? "bg-surface-active text-rose-400 font-medium" : "text-text-secondary hover:bg-surface-hover hover:text-rose-400"
            )}
          >
            <span className="text-lg leading-none shrink-0"><Trash2 size={16} /></span>
            <span className="truncate">Trash</span>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span>Holders</span>
            <button onClick={handleCreateWorkspace} className="hover:text-text-primary p-1">
              <Plus size={14} />
            </button>
          </div>
          
          <div className="space-y-1">
            {data.workspaces.map(w => {
              const wsCollections = data.collections.filter(c => c.workspaceId === w.id);
              const isExpanded = expandedWorkspaces.includes(w.id);
              
              return (
                <div key={w.id} className="flex flex-col group/ws relative">
                  <button
                    onClick={() => {
                        toggleWorkspace(w.id);
                        setActiveWorkspaceId(w.id);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors font-medium",
                      w.id === activeWorkspaceId ? "text-text-primary bg-surface-active/30" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    <span className="flex items-center gap-2 overflow-hidden flex-1">
                      <span className="text-text-muted shrink-0 p-0.5">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="text-sm leading-none shrink-0">{w.icon}</span>
                      <span className="truncate text-left">{w.name}</span>
                    </span>
                    <span className="flex items-center opacity-0 group-hover/ws:opacity-100 transition-opacity">
                      <span 
                        onClick={(e) => handleCreateCollection(e, w.id)}
                        className="p-1 hover:bg-surface rounded-md shrink-0"
                        title="Add Folder"
                      >
                         <Plus size={14} className="text-text-muted hover:text-text-primary" />
                      </span>
                      <span 
                         onClick={(e) => { e.stopPropagation(); setEditingWorkspace(editingWorkspace === w.id ? null : w.id); }}
                         className="p-1 hover:bg-surface rounded-md shrink-0"
                      >
                         <MoreHorizontal size={14} className="text-text-muted hover:text-text-primary" />
                      </span>
                    </span>
                  </button>

                  {editingWorkspace === w.id && (
                    <div className="flex items-center gap-1 bg-surface py-1 px-3 ml-2 justify-end rounded-md mb-1 border border-border/50">
                       <button onClick={(e) => handleMoveWorkspace(e, w.id, 'up')} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Move Up"><ArrowUp size={14} /></button>
                       <button onClick={(e) => handleMoveWorkspace(e, w.id, 'down')} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Move Down"><ArrowDown size={14} /></button>
                       <div className="w-px h-4 bg-border mx-1"></div>
                       <button onClick={(e) => { handleEditWorkspace(e, w.id); setEditingWorkspace(null); }} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Edit"><Pencil size={14} /></button>
                       <button onClick={(e) => { handleDeleteWorkspace(e, w.id); setEditingWorkspace(null); }} className="hover:bg-red-500/10 p-1.5 rounded-md text-red-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="ml-5 pl-2 border-l border-border/40 mt-1 space-y-0.5">
                      {wsCollections.map(c => (
                        <div key={c.id} className="flex flex-col group relative">
                          <button
                            onClick={() => {
                                setActiveWorkspaceId(w.id);
                                setActiveCollectionId(c.id);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                              activeCollectionId === c.id ? "bg-surface-active text-text-primary font-medium" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                            )}
                          >
                            <span className="flex items-center gap-2 overflow-hidden">
                              <span className="text-sm leading-none shrink-0">{c.icon}</span>
                              <span className="truncate">{c.name}</span>
                            </span>
                            <span 
                               onClick={(e) => { e.stopPropagation(); setEditingCollection(editingCollection === c.id ? null : c.id); }}
                               className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface rounded-md"
                            >
                               <MoreHorizontal size={14} className="text-text-muted hover:text-text-primary" />
                            </span>
                          </button>
                          {editingCollection === c.id && (
                            <div className="flex items-center gap-1 bg-surface px-2 py-1 justify-end rounded-md mt-0.5 border border-border/50">
                               <button onClick={(e) => handleMoveCollection(e, c.id, 'up')} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Move Up"><ArrowUp size={14} /></button>
                               <button onClick={(e) => handleMoveCollection(e, c.id, 'down')} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Move Down"><ArrowDown size={14} /></button>
                               <div className="w-px h-4 bg-border mx-1"></div>
                               <button onClick={(e) => { handleEditCollection(e, c.id); setEditingCollection(null); }} className="hover:bg-surface-hover p-1.5 rounded-md text-text-secondary hover:text-text-primary" title="Edit"><Pencil size={14} /></button>
                               <button onClick={(e) => { handleDeleteCollection(e, c.id); setEditingCollection(null); }} className="hover:bg-red-500/10 p-1.5 rounded-md text-red-500" title="Delete"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                      {wsCollections.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-text-muted italic flex items-center justify-between">
                            Empty holder
                            <button 
                                onClick={(e) => handleCreateCollection(e, w.id)}
                                className="text-accent hover:underline px-1"
                            >
                                Add folder
                            </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {data.tags.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center px-2 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              <span>Tags</span>
            </div>
            <div className="space-y-0.5">
              {data.tags.map(tag => (
                <button
                  key={tag}
                  className="w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                >
                  <Tag size={14} className="opacity-70" />
                  <span className="truncate">{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Bottom Settings Toggle */}
      <div className="p-3 border-t border-border mt-auto">
        <button 
          onClick={onOpenSettings} 
          className="w-full flex items-center gap-3 px-3 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all font-medium"
          style={{ height: "var(--nav-bar-size, 3rem)" }}
        >
          <SettingsIcon style={{ width: "var(--nav-icon-size, 16px)", height: "var(--nav-icon-size, 16px)" }} />
          <span>Settings</span>
        </button>
      </div>

    </div>
  );
};
