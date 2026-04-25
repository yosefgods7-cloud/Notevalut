import { marked } from 'marked';
import { NoteVaultData, Note } from '../types';
import { generateId } from './utils';

export async function parseJSONImport(file: File): Promise<NoteVaultData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as NoteVaultData;
        if (json.version && json.notes && json.workspaces) {
          resolve(json);
        } else {
          reject('Invalid NoteVault JSON schema');
        }
      } catch (err) {
        reject('Failed to parse JSON file');
      }
    };
    reader.onerror = () => reject('Failed to read file');
    reader.readAsText(file);
  });
}

// Minimal markdown frontmatter parser
export async function parseMarkdownImport(file: File, targetWorkspaceId: string, targetCollectionId: string): Promise<Partial<Note>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = text.match(frontmatterRegex);
      
      let title = file.name.replace(/\.md$/i, '');
      let contentMd = text;
      const tags: string[] = [];
      let source = '';
      
      if (match) {
        const yamlStr = match[1];
        contentMd = match[2];
        
        const titleMatch = yamlStr.match(/title:\s*["']?([^"'\n]+)["']?/);
        if (titleMatch) title = titleMatch[1];
        
        const tagsMatch = yamlStr.match(/tags:\s*\[(.*?)\]/);
        if (tagsMatch) {
          tagsMatch[1].split(',').forEach(t => tags.push(t.trim()));
        }
      }
      
      const contentHtml = await marked.parse(contentMd);
      
      resolve({
        title,
        content: contentHtml,
        tags,
        headerMeta: { source, summary: '', date: new Date().toISOString() }
      });
    };
    reader.onerror = () => reject('Failed to read file');
    reader.readAsText(file);
  });
}
