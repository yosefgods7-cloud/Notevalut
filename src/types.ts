export interface Workspace {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  order: number;
}

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  icon: string;
  createdAt: string;
  order: number;
}

export interface NoteHeaderMeta {
  source: string;
  summary: string;
  date: string;
}

export interface NoteImage {
  id: string;
  name: string;
  base64: string;
}

export interface NoteAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
}

export interface NoteChart {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar';
  title: string;
  data: any[];
  config: {
    xAxisKey: string;
    dataKeys: string[];
  };
}

export interface Note {
  id: string;
  workspaceId: string;
  collectionId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  starred?: boolean;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  headerMeta?: NoteHeaderMeta;
  images?: NoteImage[];
  attachments?: NoteAttachment[];
  charts?: NoteChart[];
}


export interface Settings {
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  defaultWorkspace: string;
  smartPaste: boolean;
}

export interface NoteVaultData {
  version: number;
  workspaces: Workspace[];
  collections: Collection[];
  notes: Note[];
  tags: string[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  fontSize: 'medium',
  defaultWorkspace: '',
  smartPaste: true,
};
