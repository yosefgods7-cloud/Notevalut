import React, { useEffect, useState } from "react";
import { AlertTriangle, X, CheckCircle } from "lucide-react";
import { keys, get, set } from "idb-keyval";

export const StorageDiagnosticBanner: React.FC = () => {
  const [dataToMigrateSummary, setDataToMigrateSummary] = useState<string | null>(null);
  const [localStorageUsageStr, setLocalStorageUsageStr] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  useEffect(() => {
    // Run diagnostics once on startup
    const checkStorage = async () => {
      let lsTotalSize = 0;
      let hasDataToMigrate = false;
      const issues: string[] = [];

      console.group("Storage Diagnostic");
      console.log("Checking localStorage vs IndexedDB allocations...");

      // Check LocalStorage
      console.log("--- LocalStorage ---");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key);
        if (!val) continue;

        const size = new Blob([val]).size;
        lsTotalSize += size;
        console.log(`[LS] ${key} - Size: ${(size / 1024).toFixed(2)} KB`);

        // Identify if there is content that should likely be in IndexedDB
        if (
          key.includes("notevault_history_") ||
          key.includes("note_content") ||
          key.includes("notevault_md_import_") ||
          key.includes("vault") ||
          key.includes("import") ||
          key.includes("backup")
        ) {
          hasDataToMigrate = true;
          issues.push(key);
        }
      }
      console.log(`Total localStorage Size: ${(lsTotalSize / 1024).toFixed(2)} KB`);

      if (hasDataToMigrate) {
        setIsVisible(true);
        setDataToMigrateSummary(
          `Detected persistent data in localStorage: ${issues.slice(0, 3).join(", ")}${
            issues.length > 3 ? ` and ${issues.length - 3} more` : ""
          }`
        );
        setLocalStorageUsageStr(
           `${(lsTotalSize / 1024).toFixed(2)} KB out of ~5000 KB (5MB limit)`
        );

        console.log("Starting automatic migration to IndexedDB...");
        for (const key of issues) {
          const val = localStorage.getItem(key);
          if (val) {
             let parsedVal = val;
             try {
               parsedVal = JSON.parse(val);
             } catch (e) {}
             await set(key, parsedVal);
             localStorage.removeItem(key);
             console.log(`Migrated ${key} to IndexedDB and cleared from localStorage.`);
          }
        }
        setMigrationSuccess(true);
      }

      // Check IndexedDB
      console.log("--- IndexedDB ---");
      try {
        let idbTotalSize = 0;
        const idbKeys = await keys();
        for (const key of idbKeys) {
           const val = await get(key);
           if (val) {
              const size = new Blob([typeof val === 'string' ? val : JSON.stringify(val)]).size;
              idbTotalSize += size;
              console.log(`[IDB] ${key.toString()} - Size: ${(size / 1024).toFixed(2)} KB`);
           }
        }
        console.log(`Total IndexedDB Size: ${(idbTotalSize / 1024).toFixed(2)} KB`);
      } catch (e) {
        console.error("Failed to read IndexedDB sizes:", e);
      }

      console.groupEnd();
    };

    checkStorage();
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-2xl border rounded-xl p-4 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-4 flex gap-4 items-start ${migrationSuccess ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-500/30 text-green-900 dark:text-green-100' : 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-500/30 text-orange-900 dark:text-orange-100'}`}>
       {migrationSuccess ? <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={24} /> : <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={24} />}
       <div className="flex-1 text-sm">
          <h3 className="font-semibold text-base mb-1">{migrationSuccess ? 'Storage Migration Complete' : 'Storage Migration Warning'}</h3>
          <p className="mb-2">
             {migrationSuccess 
                ? "All note content, vault backups, and imported files have been successfully migrated to IndexedDB. The 5MB localStorage limit will no longer affect your data."
                : "Note content, vault backups, or imported files were detected in browser localStorage. LocalStorage is strictly limited to 5MB and not suitable for large content."}
          </p>
          <div className={`${migrationSuccess ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/20' : 'bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/20'} rounded border p-2.5 mb-3 font-mono text-xs`}>
             <div className="font-semibold mb-1 opacity-80">{migrationSuccess ? 'Previous Usage:' : 'Current Usage:'}</div>
             <div className={`font-bold mb-1 ${migrationSuccess ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>{localStorageUsageStr}</div>
             <div className="line-clamp-2 opacity-75">
                {dataToMigrateSummary}
             </div>
          </div>
       </div>
       <button onClick={() => setIsVisible(false)} className={`p-1.5 rounded-md transition-colors shrink-0 ${migrationSuccess ? 'hover:bg-green-500/20' : 'hover:bg-orange-500/20'}`}>
          <X size={16} />
       </button>
    </div>
  );
};
