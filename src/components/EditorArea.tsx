import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStorage } from '../context/StorageContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import { cleanAIPaste } from '../lib/paste-cleaner';
import { NoteHistoryModal } from './NoteHistoryModal';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  Heading1, Heading2, Heading3, 
  List, ListOrdered, CheckSquare, 
  Code, FileCode2, Table as TableIcon, 
  Minus, Sparkles, Tag as TagIcon, X, Check, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface EditorAreaProps {
  noteId: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ noteId, isSidebarOpen, onToggleSidebar }) => {
  const { data, updateNote, updateSettings, showToast } = useStorage();
  const note = data.notes.find(n => n.id === noteId);
  const settings = data.settings;
  
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savedStatus, setSavedStatus] = useState<'saved' | 'saving'>('saved');
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const smartPasteRef = useRef(settings.smartPaste);
  useEffect(() => {
    smartPasteRef.current = settings.smartPaste;
  }, [settings.smartPaste]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Placeholder.configure({ placeholder: 'Start writing or paste AI text...' })
    ],
    content: '',
    editorProps: {
      handlePaste: (view, event, slice) => {
        if (!smartPasteRef.current) return false;
        
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          const cleaned = cleanAIPaste(text);
          // Insert the cleaned markdown as HTML
          setTimeout(() => {
             editor?.commands.insertContent(cleaned);
          }, 0);
          showToast(`✓ Smart Paste: Cleaned and inserted`);
        }
        return true;
      }
    },
    onUpdate: ({ editor }) => {
      handleSaveContent(editor.getHTML(), editor.storage.characterCount.words());
    }
  });

  useEffect(() => {
    if (note && editor) {
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, false, { preserveWhitespace: 'full' } as any);
      }
      setTitle(note.title);
      setSource(note.headerMeta?.source || '');
      setSummary(note.headerMeta?.summary || '');
      setTags(note.tags);
    }
  }, [noteId, editor]); // intentionally don't include note.content here to avoid cursor jumping

  const handleSaveContent = useCallback((content: string, wordCount: number) => {
    setSavedStatus('saving');
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    
    updateTimeoutRef.current = setTimeout(() => {
      // Version history logic
      const currentHistoryStr = localStorage.getItem(`notevault_history_${noteId}`);
      const history = currentHistoryStr ? JSON.parse(currentHistoryStr) : [];
      const lastVersion = history[0];
      
      // Save version if heavily changed (e.g. > 50 chars diff)
      if (!lastVersion || Math.abs(lastVersion.content.length - content.length) > 50) {
        const newVersion = { timestamp: new Date().toISOString(), content, wordCount };
        const newHistory = [newVersion, ...history].slice(0, 10);
        localStorage.setItem(`notevault_history_${noteId}`, JSON.stringify(newHistory));
      }

      updateNote(noteId, { content, wordCount });
      setSavedStatus('saved');
    }, 800);
  }, [noteId, updateNote]);

  const handleSaveMetadata = useCallback((updates: Partial<typeof note>) => {
    setSavedStatus('saving');
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      updateNote(noteId, updates);
      setSavedStatus('saved');
    }, 800);
  }, [noteId, updateNote]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + C -> Smart Paste
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleSmartPasteClick();
      }
      
      // Cmd/Ctrl + S -> Force Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (editor) {
          updateNote(noteId, { 
            content: editor.getHTML(), 
            wordCount: editor.storage.characterCount.words() 
          });
          setSavedStatus('saved');
          showToast('✓ Saved correctly');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, noteId, updateNote, showToast, settings.smartPaste]);

  const handleSmartPasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = cleanAIPaste(text);
      editor?.commands.insertContent(cleaned);
      showToast('✓ Cleaned & pasted clipboard content');
    } catch (e) {
      showToast('Failed to read clipboard text');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        setTags(newTags);
        updateNote(noteId, { tags: newTags });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);
    updateNote(noteId, { tags: newTags });
  };

  if (!note || !editor) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0 no-print gap-2">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          <button 
            onClick={onToggleSidebar}
            className="p-1.5 bg-surface hover:bg-surface-hover rounded-md text-text-secondary transition-colors shrink-0"
            title="Toggle Sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          {/* Toolbar */}
          <div className="flex items-center space-x-1 shrink-0">
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={<Heading1 size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={<Heading2 size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={<Heading3 size={16} />} />
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={<Bold size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={<Italic size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={<UnderlineIcon size={16} />} />
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={<List size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={<ListOrdered size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} icon={<CheckSquare size={16} />} />
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} icon={<Code size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} icon={<FileCode2 size={16} />} />
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={<TableIcon size={16} />} />
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={<Minus size={16} />} />
          
          <div className="w-px h-4 bg-border mx-1"></div>
          
          <button 
            onClick={handleSmartPasteClick}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-accent/10 text-accent hover:bg-accent/20 rounded-md font-medium transition-colors"
          >
            <Sparkles size={14} />
            <span>Smart Paste</span>
          </button>
        </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-muted select-none">
          {savedStatus === 'saving' ? 'Saving...' : '✓ Saved'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative flex justify-center pb-32 pt-8 print:pt-0">
        <div className="w-full max-w-[720px] px-8 print:px-0">
          
          {/* Note Metadata Header */}
          <div className="mb-8 p-6 bg-surface border border-border rounded-xl">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                handleSaveMetadata({ title: e.target.value });
              }}
              placeholder="Note Title"
              className="w-full text-3xl font-bold bg-transparent border-none outline-none mb-4 text-text-primary placeholder:text-text-muted"
            />
            
            <div className="w-full h-px bg-border-strong mb-4"></div>
            
            <div className="grid grid-cols-[100px_1fr] gap-y-3 gap-x-4 items-center text-sm">
              <span className="text-text-muted font-medium flex items-center gap-2"><span className="text-[1.1em]">📅</span> Date</span>
              <div className="flex justify-between items-center w-full">
                <span className="text-text-primary">{format(new Date(note.createdAt), 'MMMM d, yyyy')}</span>
                <button 
                  onClick={() => setHistoryOpen(true)}
                  className="text-xs text-text-muted hover:text-accent flex items-center gap-1"
                >
                  <Clock size={12} /> History
                </button>
              </div>

              <span className="text-text-muted font-medium flex items-center gap-2"><span className="text-[1.1em]">🔗</span> Source</span>
              <input
                type="text"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  handleSaveMetadata({ headerMeta: { ...(note.headerMeta || {date:'', summary:''}), source: e.target.value } });
                }}
                placeholder="ChatGPT, Meeting, URL..."
                className="bg-transparent border-none outline-none text-text-primary placeholder:text-surface-active"
              />

              <span className="text-text-muted font-medium flex items-center gap-2"><span className="text-[1.1em]">📌</span> Summary</span>
              <input
                type="text"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  handleSaveMetadata({ headerMeta: { ...(note.headerMeta || {date:'', source:''}), summary: e.target.value } });
                }}
                placeholder="One-line summary..."
                className="bg-transparent border-none outline-none text-text-primary placeholder:text-surface-active"
              />

              <span className="text-text-muted font-medium flex items-center gap-2 pt-1"><span className="text-[1.1em]">🏷️</span> Tags</span>
              <div className="flex flex-wrap gap-2 items-center min-h-7">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-surface-active px-2 py-0.5 rounded-md text-xs text-text-primary border border-border">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-white"><X size={10} /></button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="+ Add tag..."
                  className="bg-transparent border-none outline-none text-text-muted placeholder:text-surface-active text-xs w-24"
                />
              </div>
            </div>
          </div>

          <EditorContent editor={editor} className="min-h-[400px]" />

        </div>
      </div>
      
      {/* Footer Info */}
      <div className="h-8 border-t border-border bg-background shrink-0 px-4 flex items-center justify-between text-xs text-text-muted no-print">
        <div className="flex items-center gap-4">
          <span>{editor.storage.characterCount.words()} words</span>
          <span>{Math.max(1, Math.ceil(editor.storage.characterCount.words() / 200))} min read</span>
        </div>
        <div className="flex items-center gap-1.5 opacity-60">
          <Check size={12} /> Auto-saving enabled
        </div>
      </div>
      
      <NoteHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setHistoryOpen(false)}
        noteId={noteId}
        onRestore={(content) => {
          editor.commands.setContent(content, false);
          updateNote(noteId, { content });
          showToast('✓ Resorted from history');
        }}
      />
    </div>
  );
};

const ToolbarButton: React.FC<{ onClick: () => void; active?: boolean; icon: React.ReactNode }> = ({ onClick, active, icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "p-1.5 rounded-md transition-colors",
      active 
        ? "bg-accent/20 text-accent" 
        : "text-text-secondary hover:bg-surface-active hover:text-text-primary"
    )}
  >
    {icon}
  </button>
);
