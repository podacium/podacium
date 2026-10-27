import { cookies, headers } from "next/headers";

// Module-level cache: once loaded, messages persist for the lifetime of the server.
const messageCache = new Map<string, Record<string, any>>();

// ─── Supported locales & namespaces ──────────────────────────────────────────

export const SUPPORTED_LOCALES = ["en", "fr", "ar", "kab"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const NAMESPACES = [
  "common",
  "legal",
  "home",
  "about",
  "auth",
  "user",
  "learn",
  "component",
  "hub",
  "bi",
  "notifications",
  "billing",
  "messaging",
  "admin",
  "docs",
  "help",
  "onboarding",
  "settings-devices",
  "settings-security",
  "waitlist",
  "live",
  "search",
  "organizations",
] as const;

type Namespace = (typeof NAMESPACES)[number];

// ─── Dynamic loader ───────────────────────────────────────────────────────────
//
// Instead of statically importing all 51 JSON files at build time (which
// bundles every locale into the initial JS payload), we use dynamic imports
// so Next.js code-splits each locale into its own chunk.
//
// On the server (RSC / layout), only the active locale's chunks are loaded.
// On the client, the active locale is already hydrated; other locales are
// never fetched unless the user switches language.

async function loadNamespace(
  locale: SupportedLocale,
  ns: Namespace,
): Promise<Record<string, any>> {
  try {
    const mod = await import(`../../locales/${locale}/${ns}.json`);
    const data = mod.default ?? mod;

    if (locale !== "en") {
      try {
        const fallbackMod = await import(`../../locales/en/${ns}.json`);
        const fallbackData = fallbackMod.default ?? fallbackMod;
        return deepMerge(fallbackData, data);
      } catch {
        return data;
      }
    }
    return data;
  } catch {
    if (locale !== "en") {
      try {
        const fallback = await import(`../../locales/en/${ns}.json`);
        return fallback.default ?? fallback;
      } catch {
        return {};
      }
    }
    return {};
  }
}

// ─── Locale detection ─────────────────────────────────────────────────────────

export async function getLocale(): Promise<SupportedLocale> {
  // 1. x-locale header set by middleware when rewriting locale-prefixed URLs
  //    This is the most reliable signal — it reflects the actual URL path.
  const xLocale = (await headers()).get("x-locale");

  // 2. Fall back to cookie (set on redirect or previous visits)
  const cookieLocale = (await cookies()).get("locale")?.value;

  // 3. Fall back to browser accept-language with BCP 47 matching
  const accept = (await headers()).get("accept-language");
  let acceptLang: string | null = null;
  if (accept) {
    const preferred = accept
      .split(",")
      .map((entry) => {
        const [tag, qVal] = entry.trim().split(";q=");
        return {
          tag: tag.trim().toLowerCase(),
          q: qVal ? parseFloat(qVal) : 1.0,
        };
      })
      .sort((a, b) => b.q - a.q);

    for (const { tag } of preferred) {
      if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
        acceptLang = tag;
        break;
      }
      const primarySubtag = tag.split("-")[0];
      if ((SUPPORTED_LOCALES as readonly string[]).includes(primarySubtag)) {
        acceptLang = primarySubtag;
        break;
      }
    }
  }

  const candidate = (xLocale || cookieLocale || acceptLang || "en") as string;
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate)
    ? (candidate as SupportedLocale)
    : "en";
}

// ─── Deep merge ───────────────────────────────────────────────────────────────

function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Message assembly ─────────────────────────────────────────────────────────

export async function loadMessages(
  locale: string,
): Promise<Record<string, any>> {
  const safeLocale: SupportedLocale = (
    SUPPORTED_LOCALES as readonly string[]
  ).includes(locale)
    ? (locale as SupportedLocale)
    : "en";

  if (process.env.NODE_ENV === "production") {
    const cached = messageCache.get(safeLocale);
    if (cached) return cached;
  }

  // Load all namespaces for the active locale in parallel
  const loaded = await Promise.all(
    NAMESPACES.map(
      async (ns) => [ns, await loadNamespace(safeLocale, ns)] as const,
    ),
  );
  const data = Object.fromEntries(loaded) as Record<
    string,
    Record<string, any>
  >;

  // ── Assemble flat messages object with full deepMerge ──────────────────
  let messages: Record<string, any> = {};

  // 1. Deep merge all namespace data payloads
  for (const [, pageData] of loaded) {
    if (!pageData) continue;
    messages = deepMerge(messages, pageData);
  }

  // 2. Ensure page namespace mappings exist at root without overwriting existing keys
  const pageFiles: Namespace[] = [
    "home",
    "about",
    "auth",
    "user",
    "learn",
    "component",
    "hub",
    "bi",
    "notifications",
    "billing",
    "messaging",
    "admin",
    "legal",
    "docs",
    "help",
    "onboarding",
    "settings-devices",
    "settings-security",
    "waitlist",
    "live",
    "search",
    "organizations",
  ];

  for (const pageName of pageFiles) {
    const pageData = data[pageName];
    if (!pageData) continue;

    const pageMessages = pageData[pageName] ? pageData[pageName] : pageData;

    if (pageName === "auth") {
      messages = deepMerge(messages, pageMessages);
      messages.auth = deepMerge(messages.auth || {}, pageMessages);
    } else {
      messages[pageName] = deepMerge(messages[pageName] || {}, pageMessages);

      if (pageName === "learn") {
        messages.learn = deepMerge(messages.learn || {}, pageData);
        if (pageData.instructor) {
          messages.instructor = deepMerge(
            messages.instructor || {},
            pageData.instructor,
          );
        }
      }

      if (pageName === "hub") {
        messages.hub = deepMerge(messages.hub || {}, pageData);
        if (pageData.hub) {
          messages.hub = deepMerge(messages.hub, pageData.hub);
        }
      }

      if (pageName === "home") {
        if (pageData.postLoginModal)
          messages.postLoginModal = pageData.postLoginModal;
        if (pageData.oauth) messages.oauth = pageData.oauth;
        if (pageData.errors) messages.errors = pageData.errors;
        if (pageData.common)
          messages.common = deepMerge(messages.common || {}, pageData.common);
      }

      if (pageName === "user") {
        if (pageData.profile)
          messages.profile = deepMerge(
            messages.profile || {},
            pageData.profile,
          );
        if (pageData.settings)
          messages.settings = deepMerge(
            messages.settings || {},
            pageData.settings,
          );
        if (pageData.notifications)
          messages.notifications = deepMerge(
            messages.notifications || {},
            pageData.notifications,
          );
        if (pageData.dashboard)
          messages.dashboard = deepMerge(
            messages.dashboard || {},
            pageData.dashboard,
          );
        if (pageData.rec) messages.rec = pageData.rec;
      }
    }
  }

  if (process.env.NODE_ENV === "production") {
    messageCache.set(safeLocale, messages);
  }

  return messages;
}

export function getDir(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
