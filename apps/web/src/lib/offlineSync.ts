"use client";

export interface OfflineMutation {
  id?: number;
  type: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  payload?: any;
  idempotency_key: string;
  createdAt: number;
  status: "pending" | "syncing" | "failed" | "completed";
  retryCount: number;
  lastError?: string;
}

const DB_NAME = "podacium_offline_v1";
const DB_VERSION = 1;
const STORE_NAME = "offline_sync_queue";

function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by_status", "status", { unique: false });
        store.createIndex("by_created_at", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Enqueue a mutation into IndexedDB to be synced when online.
 */
export async function enqueueOfflineMutation(
  item: Omit<
    OfflineMutation,
    "id" | "createdAt" | "status" | "retryCount" | "idempotency_key"
  > & {
    idempotency_key?: string;
  },
): Promise<OfflineMutation> {
  const db = await openSyncDB();
  const record: OfflineMutation = {
    ...item,
    idempotency_key: item.idempotency_key || generateUUID(),
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);

    req.onsuccess = (e) => {
      record.id = (e.target as IDBRequest).result as number;
      notifySyncListeners({ type: "MUTATION_ENQUEUED", mutation: record });
      registerBackgroundSync();
      resolve(record);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Register background sync with the service worker if supported.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Background Sync is not in lib.dom yet.
      const syncReg = reg as ServiceWorkerRegistration & {
        sync?: { register(tag: string): Promise<void> };
      };
      if (syncReg.sync) {
        await syncReg.sync.register("sync-offline-actions");
        return true;
      }
    } catch (_) {}
  }
  return false;
}

/**
 * Get all pending offline mutations.
 */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result as OfflineMutation[]) || [];
        resolve(results.filter((r) => r.status !== "completed"));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Get count of pending offline mutations.
 */
export async function getPendingCount(): Promise<number> {
  try {
    const pending = await getPendingMutations();
    return pending.length;
  } catch {
    return 0;
  }
}

/**
 * Foreground sync dispatcher that reads queued items and executes them via fetch.
 */
export async function syncPendingMutations(): Promise<{
  synced: number;
  failed: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getPendingMutations();
  if (items.length === 0) return { synced: 0, failed: 0 };

  const db = await openSyncDB();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.id) continue;

    try {
      // Mark as syncing
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ ...item, status: "syncing" });
        tx.oncomplete = () => resolve();
      });

      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.headers || {}),
          "X-Idempotency-Key": item.idempotency_key,
          "X-Offline-Synced-At": new Date().toISOString(),
        },
        body: item.payload ? JSON.stringify(item.payload) : undefined,
      });

      if (response.ok || response.status === 409) {
        // Successfully processed on backend
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.delete(item.id!);
          tx.oncomplete = () => resolve();
        });
        synced++;
        notifySyncListeners({
          type: "OFFLINE_SYNC_SUCCESS",
          id: item.id,
          idempotencyKey: item.idempotency_key,
          actionType: item.type,
        });
      } else if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        // Fatal client error: mark failed
        const errText = await response.text().catch(() => "Client Error");
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put({
            ...item,
            status: "failed",
            lastError: errText,
            retryCount: item.retryCount + 1,
          });
          tx.oncomplete = () => resolve();
        });
        failed++;
      } else {
        // 5xx / 429 / transient: revert to pending for next sync
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put({
            ...item,
            status: "pending",
            retryCount: item.retryCount + 1,
          });
          tx.oncomplete = () => resolve();
        });
        failed++;
      }
    } catch (err: any) {
      // Network drop during sync
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          ...item,
          status: "pending",
          lastError: err?.message,
          retryCount: item.retryCount + 1,
        });
        tx.oncomplete = () => resolve();
      });
      failed++;
    }
  }

  notifySyncListeners({ type: "SYNC_CYCLE_COMPLETED", synced, failed });
  return { synced, failed };
}

// ── Event Listener Infrastructure ──────────────────────────────────────────
type SyncEventCallback = (event: any) => void;
const listeners = new Set<SyncEventCallback>();

function notifySyncListeners(event: any) {
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch (_) {}
  });
}

export function subscribeToSyncEvents(callback: SyncEventCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Listen to Service Worker postMessages on active window
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "OFFLINE_SYNC_SUCCESS") {
      notifySyncListeners(event.data);
    }
  });
}
