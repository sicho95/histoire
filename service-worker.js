const BUILD_ID = '__BUILD_ID__';
const APP_CACHE = `histoires-app-${BUILD_ID}`;
const AUDIO_CACHE = 'histoires-audio-__AUDIO_STYLE_VERSION__';
const PRECACHE = __PRECACHE_MANIFEST__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('histoires-app-') && key !== APP_CACHE).map(key => caches.delete(key)));
    await Promise.all(keys.filter(key => key.startsWith('histoires-audio-') && key !== AUDIO_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallback = './index.html') {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh.ok) (await caches.open(APP_CACHE)).put(request, fresh.clone());
    return fresh;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (await caches.match(fallback));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then(async response => {
    if (response.ok) (await caches.open(APP_CACHE)).put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || refresh || Response.error();
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/audio/') && /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) {
    event.respondWith(caches.open(AUDIO_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (/\/(version\.json|stories\/.*\.json)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(event.request, './stories/catalog.json'));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});
