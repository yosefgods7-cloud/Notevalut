import React, { useState } from "react";
import { Settings, AutoStructureSettings, Template, Collection } from "../types";
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Folder } from "lucide-react";
import { generateId } from "../lib/utils";

interface Props {
  settings: Settings;
  onUpdate: (updater: (s: Settings) => Settings) => void;
  collections: Collection[];
}

export const AutoStructureSettingsPanel: React.FC<Props> = ({ settings, onUpdate, collections }) => {
  const rawAst = settings.plugins?.autoStructure;
  const autoStructure: AutoStructureSettings = {
    enabled: rawAst?.enabled || false,
    templates: rawAst?.templates || [],
    folderTemplates: rawAst?.folderTemplates || {},
    activePlaceholders: rawAst?.activePlaceholders || {
      "{{date}}": true,
      "{{title}}": true,
      "{{tags}}": true,
      "{{summary}}": true,
    },
    customPlaceholders: rawAst?.customPlaceholders || {},
  };
  const enabled = autoStructure.enabled;

  const [expandedSection, setExpandedSection] = useState<"templates" | "placeholders" | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const handleToggle = (checked: boolean) => {
    onUpdate((s) => ({
      ...s,
      plugins: {
        ...s.plugins,
        autoStructure: {
          ...getAst(s),
          enabled: checked,
        },
      },
    }));
  };

  const getAst = (s: Settings): AutoStructureSettings => {
    const rawAst = s.plugins?.autoStructure;
    return {
      enabled: rawAst?.enabled || false,
      templates: rawAst?.templates || [],
      folderTemplates: rawAst?.folderTemplates || {},
      activePlaceholders: rawAst?.activePlaceholders || {
        "{{date}}": true,
        "{{title}}": true,
        "{{tags}}": true,
        "{{summary}}": true,
      },
      customPlaceholders: rawAst?.customPlaceholders || {},
    };
  };

  const addTemplate = () => {
    const newTemplate: Template = {
      id: generateId(),
      name: "New Template",
      content: "",
    };
    onUpdate((s) => {
      const ast = getAst(s);
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            templates: [...ast.templates, newTemplate],
          },
        },
      };
    });
    setEditingTemplateId(newTemplate.id);
  };

  const deleteTemplate = (id: string) => {
    onUpdate((s) => {
      const ast = getAst(s);
      const newFolderTemplates = { ...ast.folderTemplates };
      for (const k in newFolderTemplates) {
        if (newFolderTemplates[k] === id) delete newFolderTemplates[k];
      }
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            templates: ast.templates.filter((t: Template) => t.id !== id),
            folderTemplates: newFolderTemplates,
          },
        },
      };
    });
  };

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    onUpdate((s) => {
      const ast = getAst(s);
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            templates: ast.templates.map((t: Template) => t.id === id ? { ...t, ...updates } : t),
          },
        },
      };
    });
  };

  const assignTemplateFolder = (templateId: string, folderId: string) => {
    onUpdate((s) => {
      const ast = getAst(s);
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            folderTemplates: {
              ...ast.folderTemplates,
              [folderId]: templateId,
            },
          },
        },
      };
    });
  };

  const removeFolderAssignment = (folderId: string) => {
    onUpdate((s) => {
      const ast = getAst(s);
      const newFt = { ...ast.folderTemplates };
      delete newFt[folderId];
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            folderTemplates: newFt,
          },
        },
      };
    });
  };

  const togglePlaceholder = (key: string, checked: boolean) => {
    onUpdate((s) => {
      const ast = getAst(s);
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            activePlaceholders: {
              ...ast.activePlaceholders,
              [key]: checked,
            },
          },
        },
      };
    });
  };

  const updateCustomPlaceholder = (key: string, value: string) => {
    onUpdate((s) => {
      const ast = getAst(s);
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            customPlaceholders: {
              ...ast.customPlaceholders,
              [key]: value,
            },
          },
        },
      };
    });
  };
  
  const deleteCustomPlaceholder = (key: string) => {
    onUpdate((s) => {
      const ast = getAst(s);
      const cp = { ...ast.customPlaceholders };
      delete cp[key];
      return {
        ...s,
        plugins: {
          ...s.plugins,
          autoStructure: {
            ...ast,
            customPlaceholders: cp,
          },
        },
      };
    });
  };

  const [newCustomKey, setNewCustomKey] = useState("");

  const DEFAULT_PLACEHOLDERS = ["{{date}}", "{{title}}", "{{tags}}", "{{summary}}"];

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between cursor-pointer bg-surface border border-border p-3 rounded-xl hover:border-accent transition-colors">
        <div>
          <div className="text-sm font-medium">Auto Structure</div>
          <div className="text-xs text-text-muted mt-0.5">
            Default formats and template application for new notes inside folders
          </div>
        </div>
        <div className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
        </div>
      </label>

      {enabled && (
        <div className="space-y-3 mt-4 border-t border-border pt-4">
          
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === "templates" ? null : "templates")}
              className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <span>Template Editor</span>
              {expandedSection === "templates" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedSection === "templates" && (
              <div className="p-3 border-t border-border bg-surface/50 space-y-4">
                {autoStructure.templates.map(t => (
                  <div key={t.id} className="border border-border rounded-lg p-3 bg-surface">
                    <div className="flex items-center justify-between mb-2">
                       <input 
                         type="text" 
                         value={t.name}
                         onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
                         className="bg-transparent font-medium border-b border-transparent hover:border-border focus:border-accent outline-none px-1 py-0.5 text-sm w-1/2"
                       />
                       <div className="flex items-center gap-2">
                         <button onClick={() => setEditingTemplateId(editingTemplateId === t.id ? null : t.id)} className="text-text-muted hover:text-white p-1">
                           <Edit2 size={14} />
                         </button>
                         <button onClick={() => deleteTemplate(t.id)} className="text-red-500 hover:text-red-400 p-1">
                           <Trash2 size={14} />
                         </button>
                       </div>
                    </div>
                    {editingTemplateId === t.id && (
                      <div className="space-y-2 mt-2">
                        <textarea 
                           className="w-full h-32 bg-surface-active border border-border rounded-md p-2 text-xs font-mono resize-y outline-none focus:border-accent"
                           value={t.content}
                           onChange={(e) => updateTemplate(t.id, { content: e.target.value })}
                           placeholder="Markdown structure here..."
                        />
                        <div className="text-xs font-medium text-text-secondary mt-2 mb-1">Assigned Folders</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {Object.entries(autoStructure.folderTemplates).filter(([f, tid]) => tid === t.id).map(([f]) => {
                             const col = collections.find(c => c.id === f);
                             return (
                               <span key={f} className="inline-flex items-center gap-1 bg-surface-active px-2 py-1 rounded text-xs">
                                 <Folder size={10} /> {col ? col.name : 'Unknown folder'}
                                 <button onClick={() => removeFolderAssignment(f)} className="hover:text-red-400 ml-1"><Trash2 size={10} /></button>
                               </span>
                             )
                          })}
                        </div>
                        <select 
                           className="w-full bg-surface-active border border-border text-xs rounded p-1 outline-none focus:border-accent mt-1"
                           onChange={(e) => {
                             if (e.target.value) {
                                assignTemplateFolder(t.id, e.target.value);
                                e.target.value = "";
                             }
                           }}
                        >
                          <option value="">Assign to folder...</option>
                          {collections.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={addTemplate} className="w-full flex justify-center items-center gap-1 py-2 border border-dashed border-border rounded-lg text-xs font-medium text-text-muted hover:text-white hover:border-accent transition-colors">
                  <Plus size={14} /> New Template
                </button>
              </div>
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
             <button
              onClick={() => setExpandedSection(expandedSection === "placeholders" ? null : "placeholders")}
              className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <span>Placeholders</span>
              {expandedSection === "placeholders" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {expandedSection === "placeholders" && (
               <div className="p-3 border-t border-border bg-surface/50 space-y-3">
                 <div className="text-xs font-medium text-text-muted">Smart Placeholders</div>
                 <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_PLACEHOLDERS.map(p => (
                       <label key={p} className="flex items-center gap-2 cursor-pointer p-2 bg-surface border border-border rounded-lg hover:border-accent">
                         <input 
                           type="checkbox" 
                           checked={autoStructure.activePlaceholders[p]}
                           onChange={(e) => togglePlaceholder(p, e.target.checked)}
                           className="rounded bg-surface-active border-border text-orange-500 focus:ring-orange-500"
                         />
                         <span className="text-xs font-mono">{p}</span>
                       </label>
                    ))}
                 </div>
                 
                 <div className="text-xs font-medium text-text-muted mt-4">Custom Placeholders</div>
                 <div className="space-y-2">
                   {Object.entries(autoStructure.customPlaceholders).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <div className="bg-surface border border-border p-1.5 rounded-md text-xs font-mono w-1/3">
                          {`{{${k}}}`}
                        </div>
                        <input 
                          type="text"
                          value={v}
                          onChange={(e) => updateCustomPlaceholder(k, e.target.value)}
                          className="bg-surface border border-border p-1.5 rounded-md text-xs flex-1 outline-none focus:border-accent"
                          placeholder="Value"
                        />
                        <button onClick={() => deleteCustomPlaceholder(k)} className="p-1.5 text-red-500 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                   ))}
                   <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="text"
                        value={newCustomKey}
                        onChange={(e) => setNewCustomKey(e.target.value)}
                        placeholder="placeholderName"
                        className="bg-surface border border-border p-1.5 rounded-md text-xs w-1/3 outline-none focus:border-accent"
                      />
                      <button 
                        onClick={() => {
                          if (newCustomKey && !autoStructure.customPlaceholders[newCustomKey]) {
                            updateCustomPlaceholder(newCustomKey, "");
                            setNewCustomKey("");
                          }
                        }}
                        className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md flex items-center justify-center transition-colors px-3 font-medium text-xs"
                      >
                         Add
                      </button>
                   </div>
                 </div>
               </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
