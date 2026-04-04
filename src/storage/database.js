const DB_NAME = 'conteur-db-v4';
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
export const getStories = getAllStories; // alias de compatibilité
export const saveStory = story => tx('stories', 'readwrite', s => s.put(story));
export const getLibrary = () => tx('library', 'readonly', s => s.getAll());
export const saveToLibrary = session => tx('library', 'readwrite', s => s.add(session));

export async function bootstrapStories() {
  try {
    const data = await fetch('./assets/default_stories.json', { cache: 'no-store' }).then(r => r.json());
    await Promise.all(data.map(saveStory));
  } catch {}
  return getAllStories();
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
    (payload.stories || []).forEach(s => stories.put(s));
    (payload.library || []).forEach(s => library.add(s));
    tr.oncomplete = resolve;
    tr.onerror = () => reject(tr.error);
  });
}

export const importLibraryAdventure = item => saveToLibrary(item);
