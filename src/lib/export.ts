import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { NoteVaultData, Note } from '../types';
import { format } from 'date-fns';

export async function exportToJSON(data: NoteVaultData, selectedNoteIds: string[]) {
  // Filter data to only selected notes and their parent collections/workspaces
  const exportedNotes = data.notes.filter(n => selectedNoteIds.includes(n.id));
  const collectionIds = new Set(exportedNotes.map(n => n.collectionId));
  const exportedCollections = data.collections.filter(c => collectionIds.has(c.id));
  const workspaceIds = new Set(exportedCollections.map(c => c.workspaceId));
  const exportedWorkspaces = data.workspaces.filter(w => workspaceIds.has(w.id));
  
  const exportData: NoteVaultData = {
    ...data,
    notes: exportedNotes,
    collections: exportedCollections,
    workspaces: exportedWorkspaces
  };
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  saveAs(blob, `notevault-backup-${format(new Date(), 'yyyy-MM-dd')}.json`);
}

export async function exportToMarkdown(data: NoteVaultData, selectedNoteIds: string[]) {
  const exportedNotes = data.notes.filter(n => selectedNoteIds.includes(n.id));
  
  const zip = new JSZip();
  
  exportedNotes.forEach(note => {
    const col = data.collections.find(c => c.id === note.collectionId);
    const ws = data.workspaces.find(w => w.id === note.workspaceId);
    
    // Construct frontmatter
    let md = `---\n`;
    md += `title: "${note.title.replace(/"/g, '\\"')}"\n`;
    md += `date: ${note.createdAt}\n`;
    if (note.headerMeta?.source) md += `source: "${note.headerMeta.source.replace(/"/g, '\\"')}"\n`;
    if (note.headerMeta?.summary) md += `summary: "${note.headerMeta.summary.replace(/"/g, '\\"')}"\n`;
    md += `tags: [${note.tags.join(', ')}]\n`;
    md += `collection: "${col?.name || 'Unknown'}"\n`;
    md += `workspace: "${ws?.name || 'Unknown'}"\n`;
    md += `---\n\n`;
    
    // Convert HTML to simple markdown (very naive approach for basic text)
    // For a real app, use a dedicated HTML to Markdown library like turndown
    // For now, removing tags and preserving paragraphs/newlines
    let body = note.content
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
      .replace(/<li>(.*?)<\/li>/g, '- $1\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>?/gm, ''); // Strip remaining
      
    md += body;
    
    // Sanitize filename
    const safeTitle = (note.title || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    zip.file(`${safeTitle}.md`, md);
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `notevault-markdown-${format(new Date(), 'yyyy-MM-dd')}.zip`);
}

export async function exportToPlainText(data: NoteVaultData, selectedNoteIds: string[]) {
  const exportedNotes = data.notes.filter(n => selectedNoteIds.includes(n.id));
  const zip = new JSZip();
  
  exportedNotes.forEach(note => {
    let txt = `TITLE: ${note.title}\n`;
    txt += `DATE: ${format(new Date(note.createdAt), 'yyyy-MM-dd')}\n`;
    if (note.tags.length > 0) txt += `TAGS: ${note.tags.join(', ')}\n`;
    txt += `\n---\n\n`;
    
    const tmp = document.createElement('div');
    tmp.innerHTML = note.content;
    txt += tmp.innerText || tmp.textContent || '';
    
    const safeTitle = (note.title || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    zip.file(`${safeTitle}.txt`, txt);
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `notevault-text-${format(new Date(), 'yyyy-MM-dd')}.zip`);
}

export function printNotes(data: NoteVaultData, selectedNoteIds: string[]) {
  const exportedNotes = data.notes.filter(n => selectedNoteIds.includes(n.id));
  
  // Create a hidden print area and call window.print
  const printArea = document.createElement('div');
  printArea.id = 'print-area';
  printArea.className = 'print-only font-serif p-8 bg-white text-black max-w-4xl mx-auto';
  
  document.body.appendChild(printArea);
  
  let html = '';
  exportedNotes.forEach((note, idx) => {
    html += `<div style="page-break-after: ${idx < exportedNotes.length - 1 ? 'always' : 'auto'}">`;
    html += `<h1 style="font-family: sans-serif; font-size: 24px; margin-bottom: 8px;">${note.title || 'Untitled'}</h1>`;
    html += `<div style="font-size: 12px; color: #666; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #ccc;">`;
    html += `📅 ${format(new Date(note.createdAt), 'MMMM d, yyyy')} &nbsp;&nbsp;`;
    if (note.headerMeta?.source) html += `🔗 ${note.headerMeta.source} &nbsp;&nbsp;`;
    if (note.tags.length > 0) html += `🏷️ ${note.tags.join(', ')}`;
    html += `</div>`;
    html += `<div style="line-height: 1.6; font-size: 14px;">${note.content}</div>`;
    html += `</div>`;
  });
  
  printArea.innerHTML = html;
  
  // Wait a tick for styles to process
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.removeChild(printArea);
    }, 1000);
  }, 100);
}
