const CACHE_NAME = 'notevault-v2-clear';

self.addEventListener('install', e => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => caches.delete(cache)) // Delete absolutely all caches to fix the broken state
      );
    }).then(() => self.clients.claim()) // Take control of all open pages
  );
});

self.addEventListener('fetch', e => {
  // Always use the network and do NOT cache anything anymore
  e.respondWith(fetch(e.request));
});
