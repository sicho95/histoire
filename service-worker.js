
const CACHE = 'conteur-v3';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./','./index.html','./css/variables.css','./css/layout.css','./css/components.css','./src/app.js']))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
