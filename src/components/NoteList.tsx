import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { cn } from '../lib/utils';
import { Search, Plus, Pin, Trash2, Clock, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NoteListProps {
  activeWorkspaceId: string;
  activeCollectionId: string;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  activeWorkspaceId, activeCollectionId,
  activeNoteId, setActiveNoteId
}) => {
  const { data, addNote, updateNote, deleteNote } = useStorage();
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  const notes = activeCollectionId === 'starred' 
    ? data.notes.filter(n => n.workspaceId === activeWorkspaceId && n.starred)
    : data.notes.filter(n => n.collectionId === activeCollectionId);
    
  const filteredNotes = notes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q));
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleCreateNote = () => {
    const newNote = addNote(activeWorkspaceId, activeCollectionId);
    setActiveNoteId(newNote.id);
  };

  const getExcerpt = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text.substring(0, 80) + (text.length > 80 ? '...' : '');
  };

  const startRename = (noteId: string, currentTitle: string) => {
    setRenamingId(noteId);
    setRenameValue(currentTitle);
  };

  const finishRename = (noteId: string) => {
    if (renamingId === noteId) {
      updateNote(noteId, { title: renameValue });
      setRenamingId(null);
    }
  };

  const toggleSelect = (noteId: string) => {
    if (selectedNotes.includes(noteId)) {
      const next = selectedNotes.filter(id => id !== noteId);
      setSelectedNotes(next);
      if (next.length === 0) setIsBulkMode(false);
    } else {
      setSelectedNotes([...selectedNotes, noteId]);
      setIsBulkMode(true);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedNotes.length} notes?`)) {
      deleteNotes(selectedNotes);
      setSelectedNotes([]);
      setIsBulkMode(false);
      if (activeNoteId && selectedNotes.includes(activeNoteId)) {
        setActiveNoteId(null);
      }
    }
  };

  return (
    <div className="w-[300px] border-r border-border bg-surface flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border space-y-4 tracking-tight">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-md py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-text-primary placeholder:text-text-muted"
          />
        </div>
        <button
          onClick={handleCreateNote}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 rounded-md transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={16} />
          <span>New Note</span>
        </button>
      </div>

      {isBulkMode && (
        <div className="px-4 py-2 bg-surface-active border-b border-border flex items-center justify-between no-print">
          <span className="text-xs font-medium">{selectedNotes.length} selected</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleBulkDelete}
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-surface rounded transition-colors"
              title="Delete Selected"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedNotes.length === 0 ? (
          <div className="text-center py-10 px-4 text-text-muted text-sm">
            {searchQuery ? "No notes found." : "No notes yet. Click 'New Note' to start."}
          </div>
        ) : (
          sortedNotes.map(note => (
            <div
              key={note.id}
              onClick={() => {
                if (isBulkMode) {
                  toggleSelect(note.id);
                } else {
                  setActiveNoteId(note.id);
                }
              }}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-colors border",
                activeNoteId === note.id 
                  ? "bg-surface-active border-border-strong shadow-sm" 
                  : "bg-surface hover:bg-surface-hover border-transparent hover:border-border",
                selectedNotes.includes(note.id) && "ring-1 ring-accent border-accent/50"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(note.id); }}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-opacity mt-0.5",
                      selectedNotes.includes(note.id) 
                        ? "bg-accent border-accent text-white opacity-100" 
                        : "border-border-strong opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                    )}
                  >
                    {selectedNotes.includes(note.id) && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                  {renamingId === note.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => finishRename(note.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') finishRename(note.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 font-medium text-sm bg-background border border-accent rounded px-1 -ml-1 outline-none text-text-primary"
                  />
                ) : (
                  <h4 
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(note.id, note.title); }}
                    className={cn("font-medium text-sm truncate pr-6 transition-colors", activeNoteId === note.id ? "text-accent" : "text-text-primary")}
                  >
                    {note.title || 'Untitled Note'}
                  </h4>
                )}
                </div>
                {note.pinned && <Pin size={12} className="text-accent shrink-0 absolute right-3 top-3.5 fill-accent" />}
              </div>
              
              <p className="text-xs text-text-muted line-clamp-2 mb-2 leading-relaxed">
                {getExcerpt(note.content) || 'Empty note'}
              </p>
              
              <div className="flex items-center justify-between text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                </span>
                
                {note.tags.length > 0 && (
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[#26262c] text-text-primary border border-border">
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && <span className="opacity-70">+{note.tags.length - 2}</span>}
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1 bg-surface-hover rounded-md shadow-lg border border-border p-0.5 backdrop-blur-md">
                <button
                  onClick={(e) => { e.stopPropagation(); updateNote(note.id, { starred: !note.starred }); }}
                  className="p-1.5 text-text-secondary hover:text-yellow-500 rounded hover:bg-surface-active"
                  title={note.starred ? "Unstar" : "Star"}
                >
                  <Star size={12} className={note.starred ? "fill-current text-yellow-500" : ""} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); updateNote(note.id, { pinned: !note.pinned }); }}
                  className="p-1.5 text-text-secondary hover:text-accent rounded hover:bg-surface-active"
                  title={note.pinned ? "Unpin" : "Pin"}
                >
                  <Pin size={12} className={note.pinned ? "fill-current" : ""} />
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (confirm('Delete this note?')) {
                      deleteNote(note.id);
                      if (activeNoteId === note.id) setActiveNoteId(null);
                    }
                  }}
                  className="p-1.5 text-text-secondary hover:text-red-400 rounded hover:bg-surface-active"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
