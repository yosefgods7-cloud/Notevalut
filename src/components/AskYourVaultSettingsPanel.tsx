import React, { useState } from "react";
import { Settings, AskYourVaultSettings } from "../types";
import { ChevronDown, ChevronRight, Brain, Activity } from "lucide-react";

interface Props {
  settings: Settings;
  onUpdate: (updater: (s: Settings) => Settings) => void;
  apiUsage: Settings['apiUsage'];
}

export const AskYourVaultSettingsPanel: React.FC<Props> = ({ settings, onUpdate, apiUsage }) => {
  const [expanded, setExpanded] = useState(false);

  const ayvSettings: AskYourVaultSettings = settings.plugins?.askYourVault || {
    enabled: true,
    sourceNotesCount: 5,
    conversationMode: true,
  };

  const updateAYV = (updates: Partial<AskYourVaultSettings>) => {
    onUpdate((s) => ({
      ...s,
      plugins: {
        ...s.plugins,
        askYourVault: {
          ...(s.plugins?.askYourVault || ayvSettings),
          ...updates,
        },
      },
    }));
  };

  const today = new Date().toISOString().split('T')[0];
  const isToday = apiUsage?.date === today;
  const vaultUsage = isToday ? (apiUsage.embeddingCount || 0) + (apiUsage.answerCount || 0) : 0;
  const otherUsage = isToday ? (apiUsage.digestCount || 0) + (apiUsage.editorCount || 0) : 0;
  const totalUsage = vaultUsage + otherUsage;

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover text-sm font-medium transition-colors"
        >
          <div className="flex items-center gap-2">
            <Brain size={16} />
            <span>Ask Your Vault</span>
          </div>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {expanded && (
          <div className="p-4 border-t border-border bg-surface/50 space-y-6">
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="text-sm font-medium group-hover:text-white transition-colors">Enable Ask Your Vault</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Chat with your entire note collection
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ayvSettings.enabled}
                  onChange={(e) => updateAYV({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
              </div>
            </label>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium block">Source Notes Count</label>
              <div className="text-xs text-text-muted mb-2">How many notes should the AI use to answer your questions?</div>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={ayvSettings.sourceNotesCount}
                  onChange={(e) => updateAYV({ sourceNotesCount: parseInt(e.target.value) || 5 })}
                  className="flex-1 accent-accent"
                />
                <span className="text-sm font-medium w-6 text-center">{ayvSettings.sourceNotesCount}</span>
              </div>
            </div>

            <label className="flex items-center justify-between cursor-pointer group pt-2 border-t border-border">
              <div>
                <div className="text-sm font-medium group-hover:text-white transition-colors">Conversation Mode</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Maintain context for follow-up questions
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ayvSettings.conversationMode}
                  onChange={(e) => updateAYV({ conversationMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
              </div>
            </label>

            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-sm text-text-primary font-medium">
                <Activity size={16} className={totalUsage > 1300 ? "text-orange-400" : "text-text-muted"} />
                <span>API Usage Breakdown</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-surface p-2 rounded border border-border flex flex-col justify-between">
                  <span className="text-text-muted">Ask Your Vault</span>
                  <span className="font-semibold text-lg">{vaultUsage}</span>
                </div>
                <div className="bg-surface p-2 rounded border border-border flex flex-col justify-between">
                  <span className="text-text-muted">Other Features</span>
                  <span className="font-semibold text-lg">{otherUsage}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs pt-1">
                 <span className="text-text-muted">Total Today:</span>
                 <span className={totalUsage > 1300 ? "text-orange-400 font-medium" : "font-medium"}>
                   {totalUsage} / 1500
                 </span>
              </div>
            </div>
            
            {totalUsage > 1300 && (
               <div className="text-xs text-orange-400 bg-orange-400/10 p-2 rounded border border-orange-400/20">
                  Approaching the safe limit of 1400 Daily Free Tool calls. Wait until tomorrow for more AI usage.
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
