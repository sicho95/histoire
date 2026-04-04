const DB_NAME = 'conteur_audio_cache_v1';
const STORE = 'audio';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    fn(store, resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
}
export async function getAudioCacheEntry(id) { return withStore('readonly', (store, resolve) => { const req = store.get(id); req.onsuccess = () => resolve(req.result || null); }); }
export async function putAudioCacheEntry(entry) { return withStore('readwrite', (store, resolve) => { store.put(entry); resolve(true); }); }
export async function clearAudioCache() { return withStore('readwrite', (store, resolve) => { store.clear(); resolve(true); }); }
export async function listAudioCacheEntries() { return withStore('readonly', (store, resolve) => { const req = store.getAll(); req.onsuccess = () => resolve(req.result || []); }); }
