
const DB_NAME = 'conteur_audio_cache_v1';
const STORE   = 'audio';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}
async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    fn(tx.objectStore(STORE), resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
}

export const getAudioCacheEntry   = id      => withStore('readonly',  (s, res) => { const r=s.get(id);     r.onsuccess=()=>res(r.result||null); });
export const putAudioCacheEntry   = entry   => withStore('readwrite', (s, res) => { s.put(entry);           res(true); });
export const clearAudioCache      = ()      => withStore('readwrite', (s, res) => { s.clear();              res(true); });
export const listAudioCacheEntries= ()      => withStore('readonly',  (s, res) => { const r=s.getAll();     r.onsuccess=()=>res(r.result||[]); });

/** Importer un tableau d'entrées (depuis un backup ZIP) — écrase si même id */
export async function importCacheEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let count   = 0;
    entries.forEach(e => { if (e?.id && e?.dataUrl) { store.put(e); count++; } });
    tx.oncomplete = () => resolve(count);
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Cherche un audio dans le dossier statique /audio/
 * → /audio/manifest.json  { "cacheKey": "filename.mp3", … }
 * → /audio/{filename}.mp3
 * Retourne un Blob ou null.
 */
let _manifest = null;
let _manifestLoaded = false;
export async function getStaticAudio(cacheId) {
  if (!_manifestLoaded) {
    _manifestLoaded = true;
    try {
      const r = await fetch('./audio/manifest.json');
      if (r.ok) _manifest = await r.json();
    } catch {}
  }
  if (!_manifest) return null;
  const filename = _manifest[cacheId];
  if (!filename) return null;
  try {
    const r = await fetch(`./audio/${filename}`);
    if (!r.ok) return null;
    return r.blob();
  } catch { return null; }
}
