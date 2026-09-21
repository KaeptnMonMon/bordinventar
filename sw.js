// Service Worker: legt beim ersten Besuch alle App-Dateien in den Cache und liefert sie danach
// ohne Netz aus.
//
// BEI JEDER ÄNDERUNG AN DER APP: CACHE hochzählen. Sonst bleibt am Handy still die alte
// Fassung stehen. Jede App-Datei muss in FILES stehen; bereitstellen.sh prüft das.

const CACHE = 'bordinventar-v13';

// Alle Adressen relativ, ohne führenden Schrägstrich: Die App liegt in einem Unterverzeichnis.
const FILES = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'seed.json',
  'js/main.js',
  'js/store.js',
  'js/model.js',
  'js/views.js',
  'js/plan.js',
  'js/zones.js',
  'js/html.js',
  'js/dialogs.js',
  'js/overlay.js',
  'js/exchange.js',
  'js/backup-page.js',
  'js/menu.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' umgeht den HTTP-Cache des Hostings; sonst landet im neuen Cache
    // womöglich noch die alte Datei.
    await Promise.all(FILES.map((file) => cache.add(new Request(file, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (error) {
      // Kein Netz und nicht im Cache: bei Seitenaufrufen die App selbst zeigen.
      if (request.mode === 'navigate') return caches.match('index.html');
      throw error;
    }
  })());
});
