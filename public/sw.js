const CACHE_NAME = 'notevault-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      if (response) return response;
      return fetch(e.request).then(res => {
        return caches.open(CACHE_NAME).then(cache => {
          if (e.request.method === 'GET' && e.request.url.startsWith('http')) {
            cache.put(e.request, res.clone());
          }
          return res;
        });
      });
    })
  );
});
