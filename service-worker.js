const BUILD_ID = 'd613437ff6b1e9a7e08e372f8ea62aad3bd00e6f-3';
const APP_CACHE = `histoires-app-${BUILD_ID}`;
const AUDIO_CACHE = 'histoires-audio-v2';
const PRECACHE = ["./","./index.html","./manifest.json","./version.json","./css/variables.css","./css/layout.css","./css/components.css","./src/app.js","./src/pwa/update.js","./src/api/router.js","./src/api/prompts.js","./src/audio/stt.js","./src/audio/tts.js","./src/core/choices.js","./src/core/debug.js","./src/core/engine.js","./src/core/network.js","./src/core/state.js","./src/core/story-model.js","./src/core/weaver.js","./src/storage/audio_cache.js","./src/storage/database.js","./src/storage/settings.js","./src/ui/carousel.js","./src/ui/end_screen.js","./src/ui/library.js","./src/ui/parental.js","./src/ui/reader.js","./src/ui/wizard.js","./src/ui/toast.js","./assets/icons/icon.svg","./assets/icons/maskable.svg","./stories/catalog.json","./audio/manifest.json","./stories/ines-chateau-nuages.json","./stories/noa-gare-etoiles.json"];

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
