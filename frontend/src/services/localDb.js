/**
 * localDb.js — IndexedDB wrapper for AnimeX offline video & subtitle storage.
 *
 * Store: "downloads"
 * Key: "id" (string)
 */

const DB_NAME = "animex_local_db";
const DB_VERSION = 1;
const STORE_NAME = "downloads";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this browser."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("animeTitle", "animeTitle", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("platform", "platform", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error("Failed to open IndexedDB"));
    };
  });

  return dbPromise;
}

/**
 * Save or update a downloaded episode in IndexedDB.
 * @param {Object} item
 *   id: string
 *   animeTitle: string
 *   episodeTitle: string
 *   episodeNumber: number | string
 *   platform: string
 *   thumbnail: string
 *   thumbnailBlob: Blob | null
 *   quality: string
 *   audioType: "sub" | "dub" | "all"
 *   segments: Blob[]
 *   segmentDurations: number[]
 *   subtitles: Array<{ label: string, lang: string, content: string, default: boolean }>
 *   totalSize: number
 *   duration: number
 *   createdAt: number
 *   isHls: boolean
 *   videoBlob?: Blob (for direct MP4)
 */
export async function saveDownload(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = (e) => reject(e.target.error || new Error("Failed to save download"));
  });
}

/**
 * Retrieve all downloaded episodes from IndexedDB, ordered by createdAt descending.
 * @returns {Promise<Array>}
 */
export async function getAllDownloads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(list);
    };
    request.onerror = (e) => reject(e.target.error || new Error("Failed to fetch downloads"));
  });
}

/**
 * Retrieve a single downloaded episode by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getDownloadById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error || new Error(`Failed to get download ${id}`));
  });
}

/**
 * Delete a downloaded episode from IndexedDB.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteDownload(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error || new Error(`Failed to delete download ${id}`));
  });
}

/**
 * Delete all downloaded episodes from IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function clearAllDownloads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = (e) => reject(e.target.error || new Error("Failed to clear downloads"));
  });
}

/**
 * Get storage estimate (usage and quota in bytes) if supported.
 * @returns {Promise<{ usage: number, quota: number, formattedUsage: string }>}
 */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usage,
        quota,
        formattedUsage: formatBytes(usage),
        formattedQuota: formatBytes(quota),
      };
    } catch (_) {}
  }

  // Fallback: calculate totalSize from items
  try {
    const items = await getAllDownloads();
    const usage = items.reduce((acc, it) => acc + (it.totalSize || 0), 0);
    return {
      usage,
      quota: 0,
      formattedUsage: formatBytes(usage),
      formattedQuota: "Unknown",
    };
  } catch (_) {
    return { usage: 0, quota: 0, formattedUsage: "0 B", formattedQuota: "Unknown" };
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
