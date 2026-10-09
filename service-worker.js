const CACHE_NAME = 'stats-castellar-1.0.12-release-20261009';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/app.js',
  './js/home-pro2.js',
  './shared/pro2-core.bundle.js',
  './shared/ipad-frame.css',
  './shared/team-store.js',
  './shared/draft-store.js',
  './assets/escut-club.png',
  './assets/fons-horitzontal.png',
  './assets/fons-vertical.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('stats-castellar-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navegació: xarxa primer. Això fa que GitHub Pages mostri sempre
  // la versió publicada més recent; si no hi ha connexió, usa la cache.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
          return response;
        }
      } catch (_) {}

      return (await caches.match(event.request)) ||
             (await caches.match('./index.html')) ||
             (await caches.match('./'));
    })());
    return;
  }

  // Recursos de la pròpia app: cache primer i, si no hi són,
  // es descarreguen i queden guardats per a usos posteriors.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    })());
    return;
  }

  // Recursos externs: xarxa, amb fallback a cache si ja s'havien usat.
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw _;
    }
  })());
});
