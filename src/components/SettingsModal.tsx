import React, { useState, useEffect } from "react";
import { useStorage } from "../context/StorageContext";
import { useAuth } from "../context/AuthContext";
import {
  X,
  Save,
  Trash2,
  HardDrive,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  FileJson,
  Download,
  Puzzle,
  Plus,
  Folder,
  ChevronDown,
  ChevronUp,
  Monitor,
  Code,
  Cpu,
  Database,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Settings as SettingsType, DEFAULT_SETTINGS } from "../types";
import { uploadToDrive } from "../lib/drive";
import { appPrompt, appConfirm } from "./GlobalDialogs";

import { AISearchScopeSettings } from "./AISearchScopeSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport: () => void;
}

import { AutoStructureSettingsPanel } from "./AutoStructureSettings";
import { BrainMapSettingsPanel } from "./BrainMapSettingsPanel";
import { DailyDigestSettingsPanel } from "./DailyDigestSettingsPanel";
import { AskYourVaultSettingsPanel } from "./AskYourVaultSettingsPanel";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenExport,
}) => {
  const {
    data,
    updateSettings,
    clearAllData,
    syncFromCloud,
    syncToCloud,
    isSyncing,
    importData,
    showToast,
    addNote,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addCollection,
    updateCollection,
    deleteCollection,
  } = useStorage();
  const { user, accessToken, signIn, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<SettingsType>(
    data.settings,
  );
  const [deleteInput, setDeleteInput] = useState("");
  const [storageUsage, setStorageUsage] = useState<string>("0 KB");

  const [importPendingFile, setImportPendingFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [importTargetWorkspace, setImportTargetWorkspace] = useState(
    data.workspaces[0]?.id || "",
  );
  const [importTargetCollection, setImportTargetCollection] = useState(
    data.collections[0]?.id || "",
  );

  const [expandedSection, setExpandedSection] = useState<string | null>(
    "Appearance",
  );

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleExportJson = () => {
    const backup = {
      ...data,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NoteVault_Backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup JSON exported successfully");
  };

  const handleDataImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        let htmlContent = content;

        // Basic Markdown to HTML conversion if it's md
        if (file.name.endsWith(".md")) {
          htmlContent = content
            .replace(/^### (.*$)/gim, "<h3>$1</h3>")
            .replace(/^## (.*$)/gim, "<h2>$1</h2>")
            .replace(/^# (.*$)/gim, "<h1>$1</h1>")
            .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
            .replace(/\*(.*)\*/gim, "<em>$1</em>")
            .replace(/\n\n/g, "<p></p>")
            .replace(/\n/g, "<br/>");
        } else {
          htmlContent = `<p>${content.replace(/\n/g, "<br/>")}</p>`;
        }

        let initialWorkspace = data.workspaces[0]?.id || "";
        let initialCollection = initialWorkspace
          ? data.collections.find((c) => c.workspaceId === initialWorkspace)
              ?.id || ""
          : "";

        setImportTargetWorkspace(initialWorkspace);
        setImportTargetCollection(initialCollection);

        setImportPendingFile({
          name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
          content: htmlContent,
        });
      };
      reader.readAsText(file);
      e.target.value = "";
      return;
    }

    // Default JSON backup restore
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!imported.workspaces || !imported.notes) {
          throw new Error("Invalid backup file structure");
        }

        const confirmMerge = await appConfirm(
          "Merge with existing data? (Cancel to replace everything)",
        );
        await importData(imported, confirmMerge);
        onClose();
      } catch (err) {
        console.error(err);
        showToast("Failed to import JSON: Invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(data.settings);
      setDeleteInput("");

      const calculateSize = async () => {
        try {
          const { entries } = await import("idb-keyval");
          const allEntries = await entries();
          let total = 0;
          for (const [key, value] of allEntries) {
            const keyStr = String(key);
            const valStr =
              typeof value === "string" ? value : JSON.stringify(value);
            total += (valStr.length + keyStr.length) * 2;
          }
          const kb = total / 1024;
          if (kb > 1024) {
            setStorageUsage((kb / 1024).toFixed(2) + " MB");
          } else {
            setStorageUsage(kb.toFixed(2) + " KB");
          }
        } catch (e) {
          setStorageUsage("Unknown (Storage Access Denied)");
        }
      };

      calculateSize();
    }
  }, [isOpen, data.settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleClearData = () => {
    if (deleteInput === "DELETE") {
      clearAllData();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[85vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-active transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-border overflow-y-auto p-3 space-y-1 bg-background/50">
            {[
              {
                id: "FileManager",
                label: "File Manager",
                icon: Folder,
                color: "text-yellow-500",
              },
              {
                id: "Appearance",
                label: "Appearance",
                icon: Monitor,
                color: "text-accent",
              },
              {
                id: "Plugins",
                label: "Plugins",
                icon: Puzzle,
                color: "text-pink-500",
              },
              {
                id: "Editor",
                label: "Editor Settings",
                icon: Code,
                color: "text-orange-500",
              },
              {
                id: "AI",
                label: "AI Features",
                icon: Cpu,
                color: "text-blue-500",
              },
              {
                id: "Data",
                label: "Data Management",
                icon: Database,
                color: "text-green-500",
              },
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setExpandedSection(sec.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-colors font-medium text-sm text-left",
                  expandedSection === sec.id
                    ? "bg-surface-active text-text-primary shadow-sm"
                    : "hover:bg-surface text-text-secondary",
                )}
              >
                <sec.icon size={18} className={sec.color} />
                {sec.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface/30">
            {/* File Manager */}
            {expandedSection === "FileManager" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Folder className="text-yellow-500" /> File Manager
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span>Holders</span>
                      <button
                        onClick={async () => {
                          const name = await appPrompt("New Holder Name:");
                          if (name) {
                            const icon = await appPrompt("New Holder Icon/Emoji:", "🧠");
                            const newWs = addWorkspace(name, icon || "🧠");
                            if (data.settings.driveBackup?.enabled && accessToken) {
                              const newData = {
                                ...data,
                                workspaces: [...data.workspaces, newWs],
                              };
                              uploadToDrive(
                                accessToken,
                                newData,
                                data.settings.driveBackup.fileId
                              ).catch(console.error);
                            }
                          }
                        }}
                        className="p-1 hover:bg-surface rounded text-accent transition-colors"
                        title="Add Holder"
                      >
                        <Plus size={14} />
                      </button>
                    </h4>
                    <div className="space-y-2">
                      {data.workspaces.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{w.icon}</span>
                            <span className="text-sm font-medium text-text-primary">
                              {w.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                const newName = await appPrompt(
                                  "Update Holder Name:",
                                  w.name,
                                );
                                if (newName === null) return;
                                const newIcon = await appPrompt(
                                  "Update Holder Icon:",
                                  w.icon,
                                );
                                updateWorkspace(w.id, {
                                  name: newName || w.name,
                                  icon: newIcon || w.icon,
                                });
                                if (
                                  data.settings.driveBackup?.enabled &&
                                  accessToken
                                ) {
                                  const newData = {
                                    ...data,
                                    workspaces: data.workspaces.map((ws) =>
                                      ws.id === w.id
                                        ? {
                                            ...ws,
                                            name: newName || w.name,
                                            icon: newIcon || w.icon,
                                          }
                                        : ws,
                                    ),
                                  };
                                  uploadToDrive(
                                    accessToken,
                                    newData,
                                    data.settings.driveBackup.fileId,
                                  ).catch(console.error);
                                }
                              }}
                              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                              title="Edit Holder"
                            >
                              <Code size={14} className="hidden" />
                              <span className="text-xs font-medium">Edit</span>
                            </button>
                            <button
                              onClick={async () => {
                                if (
                                  await appConfirm(
                                    `Are you sure you want to completely delete the holder "${w.name}" and ALL its folders and notes? This cannot be undone.`,
                                  )
                                ) {
                                  deleteWorkspace(w.id);
                                  if (
                                    data.settings.driveBackup?.enabled &&
                                    accessToken
                                  ) {
                                    const newData = {
                                      ...data,
                                      workspaces: data.workspaces.filter(
                                        (ws) => ws.id !== w.id,
                                      ),
                                      collections: data.collections.filter(
                                        (c) => c.workspaceId !== w.id,
                                      ),
                                      notes: data.notes.filter(
                                        (n) => n.workspaceId !== w.id,
                                      ),
                                    };
                                    uploadToDrive(
                                      accessToken,
                                      newData,
                                      data.settings.driveBackup.fileId,
                                    ).catch(console.error);
                                  }
                                }
                              }}
                              className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                              title="Delete Holder"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span>Folders</span>
                      <button
                        onClick={async () => {
                          // Pick a random workspace if there are none, though not likely. Best to offer a select if we wanted, but prompt is simple.
                          const ws = data.workspaces[0];
                          if (!ws) {
                            alert("Create a holder first.");
                            return;
                          }
                          const name = await appPrompt("New Folder Name:");
                          if (name) {
                            const icon = await appPrompt("New Folder Icon/Emoji:", "📁");
                            // Find active workspace if possible, else use first.
                            const newCol = addCollection(ws.id, name, icon || "📁");
                            if (data.settings.driveBackup?.enabled && accessToken) {
                              const newData = {
                                ...data,
                                collections: [...data.collections, newCol],
                              };
                              uploadToDrive(
                                accessToken,
                                newData,
                                data.settings.driveBackup.fileId
                              ).catch(console.error);
                            }
                          }
                        }}
                        className="p-1 hover:bg-surface rounded text-accent transition-colors"
                        title="Add Folder"
                      >
                        <Plus size={14} />
                      </button>
                    </h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {data.collections.map((c) => {
                        const ws = data.workspaces.find(
                          (w) => w.id === c.workspaceId,
                        );
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between bg-surface border border-border rounded-lg p-2.5"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-lg shrink-0">{c.icon}</span>
                              <div className="flex flex-col truncate">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {c.name}
                                </span>
                                <span className="text-[10px] text-text-muted truncate">
                                  in {ws?.name || "Unknown"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={async () => {
                                  const newName = await appPrompt(
                                    "Update Folder Name:",
                                    c.name,
                                  );
                                  if (newName === null) return;
                                  const newIcon = await appPrompt(
                                    "Update Folder Icon:",
                                    c.icon,
                                  );
                                  updateCollection(c.id, {
                                    name: newName || c.name,
                                    icon: newIcon || c.icon,
                                  });
                                  if (data.settings.driveBackup?.enabled && accessToken) {
                                    const newData = {
                                      ...data,
                                      collections: data.collections.map((col) =>
                                        col.id === c.id
                                          ? {
                                              ...col,
                                              name: newName || c.name,
                                              icon: newIcon || c.icon,
                                            }
                                          : col
                                      ),
                                    };
                                    uploadToDrive(
                                      accessToken,
                                      newData,
                                      data.settings.driveBackup.fileId
                                    ).catch(console.error);
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-active rounded transition-colors"
                                title="Edit Folder"
                              >
                                <span className="text-xs font-medium">
                                  Edit
                                </span>
                              </button>
                              <button
                                onClick={async () => {
                                  if (
                                    await appConfirm(
                                      `Are you sure you want to completely delete the folder "${c.name}" and ALL its notes? This cannot be undone.`
                                    )
                                  ) {
                                    deleteCollection(c.id);
                                    if (data.settings.driveBackup?.enabled && accessToken) {
                                      const newData = {
                                        ...data,
                                        collections: data.collections.filter(
                                          (col) => col.id !== c.id
                                        ),
                                        notes: data.notes.filter(
                                          (n) => n.collectionId !== c.id
                                        ),
                                      };
                                      uploadToDrive(
                                        accessToken,
                                        newData,
                                        data.settings.driveBackup.fileId
                                      ).catch(console.error);
                                    }
                                  }
                                }}
                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Folder"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance */}
            {expandedSection === "Appearance" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Monitor className="text-accent" /> Appearance
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <span className="text-sm">Theme</span>
                    <select
                      value={localSettings.theme}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          theme: e.target.value as any,
                        }))
                      }
                      className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <span className="text-sm">Note Output Font Size</span>
                    <select
                      value={localSettings.fontSize}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          fontSize: e.target.value as any,
                        }))
                      }
                      className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="ultralarge">Ultra Large</option>
                    </select>
                  </div>
                  
                  {/* Custom Colors */}
                  <div className="border border-border rounded-xl p-4 mt-6 bg-surface">
                    <h4 className="font-semibold text-sm mb-4">Custom Theme Colors</h4>
                    <p className="text-xs text-text-muted mb-4">Set specific colors to override the selected theme. Leave empty to use theme defaults.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "--bg", label: "Background" },
                        { key: "--surface", label: "Nav/Cards Background" },
                        { key: "--surface-hover", label: "Surface Hover" },
                        { key: "--border", label: "Border/Boxed" },
                        { key: "--text-primary", label: "Base & Bold Texts" },
                        { key: "--text-muted", label: "Muted Text" },
                        { key: "--accent", label: "Accent/Underline/Charts" },
                        { key: "--doc-h1", label: "Editor Headlines" },
                      ].map(colorVar => (
                        <div key={colorVar.key} className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium">{colorVar.label} <span className="text-text-muted/50">({colorVar.key})</span></label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              className="w-8 h-8 rounded border-0 p-0 cursor-pointer bg-transparent"
                              value={localSettings.customColors?.[colorVar.key] || "#000000"}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s,
                                customColors: {
                                  ...(s.customColors || {}),
                                  [colorVar.key]: e.target.value
                                }
                              }))}
                              title={`Pick ${colorVar.label} Color`}
                            />
                            <input
                              type="text"
                              placeholder="e.g. #000000 or rgb(...)"
                              className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-accent"
                              value={localSettings.customColors?.[colorVar.key] || ""}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s,
                                customColors: {
                                  ...(s.customColors || {}),
                                  [colorVar.key]: e.target.value
                                }
                              }))}
                            />
                            {localSettings.customColors?.[colorVar.key] && (
                               <button 
                                 title="Clear color override"
                                 onClick={() => setLocalSettings(s => {
                                   const newColors = { ...(s.customColors || {}) };
                                   delete newColors[colorVar.key];
                                   return { ...s, customColors: newColors };
                                 })}
                                 className="text-text-muted hover:text-red-500 p-1 font-bold text-lg leading-none flex items-center justify-center w-6 h-6 rounded-full hover:bg-red-500/10"
                               >
                                 &times;
                               </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Plugins */}
            {expandedSection === "Plugins" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Puzzle className="text-pink-500" /> Plugins
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Auto-Categorize</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Move notes to folders automatically based on tags
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          localSettings.plugins?.autoCategorize?.enabled ||
                          false
                        }
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLocalSettings((s) => ({
                            ...s,
                            plugins: {
                              ...s.plugins,
                              autoCategorize: {
                                rules: s.plugins?.autoCategorize?.rules || [],
                                enabled: checked,
                              },
                            },
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </div>
                  </label>

                  {localSettings.plugins?.autoCategorize?.enabled && (
                    <div className="space-y-3 mt-4 border-t border-border pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-text-secondary">
                          Routing Rules
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSettings((s) => ({
                              ...s,
                              plugins: {
                                ...s.plugins,
                                autoCategorize: {
                                  enabled: true,
                                  rules: [
                                    ...(s.plugins?.autoCategorize?.rules || []),
                                    {
                                      tag: "",
                                      workspaceId: data.workspaces[0]?.id || "",
                                      collectionId:
                                        data.collections[0]?.id || "",
                                    },
                                  ],
                                },
                              },
                            }));
                          }}
                          className="text-pink-500 hover:text-pink-400 text-xs flex items-center gap-1 font-medium bg-pink-500/10 px-2 py-1 rounded"
                        >
                          <Plus size={12} /> Add Rule
                        </button>
                      </div>

                      {localSettings.plugins.autoCategorize.rules.map(
                        (rule, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 bg-surface p-3 rounded-lg border border-border"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Tag (e.g. todo)"
                                  value={rule.tag}
                                  onChange={(e) => {
                                    const newRules = [
                                      ...(localSettings.plugins?.autoCategorize
                                        ?.rules || []),
                                    ];
                                    newRules[idx].tag = e.target.value
                                      .toLowerCase()
                                      .replace("#", "");
                                    setLocalSettings((s) => ({
                                      ...s,
                                      plugins: {
                                        ...s.plugins,
                                        autoCategorize: {
                                          ...(s.plugins?.autoCategorize as any),
                                          enabled: true,
                                          rules: newRules,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <select
                                  value={rule.collectionId}
                                  onChange={(e) => {
                                    const newRules = [
                                      ...(localSettings.plugins?.autoCategorize
                                        ?.rules || []),
                                    ];
                                    newRules[idx].collectionId = e.target.value;
                                    const targetCol = data.collections.find(
                                      (c) => c.id === e.target.value,
                                    );
                                    newRules[idx].workspaceId =
                                      targetCol?.workspaceId || "";
                                    setLocalSettings((s) => ({
                                      ...s,
                                      plugins: {
                                        ...s.plugins,
                                        autoCategorize: {
                                          ...(s.plugins?.autoCategorize as any),
                                          enabled: true,
                                          rules: newRules,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:border-pink-500 outline-none"
                                >
                                  {data.collections.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {
                                        data.workspaces.find(
                                          (w) => w.id === c.workspaceId,
                                        )?.name
                                      }{" "}
                                      &gt; {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => {
                                  const newRules =
                                    localSettings.plugins?.autoCategorize?.rules.filter(
                                      (_, i) => i !== idx,
                                    ) || [];
                                  setLocalSettings((s) => ({
                                    ...s,
                                    plugins: {
                                      ...s.plugins,
                                      autoCategorize: {
                                        ...(s.plugins?.autoCategorize as any),
                                        enabled: true,
                                        rules: newRules,
                                      },
                                    },
                                  }));
                                }}
                                className="text-text-muted hover:text-red-400 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-border mt-6 pt-6">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Smart Linking</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Suggests related notes while typing based on content
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.plugins?.smartLinking?.enabled ?? true}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLocalSettings((s) => ({
                            ...s,
                            plugins: {
                              ...s.plugins,
                              smartLinking: {
                                ...(s.plugins?.smartLinking || {
                                  maxSuggestions: 5,
                                  triggerMode: "typing",
                                  minWordCount: 10,
                                  sources: { keywordMatching: true, tagOverlap: true, embeddingSimilarity: false }
                                }),
                                enabled: checked,
                              },
                            },
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </div>
                  </label>

                  {localSettings.plugins?.smartLinking?.enabled && (
                    <div className="space-y-4 pl-2 pr-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Max Suggestions</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                            value={localSettings.plugins.smartLinking.maxSuggestions}
                            onChange={(e) => setLocalSettings(s => ({
                              ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, maxSuggestions: Number(e.target.value) } }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Min Word Count</label>
                          <input
                            type="number"
                            min={0}
                            className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                            value={localSettings.plugins.smartLinking.minWordCount}
                            onChange={(e) => setLocalSettings(s => ({
                              ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, minWordCount: Number(e.target.value) } }
                            }))}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Trigger Mode</label>
                        <select
                          className="bg-surface border border-border rounded px-2 py-1.5 text-sm w-full"
                          value={localSettings.plugins.smartLinking.triggerMode}
                          onChange={(e) => setLocalSettings(s => ({
                            ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, triggerMode: e.target.value as any } }
                          }))}
                        >
                          <option value="typing">While Typing</option>
                          <option value="button">On Demand (Button)</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-medium text-text-secondary mb-2">Suggestion Sources</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={localSettings.plugins.smartLinking.sources.keywordMatching}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, sources: { ...s.plugins!.smartLinking!.sources, keywordMatching: e.target.checked } } }
                              }))}
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">Keyword Matching</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={localSettings.plugins.smartLinking.sources.tagOverlap}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, sources: { ...s.plugins!.smartLinking!.sources, tagOverlap: e.target.checked } } }
                              }))}
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">Tag Overlap</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={localSettings.plugins.smartLinking.sources.embeddingSimilarity}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s, plugins: { ...s.plugins, smartLinking: { ...s.plugins!.smartLinking!, sources: { ...s.plugins!.smartLinking!.sources, embeddingSimilarity: e.target.checked } } }
                              }))}
                              className="rounded border-border text-pink-500 focus:ring-pink-500"
                            />
                            <span className="text-sm">Embedding Similarity (IndexedDB)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <AutoStructureSettingsPanel 
                     settings={localSettings} 
                     onUpdate={setLocalSettings} 
                     collections={data.collections} 
                  />
                  <BrainMapSettingsPanel settings={localSettings} onUpdate={setLocalSettings} />
                  <AskYourVaultSettingsPanel 
                     settings={localSettings} 
                     onUpdate={setLocalSettings} 
                     apiUsage={data.settings.apiUsage} 
                  />
                  <DailyDigestSettingsPanel 
                     settings={localSettings} 
                     onUpdate={setLocalSettings} 
                     apiUsageCount={
                       data.settings.apiUsage?.date === new Date().toISOString().split('T')[0] 
                        ? (data.settings.apiUsage.embeddingCount || 0) + (data.settings.apiUsage.answerCount || 0) + (data.settings.apiUsage.digestCount || 0) + (data.settings.apiUsage.editorCount || 0) 
                        : 0
                     } 
                  />
                </div>
              </div>
            )}

            {/* Editor Settings */}
            {expandedSection === "Editor" && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Code className="text-orange-500" /> Editor Settings
                </h3>
                <div className="space-y-6">
                  <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
                    <div>
                      <div className="text-sm font-medium">Smart Paste</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Automatically clean AI text on Ctrl+V
                      </div>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.smartPaste}
                        onChange={(e) =>
                          setLocalSettings((s) => ({
                            ...s,
                            smartPaste: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                  </label>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">Highlight Colors</div>
                    <div className="text-xs text-text-muted mb-4">
                      Customize the background color for ==highlighted text==.
                    </div>
                    <div className="flex gap-2">
                      {[
                        { name: "Yellow", value: "#facc15" },
                        { name: "Green", value: "#4ade80" },
                        { name: "Blue", value: "#60a5fa" },
                        { name: "Pink", value: "#f472b6" },
                        { name: "Orange", value: "#fb923c" }
                      ].map(color => (
                        <button
                          key={color.value}
                          onClick={() => setLocalSettings(s => ({ ...s, highlightColor: color.value }))}
                          className={`w-8 h-8 rounded-full border-2 ${localSettings.highlightColor === color.value ? 'border-primary' : 'border-transparent'}`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">Callout Styles</div>
                    <div className="text-xs text-text-muted mb-4">
                      Customize colors and icons for each callout type.
                    </div>
                    <div className="space-y-3">
                      {Object.keys(localSettings.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {}).map(type => {
                        const style = (localSettings.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {})[type];
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <div className="w-24 text-sm font-semibold">{type}</div>
                            <input 
                              type="color" 
                              value={style?.color || "#000000"} 
                              onChange={(e) => setLocalSettings(s => ({
                                ...s,
                                calloutStyles: {
                                  ...(s.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {}),
                                  [type]: { ...((s.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {})[type] || { icon: "Info", color: "#000" }), color: e.target.value }
                                }
                              }))}
                              className="w-8 h-8 rounded shrink-0 border border-border bg-transparent p-0 overflow-hidden cursor-pointer"
                            />
                            <select
                              value={style?.icon || "Info"}
                              onChange={(e) => setLocalSettings(s => ({
                                ...s,
                                calloutStyles: {
                                  ...(s.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {}),
                                  [type]: { ...((s.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {})[type] || { color: "#000", icon: "Info" }), icon: e.target.value }
                                }
                              }))}
                              className="flex-1 bg-surface-active border border-border rounded px-2 py-1.5 text-sm"
                            >
                              <option value="Info">Info</option>
                              <option value="BookOpen">BookOpen</option>
                              <option value="AlertCircle">AlertCircle</option>
                              <option value="HelpCircle">HelpCircle</option>
                              <option value="AlertTriangle">AlertTriangle</option>
                              <option value="Lightbulb">Lightbulb</option>
                              <option value="Star">Star</option>
                              <option value="Zap">Zap</option>
                              <option value="Flag">Flag</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">Default Callout</div>
                    <div className="text-xs text-text-muted mb-2">
                      Select which callout type is used by default when clicking the Callout button.
                    </div>
                    <select
                      value={localSettings.defaultCallout || "NOTE"}
                      onChange={e => setLocalSettings(s => ({ ...s, defaultCallout: e.target.value }))}
                      className="w-full bg-surface-active border border-border rounded px-3 py-2 text-sm"
                    >
                      {Object.keys(localSettings.calloutStyles || DEFAULT_SETTINGS.calloutStyles || {}).map(type => (
                         <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="text-sm font-medium mb-1">
                      Bottom Bar Button Configuration
                    </div>
                    <div className="text-xs text-text-muted mb-4">
                      Reorder, add, or remove tools from the editor toolbar.
                    </div>

                    <div className="flex flex-col gap-2">
                      {(localSettings.toolbarItems || []).map((item, idx) => {
                        if (item === "|") return null;
                        return (
                          <div
                            key={`${item}-${idx}`}
                            className="flex items-center justify-between bg-surface p-2 border border-border rounded-md"
                          >
                            <span className="text-sm text-text-primary capitalize">
                              {item.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ];
                                  const withoutSeps = items.filter(
                                    (x) => x !== "|",
                                  );
                                  const selfIdx = withoutSeps.indexOf(item);
                                  if (selfIdx > 0) {
                                    const tmp = withoutSeps[selfIdx - 1];
                                    withoutSeps[selfIdx - 1] = item;
                                    withoutSeps[selfIdx] = tmp;
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: withoutSeps,
                                    }));
                                  }
                                }}
                                className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                                disabled={idx === 0}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ];
                                  const withoutSeps = items.filter(
                                    (x) => x !== "|",
                                  );
                                  const selfIdx = withoutSeps.indexOf(item);
                                  if (selfIdx < withoutSeps.length - 1) {
                                    const tmp = withoutSeps[selfIdx + 1];
                                    withoutSeps[selfIdx + 1] = item;
                                    withoutSeps[selfIdx] = tmp;
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: withoutSeps,
                                    }));
                                  }
                                }}
                                className="p-1 hover:bg-surface-active rounded text-text-muted transition-colors disabled:opacity-30"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <div className="w-px h-4 bg-border mx-1"></div>
                              <button
                                onClick={() => {
                                  const items = [
                                    ...(localSettings.toolbarItems || []),
                                  ].filter((x) => x !== "|");
                                  setLocalSettings((s) => ({
                                    ...s,
                                    toolbarItems: items.filter(
                                      (x) => x !== item,
                                    ),
                                  }));
                                }}
                                className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {[
                        "undo",
                        "redo",
                        "h1",
                        "h2",
                        "h3",
                        "bold",
                        "italic",
                        "underline",
                        "link",
                        "blockquote",
                        "bulletList",
                        "orderedList",
                        "taskList",
                        "code",
                        "codeBlock",
                        "table",
                        "hr",
                        "dictate",
                        "attachment",
                        "chart",
                        "image",
                      ].filter(
                        (item) =>
                          !(localSettings.toolbarItems || []).includes(item),
                      ).length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">
                            Available Features
                          </div>
                          {[
                            "undo",
                            "redo",
                            "h1",
                            "h2",
                            "h3",
                            "bold",
                            "italic",
                            "underline",
                            "link",
                            "blockquote",
                            "bulletList",
                            "orderedList",
                            "taskList",
                            "code",
                            "codeBlock",
                            "table",
                            "hr",
                            "dictate",
                            "attachment",
                            "chart",
                            "image",
                          ]
                            .filter(
                              (item) =>
                                !(localSettings.toolbarItems || []).includes(
                                  item,
                                ),
                            )
                            .map((item) => (
                              <div
                                key={`avail-${item}`}
                                className="flex items-center justify-between bg-surface-active p-2 rounded-md mb-2 opacity-70 hover:opacity-100 transition-opacity border border-dashed border-border"
                              >
                                <span className="text-sm text-text-muted capitalize">
                                  {item.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                <button
                                  onClick={() => {
                                    const items = [
                                      ...(localSettings.toolbarItems || []),
                                    ].filter((x) => x !== "|");
                                    items.push(item);
                                    setLocalSettings((s) => ({
                                      ...s,
                                      toolbarItems: items,
                                    }));
                                  }}
                                  className="p-1 hover:bg-green-500/20 text-green-500 rounded transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Features */}
            {expandedSection === "AI" && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Cpu className="text-blue-500" /> AI Features
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-sm font-medium flex justify-between">
                      <span>Gemini API Key</span>
                      <span className="text-xs text-text-muted font-normal bg-surface-active px-2 py-0.5 rounded">
                        Optional
                      </span>
                    </label>
                    <input
                      type="password"
                      value={localSettings.geminiApiKey || ""}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          geminiApiKey: e.target.value,
                        }))
                      }
                      placeholder="AI Studio Free API Key..."
                      className="bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full"
                    />
                    <div className="flex items-center gap-2 mt-2">
                       <button
                         type="button"
                         onClick={async () => {
                           if (!localSettings.geminiApiKey) return;
                           const { fetchEmbedding } = await import('../lib/ai');
                           const el = document.getElementById("apiKeyMessage");
                           if (el) el.textContent = "Verifying...";
                           const res = await fetchEmbedding("test", localSettings.geminiApiKey);
                           if (el) {
                             if (res) el.textContent = "✅ Valid API Key";
                             else el.textContent = "❌ Invalid API Key format or network error";
                           }
                         }}
                         className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded font-medium transition-colors border border-blue-500/20"
                       >
                         Verify Key
                       </button>
                       <span id="apiKeyMessage" className="text-xs font-mono text-text-muted"></span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mt-1">
                      Required for the Second Brain features. You can get a free API key from Google AI Studio. Stored securely and locally in your browser.
                    </p>
                  </div>
                  
                  {/* Search Scope */}
                  <AISearchScopeSettings localSettings={localSettings} setLocalSettings={setLocalSettings} />
                  
                  {/* API Usage Metrics */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border mt-4">
                    <h4 className="text-sm font-medium">Daily API Usage</h4>
                    <p className="text-xs text-text-muted mb-2">Monitor your Gemini API usage for second brain and AI features. Free tier limits apply.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-background rounded-lg p-3 border border-border">
                        <div className="text-xs text-text-muted mb-1">Embedding Calls</div>
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-bold">{data.settings.apiUsage?.date === new Date().toISOString().split('T')[0] ? data.settings.apiUsage?.embeddingCount || 0 : 0}</span>
                          <span className="text-xs text-text-muted mb-1">/ 1400</span>
                        </div>
                        <div className="w-full bg-surface-active h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full transition-all" 
                            style={{ width: `${Math.min(((data.settings.apiUsage?.date === new Date().toISOString().split('T')[0] ? data.settings.apiUsage?.embeddingCount || 0 : 0) / 1400) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-3 border border-border">
                        <div className="text-xs text-text-muted mb-1">AI Chat Calls</div>
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-bold">{data.settings.apiUsage?.date === new Date().toISOString().split('T')[0] ? data.settings.apiUsage?.answerCount || 0 : 0}</span>
                          <span className="text-xs text-text-muted mb-1">/ 1400</span>
                        </div>
                        <div className="w-full bg-surface-active h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all" 
                            style={{ width: `${Math.min(((data.settings.apiUsage?.date === new Date().toISOString().split('T')[0] ? data.settings.apiUsage?.answerCount || 0 : 0) / 1400) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Management */}
            {expandedSection === "Data" && (
              <div className="space-y-5">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Database className="text-green-500" /> Data Management
                </h3>
                <div className="space-y-5">
                  {/* Cloud Sync */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> Cloud Sync
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3">
                      {user ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-medium text-text-primary text-sm">
                                Signed in
                              </span>
                              <span className="text-text-muted text-[11px] truncate w-32">
                                {user.email}
                              </span>
                            </div>
                            <button
                              onClick={signOut}
                              className="text-text-muted hover:bg-surface-active p-1.5 rounded transition-colors text-xs font-medium"
                            >
                              Sign out
                            </button>
                          </div>
                          <div className="flex flex-col gap-2 pt-2 border-t border-border">
                            <div className="flex justify-between items-center text-xs text-text-muted">
                              <span>Last Successful Backup:</span>
                              <span className="font-medium">
                                {localSettings.lastCloudSyncDate
                                  ? new Date(
                                      localSettings.lastCloudSyncDate,
                                    ).toLocaleString()
                                  : "Never"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => syncToCloud()}
                                disabled={isSyncing}
                                className="flex-1 bg-accent hover:bg-accent-hover text-white disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium border border-transparent"
                              >
                                <Cloud size={14} /> Backup Now
                              </button>
                              <button
                                onClick={() => syncFromCloud()}
                                disabled={isSyncing}
                                className="flex-1 bg-background hover:bg-surface-active border border-border disabled:opacity-50 text-xs py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 font-medium"
                              >
                                <RefreshCw
                                  size={14}
                                  className={isSyncing ? "animate-spin" : ""}
                                />{" "}
                                Restore
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center py-1 space-y-3">
                          <p className="text-xs text-text-muted">
                            Sign in to securely backup layout.
                          </p>
                          <button
                            type="button"
                            onClick={signIn}
                            className="bg-white text-black font-medium hover:bg-gray-200 transition-colors w-full px-3 py-1.5 rounded-md flex items-center justify-center gap-2 text-sm shadow-sm"
                          >
                            <LogIn size={14} /> Sign in with Google
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Google Drive Backup */}
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center gap-2">
                      <Cloud size={14} /> Google Drive Auto Backup
                    </h4>
                    <div className="bg-surface border border-border rounded-lg p-3">
                      <label className="flex items-center justify-between cursor-pointer mb-3">
                        <div>
                          <div className="text-sm font-medium">
                            Enable Auto-Sync
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Automatically save NoteVault_Backup.json
                          </div>
                        </div>
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              localSettings.driveBackup?.enabled || false
                            }
                            onChange={async (e) => {
                              const enabled = e.target.checked;
                              if (enabled) {
                                // Request auth scope immediately upon enabling
                                try {
                                  await signIn();
                                } catch (err) {
                                  console.error(err);
                                  showToast(
                                    "Google Drive authentication failed",
                                  );
                                  return;
                                }
                              }

                              setLocalSettings((s) => ({
                                ...s,
                                driveBackup: {
                                  ...s.driveBackup,
                                  enabled,
                                  frequency:
                                    s.driveBackup?.frequency || "daily",
                                },
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                      </label>

                      {localSettings.driveBackup?.enabled && (
                        <div className="pt-3 border-t border-border flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-text-secondary">
                              Sync Frequency
                            </span>
                            <select
                              value={
                                localSettings.driveBackup?.frequency || "daily"
                              }
                              onChange={(e) => {
                                setLocalSettings((s) => ({
                                  ...s,
                                  driveBackup: {
                                    ...s.driveBackup!,
                                    frequency: e.target.value as any,
                                  },
                                }));
                              }}
                              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:border-green-500 outline-none"
                            >
                              <option value="daily">Daily</option>
                              <option value="3days">Every 3 Days</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="90days">Every 90 Days</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Local Backup */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <HardDrive size={14} /> Local Backup
                      </span>
                      <span className="normal-case font-normal text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">
                        {storageUsage}
                      </span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenExport();
                        }}
                        className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all"
                      >
                        <FileJson size={16} />
                        <span className="text-xs font-medium">Export</span>
                      </button>
                      <label className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-all cursor-pointer">
                        <Download size={16} />
                        <span className="text-xs font-medium">Import</span>
                        <input
                          type="file"
                          accept=".json,.txt,.md"
                          onChange={handleDataImport}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    <h4 className="text-red-400 font-medium text-xs mb-2 flex items-center gap-1.5">
                      <Trash2 size={14} /> Danger Zone
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type DELETE"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        className="bg-background border border-border rounded w-24 px-2 py-1 text-xs focus:outline-none focus:border-red-500"
                      />
                      <button
                        onClick={handleClearData}
                        disabled={deleteInput !== "DELETE"}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:pointer-events-none px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Clear Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0 bg-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border hover:bg-surface-active transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-colors flex items-center gap-2 text-sm shadow-md"
          >
            <Save size={16} />
            Apply Settings
          </button>
        </div>

        {importPendingFile && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px] rounded-2xl z-50 flex items-center justify-center p-6">
            <div className="bg-surface border border-border rounded-xl shadow-2xl p-5 w-full max-w-sm">
              <h3 className="text-lg font-bold text-text-primary mb-3 flex items-center gap-2">
                <FileJson size={18} /> Import Note
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                Select where to save <strong>{importPendingFile.name}</strong>:
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">
                    Workspace
                  </label>
                  <div className="relative">
                    <select
                      value={importTargetWorkspace}
                      onChange={(e) => {
                        setImportTargetWorkspace(e.target.value);
                        setImportTargetCollection(
                          data.collections.find(
                            (c) => c.workspaceId === e.target.value,
                          )?.id || "",
                        );
                      }}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                    >
                      {data.workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-2.5 text-text-muted pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-muted mb-1.5 block">
                    Folder (Collection)
                  </label>
                  <div className="relative">
                    <select
                      value={importTargetCollection}
                      onChange={(e) =>
                        setImportTargetCollection(e.target.value)
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-accent"
                      disabled={!importTargetWorkspace}
                    >
                      {data.collections
                        .filter((c) => c.workspaceId === importTargetWorkspace)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-2.5 text-text-muted pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setImportPendingFile(null)}
                  className="px-4 py-2 rounded-md hover:bg-surface-active transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (importTargetWorkspace && importTargetCollection) {
                      addNote(
                        importTargetWorkspace,
                        importTargetCollection,
                        importPendingFile.name,
                        importPendingFile.content,
                      );
                      showToast("✓ Note imported");
                      setImportPendingFile(null);
                    }
                  }}
                  disabled={!importTargetWorkspace || !importTargetCollection}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-md transition-colors text-sm"
                >
                  Import File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
