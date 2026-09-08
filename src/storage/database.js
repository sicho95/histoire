import { buildReviewPackage, harmonizeCreatedStoryOpening, normalizeStory, storyToPortable, validateStory } from '../core/story-model.js';

const DB_NAME = 'histoires-pwa-v2';
const DB_VERSION = 1;
const STORES = ['stories', 'drafts', 'adventures', 'meta'];
let dbPromise;

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('adventures')) db.createObjectStore('adventures', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(store, mode, operation) {
  const db = await openDb();
  const transaction = db.transaction(store, mode);
  return request(operation(transaction.objectStore(store)));
}

async function putAll(store, values) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    for (const value of values) objectStore.put(value);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export const getAllStories = () => withStore('stories', 'readonly', store => store.getAll());
export const getStories = getAllStories;
export const getDrafts = async () => (await withStore('drafts', 'readonly', store => store.getAll())).map(harmonizeCreatedStoryOpening);
export const getLibrary = () => withStore('adventures', 'readonly', store => store.getAll());
export const getStory = id => withStore('stories', 'readonly', store => store.get(id));
export const deleteDraft = id => withStore('drafts', 'readwrite', store => store.delete(id));

export async function saveStory(input, meta = {}) {
  const result = validateStory(normalizeStory(input, meta));
  if (!result.ok) throw new Error(`Histoire invalide : ${result.errors.join(' ')}`);
  result.story.status = meta.status || result.story.status || 'published';
  await withStore('stories', 'readwrite', store => store.put(result.story));
  return result.story;
}

export async function saveDraft(input, context = null) {
  const story = harmonizeCreatedStoryOpening(normalizeStory(input, { source: 'child-draft' }));
  const draft = {
    ...story,
    status: 'draft',
    creationContext: context || input.creationContext || null,
    updatedAt: new Date().toISOString()
  };
  await withStore('drafts', 'readwrite', store => store.put(draft));
  return draft;
}

export async function saveToLibrary(session) {
  const saved = {
    ...session,
    id: session.id || `aventure-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: session.savedAt || new Date().toISOString()
  };
  await withStore('adventures', 'readwrite', store => store.put(saved));
  return saved;
}

export async function syncPublishedStories({ force = false } = {}) {
  const catalogResponse = await fetch(`./stories/catalog.json${force ? `?v=${Date.now()}` : ''}`, { cache: 'no-store' });
  if (!catalogResponse.ok) throw new Error('Le catalogue GitHub est momentanément indisponible.');
  const catalog = await catalogResponse.json();
  const current = new Map((await getAllStories()).map(story => [story.id, story]));
  const synced = [];
  const publishedIds = new Set((catalog.stories || []).map(entry => entry.id));
  const obsoleteIds = [...current.keys()].filter(id => !publishedIds.has(id));

  if (obsoleteIds.length) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('stories', 'readwrite');
      const store = transaction.objectStore('stories');
      obsoleteIds.forEach(id => store.delete(id));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  for (const entry of catalog.stories || []) {
    const existing = current.get(entry.id);
    if (!force && existing && Number(existing.revision) >= Number(entry.revision || 1)) continue;
    const response = await fetch(`./stories/${entry.file}?revision=${entry.revision || 1}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Impossible de télécharger « ${entry.title || entry.id} ».`);
    synced.push(await saveStory(await response.json(), { source: 'github', revision: entry.revision, status: 'published' }));
  }

  await withStore('meta', 'readwrite', store => store.put({
    key: 'catalog',
    revision: catalog.revision || 1,
    syncedAt: new Date().toISOString()
  }));
  return { catalog, synced, removed: obsoleteIds.length };
}

export async function bootstrapStories() {
  try { await syncPublishedStories(); } catch (error) { console.warn(error.message); }
  return getAllStories();
}

export async function exportAllData() {
  return {
    exportVersion: 2,
    exportedAt: new Date().toISOString(),
    stories: (await getAllStories()).map(storyToPortable),
    drafts: (await getDrafts()).map(storyToPortable),
    adventures: await getLibrary()
  };
}

export async function importAllData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Fichier de sauvegarde invalide.');
  const stories = (payload.stories || []).map(story => normalizeStory(story, { source: story.source || 'import' }));
  const drafts = (payload.drafts || []).map(story => normalizeStory(story, { source: 'child-draft' }));
  await putAll('stories', stories);
  await putAll('drafts', drafts);
  await putAll('adventures', payload.adventures || payload.library || []);
}

export const importStory = story => saveDraft(story);
export const exportStory = async id => (await getStory(id)) || withStore('drafts', 'readonly', store => store.get(id));
export const importLibraryAdventure = item => saveToLibrary(item);
export const loadExternalStories = syncPublishedStories;

export async function exportDraftForReview(id, notes = '') {
  const draft = await withStore('drafts', 'readonly', store => store.get(id));
  if (!draft) throw new Error('Brouillon introuvable.');
  return buildReviewPackage(draft, {
    notes,
    creationContext: draft.creationContext || null,
    playedPath: draft.playedPath || []
  });
}

export { STORES };
