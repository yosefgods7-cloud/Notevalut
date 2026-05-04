import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useStorage } from '../context/StorageContext';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
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
import ImageResize from 'tiptap-extension-resize-image';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontSize } from '../lib/FontSize';
import { cleanAIPaste } from '../lib/paste-cleaner';
import { NoteHistoryModal } from './NoteHistoryModal';
import { ImageCropModal } from './ImageCropModal';
import { ChartBuilderModal } from './ChartBuilderModal';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  Heading1, Heading2, Heading3, 
  List, ListOrdered, CheckSquare, 
  Code, FileCode2, Table as TableIcon, 
  Minus, Sparkles, Tag as TagIcon, X, Check, Clock,
  Image as ImageIcon, Download, Trash2, Bot, Undo2, Redo2, FileText, FileJson, Crop, Paperclip, BookOpen, Pen, BarChart3, LineChart, PieChart, Quote, Type, Palette, Plus, ChevronDown, AreaChart as AreaChartIcon, Hexagon
} from 'lucide-react';
import { cn, generateId } from '../lib/utils';
import { format } from 'date-fns';
import imageCompression from 'browser-image-compression';
import { GoogleGenAI } from '@google/genai';
import { NoteChart } from '../types';
import {
  BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie,
  AreaChart as RechartsAreaChart, Area, RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

import TurndownService from 'turndown';

// html2pdf is a robust library for turning DOM elements into PDFs
// @ts-ignore
import html2pdf from 'html2pdf.js';

const turndownService = new TurndownService();
// Preserve some basic HTML if needed
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`
});

let aiClient: GoogleGenAI | null = null;
let draggedImageData: { id: string; src: string; alt: string } | null = null;

const getAiClient = () => {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
};

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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<{ id: string, base64: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChartBuilderOpen, setIsChartBuilderOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<NoteChart | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;
    
    setIsProcessingImage(true);
    showToast('Compressing image...');
    try {
      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
      
      const newImage = {
        id: generateId(),
        name: file.name,
        base64
      };
      
      const updatedImages = [...(note.images || []), newImage];
      updateNote(noteId, { images: updatedImages });
      showToast('Image attached');
    } catch (err) {
      console.error(err);
      showToast('Failed to process image');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !note) return;
    
    // Size limit 2MB for overall stability in local storage
    if (file.size > 2 * 1024 * 1024) {
      showToast('File too large (limit: 2MB)');
      return;
    }

    try {
      showToast('Uploading file...');
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const newAttachment = {
          id: generateId(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          base64
        };
        const updatedAttachments = [...(note.attachments || []), newAttachment];
        updateNote(noteId, { attachments: updatedAttachments });
        showToast('File attached');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast('Failed to attach file');
    } finally {
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId: string) => {
    if (!note) return;
    const newAttachments = (note.attachments || []).filter(a => a.id !== attachmentId);
    updateNote(noteId, { attachments: newAttachments });
  };

  const explainImage = async (base64: string) => {
    showToast('Analyzing image with AI...');
    try {
      // Need to strip the data prefix from base64 string
      const base64Data = base64.split(',')[1];
      const mimeType = base64.split(';')[0].split(':')[1];
      
      const ai = getAiClient();
      if (!ai) {
        showToast('AI features require an API key to be set');
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Please analyze this image, describe what you see, and extract any notable text or key information.' },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ]
      });
      
      if (response.text) {
        editor?.commands.insertContent(`<p><strong>AI Image Analysis:</strong> ${response.text}</p>`);
        showToast('Image analysis added to note');
      }
    } catch (err) {
      console.error(err);
      showToast('AI analysis failed');
    }
  };

  const handleSaveCrop = (croppedBase64: string) => {
    if (!note || !imageToCrop) return;
    const newImages = (note.images || []).map(img => 
      img.id === imageToCrop.id ? { ...img, base64: croppedBase64 } : img
    );
    updateNote(noteId, { images: newImages });
    setImageToCrop(null);
    showToast('Image cropped successfully');
  };

  const deleteImage = (imageId: string) => {
    if (!note) return;
    const newImages = (note.images || []).filter(img => img.id !== imageId);
    updateNote(noteId, { images: newImages });
  };

  const handleSaveChart = (chart: NoteChart) => {
    if (!note) return;
    const existingCharts = note.charts || [];
    const editIndex = existingCharts.findIndex(c => c.id === chart.id);
    
    let newCharts;
    if (editIndex >= 0) {
      newCharts = [...existingCharts];
      newCharts[editIndex] = chart;
    } else {
      newCharts = [...existingCharts, chart];
    }
    
    updateNote(noteId, { charts: newCharts });
    setIsChartBuilderOpen(false);
    setEditingChart(undefined);
  };

  const deleteChart = (chartId: string) => {
    if (!note) return;
    const newCharts = (note.charts || []).filter(c => c.id !== chartId);
    updateNote(noteId, { charts: newCharts });
  };

  const renderChartPreview = (chart: NoteChart) => {
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];
    
    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={chart.config.xAxisKey} stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {chart.config.dataKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsLineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={chart.config.xAxisKey} stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {chart.config.dataKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {chart.config.dataKeys.map((key, i) => (
                <Pie 
                  key={key} 
                  data={chart.data} 
                  dataKey={key} 
                  nameKey={chart.config.xAxisKey} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100 - (i * 20)} 
                  fill={COLORS[i % COLORS.length]}
                >
                  {chart.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + i) % COLORS.length]} />
                  ))}
                </Pie>
              ))}
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsAreaChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={chart.config.xAxisKey} stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {chart.config.dataKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
              ))}
            </RechartsAreaChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsRadarChart data={chart.data}>
              <PolarGrid stroke="#555" />
              <PolarAngleAxis dataKey={chart.config.xAxisKey} stroke="#888" fontSize={12} />
              <PolarRadiusAxis stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {chart.config.dataKeys.map((key, i) => (
                <Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} />
              ))}
            </RechartsRadarChart>
          </ResponsiveContainer>
        );
    }
  };

  useEffect(() => {
    const handleImageDropped = (e: any) => {
      if (e.detail?.id) {
        deleteImage(e.detail.id);
      }
    };
    window.addEventListener('image-dropped', handleImageDropped);
    return () => window.removeEventListener('image-dropped', handleImageDropped);
  }, [note, deleteImage]);

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
      ImageResize,
      TextStyle,
      Color,
      FontSize,
      Placeholder.configure({ placeholder: 'Start writing or paste AI text...' })
    ],
    content: '',
    editable: isEditing,
    editorProps: {
      handleDrop: (view, event, slice, moved) => {
        if (draggedImageData) {
          event.preventDefault();
          const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (coordinates) {
            const imageNode = view.state.schema.nodes.imageResize || view.state.schema.nodes.image;
            if (!imageNode) return false;
            const node = imageNode.create({
              src: draggedImageData.src,
              alt: draggedImageData.alt
            });
            const tr = view.state.tr.insert(coordinates.pos, node);
            view.dispatch(tr);
            view.focus();
            if (draggedImageData.id) {
               window.dispatchEvent(new CustomEvent('image-dropped', { detail: { id: draggedImageData.id } }));
            }
            draggedImageData = null;
            return true;
          }
        }
        return false;
      },
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
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (note && editor) {
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, { emitUpdate: false });
      }
      setTitle(note.title);
      setSource(note.headerMeta?.source || '');
      setSummary(note.headerMeta?.summary || '');
      setTags(note.tags);
    }
  }, [noteId, editor]); // intentionally don't include note.content here to avoid cursor jumping

  const exportToPdf = useCallback(() => {
    if (!pdfContainerRef.current || !note) return;
    
    setIsExporting(true);
    showToast('Preparing PDF...');
    
    const element = pdfContainerRef.current;
    const originalStyle = element.getAttribute('style') || '';
    
    // Force some styles for export
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#000000';
    element.classList.add('pdf-export-mode');
    
    const opt = {
      margin:       [10, 10] as [number, number],
      filename:     `${note.title || 'Untitled_Note'}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('PDF Exported Successfully');
    }).catch(err => {
      console.error(err);
      showToast('PDF Export Failed');
    }).finally(() => {
      element.setAttribute('style', originalStyle);
      element.classList.remove('pdf-export-mode');
      setIsExporting(false);
    });
  }, [note, showToast]);

  const exportAsMarkdown = useCallback(() => {
    if (!editor || !note) return;
    const html = editor.getHTML();
    const markdown = turndownService.turndown(html);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'Untitled_Note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown exported');
  }, [editor, note, showToast]);

  const exportAsText = useCallback(() => {
    if (!editor || !note) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'Untitled_Note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Text exported');
  }, [editor, note, showToast]);

  const handleSaveContent = useCallback((content: string, wordCount: number) => {
    setSavedStatus('saving');
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    
    updateTimeoutRef.current = setTimeout(() => {
      // Version history logic
      try {
        const currentHistoryStr = localStorage.getItem(`notevault_history_${noteId}`);
        const history = currentHistoryStr ? JSON.parse(currentHistoryStr) : [];
        const lastVersion = history[0];
        
        // Save version if heavily changed (e.g. > 50 chars diff)
        if (!lastVersion || Math.abs(lastVersion.content.length - content.length) > 50) {
          const newVersion = { timestamp: new Date().toISOString(), content, wordCount };
          const newHistory = [newVersion, ...history].slice(0, 10);
          localStorage.setItem(`notevault_history_${noteId}`, JSON.stringify(newHistory));
        }
      } catch (e) {
        console.warn('History save failed', e);
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
          {isEditing && (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={<Undo2 size={16} />} title="Undo (Ctrl+Z)" />
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={<Redo2 size={16} />} title="Redo (Ctrl+Shift+Z)" />
              
              <div className="w-px h-4 bg-border mx-1"></div>

              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={<Heading1 size={16} />} />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={<Heading2 size={16} />} />
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={<Heading3 size={16} />} />
              
              <div className="w-px h-4 bg-border mx-1"></div>
              
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={<Bold size={16} />} />
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={<Italic size={16} />} />
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={<UnderlineIcon size={16} />} />
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={<Quote size={16} />} title="Quote" />
              
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
                id="btn-smart-paste"
                onClick={handleSmartPasteClick}
                className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-accent/10 text-accent hover:bg-accent/20 rounded-md font-medium transition-colors h-8"
              >
                <Sparkles size={14} />
                <span>Smart Paste</span>
              </button>
            </>
          )}

          <div className="relative group">
            <button 
              id="btn-export-main"
              className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-surface-active text-text-primary hover:bg-border rounded-md font-medium transition-colors h-8"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <div className="absolute top-full right-0 mt-1 w-40 bg-surface border border-border rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
              <button 
                onClick={exportToPdf}
                disabled={isExporting}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-active flex items-center gap-2"
              >
                <FileText size={14} /> PDF Document
              </button>
              <button 
                onClick={exportAsMarkdown}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-active flex items-center gap-2"
              >
                <Bot size={14} /> Markdown (.md)
              </button>
              <button 
                onClick={exportAsText}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-active flex items-center gap-2"
              >
                <FileText size={14} /> Plain Text (.txt)
              </button>
            </div>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 no-print">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-surface-active hover:bg-border text-text-primary rounded-md font-medium transition-colors h-8"
            title={isEditing ? "Switch to Reading Mode" : "Switch to Editing Mode"}
          >
            {isEditing ? (
              <><BookOpen size={14} /> <span className="hidden sm:inline">Read</span></>
            ) : (
              <><Pen size={14} /> <span className="hidden sm:inline">Edit</span></>
            )}
          </button>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-surface-active rounded border border-border text-xs text-text-muted h-8">
            <span className="flex items-center gap-1"><span className="text-text-primary text-[10px] w-3 h-3 flex items-center justify-center bg-border rounded">A</span> {editor.storage.characterCount.characters()}</span>
            <span className="text-border mx-1">|</span>
            <span>{editor.storage.characterCount.words()} <span className="hidden lg:inline">words</span></span>
          </div>
          <div className="text-xs text-text-muted select-none w-16 text-right">
            {savedStatus === 'saving' ? 'Saving...' : '✓ Saved'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative flex justify-center pb-32 pt-8 print:pt-0">
        <div className="w-full max-w-[720px] px-8 print:px-0" ref={pdfContainerRef}>
          
          {/* Note Metadata Header */}
          <div className="mb-8 p-6 bg-surface border border-border rounded-xl">
            <input
              type="text"
              value={title}
              readOnly={!isEditing}
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
                readOnly={!isEditing}
                onChange={(e) => {
                  setSource(e.target.value);
                  handleSaveMetadata({ headerMeta: { ...(note.headerMeta || {date:'', summary:''}), source: e.target.value } });
                }}
                placeholder="ChatGPT, Meeting, URL..."
                className="bg-transparent border-none outline-none text-text-primary placeholder:text-surface-active w-full"
              />

              <span className="text-text-muted font-medium flex items-center gap-2"><span className="text-[1.1em]">📌</span> Summary</span>
              <input
                type="text"
                value={summary}
                readOnly={!isEditing}
                onChange={(e) => {
                  setSummary(e.target.value);
                  handleSaveMetadata({ headerMeta: { ...(note.headerMeta || {date:'', source:''}), summary: e.target.value } });
                }}
                placeholder="One-line summary..."
                className="bg-transparent border-none outline-none text-text-primary placeholder:text-surface-active w-full"
              />

              <span className="text-text-muted font-medium flex items-center gap-2 pt-1"><span className="text-[1.1em]">🏷️</span> Tags</span>
              <div className="flex flex-wrap gap-2 items-center min-h-7">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-surface-active px-2 py-0.5 rounded-md text-xs text-text-primary border border-border">
                    {tag}
                    {isEditing && (
                      <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-white"><X size={10} /></button>
                    )}
                  </span>
                ))}
                {isEditing && (
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="+ Add tag..."
                    className="bg-transparent border-none outline-none text-text-muted placeholder:text-surface-active text-xs w-24"
                  />
                )}
              </div>
            </div>
          </div>

          {isEditing && editor && (
            <BubbleMenu 
              editor={editor} 
              pluginKey="imageMenu"
              shouldShow={({ editor }) => editor.isActive('image') || editor.isActive('imageResize')}
            >
              <div className="bg-surface-header border border-border shadow-xl rounded-lg overflow-hidden flex flex-col p-1 gap-1 relative z-10">
                <button
                  onClick={() => editor.chain().focus().deleteSelection().run()}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-surface hover:text-red-500 rounded-md transition-colors"
                >
                  <Trash2 size={14} /> Remove Image
                </button>
              </div>
            </BubbleMenu>
          )}

          {isEditing && editor && (
            <BubbleMenu 
              editor={editor} 
              pluginKey="textBubbleMenu"
              shouldShow={({ editor, from, to }) => {
                return from !== to && !editor.isActive('image') && !editor.isActive('imageResize');
              }}
            >
              <div className="bg-surface-header border border-border shadow-xl rounded-lg overflow-visible flex items-center p-1 gap-1 relative z-50">
                <button
                  onClick={() => {
                    const currentSize = parseInt(editor.getAttributes('textStyle').fontSize || '16', 10);
                    editor.chain().focus().setFontSize(`${Math.max(8, currentSize - 2)}px`).run();
                  }}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded-md transition-colors"
                  title="Decrease Font Size"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs font-medium px-2 text-text-primary min-w-[32px] text-center">
                  {parseInt(editor.getAttributes('textStyle').fontSize || '16', 10)}
                </span>
                <button
                  onClick={() => {
                    const currentSize = parseInt(editor.getAttributes('textStyle').fontSize || '16', 10);
                    editor.chain().focus().setFontSize(`${Math.min(72, currentSize + 2)}px`).run();
                  }}
                  className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded-md transition-colors"
                  title="Increase Font Size"
                >
                  <Plus size={14} />
                </button>
                <div className="w-px h-4 bg-border mx-1"></div>
                <div className="relative group">
                  <button 
                    className="flex items-center gap-1 p-1.5 text-text-primary hover:bg-surface-active rounded-md transition-colors"
                  >
                    <Palette size={14} style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }} />
                  </button>
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-xl p-2 hidden group-hover:grid grid-cols-4 gap-1 z-50 min-w-[120px]">
                    {[
                      { name: 'Default', value: '' },
                      { name: 'Red', value: '#ef4444' },
                      { name: 'Orange', value: '#f97316' },
                      { name: 'Yellow', value: '#eab308' },
                      { name: 'Green', value: '#22c55e' },
                      { name: 'Blue', value: '#3b82f6' },
                      { name: 'Purple', value: '#a855f7' },
                      { name: 'Pink', value: '#ec4899' },
                      { name: 'White', value: '#ffffff' },
                      { name: 'Gray', value: '#9ca3af' },
                      { name: 'Black', value: '#000000' }
                    ].map(color => (
                        <button
                          key={color.name}
                          onClick={() => {
                            if (color.value) {
                              editor.chain().focus().setColor(color.value).run();
                            } else {
                              editor.chain().focus().unsetColor().run();
                            }
                          }}
                          className="w-6 h-6 rounded-md border border-border/50 hover:scale-110 transition-transform relative overflow-hidden"
                          style={{ backgroundColor: color.value || 'transparent' }}
                          title={color.name}
                        >
                          {!color.value && <div className="absolute inset-x-0 inset-y-1/2 h-px bg-red-500 -rotate-45" />}
                        </button>
                    ))}
                  </div>
                </div>
              </div>
            </BubbleMenu>
          )}

          <EditorContent editor={editor} className="min-h-[400px]" />
          
          {/* Attachments Section */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <Paperclip size={16} /> Files & Attachments
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => attachmentInputRef.current?.click()}
                  className="text-xs bg-surface-active hover:bg-border text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                >
                  + Add File 
                </button>
                <input 
                  type="file" 
                  ref={attachmentInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </div>
            </div>
            
            {note.attachments && note.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                {note.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg group">
                    <div className="p-2 bg-surface-active rounded-md text-accent">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate" title={att.name}>{att.name}</p>
                      <p className="text-xs text-text-muted">{(att.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={att.base64} 
                        download={att.name}
                        className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-surface-active transition-colors"
                        title="Download"
                      >
                        <Download size={14} />
                      </a>
                      <button 
                        onClick={() => removeAttachment(att.id)}
                        className="p-1.5 text-text-muted hover:text-red-400 rounded-md hover:bg-surface-active transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-4 mt-8">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={16} /> Charts & Data
              </h3>
              <button 
                onClick={() => { setEditingChart(undefined); setIsChartBuilderOpen(true); }}
                className="text-xs bg-surface-active hover:bg-border text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
              >
                + Build Chart
              </button>
            </div>

            {note.charts && note.charts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {note.charts.map(chart => (
                  <div key={chart.id} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col pt-4">
                    <div className="px-4 pb-2 flex items-center justify-between">
                      <h4 className="font-semibold text-text-primary flex items-center gap-2">
                        {chart.type === 'bar' ? <BarChart3 size={18}/> : chart.type === 'line' ? <LineChart size={18}/> : chart.type === 'pie' ? <PieChart size={18}/> : chart.type === 'area' ? <AreaChartIcon size={18} /> : <Hexagon size={18}/>}
                        {chart.title}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => { setEditingChart(chart); setIsChartBuilderOpen(true); }}
                          className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-surface-active transition-colors"
                          title="Edit Chart"
                        >
                          <Pen size={14} />
                        </button>
                        <button 
                          onClick={() => deleteChart(chart.id)}
                          className="p-1.5 text-text-muted hover:text-red-400 rounded-md hover:bg-surface-active transition-colors"
                          title="Delete Chart"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 w-full p-2 relative bg-background/50">
                      {renderChartPreview(chart)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-4 mt-8">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={16} /> Images
                <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full normal-case font-medium ml-2">Drag into text ↑</span>
              </h3>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="text-xs bg-surface-active hover:bg-border text-text-primary px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessingImage ? 'Loading...' : '+ Add Photo'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
            </div>

            {note.images && note.images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {note.images.map(img => (
                  <div 
                    key={img.id} 
                    className="group relative bg-surface border border-border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
                    draggable={true}
                    onDragStart={(e) => {
                      draggedImageData = { id: img.id, src: img.base64, alt: img.name };
                      // Set both plain URL and HTML to be super compatible with Tiptap
                      e.dataTransfer.setData('text/plain', `[Image: ${img.name}]`);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    onDragEnd={() => {
                      draggedImageData = null;
                    }}
                  >
                    <img src={img.base64} alt={img.name} className="w-full h-48 object-cover" />
                    
                    <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setImageToDelete(img.id);
                        }}
                        className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-full shadow-lg md:opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto"
                        title="Delete Image"
                    >
                        <Trash2 size={14} />
                    </button>

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 no-print pointer-events-none">
                      <button 
                        onClick={(e) => { e.stopPropagation(); explainImage(img.base64); }}
                        className="pointer-events-auto bg-accent text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:bg-accent/80 transition-colors"
                      >
                        <Bot size={16} /> Ask AI
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setImageToCrop({ id: img.id, base64: img.base64 }); }}
                        className="pointer-events-auto bg-surface text-text-primary px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:bg-surface-active transition-colors border border-border"
                      >
                        <Crop size={16} /> Crop Image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
          editor.commands.setContent(content, { emitUpdate: false });
          updateNote(noteId, { content });
          showToast('✓ Resorted from history');
        }}
      />

      {/* Image Delete Confirmation Modal */}
      {imageToDelete && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
              <Trash2 className="text-red-400" size={20} /> Delete Image?
            </h3>
            <p className="text-sm text-text-muted mb-6">
              Are you sure you want to permanently delete this uploaded image?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setImageToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  deleteImage(imageToDelete);
                  setImageToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium bg-red-500/90 hover:bg-red-600 text-white rounded-md transition-colors shadow-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {imageToCrop && (
        <ImageCropModal 
          imageUrl={imageToCrop.base64}
          onClose={() => setImageToCrop(null)}
          onSave={handleSaveCrop}
        />
      )}

      {isChartBuilderOpen && (
        <ChartBuilderModal
          initialChart={editingChart}
          onClose={() => setIsChartBuilderOpen(false)}
          onSave={handleSaveChart}
        />
      )}
    </div>
  );
};

const ToolbarButton: React.FC<{ onClick: () => void; active?: boolean; disabled?: boolean; icon: React.ReactNode; title?: string }> = ({ onClick, active, disabled, icon, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none",
      active 
        ? "bg-accent/20 text-accent" 
        : "text-text-secondary hover:bg-surface-active hover:text-text-primary"
    )}
  >
    {icon}
  </button>
);
