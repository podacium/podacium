/**
 * Podacium Progressive Web App Service Worker (TypeScript source).
 * Provides offline navigation shell, dynamic chunk caching, and Web Push notifications
 * with interactive live session joining actions and vibration alerts.
 */

export interface LivePushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  action_url?: string;
  type?: "session_reminder" | "live_session" | "general";
  sessionId?: string;
  id?: string | number;
  icon?: string;
  tag?: string;
}

export interface ExtendedNotificationOptions extends NotificationOptions {
  actions?: Array<{ action: string; title: string; icon?: string }>;
  vibrate?: number[];
  [key: string]: any;
}

export const SW_CACHE_VERSION = "2026-09-19-p3";
export const SW_STATIC_CACHE = `podacium-static-${SW_CACHE_VERSION}`;
export const SW_DYNAMIC_CACHE = `podacium-dynamic-${SW_CACHE_VERSION}`;
export const SW_NAV_CACHE = `podacium-navigation-${SW_CACHE_VERSION}`;
export const SW_OFFLINE_URL = "/offline.html";

export const SW_PRECACHE_URLS = [
  SW_OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/favicon.png",
  "/favicon-black.png",
  "/favicon-white.svg",
  "/og-image.jpg",
];

export function buildPushNotificationOptions(
  data: LivePushNotificationPayload,
): ExtendedNotificationOptions {
  const targetUrl = data.action_url || data.url || "/notifications";
  const isLiveSession =
    data.type === "session_reminder" ||
    data.type === "live_session" ||
    (typeof targetUrl === "string" && targetUrl.includes("/live/"));

  const actions: Array<{ action: string; title: string; icon?: string }> = [];
  if (isLiveSession) {
    actions.push(
      { action: "join", title: "Join Session" },
      { action: "dismiss", title: "Dismiss" },
    );
  }

  return {
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
}
