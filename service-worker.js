const CACHE = 'conteur-v4';
const ASSETS = ['./','./index.html','./manifest.json','./service-worker.js','./css/variables.css','./css/layout.css','./css/components.css','./src/app.js','./src/ui/carousel.js','./src/ui/reader.js','./src/ui/library.js','./src/ui/parental.js','./src/ui/end_screen.js','./src/ui/wizard.js','./src/core/engine.js','./src/core/weaver.js','./src/core/state.js','./src/core/choices.js','./src/storage/database.js','./src/storage/settings.js','./src/audio/tts.js','./src/audio/stt.js','./src/api/router.js','./src/api/prompts.js','./assets/default_stories.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const appFile = url.origin === location.origin && (/\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/histoire/'));
  if (appFile) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
