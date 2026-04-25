import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { cn } from '../lib/utils';
import { Plus, Tag, Settings as SettingsIcon, Download, Upload, Star } from 'lucide-react';

interface SidebarProps {
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  activeCollectionId: string | null;
  setActiveCollectionId: (id: string | null) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspaceId, setActiveWorkspaceId,
  activeCollectionId, setActiveCollectionId,
  onOpenExport, onOpenImport, onOpenSettings
}) => {
  const { data, addCollection } = useStorage();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

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
    <div className="w-60 bg-surface border-r border-border flex flex-col h-full shrink-0">
      {/* Workspace Switcher */}
      <div className="p-3 border-b border-border">
        <button 
          onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-hover text-text-primary font-medium"
        >
          <span className="flex items-center gap-2">
            <span>{activeWorkspace?.icon || '🧠'}</span>
            <span className="truncate">{activeWorkspace?.name || 'Workspace'}</span>
          </span>
          <span className="text-xs text-text-muted">▼</span>
        </button>
        
        {isWorkspaceOpen && (
          <div className="absolute z-50 top-14 left-3 w-54 bg-surface border border-border rounded-lg shadow-xl py-1">
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
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 no-print">
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
      
      <div className="p-3 border-t border-border mt-auto space-y-1">
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
          <SettingsIcon size={16} />
          <span>Settings</span>
        </button>
        <button onClick={onOpenImport} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
          <Upload size={16} />
          <span>Import</span>
        </button>
        <button onClick={onOpenExport} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
