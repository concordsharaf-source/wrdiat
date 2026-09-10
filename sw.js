const CACHE_NAME = 'wrdiat-offline-v22';
const ICON = './images/icon-192x192.png';
const APP_URL = './index.html';
const APP_SHELL = [
  './', './index.html', './config.js', './tw.css', './fonts.css',
  './firebase-app.js', './firebase-database.js', './manifest.json',
  './images/icon-192x192.png', './images/icon-512x512.png',
  './fonts/tajawal-400.ttf', './fonts/tajawal-700.ttf'
];
self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(APP_SHELL); }).catch(function() {}));
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(function(response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request, { ignoreSearch: true }).then(function(cached) {
        return cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : cached);
      });
    })
  );
});
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
