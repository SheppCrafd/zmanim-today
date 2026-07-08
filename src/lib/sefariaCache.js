// Lightweight IndexedDB cache for Sefaria text segments.
// Sefaria texts are static (ancient source material), so cached entries have
// no expiry — once fetched, a ref loads instantly on every subsequent load.
// Falls back gracefully (no-ops) when IndexedDB is unavailable.

const DB_NAME = "sefaria-text-cache";
const DB_VERSION = 1;
const STORE = "texts";

let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function cacheGet(ref) {
  const db = await getDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(ref);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function cacheSet(ref, value) {
  const db = await getDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, ref);
    tx.onerror = () => {};
  } catch {
    /* ignore */
  }
}