import React, { useState } from "react";
import { Settings, DailyDigestSettings } from "../types";
import { ChevronDown, ChevronRight, Sparkles, Activity } from "lucide-react";

interface Props {
  settings: Settings;
  onUpdate: (updater: (s: Settings) => Settings) => void;
  apiUsageCount: number;
}

export const DailyDigestSettingsPanel: React.FC<Props> = ({ settings, onUpdate, apiUsageCount }) => {
  const [expanded, setExpanded] = useState(false);

  const ddSettings: DailyDigestSettings = settings.plugins?.dailyDigest || {
    enabled: false,
    minNotesRequired: 3,
    timeOfDay: "09:00",
  };

  const updateDigest = (updates: Partial<DailyDigestSettings>) => {
    onUpdate((s) => ({
      ...s,
      plugins: {
        ...s.plugins,
        dailyDigest: {
          ...(s.plugins?.dailyDigest || ddSettings),
          ...updates,
        },
      },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-hover text-sm font-medium transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span>Daily AI Digest</span>
          </div>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {expanded && (
          <div className="p-4 border-t border-border bg-surface/50 space-y-6">
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="text-sm font-medium group-hover:text-white transition-colors">Enable Daily Digest</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Summarize your edited notes every morning
                </div>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ddSettings.enabled}
                  onChange={(e) => updateDigest({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </div>
            </label>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium block">Minimum Notes Edited</label>
              <div className="text-xs text-text-muted mb-2">Requires this many notes to be edited to generate a digest</div>
              <input 
                type="number"
                min="1"
                max="50"
                value={ddSettings.minNotesRequired}
                onChange={(e) => updateDigest({ minNotesRequired: parseInt(e.target.value) || 3 })}
                className="w-24 bg-surface border border-border rounded-lg text-sm px-3 py-2 text-text-primary focus:border-accent outline-none"
              />
            </div>

             <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium block">Generation Time</label>
              <div className="text-xs text-text-muted mb-2">When should the summary generate?</div>
              <input 
                type="time"
                value={ddSettings.timeOfDay}
                onChange={(e) => updateDigest({ timeOfDay: e.target.value })}
                className="w-32 bg-surface border border-border rounded-lg text-sm px-3 py-2 text-text-primary focus:border-accent outline-none"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <Activity size={16} className={apiUsageCount > 1300 ? "text-orange-400" : "text-text-muted"} />
                <span>Daily API Usage</span>
              </div>
              <span className={apiUsageCount > 1300 ? "text-orange-400 font-medium text-sm" : "text-sm text-text-muted"}>
                 {apiUsageCount} / 1500 limit
              </span>
            </div>
            {apiUsageCount > 1300 && (
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
