import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker
import { registerSW } from 'virtual:pwa-register';

import { get } from 'idb-keyval';
import { db, auth } from './lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

// Request persistent storage on app launch
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    console.log('Persistent storage granted:', granted);
  });
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const preUpdateCheck = async () => {
      console.log('New app version detected, running pre-update checkpoint...');
      try {
        const user = auth.currentUser;
        if (user) {
          const STORAGE_KEY = "notevault_data";
          const rawData = await get(STORAGE_KEY);
          let localCount = 0;
          if (rawData) {
            try {
              const data = JSON.parse(rawData);
              localCount = data.notes?.length || 0;
            } catch(e) {}
          }
          
          const q = query(collection(db, `users/${user.uid}/notes`));
          const snap = await getDocs(q);
          const fbCount = snap.docs.length;
          
          if (localCount < fbCount) {
             console.warn(`[Pre-update strict check] Blocking SW update to preserve IndexedDB data. Local notes (${localCount}) < Firebase notes (${fbCount}).`);
             window.dispatchEvent(new CustomEvent('sw-update-blocked', { detail: { localCount, fbCount } }));
             return; // Abort update to prevent any risk to data
          }
        }
        
        console.log("[Pre-update strict check] Validation passed. Preserving IndexedDB data and proceeding with SW cache update.");
        updateSW(true);
      } catch (err) {
        console.error("SW pre-update checkpoint failed (offline?), updating SW anyway while preserving IndexedDB.", err);
        updateSW(true);
      }
    };
    
    preUpdateCheck();
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
