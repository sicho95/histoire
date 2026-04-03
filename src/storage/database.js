
const DB_NAME = 'ConteurDB';
const DB_VERSION = 1;
let dbInstance = null;

export const initDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('stories')) db.createObjectStore('stories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = () => reject(req.error);
});

const executeTx = (storeName, mode, callback) => new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = callback(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

export const getStory = id => executeTx('stories', 'readonly', s => s.get(id));
export const getAllStories = () => executeTx('stories', 'readonly', s => s.getAll());
export const saveStory = story => executeTx('stories', 'readwrite', s => s.put(story));

export const getLibrary = () => executeTx('library', 'readonly', s => s.getAll());
export const saveToLibrary = session => executeTx('library', 'readwrite', s => s.put(session));
export const exportAllData = async () => {
    return { stories: await getAllStories(), library: await getLibrary() };
};
export const importAllData = async (data) => {
    const tx = dbInstance.transaction(['stories', 'library'], 'readwrite');
    data.stories?.forEach(st => tx.objectStore('stories').put(st));
    data.library?.forEach(lib => tx.objectStore('library').put(lib));
    return new Promise(r => tx.oncomplete = r);
};
