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
  parentId?: string;
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
  type: "bar" | "line" | "pie" | "area" | "radar";
  title: string;
  data: any[];
  config: {
    xAxisKey: string;
    dataKeys: string[];
    colors?: string[];
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
  isDeleted?: boolean;
  deletedAt?: string;
  wordCount: number;
  headerMeta?: NoteHeaderMeta;
  images?: NoteImage[];
  attachments?: NoteAttachment[];
  charts?: NoteChart[];
  contentHash?: string;
  embedding?: number[];
}

export interface AutoCategorizeRule {
  tag: string;
  workspaceId: string;
  collectionId: string;
}

export interface SmartLinkingPluginSettings {
  enabled: boolean;
  maxSuggestions: number;
  triggerMode: "typing" | "button";
  minWordCount: number;
  sources: {
    keywordMatching: boolean;
    tagOverlap: boolean;
    embeddingSimilarity: boolean;
  };
}

export interface Template {
  id: string;
  name: string;
  content: string;
}

export interface AutoStructureSettings {
  enabled: boolean;
  templates: Template[];
  folderTemplates: Record<string, string>;
  activePlaceholders: Record<string, boolean>;
  customPlaceholders: Record<string, string>;
}

export interface BrainMapFilters {
  searchTerm: string;
  tags: string[];
  folders: string[];
  dateRange: { start: string | null; end: string | null };
  connectionTypes: {
    wikilinks: boolean;
    tags: boolean;
  };
}

export interface BrainMapSettings {
  enabled: boolean;
  rememberLastFilter: boolean;
  nonMatchingBehavior: "dim" | "hide";
  defaultFilters: BrainMapFilters;
}

export interface DailyDigestSettings {
  enabled: boolean;
  minNotesRequired: number;
  timeOfDay: string;
}

export interface AskYourVaultSettings {
  enabled: boolean;
  sourceNotesCount: number;
  conversationMode: boolean;
}

export interface PluginSettings {
  autoCategorize?: {
    enabled: boolean;
    rules: AutoCategorizeRule[];
  };
  smartLinking?: SmartLinkingPluginSettings;
  autoStructure?: AutoStructureSettings;
  brainMap?: BrainMapSettings;
  dailyDigest?: DailyDigestSettings;
  askYourVault?: AskYourVaultSettings;
}

export interface DriveBackupSettings {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "3days" | "90days";
  lastBackupDate?: string;
  nextBackupDate?: string;
  fileId?: string;
}

export interface ExternalApiKey {
  id: string;
  name: string;
  key: string;
}

export interface AiSearchScope {
  workspaceIds: string[];
  collectionIds: string[];
  noteIds: string[];
}

export interface CalloutStyle {
  color: string;
  icon: string;
}

export interface ApiUsageStats {
  date: string;
  embeddingCount: number;
  answerCount: number;
  digestCount: number;
  editorCount: number;
}

export interface Settings {
  theme: "dark" | "light" | "system";
  fontSize: "small" | "medium" | "large" | "ultralarge";
  defaultWorkspace: string;
  smartPaste: boolean;
  geminiApiKey?: string; // Legacy/fallback
  apiKeys?: ExternalApiKey[];
  featureApiConfigs?: {
    embeddingKeyId?: string;
    chatKeyId?: string;
    digestKeyId?: string;
    editorKeyId?: string;
  };
  aiScope?: AiSearchScope;
  plugins?: PluginSettings;
  toolbarItems?: string[];
  driveBackup?: DriveBackupSettings;
  lastCloudSyncDate?: string;
  customColors?: Record<string, string>;
  highlightColor?: string;
  defaultCallout?: string;
  calloutStyles?: Record<string, CalloutStyle>;
  apiUsage?: ApiUsageStats; // Legacy
  apiUsageByKey?: Record<string, ApiUsageStats>;
}

export interface NoteTemplate {
  id: string;
  name: string;
  content: string;
}

export type ReviewNoteType = "weekly" | "monthly" | "yearly";

export interface ReviewNote {
  id: string;
  type: ReviewNoteType;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  title: string;
  content: string;
  topLessons: string;
  keySources: string;
  ideasToRevisit: string;
  actionsToTake: string;
  summary: string;
  linkedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteVaultData {
  version: number;
  workspaces: Workspace[];
  collections: Collection[];
  notes: Note[];
  tags: string[];
  settings: Settings;
  templates?: NoteTemplate[];
  reviewNotes?: ReviewNote[];
  brainMapLastFilters?: BrainMapFilters;
  dailyDigest?: DailyDigest;
}

export interface DailyDigest {
  timestamp: number;
  summary: string;
  includedNoteIds: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  fontSize: "medium",
  defaultWorkspace: "",
  smartPaste: true,
  customColors: {},
  highlightColor: "#facc15", // yellow-400
  defaultCallout: "NOTE",
  calloutStyles: {
    CONCEPT: { color: "#3b82f6", icon: "BookOpen" },
    IMPORTANT: { color: "#ef4444", icon: "AlertCircle" },
    QUESTION: { color: "#8b5cf6", icon: "HelpCircle" },
    WARNING: { color: "#f59e0b", icon: "AlertTriangle" },
    IDEA: { color: "#10b981", icon: "Lightbulb" },
    NOTE: { color: "#6b7280", icon: "Info" },
  },
  plugins: {
    autoCategorize: {
      enabled: false,
      rules: [],
    },
    smartLinking: {
      enabled: true,
      maxSuggestions: 5,
      triggerMode: "typing",
      minWordCount: 10,
      sources: {
        keywordMatching: true,
        tagOverlap: true,
        embeddingSimilarity: false,
      },
    },
    autoStructure: {
      enabled: false,
      templates: [],
      folderTemplates: {},
      activePlaceholders: {
        "{{date}}": true,
        "{{title}}": true,
        "{{tags}}": true,
        "{{summary}}": true,
      },
      customPlaceholders: {},
    },
    brainMap: {
      enabled: true,
      rememberLastFilter: true,
      nonMatchingBehavior: "dim",
      defaultFilters: {
        searchTerm: "",
        tags: [],
        folders: [],
        dateRange: { start: null, end: null },
        connectionTypes: { wikilinks: true, tags: true },
      },
    },
    dailyDigest: {
      enabled: false,
      minNotesRequired: 3,
      timeOfDay: "09:00",
    },
    askYourVault: {
      enabled: true,
      sourceNotesCount: 5,
      conversationMode: true,
    },
  },
  driveBackup: {
    enabled: false,
    frequency: "daily",
  },
  toolbarItems: [
    "undo",
    "redo",
    "|",
    "h1",
    "h2",
    "h3",
    "|",
    "bold",
    "italic",
    "underline",
    "highlight",
    "link",
    "blockquote",
    "callout",
    "foldable",
    "|",
    "bulletList",
    "orderedList",
    "taskList",
    "|",
    "code",
    "codeBlock",
    "|",
    "table",
    "hr",
    "|",
    "dictate",
    "attachment",
    "chart",
    "image",
  ],
};
