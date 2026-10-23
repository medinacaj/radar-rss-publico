/* Radar RSS — lectura sin conexión.
   Estrategia: primero la red (siempre lo más reciente); si no hay conexión, la última
   copia guardada. Solo se guardan archivos del propio sitio, nunca imágenes ni enlaces externos.
   Las URL se guardan sin parámetros (?v=, ?check=) para que la caché no crezca sin límite. */
const CACHE = 'radar-rss-v28';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png',
  './styles.css', './editorial.css', './hashnode-preview.css', './radar-hybrid.css', './library.css',
  './sidebar-layout.css', './modal-layout.css', './news-effects.css', './sidebar-health.css', './ux.css', './features.css',
  './v12.css', './v13.css', './reading-ux.css', './app.js', './v12.js', './v13.js', './library.js', './sidebar-layout.js', './news-effects.js', './features.js',
  './feed-ux.js', './reader-ux.js',
  './data/latest.json', './data/sources.json', './data/status.json', './data/meta.json', './data/trends.json',
];

const keyFor = request => {
  const url = new URL(request.url);
  return url.origin + url.pathname;
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(path =>
    fetch(path, { cache: 'reload' }).then(res => res.ok ? cache.put(keyFor(new Request(path)), res) : null).catch(() => null)
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('radar-rss-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Never cache range requests or requests outside the app's own scope.
  if (request.headers.has('range') || request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' && !url.pathname.endsWith('/sw.js')) {
        event.waitUntil(cache.put(keyFor(request), response.clone()).catch(() => {}));
      }
      return response;
    } catch (error) {
      const cached = await cache.match(keyFor(request));
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await cache.match(keyFor(new Request('./index.html')));
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
