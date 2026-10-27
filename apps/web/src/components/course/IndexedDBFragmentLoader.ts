"use client";

import Hls from "hls.js";
import { normalizeVideoUrl } from "@/hooks/useOfflineVideoCache";

const DB_NAME = "PodaciumVideoCacheDB";
const STORE_NAME = "hls_segments";

async function getCachedSegmentFromDB(
  url: string,
): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;

  return new Promise((resolve) => {
    try {
      const normalized = normalizeVideoUrl(url);
      const request = indexedDB.open(DB_NAME, 2);

      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(null);
          return;
        }

        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(normalized);

        getReq.onsuccess = () => {
          if (getReq.result && getReq.result.data) {
            // Touch timestamp for LRU
            getReq.result.timestamp = Date.now();
            store.put(getReq.result);
            resolve(getReq.result.data);
          } else {
            resolve(null);
          }
        };

        getReq.onerror = () => resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function storeCachedSegmentInDB(
  url: string,
  data: ArrayBuffer,
): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  return new Promise((resolve) => {
    try {
      const normalized = normalizeVideoUrl(url);
      const request = indexedDB.open(DB_NAME, 2);

      request.onerror = () => resolve();
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve();
          return;
        }

        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          url: normalized,
          rawUrl: url,
          data,
          timestamp: Date.now(),
          size: data.byteLength,
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
    } catch {
      resolve();
    }
  });
}

const BaseLoader: any =
  typeof Hls !== "undefined" && Hls?.DefaultConfig?.loader
    ? Hls.DefaultConfig.loader
    : class {
        config: any;
        constructor(config: any) {
          this.config = config;
        }
        destroy() {}
        abort() {}
        load(_context: any, _config: any, _callbacks: any) {}
      };

/**
 * Custom HLS.js Fragment Loader with sub-millisecond IndexedDB cache interception.
 * Enables offline HLS video playback comparable to YouTube Mobile & Netflix PWA.
 */
export class IndexedDBFragmentLoader extends BaseLoader {
  constructor(config: any) {
    super(config);
  }

  load(context: any, config: any, callbacks: any) {
    const url = context.url;

    // Check IndexedDB before hitting the network
    getCachedSegmentFromDB(url)
      .then((cachedData) => {
        if (cachedData) {
          // Instant cache hit: deliver directly to HLS MediaSource engine
          const response = {
            url: context.url,
            data: cachedData,
          };
          const now = performance.now();
          const stats = {
            trequest: now,
            tfirst: now,
            tload: now,
            loaded: cachedData.byteLength,
            total: cachedData.byteLength,
            retry: 0,
            bwEstimate: 50000000, // 50 Mbps synthetic internal cache throughput
          };
          callbacks.onSuccess(response, stats, context);
          return;
        }

        // Cache miss: intercept network response to persist in IndexedDB
        const originalOnSuccess = callbacks.onSuccess;
        callbacks.onSuccess = (
          response: any,
          stats: any,
          ctx: any,
          networkInfo: any,
        ) => {
          if (response.data instanceof ArrayBuffer) {
            storeCachedSegmentInDB(url, response.data).catch(() => {});
          }
          originalOnSuccess(response, stats, ctx, networkInfo);
        };

        super.load(context, config, callbacks);
      })
      .catch(() => {
        super.load(context, config, callbacks);
      });
  }
}
