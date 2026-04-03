const DB_NAME = 'conteur-db-v3';
const DB_VERSION = 1;
let dbPromise;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function tx(store, mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tr = db.transaction(store, mode);
    const st = tr.objectStore(store);
    const req = fn(st);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
export const getAllStories = () => tx('stories', 'readonly', s => s.getAll());
export const saveStory = story => tx('stories', 'readwrite', s => s.put(story));
export const getStory = id => tx('stories', 'readonly', s => s.get(id));
export const getLibrary = () => tx('library', 'readonly', s => s.getAll());
export const saveToLibrary = session => tx('library', 'readwrite', s => s.add(session));
export const deleteLibraryItem = id => tx('library', 'readwrite', s => s.delete(id));
async function fetchDefaults() {
  const response = await fetch('./assets/default_stories.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Impossible de charger les histoires par défaut');
  return response.json();
}
export async function bootstrapStories() {
  const existing = await getAllStories();
  try {
    const defaults = await fetchDefaults();
    await Promise.all(defaults.map(saveStory));
  } catch {}
  const merged = await getAllStories();
  return merged.length ? merged : existing;
}
export async function exportAllData() {
  return { stories: await getAllStories(), library: await getLibrary() };
}
export async function importAllData(payload) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tr = db.transaction(['stories', 'library'], 'readwrite');
    const stories = tr.objectStore('stories');
    const library = tr.objectStore('library');
    stories.clear();
    library.clear();
    (payload.stories || []).forEach(item => stories.put(item));
    (payload.library || []).forEach(item => library.add(item));
    tr.oncomplete = resolve;
    tr.onerror = () => reject(tr.error);
  });
}
export async function importLibraryAdventure(item) {
  return saveToLibrary(item);
}
