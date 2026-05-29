import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { cn } from '../lib/utils';
import { Plus, Tag, Settings as SettingsIcon, Download, Upload, Star, Undo2, Network, Menu, Folder } from 'lucide-react';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspaceId, setActiveWorkspaceId,
  activeCollectionId, setActiveCollectionId,
  onOpenExport, onOpenImport, onOpenSettings,
  onToggleBrainMap, isBrainMapActive
}) => {
  const { data, addCollection, addWorkspace, undo, canUndo } = useStorage();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeWorkspace = data.workspaces.find(w => w.id === activeWorkspaceId);
  const collections = data.collections.filter(c => c.workspaceId === activeWorkspaceId);

  const handleCreateCollection = () => {
    const name = prompt('Collection Name:');
    if (name && activeWorkspaceId) {
      const newCol = addCollection(activeWorkspaceId, name, '📁');
      setActiveCollectionId(newCol.id);
    }
  };

  return (
    <div className="w-60 bg-surface/90 backdrop-blur-md flex flex-col h-full shrink-0">
      {/* Top Menu Dropdown */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover text-text-primary font-medium w-full relative"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </div>
      
      {isMenuOpen && (
        <div className="border-b border-border bg-surface-active/50 space-y-1 p-2 text-sm z-50">
          <div className="relative">
            <button 
              onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-hover text-text-primary"
            >
              <span className="flex items-center gap-2">
                <Folder size={16} />
                <span className="truncate">{activeWorkspace?.name || 'Workspace'}</span>
              </span>
              <span className="text-xs text-text-muted">▼</span>
            </button>
            
            {isWorkspaceOpen && (
              <div className="absolute z-50 top-full left-0 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl py-1">
                {data.workspaces.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setActiveWorkspaceId(w.id);
                      const firstCol = data.collections.find(c => c.workspaceId === w.id);
                      setActiveCollectionId(firstCol ? firstCol.id : null);
                      setIsWorkspaceOpen(false);
                    }}
                    className={cn("w-full flex items-center gap-2 px-4 py-2 hover:bg-surface-hover text-sm", w.id === activeWorkspaceId ? "text-accent bg-accent-transparent" : "text-text-primary")}
                  >
                    <span>{w.icon}</span>
                    <span>{w.name}</span>
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => {
                      const name = prompt('Main Holder Name:');
                      if (name) {
                        const newWorkspace = addWorkspace(name, '🧠');
                        setActiveWorkspaceId(newWorkspace.id);
                        setActiveCollectionId(null);
                        setIsWorkspaceOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-surface-hover text-sm text-text-primary"
                  >
                    <Plus size={14} />
                    <span>New Main Holder</span>
                  </button>
                </div>
              </div>
            )}
          </div>
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
          <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
            <SettingsIcon size={16} />
            <span>Settings</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4 px-2 no-print">
        <div className="mb-6">
          <button
            onClick={onToggleBrainMap}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-4 border border-transparent shadow-sm",
              isBrainMapActive 
                ? "bg-accent text-white shadow-accent/20" 
                : "bg-surface/50 text-text-primary hover:border-border hover:bg-surface-hover"
            )}
          >
            <Network size={16} className={cn(isBrainMapActive ? "text-white" : "text-accent")} />
            <span>Brain Mapping</span>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <span>Collections</span>
            <button onClick={handleCreateCollection} className="hover:text-text-primary">
              <Plus size={14} />
            </button>
          </div>
          
          <div className="space-y-0.5">
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
            {collections.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCollectionId(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                  activeCollectionId === c.id ? "bg-surface-active text-text-primary font-medium" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )}
              >
                <span className="text-lg leading-none shrink-0">{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
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
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors font-medium">
          <SettingsIcon size={16} />
          <span>Settings</span>
        </button>
      </div>

    </div>
  );
};
