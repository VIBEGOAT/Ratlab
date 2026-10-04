/**
 * Small IndexedDB cache so a study that has run once opens instantly next time (for example before
 * a pitch). Keys include the simulator version, so a model change never serves stale results.
 * Every call fails soft and fast: each operation closes its connection, and anything that takes
 * longer than TIMEOUT_MS (a blocked upgrade or delete in another tab) is treated as a cache miss.
 */
const DB = "eliminate-lab";
const STORE = "runs";
const TIMEOUT_MS = 1500;
const MAX_ENTRIES = 12;

function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close(); resolve(db); };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

export function cacheGet<T>(key: string): Promise<T | null> {
  return withTimeout((async () => {
    const db = await open();
    if (!db) return null;
    try {
      return await new Promise<T | null>((resolve) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      });
    } finally { db.close(); }
  })(), null);
}

export function cacheSet(key: string, value: unknown): Promise<void> {
  return withTimeout((async () => {
    const db = await open();
    if (!db) return;
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.put(value, key);
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => { const keys = keysReq.result; if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) store.delete(k); };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } finally { db.close(); }
  })(), undefined);
}
