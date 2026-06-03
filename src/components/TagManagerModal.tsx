import React, { useState } from "react";
import { X, Edit2, Trash2, Check, Tags } from "lucide-react";
import { useStorage } from "../context/StorageContext";

interface TagManagerModalProps {
  onClose: () => void;
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({ onClose }) => {
  const { data, renameTag, deleteTag } = useStorage();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const handleEditClick = (tag: string) => {
    setEditingTag(tag);
    setEditingValue(tag);
  };

  const handleSaveRename = (oldTag: string) => {
    if (editingValue.trim() && editingValue.trim() !== oldTag) {
      renameTag(oldTag, editingValue.trim());
    }
    setEditingTag(null);
    setEditingValue("");
  };

  const handleDelete = (tag: string) => {
    if (confirm(`Are you sure you want to delete the tag "${tag}" from all notes?`)) {
      deleteTag(tag);
    }
  };

  // Get tags with note counts
  const tagCounts: Record<string, number> = {};
  data.notes.forEach((note) => {
    if (note.tags) {
      note.tags.forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    }
  });

  const uniqueTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium text-text-primary flex items-center gap-2">
            <Tags size={18} />
            Tag Manager
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {uniqueTags.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">No tags found in the vault.</p>
          ) : (
            uniqueTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
              >
                {editingTag === tag ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(tag);
                        if (e.key === "Escape") setEditingTag(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(tag)}
                      className="p-1.5 bg-accent/20 text-accent rounded-md hover:bg-accent/30 transition-colors"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingTag(null)}
                      className="p-1.5 bg-surface-hover text-text-muted rounded-md hover:text-text-primary transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm rounded-md bg-surface-active px-2 py-0.5 text-text-primary">
                        #{tag}
                      </span>
                      <span className="text-xs text-text-muted">
                        ({tagCounts[tag]} note{tagCounts[tag] !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(tag)}
                        className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-accent/10 transition-colors"
                        title="Rename tag"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(tag)}
                        className="p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors"
                        title="Delete tag globally"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
