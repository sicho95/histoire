const DB_NAME = 'histoires-audio-v2';
const STORE = 'audio';
let dbPromise;
let manifestPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function operation(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export const getAudioCacheEntry = id => operation('readonly', store => store.get(id));
export const putAudioCacheEntry = entry => operation('readwrite', store => store.put(entry));
export const clearAudioCache = () => operation('readwrite', store => store.clear());
export const listAudioCacheEntries = () => operation('readonly', store => store.getAll());

export async function importCacheEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const entry of entries) {
    if (!entry?.id || !entry?.dataUrl) continue;
    await putAudioCacheEntry(entry);
    count += 1;
  }
  return count;
}

async function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('./audio/manifest.json', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return manifestPromise;
}

export async function getStaticAudio({ storyId, nodeId, textHash }) {
  if (!storyId || !nodeId) return null;
  const manifest = await getManifest();
  const track = manifest?.tracks?.[`${storyId}:${nodeId}`];
  if (!track?.file || track.textHash !== textHash) return null;
  try {
    const response = await fetch(`./audio/${track.file}`);
    return response.ok ? response.blob() : null;
  } catch {
    return null;
  }
}
