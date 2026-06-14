import { addDays, addMonths, isAfter, isBefore } from 'date-fns';
import { DriveBackupSettings, NoteVaultData, Note } from '../types';

export const calculateNextBackupDate = (startDate: Date, frequency: DriveBackupSettings['frequency']): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(startDate, 1);
    case '3days':
      return addDays(startDate, 3);
    case 'weekly':
      return addDays(startDate, 7);
    case 'monthly':
      return addMonths(startDate, 1);
    case '90days':
      return addDays(startDate, 90);
    default:
      return addDays(startDate, 1);
  }
};

export const shouldRunBackup = (settings?: DriveBackupSettings): boolean => {
  if (!settings || !settings.enabled) return false;
  if (!settings.nextBackupDate) return true; // first time
  const nextBackup = new Date(settings.nextBackupDate);
  const now = new Date();
  return isAfter(now, nextBackup) || isBefore(nextBackup, now);
};

export const createFolder = async (accessToken: string, name: string, parents?: string[]): Promise<string> => {
  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parents) {
    metadata.parents = parents;
  }
  
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) throw new Error('Failed to create folder');
  const result = await res.json();
  return result.id;
};

export const listDriveFolders = async (accessToken: string): Promise<{id: string, name: string}[]> => {
  const query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to list folders');
  const result = await res.json();
  return result.files || [];
};

export const getFolder = async (accessToken: string, folderId: string): Promise<{id: string, name: string} | null> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  return await res.json();
};

export const ensureBackupHierarchy = async (accessToken: string, rootFolderId: string): Promise<{ jsonFolderId: string, vaultFolderId: string }> => {
  // Check children of rootFolderId for "JSON Backups" and "Vault Folders"
  const query = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  const children: {id: string, name: string}[] = data.files || [];
  
  let jsonFolderId = children.find(f => f.name === 'JSON Backups')?.id;
  let vaultFolderId = children.find(f => f.name === 'Vault Folders')?.id;
  
  if (!jsonFolderId) {
    jsonFolderId = await createFolder(accessToken, 'JSON Backups', [rootFolderId]);
  }
  
  if (!vaultFolderId) {
    vaultFolderId = await createFolder(accessToken, 'Vault Folders', [rootFolderId]);
  }
  
  return { jsonFolderId, vaultFolderId };
};

export const uploadToDrive = async (accessToken: string, data: NoteVaultData, fileId?: string, fileName?: string, folderId?: string): Promise<string> => {
  let jsonFolderId = folderId;
  
  // If we're creating a new file and have a parent folder, use it
  const metadata: any = {
    name: fileName || `NoteVault_Backup_${new Date().toISOString().split('T')[0]}.json`,
    mimeType: 'application/json',
    description: `${data.notes?.length || 0} notes`
  };
  
  if (!fileId && jsonFolderId) {
    metadata.parents = [jsonFolderId];
  } else if (!fileId && !jsonFolderId) {
    metadata.parents = ['root'];
  }

  const fileContent = JSON.stringify(data);
  const boundary = 'foo_bar_baz';
  
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(fileId ? { name: metadata.name } : metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    fileContent,
    `--${boundary}--`
  ].join('\r\n');

  const method = fileId ? 'PATCH' : 'POST';
  const url = fileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${res.statusText} - ${err}`);
  }

  const result = await res.json();
  return result.id;
};

export const listJsonBackups = async (accessToken: string, rootFolderId: string): Promise<{id: string, name: string, createdTime: string, size?: string, description?: string}[]> => {
  try {
    const hierarchy = await ensureBackupHierarchy(accessToken, rootFolderId);
    const jsonFolderId = hierarchy.jsonFolderId;
    
    // Only search for .json files inside jsonFolderId
    const query = `'${jsonFolderId}' in parents and mimeType='application/json' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size,description)&orderBy=createdTime desc`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) throw new Error('Failed to list backups');
    const result = await res.json();
    return result.files || [];
  } catch(e) {
    console.error("listJsonBackups error:", e);
    return [];
  }
};

export const downloadJsonBackup = async (accessToken: string, fileId: string): Promise<NoteVaultData> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to download backup');
  const result = await res.json();
  return result;
};

export const listVaultBackups = async (accessToken: string, rootFolderId: string): Promise<{id: string, name: string, createdTime: string}[]> => {
  try {
    const hierarchy = await ensureBackupHierarchy(accessToken, rootFolderId);
    const vaultFolderId = hierarchy.vaultFolderId;
    
    // Search for folders inside vaultFolderId
    const query = `'${vaultFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime desc`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) throw new Error('Failed to list vault backups');
    const result = await res.json();
    return result.files || [];
  } catch(e) {
    console.error("listVaultBackups error:", e);
    return [];
  }
};

