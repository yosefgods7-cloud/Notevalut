import React, { useState } from 'react';
import { useStorage } from '../context/StorageContext';
import { parseJSONImport, parseMarkdownImport } from '../lib/import';
import { generateId } from '../lib/utils';
import { X, UploadCloud } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspaceId: string;
  activeCollectionId: string | null;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, activeWorkspaceId, activeCollectionId }) => {
  const { data, importData, addNote, updateNote } = useStorage();
  const [isImporting, setIsImporting] = useState(false);
  
  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsImporting(true);
    try {
      const file = files[0];
      if (file.name.endsWith('.json')) {
        const parsed = await parseJSONImport(file);
        if (confirm(`Found ${parsed.notes.length} notes. Merge into current vault (OK) or Replace everything (Cancel)?`)) {
          importData(parsed, true);
        } else {
          importData(parsed, false);
        }
      } else if (file.name.endsWith('.md')) {
        if (!activeWorkspaceId || !activeCollectionId) {
          alert("Please select a workspace and collection first.");
          return;
        }
        const noteData = await parseMarkdownImport(file, activeWorkspaceId, activeCollectionId);
        
        // Use addNote context method to ensure UUIDs are generated properly
        const newNote = addNote(activeWorkspaceId, activeCollectionId, noteData.title, noteData.content);
        // Then apply any additional metadata from frontmatter
        if (noteData.headerMeta || noteData.tags) {
           updateNote(newNote.id, { headerMeta: noteData.headerMeta, tags: noteData.tags || [] });
        }
      } else {
        alert("Unsupported file format. Please use .json or .md");
      }
      onClose();
    } catch (err) {
      console.error(err);
      alert('Import failed: ' + err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Import Notes</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="border-2 border-dashed border-border-strong rounded-xl p-8 flex flex-col items-center justify-center hover:bg-surface-active transition-colors cursor-pointer relative">
          <input 
            type="file" 
            accept=".json,.md"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
            disabled={isImporting}
          />
          <UploadCloud size={48} className="text-accent mb-4" />
          <p className="font-medium text-center mb-1">Click or drag files here</p>
          <p className="text-xs text-text-muted text-center max-w-[200px]">
            Supports NoteVault .json backups or .md Markdown files
          </p>
        </div>

        {isImporting && <p className="text-center mt-4 text-sm text-accent">Importing data...</p>}
      </div>
    </div>
  );
};
