const CACHE = 'conteur-v3';
const APP_ASSETS = [
  './', './index.html', './manifest.json', './service-worker.js',
  './css/variables.css', './css/layout.css', './css/components.css',
  './src/app.js', './src/ui/carousel.js', './src/ui/reader.js', './src/ui/library.js', './src/ui/parental.js', './src/ui/end_screen.js', './src/ui/wizard.js',
  './src/core/engine.js', './src/core/weaver.js', './src/core/state.js', './src/core/choices.js',
  './src/storage/database.js', './src/storage/settings.js', './src/audio/tts.js', './src/audio/stt.js', './src/api/router.js', './src/api/prompts.js',
  './assets/default_stories.json'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isAppFile = url.origin === location.origin && (/\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/histoire/'));
  if (isAppFile) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, copy));
    return res;
  })));
});
