import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker
import { registerSW } from 'virtual:pwa-register';

// Aggressive cache clearing for development/refresh
if ('caches' in window) {
  caches.keys().then((names) => {
    // Clear all caches to force a fresh load
    names.forEach(name => {
      if (name.includes('google-fonts-cache') || name.includes('gstatic-fonts-cache')) return;
      caches.delete(name);
    });
  });
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatically force update if there's a new version
    updateSW(true);
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
