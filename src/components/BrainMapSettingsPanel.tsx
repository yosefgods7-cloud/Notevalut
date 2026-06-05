import React, { useState } from "react";
import { Settings, BrainMapSettings } from "../types";
import { Filter, ChevronDown, ChevronRight, X, User } from "lucide-react";

interface Props {
  settings: Settings;
  onUpdate: (updater: (s: Settings) => Settings) => void;
}

export const BrainMapSettingsPanel: React.FC<Props> = ({ settings, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);

  const bmSettings = settings.plugins?.brainMap || {
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
  };

  const updateBrainMap = (updates: Partial<BrainMapSettings>) => {
    onUpdate((s) => ({
      ...s,
      plugins: {
        ...s.plugins,
        brainMap: {
          ...(s.plugins?.brainMap || bmSettings),
          ...updates,
        },
      },
    }));
  };

  const updateDefaultFilters = (updates: Partial<BrainMapSettings["defaultFilters"]>) => {
    updateBrainMap({
      defaultFilters: {
        ...bmSettings.defaultFilters,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover text-sm font-medium transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} />
            <span>Brain Map View</span>
          </div>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {expanded && (
          <div className="p-4 border-t border-border bg-surface/50 space-y-4">
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="text-sm font-medium group-hover:text-white transition-colors">Remember Last Filter</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Automatically restore the last used graph filter upon reopening
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bmSettings.rememberLastFilter}
                  onChange={(e) => updateBrainMap({ rememberLastFilter: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </div>
            </label>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="text-sm font-medium">Non-Matching Nodes Behavior</div>
              <div className="text-xs text-text-muted mb-2">When a filter is active, how should non-matching nodes appear?</div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nonMatchingBehavior"
                    value="dim"
                    checked={bmSettings.nonMatchingBehavior === "dim"}
                    onChange={() => updateBrainMap({ nonMatchingBehavior: "dim" })}
                    className="text-orange-500 focus:ring-orange-500 bg-surface-active border-border"
                  />
                  <span className="text-sm">Dim (keep context)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nonMatchingBehavior"
                    value="hide"
                    checked={bmSettings.nonMatchingBehavior === "hide"}
                    onChange={() => updateBrainMap({ nonMatchingBehavior: "hide" })}
                    className="text-orange-500 focus:ring-orange-500 bg-surface-active border-border"
                  />
                  <span className="text-sm">Hide completely</span>
                </label>
              </div>
            </div>

             <div className="space-y-4 pt-2 border-t border-border">
              <div className="text-sm font-medium">Default Filters (On open)</div>
              
               <div className="space-y-2">
                 <div className="text-xs text-text-muted">Connection Types</div>
                 <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bmSettings.defaultFilters.connectionTypes.wikilinks}
                        onChange={(e) => updateDefaultFilters({ connectionTypes: { ...bmSettings.defaultFilters.connectionTypes, wikilinks: e.target.checked } })}
                        className="rounded bg-surface-active border-border text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xs">Wikilinks</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bmSettings.defaultFilters.connectionTypes.tags}
                        onChange={(e) => updateDefaultFilters({ connectionTypes: { ...bmSettings.defaultFilters.connectionTypes, tags: e.target.checked } })}
                        className="rounded bg-surface-active border-border text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xs">Tags</span>
                    </label>
                 </div>
               </div>
               
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
