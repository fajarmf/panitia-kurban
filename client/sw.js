const CACHE_NAME = 'scanner-v1';
const ASSETS = [
  '/scanner.html',
  '/css/style.css',
  '/js/app.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests
  if (e.request.method !== 'GET') return;
  
  // Don't cache API requests
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
