// A minimal IndexedDB-backed key/value cache for content that's safe to
// show stale, or serve entirely offline: static reference data that never
// varies per user and doesn't represent live campaign state. That's a
// narrow, deliberate carve-out — the service worker (public/sw.js) never
// caches /api/* responses at all, precisely because campaign data is live
// and server-backed, and showing a DM stale encounter/roster state mid-
// session would be worse than a clear network error. This module is for
// the opposite case: content like the 5e Compendium (spells, monsters,
// rules) that's identical for every request and safe to fall back to when
// offline. Callers opt in per-endpoint, one key at a time — this is not a
// general request cache or an offline write queue.

const DB_NAME = "spark-offline-cache";
const DB_VERSION = 1;
const STORE_NAME = "kv";

interface CacheRow<T> {
  key: string;
  data: T;
  cachedAt: string;
}

export interface CachedEntry<T> {
  data: T;
  cachedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open offline cache"));
  });
}

// Best-effort — a private-browsing tab, a full storage quota, or a browser
// without IndexedDB shouldn't break the app; callers just don't get a
// cached fallback next time.
export async function putCached<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const row: CacheRow<T> = { key, data, cachedAt: new Date().toISOString() };
      tx.objectStore(STORE_NAME).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to write offline cache"));
    });
    db.close();
  } catch {
    // ignored — see above
  }
}

export async function getCached<T>(key: string): Promise<CachedEntry<T> | null> {
  try {
    const db = await openDb();
    const result = await new Promise<CachedEntry<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const row = req.result as CacheRow<T> | undefined;
        resolve(row ? { data: row.data, cachedAt: row.cachedAt } : null);
      };
      req.onerror = () => reject(req.error ?? new Error("Failed to read offline cache"));
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
