"use client";

import { useEffect, useCallback, useState, useRef } from "react";

const DB_NAME = "PodaciumVideoCacheDB";
const DB_VERSION = 2;
const STORE_NAME = "hls_segments";
const METADATA_STORE = "lesson_metadata";
const DEFAULT_MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB per device

export interface CachedSegment {
  url: string; // Normalized URL (stripped query tokens)
  rawUrl?: string;
  lessonId?: string;
  data: ArrayBuffer;
  timestamp: number;
  size: number;
}

export interface CachedLessonMetadata {
  lessonId: string;
  videoUrl: string;
  totalSize: number;
  downloadedAt: number;
  completed: boolean;
}

/**
 * Strip ephemeral query params (e.g. CloudFront/S3 signatures: Expires, Signature, Key-Pair-Id)
 * so refreshed signed URLs map reliably to the same cache entry.
 */
export function normalizeVideoUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, "https://podacium.local");
    // Strip common CDN signing query params
    const signatureParams = [
      "Expires",
      "Signature",
      "Key-Pair-Id",
      "token",
      "access_token",
      "h",
      "exp",
    ];
    for (const param of signatureParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.origin === "https://podacium.local"
      ? parsed.pathname
      : parsed.origin + parsed.pathname;
  } catch {
    return rawUrl.split("?")[0];
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
        store.createIndex("lessonId", "lessonId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "lessonId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function useOfflineVideoCache(
  maxQuotaBytes: number = DEFAULT_MAX_CACHE_BYTES,
) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [cachedLessons, setCachedLessons] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<
    Record<string, number>
  >({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>(
    {},
  );
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);
  const activeAbortControllers = useRef<Map<string, AbortController>>(
    new Map(),
  );

  // Evict least-recently-used segments until cache size is under 85% of quota
  const evictLRU = useCallback(
    async (requiredBytes: number): Promise<void> => {
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("timestamp");
        const targetSize = maxQuotaBytes * 0.85;

        // Iterate oldest to newest
        const req = index.openCursor(null, "next");
        let freedBytes = 0;

        await new Promise<void>((resolve, reject) => {
          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
              .result;
            if (cursor && cacheSize - freedBytes + requiredBytes > targetSize) {
              freedBytes += cursor.value.size || 0;
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn("[VideoCache] LRU Eviction failed:", err);
      }
    },
    [cacheSize, maxQuotaBytes],
  );

  const calculateTotalSize = useCallback(async (): Promise<number> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        let total = 0;

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor) {
            total += cursor.value.size || 0;
            cursor.continue();
          } else {
            setCacheSize(total);
            resolve(total);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return 0;
    }
  }, []);

  const refreshCachedLessons = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(METADATA_STORE, "readonly");
      const store = tx.objectStore(METADATA_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const metas = (req.result as CachedLessonMetadata[]) || [];
        const completedIds = metas
          .filter((m) => m.completed)
          .map((m) => m.lessonId);
        setCachedLessons(completedIds);
      };
    } catch {
      setCachedLessons([]);
    }
  }, []);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "indexedDB" in window;
    setIsSupported(supported);

    if (supported) {
      calculateTotalSize();
      refreshCachedLessons();

      // Safari/iOS Persistent Storage request
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }

      if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
        navigator.storage
          .estimate()
          .then((est) => {
            if (est.usage !== undefined && est.quota !== undefined) {
              setStorageEstimate({ usage: est.usage, quota: est.quota });
            }
          })
          .catch(() => {});
      }
    }
  }, [calculateTotalSize, refreshCachedLessons]);

  const storeSegment = useCallback(
    async (
      url: string,
      data: ArrayBuffer,
      lessonId?: string,
    ): Promise<boolean> => {
      try {
        const normalized = normalizeVideoUrl(url);
        const segmentSize = data.byteLength;

        // Check if eviction needed
        if (cacheSize + segmentSize > maxQuotaBytes) {
          await evictLRU(segmentSize);
        }

        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const record: CachedSegment = {
            url: normalized,
            rawUrl: url,
            lessonId,
            data,
            timestamp: Date.now(),
            size: segmentSize,
          };
          const req = store.put(record);
          req.onsuccess = () => {
            setCacheSize((prev) => prev + segmentSize);
            resolve(true);
          };
          req.onerror = () => reject(req.error);
        });
      } catch (err) {
        console.warn("Failed to store video segment in IndexedDB:", err);
        return false;
      }
    },
    [cacheSize, evictLRU, maxQuotaBytes],
  );

  const getSegment = useCallback(
    async (url: string): Promise<ArrayBuffer | null> => {
      try {
        const normalized = normalizeVideoUrl(url);
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(normalized);
          req.onsuccess = () => {
            const record = req.result as CachedSegment | undefined;
            if (record) {
              // Update last accessed timestamp (LRU touch)
              record.timestamp = Date.now();
              store.put(record);
              resolve(record.data);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const clearLessonCache = useCallback(
    async (lessonId: string): Promise<boolean> => {
      try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const index = store.index("lessonId");
          const range =
            typeof IDBKeyRange !== "undefined"
              ? IDBKeyRange.only(lessonId)
              : null;
          const req = index.openCursor(range);

          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
              .result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve(true);
            }
          };
          req.onerror = () => reject(req.error);
        });

        // Remove from metadata store
        await new Promise((resolve, reject) => {
          const tx = db.transaction(METADATA_STORE, "readwrite");
          const store = tx.objectStore(METADATA_STORE);
          const req = store.delete(lessonId);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });

        await calculateTotalSize();
        await refreshCachedLessons();
        return true;
      } catch {
        return false;
      }
    },
    [calculateTotalSize, refreshCachedLessons],
  );

  const isLessonDownloaded = useCallback(
    async (lessonId: string): Promise<boolean> => {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(METADATA_STORE, "readonly");
          const store = tx.objectStore(METADATA_STORE);
          const req = store.get(lessonId);
          req.onsuccess = () => {
            const meta = req.result as CachedLessonMetadata | undefined;
            resolve(!!meta?.completed);
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        return false;
      }
    },
    [],
  );

  const getLessonVideoBlobUrl = useCallback(
    async (lessonId: string): Promise<string | null> => {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const index = store.index("lessonId");
          const range =
            typeof IDBKeyRange !== "undefined"
              ? IDBKeyRange.only(lessonId)
              : null;
          const req = index.openCursor(range);

          req.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
              .result;
            if (cursor && cursor.value?.data) {
              const blob = new Blob([cursor.value.data], { type: "video/mp4" });
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(null);
            }
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const downloadLesson = useCallback(
    async (lessonId: string, videoUrl: string): Promise<boolean> => {
      if (!isSupported || !videoUrl) return false;

      const abortController = new AbortController();
      activeAbortControllers.current.set(lessonId, abortController);
      setIsDownloading((prev) => ({ ...prev, [lessonId]: true }));
      setDownloadProgress((prev) => ({ ...prev, [lessonId]: 0 }));

      try {
        const response = await fetch(videoUrl, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Fetch failed with HTTP status ${response.status}`);
        }

        const contentLength = +(response.headers.get("Content-Length") || 0);
        const reader = response.body?.getReader();

        if (!reader) {
          const buffer = await response.arrayBuffer();
          await storeSegment(videoUrl, buffer, lessonId);
          setDownloadProgress((prev) => ({ ...prev, [lessonId]: 100 }));
        } else if (contentLength > 0) {
          // Pre-allocate exact buffer once to prevent high-watermark memory spikes on mobile devices
          const combined = new Uint8Array(contentLength);
          let receivedBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              combined.set(value, receivedBytes);
              receivedBytes += value.length;
              const pct = Math.min(
                Math.round((receivedBytes / contentLength) * 100),
                99,
              );
              setDownloadProgress((prev) => ({ ...prev, [lessonId]: pct }));
            }
          }

          const finalBuffer =
            receivedBytes === contentLength
              ? combined.buffer
              : combined.slice(0, receivedBytes).buffer;

          await storeSegment(videoUrl, finalBuffer, lessonId);
          setDownloadProgress((prev) => ({ ...prev, [lessonId]: 100 }));
        } else {
          // Fallback for chunked transfer without Content-Length header
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
            }
          }
          const blob = new Blob(chunks as BlobPart[]);
          const buffer = await blob.arrayBuffer();
          await storeSegment(videoUrl, buffer, lessonId);
          setDownloadProgress((prev) => ({ ...prev, [lessonId]: 100 }));
        }

        // Store metadata
        const db = await openDB();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(METADATA_STORE, "readwrite");
          const store = tx.objectStore(METADATA_STORE);
          const meta: CachedLessonMetadata = {
            lessonId,
            videoUrl: normalizeVideoUrl(videoUrl),
            totalSize: contentLength || 0,
            downloadedAt: Date.now(),
            completed: true,
          };
          const req = store.put(meta);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });

        await calculateTotalSize();
        await refreshCachedLessons();
        return true;
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[VideoCache] Download failed:", err);
        }
        return false;
      } finally {
        activeAbortControllers.current.delete(lessonId);
        setIsDownloading((prev) => ({ ...prev, [lessonId]: false }));
      }
    },
    [calculateTotalSize, isSupported, refreshCachedLessons, storeSegment],
  );

  const cancelDownload = useCallback((lessonId: string) => {
    const controller = activeAbortControllers.current.get(lessonId);
    if (controller) {
      controller.abort();
      activeAbortControllers.current.delete(lessonId);
    }
    setIsDownloading((prev) => ({ ...prev, [lessonId]: false }));
    setDownloadProgress((prev) => ({ ...prev, [lessonId]: 0 }));
  }, []);

  return {
    isSupported,
    cacheSize,
    cachedLessons,
    downloadProgress,
    isDownloading,
    storageEstimate,
    storeSegment,
    getSegment,
    clearLessonCache,
    calculateTotalSize,
    downloadLesson,
    cancelDownload,
    isLessonDownloaded,
    getLessonVideoBlobUrl,
    refreshCachedLessons,
  };
}
