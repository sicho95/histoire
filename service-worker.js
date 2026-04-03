const CACHE = 'conteur-v2';
const ASSETS = [
  './', './index.html', './manifest.json', './service-worker.js',
  './css/variables.css', './css/layout.css', './css/components.css',
  './src/app.js', './src/ui/carousel.js', './src/ui/reader.js', './src/ui/library.js', './src/ui/parental.js', './src/ui/end_screen.js',
  './src/core/engine.js', './src/core/weaver.js', './src/core/state.js', './src/core/choices.js',
  './src/storage/database.js', './src/storage/settings.js', './src/audio/tts.js', './src/audio/stt.js', './src/api/router.js', './src/api/prompts.js',
  './assets/default_stories.json'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return resp;
  }).catch(() => caches.match('./index.html'))));
});
