import React, { useState, useEffect } from 'react';
import { Github, Save, RefreshCw, UploadCloud, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Settings } from '../types';
import { getGithubToken, setGithubToken, testGithubConnection, getPendingPushCount, pushToGithub } from '../lib/githubSync';
import { useStorage } from '../context/StorageContext';

export const GithubSyncSettingsPanel: React.FC<{
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
}> = ({ settings, updateSettings }) => {
  const { data } = useStorage();
  const [token, setToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const githubSync = settings.githubSync || {
    enabled: false,
    repository: "",
    branch: "main",
    pullOnStartup: false,
    syncInterval: 0
  };
  
  const pendingCount = getPendingPushCount(data, githubSync.lastSyncTime);
  
  useEffect(() => {
    getGithubToken().then(t => {
      if (t) setToken("••••••••••••••••••••••••••••••••••••••••"); // Masked
    });
  }, []);

  const handleConnect = async () => {
    if (!githubSync.repository) {
      setErrorMsg("Please enter a repository (owner/repo)");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsConnecting(true);
    
    try {
      const realToken = token.startsWith("••••") ? await getGithubToken() : token;
      if (!realToken) throw new Error("Please enter a personal access token");
      
      await testGithubConnection(githubSync.repository, githubSync.branch, realToken);
      
      if (!token.startsWith("••••")) {
        await setGithubToken(token);
        setToken("••••••••••••••••••••••••••••••••••••••••");
      }
      
      updateSettings({
        githubSync: {
          ...githubSync,
          enabled: true,
          error: undefined
        }
      });
      setSuccessMsg("Connected to GitHub repository!");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to connect to GitHub");
      updateSettings({
        githubSync: {
          ...githubSync,
          enabled: false,
          error: e.message
        }
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSync = async () => {
    if (!githubSync.enabled) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIsSyncing(true);
    
    try {
      const pushedCount = await pushToGithub(data, githubSync);
      const newSyncTime = new Date().toISOString();
      
      updateSettings({
        githubSync: {
          ...githubSync,
          lastSyncTime: newSyncTime,
          error: undefined
        }
      });
      
      setSuccessMsg(`Pushed ${pushedCount} notes to GitHub!`);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to sync to GitHub");
      updateSettings({
        githubSync: {
          ...githubSync,
          error: e.message
        }
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const disconnect = async () => {
    await setGithubToken("");
    setToken("");
    updateSettings({
      githubSync: {
        ...githubSync,
        enabled: false,
        repository: "",
        lastSyncTime: undefined
      }
    });
    setSuccessMsg("Disconnected from GitHub");
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-text-muted uppercase flex items-center gap-2">
        <Github size={14} /> GitHub Sync
      </h4>
      <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
        
        {githubSync.enabled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                <CheckCircle2 size={16} /> Connected to {githubSync.repository}
              </div>
              <button 
                onClick={disconnect}
                className="text-xs text-text-muted hover:text-red-400"
              >
                Disconnect
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded p-3 border border-border">
                <div className="text-xs text-text-muted flex items-center gap-1 mb-1">
                  <Clock size={12} /> Last Sync
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {githubSync.lastSyncTime ? new Date(githubSync.lastSyncTime).toLocaleString() : 'Never'}
                </div>
              </div>
              <div className="bg-background rounded p-3 border border-border">
                <div className="text-xs text-text-muted flex items-center gap-1 mb-1">
                  <UploadCloud size={12} /> Pending Push
                </div>
                <div className="text-sm font-medium text-amber-500">
                  {pendingCount} note{pendingCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            
            {githubSync.error && (
               <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-xs flex items-start gap-2 border border-red-500/20">
                 <AlertCircle size={14} className="mt-0.5 shrink-0" />
                 <div>{githubSync.error}</div>
               </div>
            )}
            
            {successMsg && (
               <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-lg text-xs border border-emerald-500/20">
                 {successMsg}
               </div>
            )}
            
            <button
              onClick={handleManualSync}
              disabled={isSyncing || pendingCount === 0}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : pendingCount > 0 ? `Push ${pendingCount} notes now` : "All notes synced"}
            </button>
            
            <div className="pt-3 border-t border-border space-y-3">
               <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Pull on Startup</span>
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={githubSync.pullOnStartup} onChange={e => {
                       updateSettings({ githubSync: { ...githubSync, pullOnStartup: e.target.checked } });
                    }} />
                    <div className="w-9 h-5 bg-surface-active border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </div>
               </label>
               
               <div className="flex flex-col gap-1.5">
                  <label className="text-sm">Scheduled Push Interval</label>
                  <select 
                    value={githubSync.syncInterval}
                    onChange={e => updateSettings({ githubSync: { ...githubSync, syncInterval: parseInt(e.target.value) } })}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-accent"
                  >
                    <option value={0}>Manual Only</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={60}>Every 1 hour</option>
                    <option value={360}>Every 6 hours</option>
                    <option value={1440}>Every 24 hours</option>
                  </select>
               </div>
            </div>
            
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-text-muted space-y-2 mb-4 bg-background p-3 rounded border border-border">
              <p className="font-semibold text-text-primary">How to connect GitHub Sync:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to GitHub Settings &gt; Developer settings &gt; Personal access tokens &gt; Tokens (classic)</li>
                <li>Generate new token with `repo` scope</li>
                <li>Create an empty repository on GitHub</li>
                <li>Fill in the details below to connect</li>
              </ol>
            </div>
          
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Repository</label>
                <input
                  type="text"
                  placeholder="username/repo"
                  value={githubSync.repository}
                  onChange={e => updateSettings({ githubSync: { ...githubSync, repository: e.target.value } })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Branch</label>
                <input
                  type="text"
                  placeholder="main"
                  value={githubSync.branch}
                  onChange={e => updateSettings({ githubSync: { ...githubSync, branch: e.target.value } })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Personal Access Token</label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-[10px] text-text-muted mt-0.5">Token is stored securely in IndexedDB only.</p>
              </div>
            </div>
            
            {errorMsg && (
               <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-xs flex items-start gap-2 border border-red-500/20">
                 <AlertCircle size={14} className="mt-0.5 shrink-0" />
                 <div>{errorMsg}</div>
               </div>
            )}
            
            {successMsg && (
               <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-lg text-xs border border-emerald-500/20">
                 {successMsg}
               </div>
            )}
            
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium text-sm py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isConnecting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Connect & Validate
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