export const listDriveContents = async (accessToken: string, folderId: string): Promise<{id: string, name: string, mimeType: string}[]> => {
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=folder,name`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to list folder contents');
  const result = await res.json();
  return result.files || [];
};

export const downloadTextFile = async (accessToken: string, fileId: string): Promise<string> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to download file');
  return await res.text();
};

export const parseMarkdownFile = (content: string): { frontmatter: Record<string, string>, body: string } => {
  const frontmatter: Record<string, string> = {};
  let body = content;
  
  if (content.startsWith('---\n')) {
    const endIdx = content.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const fmStr = content.substring(4, endIdx);
      body = content.substring(endIdx + 5);
      
      const lines = fmStr.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim();
          let val = line.substring(colonIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
            val = val.replace(/\\"/g, '"');
          }
          frontmatter[key] = val;
        }
      }
    }
  }
  
  return { frontmatter, body };
};

export const createMarkdown = (note: Note): string => {
  let md = '---\n';
  md += `title: "${(note.title || 'Untitled').replace(/"/g, '\\"')}"\n`;
  md += `date: "${note.headerMeta?.date || note.createdAt}"\n`;
  md += `source: "${(note.headerMeta?.source || '').replace(/"/g, '\\"')}"\n`;
  md += `summary: "${(note.headerMeta?.summary || '').replace(/"/g, '\\"')}"\n`;
  md += `tags: [${note.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]\n`;
  md += '---\n\n';
  md += note.content;
  return md;
};

const uploadSimpleFile = async (accessToken: string, name: string, content: string, parentId: string, mimeType: string) => {
  const metadata = {
    name,
    mimeType,
    parents: [parentId]
  };

  const boundary = 'foo_bar_baz_vault';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    '',
    content,
    `--${boundary}--`
  ].join('\r\n');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Vault file upload failed:`, err);
  }
};

const processCollectionsForVault = async (accessToken: string, cols: any[], allCols: any[], allNotes: Note[], parentFolderId: string) => {
  for (const col of cols) {
    const colFolderId = await createFolder(accessToken, col.name || 'Untitled Collection', [parentFolderId]);
    
    // Notes in this collection
    const colNotes = allNotes.filter(n => n.collectionId === col.id);
    for (const note of colNotes) {
      const content = createMarkdown(note);
      await uploadSimpleFile(accessToken, `${(note.title || 'Untitled').replace(/\//g, '_')}.md`, content, colFolderId, 'text/markdown');
    }

    // Subcollections
    const subCols = allCols.filter(c => c.parentId === col.id);
    if (subCols.length > 0) {
      await processCollectionsForVault(accessToken, subCols, allCols, allNotes, colFolderId);
    }
  }
};

export const uploadVaultToDrive = async (accessToken: string, data: NoteVaultData, rootFolderId?: string): Promise<void> => {
  const hierarchy = await ensureBackupHierarchy(accessToken, rootFolderId || 'root');
  const vaultContainerId = hierarchy.vaultFolderId;

  const sessionName = `Vault_Backup_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
  const sessionFolderId = await createFolder(accessToken, sessionName, [vaultContainerId]);

  // Root level notes
  const rootNotes = data.notes.filter(n => !n.workspaceId && !n.collectionId);
  for (const note of rootNotes) {
    const content = createMarkdown(note);
    await uploadSimpleFile(accessToken, `${(note.title || 'Untitled').replace(/\//g, '_')}.md`, content, sessionFolderId, 'text/markdown');
  }

  // tags.json
  const tagsMap: Record<string, string[]> = {};
  data.tags.forEach(t => tagsMap[t] = []);
  data.notes.forEach(note => {
    note.tags.forEach(t => {
      if (!tagsMap[t]) tagsMap[t] = [];
      tagsMap[t].push(`${(note.title || 'Untitled').replace(/\//g, '_')}.md`);
    });
  });
  await uploadSimpleFile(accessToken, 'tags.json', JSON.stringify(tagsMap, null, 2), sessionFolderId, 'application/json');

  // Workspaces
  for (const ws of data.workspaces) {
    const wsFolderId = await createFolder(accessToken, ws.name || 'Untitled Workspace', [sessionFolderId]);
    
    const wsNotes = data.notes.filter(n => n.workspaceId === ws.id && !n.collectionId);
    for (const note of wsNotes) {
      const content = createMarkdown(note);
      await uploadSimpleFile(accessToken, `${(note.title || 'Untitled').replace(/\//g, '_')}.md`, content, wsFolderId, 'text/markdown');
    }

    const wsCols = data.collections.filter(c => c.workspaceId === ws.id && !c.parentId);
    await processCollectionsForVault(accessToken, wsCols, data.collections, data.notes, wsFolderId);
  }
};
