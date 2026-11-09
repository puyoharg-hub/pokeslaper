const SPRITE_CACHE = 'pokeslaper-sprite-cache-v1';

const CACHEABLE_HOSTS = [
  'archives.bulbagarden.net',
  'raw.githubusercontent.com',
];

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;
  try {
    const url = new URL(request.url);
    return CACHEABLE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheableRequest(request)) return;

  event.respondWith(
    caches.open(SPRITE_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      cache.put(request, response.clone());
      return response;
    })
  );
});
