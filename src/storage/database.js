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

/** Importer / mettre à jour une histoire depuis un JSON externe */
export const importStory = story => tx('stories', 'readwrite', s => s.put(story));

/** Exporter une histoire par id (retourne l'objet complet) */
export const exportStory = id => tx('stories', 'readonly', s => s.get(id));

/**
 * Charger les histoires déclarées dans /stories/index.json
 * Format : ["castle.json","forest.json",…]
 * Chaque fichier est un story JSON standard.
 * Les histoires déjà présentes en IndexedDB ne sont pas écrasées.
 */
export async function loadExternalStories() {
  let index;
  try {
    const r = await fetch('./stories/index.json');
    if (!r.ok) return;
    index = await r.json();
  } catch { return; }
  const existing = await getAllStories();
  const existingIds = new Set(existing.map(s => s.id));
  const results = { loaded: 0, skipped: 0, errors: 0 };
  for (const filename of index) {
    try {
      const r = await fetch(`./stories/${filename}`);
      if (!r.ok) { results.errors++; continue; }
      const story = await r.json();
      if (!story?.id) { results.errors++; continue; }
      if (existingIds.has(story.id)) { results.skipped++; continue; }
      await importStory(story);
      results.loaded++;
    } catch { results.errors++; }
  }
  return results;
}
