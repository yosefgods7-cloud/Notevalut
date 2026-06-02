import React, { useState } from "react";
import { useStorage } from "../context/StorageContext";
import { ChevronDown, ChevronRight, Folder, FileText, Database } from "lucide-react";
import { Settings } from "../types";

interface Props {
  localSettings: Settings;
  setLocalSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const AISearchScopeSettings: React.FC<Props> = ({ localSettings, setLocalSettings }) => {
  const { data } = useStorage();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});

  const scope = localSettings.aiScope || {
    workspaceIds: [],
    collectionIds: [],
    noteIds: []
  };

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleWorkspaceCheck = (id: string, checked: boolean) => {
    setLocalSettings(s => {
      const currentScope = s.aiScope || { workspaceIds: [], collectionIds: [], noteIds: [] };
      const newWorkspaceIds = checked 
        ? [...currentScope.workspaceIds, id]
        : currentScope.workspaceIds.filter(wid => wid !== id);
      return { ...s, aiScope: { ...currentScope, workspaceIds: newWorkspaceIds } };
    });
  };

  const handleCollectionCheck = (id: string, checked: boolean) => {
    setLocalSettings(s => {
      const currentScope = s.aiScope || { workspaceIds: [], collectionIds: [], noteIds: [] };
      const newCollectionIds = checked 
        ? [...currentScope.collectionIds, id]
        : currentScope.collectionIds.filter(cid => cid !== id);
      return { ...s, aiScope: { ...currentScope, collectionIds: newCollectionIds } };
    });
  };

  const handleNoteCheck = (id: string, checked: boolean) => {
    setLocalSettings(s => {
      const currentScope = s.aiScope || { workspaceIds: [], collectionIds: [], noteIds: [] };
      const newNoteIds = checked 
        ? [...currentScope.noteIds, id]
        : currentScope.noteIds.filter(nid => nid !== id);
      return { ...s, aiScope: { ...currentScope, noteIds: newNoteIds } };
    });
  };

  return (
    <div className="flex flex-col gap-2 bg-surface border border-border rounded-xl p-4 mt-4">
      <h4 className="text-sm font-medium">Search Scope</h4>
      <p className="text-xs text-text-muted mb-2">
        Select specific workspaces, folders, or notes to include in the Second Brain search. 
        If nothing is selected, everything is included by default.
      </p>

      <div className="max-h-64 overflow-y-auto border border-border rounded-lg p-2 bg-background space-y-1">
        {data.workspaces.map(ws => {
          const isWsExpanded = expandedWorkspaces[ws.id];
          const isWsChecked = scope.workspaceIds.includes(ws.id);
          const wsCollections = data.collections.filter(c => c.workspaceId === ws.id);

          return (
            <div key={ws.id} className="text-sm">
              <div className="flex items-center gap-2 hover:bg-surface-active p-1 rounded">
                <button onClick={() => toggleWorkspace(ws.id)} className="p-0.5 text-text-muted">
                  {isWsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <input 
                  type="checkbox" 
                  checked={isWsChecked} 
                  onChange={(e) => handleWorkspaceCheck(ws.id, e.target.checked)}
                  className="rounded border-border"
                />
                <Database size={14} className="text-blue-500" />
                <span className="font-medium truncate">{ws.name}</span>
              </div>

              {isWsExpanded && (
                <div className="pl-6 space-y-1 mt-1 border-l ml-3 border-border">
                  {wsCollections.map(col => {
                    const isColExpanded = expandedCollections[col.id];
                    const isColChecked = scope.collectionIds.includes(col.id);
                    const colNotes = data.notes.filter(n => n.collectionId === col.id);

                    return (
                      <div key={col.id}>
                        <div className="flex items-center gap-2 hover:bg-surface-active p-1 rounded">
                          <button onClick={() => toggleCollection(col.id)} className="p-0.5 text-text-muted">
                            {isColExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <input 
                            type="checkbox" 
                            checked={isColChecked} 
                            onChange={(e) => handleCollectionCheck(col.id, e.target.checked)}
                            className="rounded border-border"
                          />
                          <Folder size={14} className="text-yellow-500" />
                          <span className="truncate">{col.name}</span>
                        </div>

                        {isColExpanded && (
                          <div className="pl-6 space-y-1 mt-1 border-l ml-3 border-border">
                            {colNotes.map(note => {
                              const isNoteChecked = scope.noteIds.includes(note.id);
                              return (
                                <div key={note.id} className="flex items-center gap-2 hover:bg-surface-active p-1 rounded text-text-muted">
                                  <input 
                                    type="checkbox" 
                                    checked={isNoteChecked} 
                                    onChange={(e) => handleNoteCheck(note.id, e.target.checked)}
                                    className="rounded border-border"
                                  />
                                  <FileText size={14} />
                                  <span className="truncate">{note.title || "Untitled"}</span>
                                </div>
                              );
                            })}
                            {colNotes.length === 0 && (
                              <div className="text-xs text-text-muted pl-6 italic py-1">No notes</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {wsCollections.length === 0 && (
                    <div className="text-xs text-text-muted pl-6 italic py-1">No folders</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
