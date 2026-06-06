import React, { useEffect, useState } from "react";
import { Settings, ExternalApiKey } from "../types";
import { Plus, Trash2, Key, Activity } from "lucide-react";
import { generateId } from "../lib/utils";
import { useStorage } from "../context/StorageContext";

export const ApiKeysSettingsPanel: React.FC<{
  localSettings: Settings;
  setLocalSettings: React.Dispatch<React.SetStateAction<Settings>>;
}> = ({ localSettings, setLocalSettings }) => {
  const { data } = useStorage();
  const apiKeys = localSettings.apiKeys || [];
  
  const ensureLegacyKeyMigrated = () => {
    if (localSettings.geminiApiKey && apiKeys.length === 0) {
      setLocalSettings(s => ({
        ...s,
        apiKeys: [{ id: "legacy", name: "Default API Key", key: s.geminiApiKey as string }],
        geminiApiKey: undefined
      }));
    }
  };

  useEffect(() => {
    ensureLegacyKeyMigrated();
  }, []);

  const addApiKey = () => {
    if (apiKeys.length >= 4) return;
    setLocalSettings(s => ({
      ...s,
      apiKeys: [...(s.apiKeys || []), { id: generateId(), name: `API Key ${(s.apiKeys?.length || 0) + 1}`, key: "" }]
    }));
  };

  const updateKey = (id: string, field: keyof ExternalApiKey, value: string) => {
    setLocalSettings(s => ({
      ...s,
      apiKeys: s.apiKeys?.map(k => k.id === id ? { ...k, [field]: value } : k)
    }));
  };

  const removeKey = (id: string) => {
    setLocalSettings(s => ({
      ...s,
      apiKeys: s.apiKeys?.filter(k => k.id !== id)
    }));
  };

  const handleVerify = async (key: string, id: string) => {
    if (!key) return;
    const { fetchEmbedding } = await import('../lib/ai');
    const el = document.getElementById(`apiKeyMessage-${id}`);
    if (el) el.textContent = "Verifying...";
    const res = await fetchEmbedding("test", key);
    if (el) {
      if (res) el.textContent = "✅ Valid API Key";
      else el.textContent = "❌ Invalid API Key format or network error";
    }
  };

  const updateFeatureMap = (feature: 'embeddingKeyId' | 'chatKeyId' | 'digestKeyId' | 'editorKeyId', keyId: string) => {
    setLocalSettings(s => ({
      ...s,
      featureApiConfigs: {
        ...(s.featureApiConfigs || {}),
        [feature]: keyId
      }
    }));
  };

  const getFeatureSelection = (feature: 'embeddingKeyId' | 'chatKeyId' | 'digestKeyId' | 'editorKeyId') => {
    return localSettings.featureApiConfigs?.[feature] || (apiKeys[0]?.id || "");
  };
  
  const getUsage = (keyId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const u = data.settings.apiUsageByKey?.[keyId] || (keyId === 'legacy' ? data.settings.apiUsage : undefined);
    if (u?.date === today) {
       return (u.embeddingCount || 0) + (u.answerCount || 0) + (u.digestCount || 0) + (u.editorCount || 0);
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface p-4 rounded-xl border border-border">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-medium flex items-center gap-2"><Key size={16}/> API Keys Management</h4>
          {apiKeys.length < 4 && (
             <button onClick={addApiKey} className="flex items-center gap-1 px-2 py-1 bg-surface-active hover:bg-surface-hover rounded text-xs transition-colors border border-border">
                <Plus size={12}/> Add Key
             </button>
          )}
        </div>
        
        {apiKeys.length === 0 ? (
           <div className="text-center p-4 bg-background rounded-lg border border-border mt-2">
             <p className="text-sm text-text-muted mb-3">No API keys found. Add a Google AI Studio API key to enable AI features.</p>
             <button onClick={addApiKey} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">Add API Key</button>
           </div>
        ) : (
           <div className="space-y-4">
             {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="bg-background rounded-lg p-3 border border-border">
                   <div className="flex justify-between items-center mb-2 gap-2">
                      <input 
                        className="bg-transparent text-sm font-medium focus:outline-none border-b border-transparent focus:border-border w-1/2"
                        value={apiKey.name}
                        onChange={(e) => updateKey(apiKey.id, 'name', e.target.value)}
                        placeholder="Key Name"
                      />
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-text-muted flex items-center gap-1 bg-surface-active px-2 py-1 rounded">
                           <Activity size={12}/> {getUsage(apiKey.id)} / 1400 today
                        </div>
                        <button onClick={() => removeKey(apiKey.id)} className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors">
                           <Trash2 size={14}/>
                        </button>
                      </div>
                   </div>
                   <input
                     type="password"
                     value={apiKey.key}
                     onChange={(e) => updateKey(apiKey.id, 'key', e.target.value)}
                     placeholder="AI Studio Free API Key..."
                     className="bg-surface border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-full mb-2"
                   />
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={() => handleVerify(apiKey.key, apiKey.id)}
                       className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded font-medium transition-colors border border-blue-500/20"
                     >
                       Verify Key
                     </button>
                     <span id={`apiKeyMessage-${apiKey.id}`} className="text-xs font-mono text-text-muted"></span>
                   </div>
                </div>
             ))}
           </div>
        )}
      </div>

      {apiKeys.length > 0 && (
        <div className="bg-surface p-4 rounded-xl border border-border">
             <h4 className="text-sm font-medium mb-4">Feature API Mapping</h4>
             <p className="text-xs text-text-muted mb-4">Select which API key to use for specific features to distribute rate limits.</p>
             <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'embeddingKeyId', label: 'Brain Embeddings' },
                  { id: 'chatKeyId', label: 'Ask Second Brain Chat' },
                  { id: 'digestKeyId', label: 'Daily Digest' },
                  { id: 'editorKeyId', label: 'Editor AI formatting' }
                ].map(f => (
                   <div key={f.id} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium">{f.label}</label>
                      <select 
                         value={getFeatureSelection(f.id as any)}
                         onChange={(e) => updateFeatureMap(f.id as any, e.target.value)}
                         className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      >
                         {apiKeys.map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                         ))}
                      </select>
                   </div>
                ))}
             </div>
        </div>
      )}
    </div>
  );
};
