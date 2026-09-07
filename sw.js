/* Bump CACHE on every deploy or the phone keeps serving the old build. */
var CACHE = 'count-on-it-v2';

var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Cache-first: the app is seven static files and must open in airplane mode.
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;

  ev.respondWith(
    caches.match(ev.request).then(function (hit) {
      return hit || fetch(ev.request).then(function (res) {
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
