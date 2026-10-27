const CACHE_VERSION = "2026-09-21-p4";
const CACHE_NAME = `podacium-${CACHE_VERSION}`;
const STATIC_CACHE = `podacium-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `podacium-dynamic-${CACHE_VERSION}`;
const NAV_CACHE = `podacium-navigation-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/favicon.png",
  "/favicon-black.png",
  "/favicon-white.svg",
  "/og-image.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Individually precache URLs so a single failure doesn't prevent offline.html caching
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Precache skipped for ${url}:`, err);
          }),
        ),
      );
    }),
  );
  self.skipWaiting();
});

// Never cache requests that carry an authentication cookie or target auth/sensitive routes.
// Authenticated or auth-entry pages are personalized and must never be served offline
// from a shared navigation cache.
function isAuthRequest(request) {
  try {
    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/auth") ||
      url.pathname.startsWith("/login") ||
      url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/admin") ||
      url.pathname.startsWith("/settings") ||
      url.pathname.startsWith("/profile") ||
      url.pathname.startsWith("/account") ||
      url.pathname.startsWith("/hub") ||
      url.pathname.startsWith("/bi") ||
      url.pathname.startsWith("/live")
    ) {
      return true;
    }
  } catch (_) {}
  const cookie = request.headers.get("cookie") || "";
  return /(?:access_token|auth_hint|podacium_session)=/.test(cookie);
}

// Inline resilient offline fallback HTML for when network and cache miss
function getInlineOfflineResponse() {
  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/><meta name="theme-color" content="#2563eb"/><title>Offline — Podacium</title><style>:root{--bg:#f8fafc;--card:#ffffff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--primary:linear-gradient(135deg,#2563eb,#4f46e5);--shadow:rgba(37,99,235,0.25);}@media(prefers-color-scheme:dark){:root{--bg:#020617;--card:rgba(15,23,42,0.85);--text:#f8fafc;--muted:#94a3b8;--border:#334155;--primary:linear-gradient(135deg,#3b82f6,#6366f1);--shadow:rgba(59,130,246,0.3);}}body{min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;text-align:center;box-sizing:border-box;}.card{width:100%;max-width:440px;background:var(--card);border:1px solid var(--border);border-radius:24px;padding:2.25rem 2rem;box-shadow:0 20px 45px -12px rgba(0,0,0,0.08);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;}.brand{display:inline-flex;align-items:center;gap:8px;margin-bottom:1.5rem;font-weight:700;font-size:1.1rem;}.mark{width:32px;height:32px;border-radius:8px;background:var(--primary);display:grid;place-items:center;color:#fff;}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:rgba(245,158,11,0.12);color:#b45309;border:1px solid rgba(245,158,11,0.25);font-size:12px;font-weight:600;margin-bottom:1rem;}h1{margin:0 0 8px;font-size:1.5rem;font-weight:700;letter-spacing:-0.02em;}p{margin:0 0 1.5rem;color:var(--muted);font-size:0.95rem;line-height:1.6;max-width:34ch;}.btn{display:inline-block;width:100%;box-sizing:border-box;padding:0.8rem 1.5rem;border:0;border-radius:14px;background:var(--primary);color:#fff;font-size:0.95rem;font-weight:600;cursor:pointer;box-shadow:0 8px 20px -4px var(--shadow);transition:opacity .15s;}@media(prefers-color-scheme:dark){.badge{color:#fbbf24;}}</style></head><body><div class="card"><div class="brand"><div class="mark"><svg viewBox="0 0 209.59 224.89" width="18" height="18" fill="none"><path fill="currentColor" d="M321.44,545.39v64.43a8.26,8.26,0,0,1-8.26,8.26H228.34a8.26,8.26,0,0,1-8.27-8.26V545.39c0-24.42,22.81-44.4,50.69-44.4a54.33,54.33,0,0,1,35.79,13C315.74,522.08,321.44,533.18,321.44,545.39Zm59.91-150.34h-53.9v48.33h0c0,26.57,22.41,48.32,49,48.32h4.91a48.33,48.33,0,0,0,0-96.65Z" transform="translate(-220.07 -393.19)"/><circle fill="currentColor" cx="49.25" cy="49.25" r="49.25"/></svg></div><span>Podacium</span></div><div class="badge">Offline Mode</div><h1>You\'re offline</h1><p>No internet connection detected. Your learning and work on Podacium will resume automatically when you reconnect.</p><button class="btn" onclick="location.reload()">Try Again</button></div><script>window.addEventListener("online",function(){location.reload();});</script></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Slice cached video/media ArrayBuffer for Safari HTTP 206 Partial Content range requests
async function handleRangeResponse(request, response) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return response;
  }

  try {
    const arrayBuffer = await response.arrayBuffer();
    const total = arrayBuffer.byteLength;
    const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);

    if (!matches) {
      return response;
    }

    const start = matches[1] ? parseInt(matches[1], 10) : 0;
    const end = matches[2] ? parseInt(matches[2], 10) : total - 1;

    if (start >= total || end >= total || start > end) {
      return new Response(null, {
        status: 416,
        statusText: "Range Not Satisfiable",
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const sliced = arrayBuffer.slice(start, end + 1);
    return new Response(sliced, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": response.headers.get("content-type") || "video/mp4",
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(sliced.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (_) {
    return response;
  }
}

self.addEventListener("fetch", (event) => {
  // Do not intercept external requests (CloudFront, S3, Vimeo, external CDNs/APIs)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  // ── 1. Navigation (HTML) ──────────────────────────────────────────────────
  // CRITICAL-PWA-01: Intercept ALL document navigations (including /dashboard, /admin,
  // /settings, /profile, etc.) so that network failures cleanly fall back to offline.html
  // or inline shell without triggering browser ERR_FAILED or Chrome dinosaur.
  // Sensitive/auth pages are NEVER stored in NAV_CACHE to preserve privacy.
  if (event.request.mode === "navigate") {
    const auth = isAuthRequest(event.request);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache unauthenticated, public navigation responses
          if (response.ok && !auth && response.type === "basic") {
            const clone = response.clone();
            caches
              .open(NAV_CACHE)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          try {
            if (!auth) {
              const cached = await caches.match(event.request);
              if (cached) return cached;
            }
            const offlinePage = await caches.match(OFFLINE_URL);
            if (offlinePage) return offlinePage;
          } catch (_) {}

          return getInlineOfflineResponse();
        }),
    );
    return;
  }

  // ── 2. Bypass API, Live Streams, Auth endpoints, and Next.js internal RSC ─
  // Non-navigation fetches to these prefixes must hit the network directly.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/live") ||
    url.pathname.startsWith("/auth/") ||
    url.searchParams.has("_rsc") ||
    event.request.headers.get("rsc") === "1" ||
    event.request.headers.get("next-router-state-tree") ||
    event.request.headers.get("next-router-prefetch") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    return;
  }

  // ── 3. Next.js Chunks & Static assets ─────────────────────────────────────
  // HIGH-PWA-02: Guaranteed to always resolve to a valid Response.
  // On cache miss offline, return synthetic HTTP 503 Response to prevent DOMException.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const clone = response.clone();
            caches
              .open(DYNAMIC_CACHE)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response("/* Podacium: Chunk unavailable offline */", {
            status: 503,
            statusText: "Service Unavailable",
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }),
    );
    return;
  }

  // ── 4. Static assets (images, fonts, media) — cache-first with 206 range support ──
  // Guaranteed to always resolve to a valid Response object.
  event.respondWith(
    caches
      .match(event.request)
      .then(async (cached) => {
        if (cached) {
          if (event.request.headers.get("range")) {
            return handleRangeResponse(event.request, cached);
          }
          return cached;
        }

        return fetch(event.request).then(async (response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const clone = response.clone();
            caches
              .open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(event.request, clone);
                trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ITEMS);
              })
              .catch(() => {});
          }
          return response;
        });
      })
      .catch(() => {
        return new Response("", {
          status: 404,
          statusText: "Offline or asset not found",
        });
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => {
        return Promise.all(
          names
            .filter(
              (n) =>
                n !== STATIC_CACHE && n !== DYNAMIC_CACHE && n !== NAV_CACHE,
            )
            .map((n) => caches.delete(n)),
        );
      })
      .then(() => {
        return self.clients.claim();
      }),
  );
});

const MAX_DYNAMIC_ITEMS = 60;

// Trim dynamic cache to prevent storage bloat & handle quota limits
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    // Storage Quota Watchdog: Trim aggressively if device storage is above 80%
    let forceTrim = false;
    if (
      self.navigator &&
      self.navigator.storage &&
      self.navigator.storage.estimate
    ) {
      try {
        const estimate = await self.navigator.storage.estimate();
        if (
          estimate.quota &&
          estimate.usage &&
          estimate.usage / estimate.quota > 0.8
        ) {
          forceTrim = true;
        }
      } catch (_) {}
    }

    const effectiveLimit = forceTrim ? Math.floor(maxItems / 2) : maxItems;
    if (keys.length > effectiveLimit) {
      await cache.delete(keys[0]);
      await trimCache(cacheName, maxItems);
    }
  } catch (_) {}
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Open offline sync queue IndexedDB
function openSyncQueueDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in self)) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open("podacium_offline_v1", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline_sync_queue")) {
        const store = db.createObjectStore("offline_sync_queue", {
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

// Process pending offline mutations when network connectivity is restored
async function processOfflineSyncQueue() {
  try {
    const db = await openSyncQueueDB();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction("offline_sync_queue", "readonly");
      const store = tx.objectStore("offline_sync_queue");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const item of items) {
      if (item.status === "completed") continue;
      try {
        const res = await fetch(item.endpoint, {
          method: item.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...(item.headers || {}),
            "X-Idempotency-Key": item.idempotency_key || String(item.id),
            "X-Offline-Synced-At": new Date().toISOString(),
          },
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (res.ok || res.status === 409) {
          // Success or already processed: delete item from queue
          await new Promise((resolve, reject) => {
            const tx = db.transaction("offline_sync_queue", "readwrite");
            const store = tx.objectStore("offline_sync_queue");
            const req = store.delete(item.id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });

          // Notify active window clients of successful sync
          const allClients = await self.clients.matchAll();
          allClients.forEach((client) => {
            client.postMessage({
              type: "OFFLINE_SYNC_SUCCESS",
              id: item.id,
              actionType: item.type,
              idempotencyKey: item.idempotency_key,
            });
          });
        }
      } catch (err) {
        console.warn("[SW] Sync error for item", item.id, err);
      }
    }
  } catch (err) {
    console.warn("[SW] Failed to process offline sync queue:", err);
  }
}

self.addEventListener("sync", (event) => {
  if (
    event.tag === "sync-offline-actions" ||
    event.tag === "sync-data" ||
    (typeof event.tag === "string" && event.tag.startsWith("sync-"))
  ) {
    event.waitUntil(processOfflineSyncQueue());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (
    event.tag === "sync-offline-actions" ||
    event.tag === "check-sync-queue" ||
    event.tag === "content-sync"
  ) {
    event.waitUntil(processOfflineSyncQueue());
  }
});

// ── Web Push Notifications with Live Session Alert Support ────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "Podacium";
    const targetUrl = data.action_url || data.url || "/notifications";
    const isLiveSession =
      data.type === "session_reminder" ||
      data.type === "live_session" ||
      (typeof targetUrl === "string" && targetUrl.includes("/live/"));

    const actions = [];
    if (isLiveSession) {
      actions.push(
        { action: "join", title: "Join Session" },
        { action: "dismiss", title: "Dismiss" },
      );
    }

    // App Badging on push notification arrival
    if ("setAppBadge" in self.navigator) {
      const badgeCount =
        typeof data.badge_count === "number" ? data.badge_count : undefined;
      self.navigator.setAppBadge(badgeCount).catch(() => {});
    }

    const options = {
      body: data.body || "You have an upcoming live session on Podacium",
      icon: data.icon || "/icon-192.png",
      badge: "/favicon-32.png",
      data: { url: targetUrl, isLiveSession },
      vibrate: isLiveSession ? [200, 100, 200, 100, 300] : [100, 50, 100],
      tag:
        data.tag ||
        (data.id
          ? `notif-${data.id}`
          : isLiveSession
            ? `live-session-${data.sessionId || "alert"}`
            : undefined),
      renotify: true,
      actions: actions.length > 0 ? actions : undefined,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (_) {
    event.waitUntil(
      self.registration.showNotification("Podacium", {
        body: event.data.text(),
        icon: "/icon-192.png",
        data: { url: "/notifications" },
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if ("clearAppBadge" in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  if (event.action === "dismiss") {
    return;
  }

  const targetPath = event.notification.data?.url || "/notifications";
  // Resolve to absolute URL for proper comparison with client.url
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Compare absolute URLs; also match if client is on same path
          if (
            (client.url === targetUrl || client.url.endsWith(targetPath)) &&
            "focus" in client
          ) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
