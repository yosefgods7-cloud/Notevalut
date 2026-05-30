import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker
import { registerSW } from 'virtual:pwa-register';

// Request persistent storage on app launch
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    console.log('Persistent storage granted:', granted);
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
