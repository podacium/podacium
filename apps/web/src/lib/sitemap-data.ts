/**
 * =============================================================================
 * Podacium Sitemap Configuration
 * =============================================================================
 * Comprehensive sitemap for Google Search Console indexing.
 * Includes all indexable routes with proper prioritization and change frequencies.
 *
 * Excluded from sitemap (private/noindex):
 * - /admin/* (admin panel)
 * - /auth/* (authentication flows)
 * - /dashboard (user dashboard)
 * - /profile (user profile)
 * - /settings (account settings)
 * - /notifications (user notifications)
 * - /billing (billing management)
 * - /payment/* (payment flows)
 * - /verify/* (verification tokens)
 * - /ai-analytics (utility page - minimal content)
 * - /docs (utility page - minimal content)
 * - /help (utility page - minimal content)
 * - /hub/projects/new (creation form)
 * - /hub/projects/[id]/proposals (private proposals)
 * - /hub/contracts/[id]/* (private contract actions, no public API)
 * - /hub/proposals (user proposals)
 * - /hub/messages (private messages)
 * - /learn/certificates/[id] (no public list API)
 * - /bi/dashboards/new (creation form)
 * - /bi/dashboards/[id] (auth-required, no public API)
 * - /bi/datasets/upload (upload form)
 * - /bi/datasets/[id] (auth-required, no public API)
 * - /bi/reports/[id] (auth-required, no public API)
 * - /bi/organizations/[id] (auth-required, no public API)
 * - /bi/organizations/invitations/* (token-based)
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 * @see https://www.sitemaps.org/protocol.html
 */

import { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/metadata.config";

const BASE_URL = SITE_CONFIG.url;

// Supported locales for hreflang
const LOCALES = ["en", "fr", "ar", "kab"] as const;
type Locale = (typeof LOCALES)[number];

// =============================================================================
// STATIC ROUTES CONFIGURATION
// =============================================================================

interface StaticRouteConfig {
  path: string;
  priority: number;
  changeFrequency:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  lastModified?: Date;
}

/**
 * All publicly indexable static routes
 * Ordered by SEO priority (highest to lowest)
 */
const STATIC_ROUTES: StaticRouteConfig[] = [
  // Homepage - Absolute highest priority
  { path: "/", priority: 1.0, changeFrequency: "daily" },

  // Core marketing pages - High priority
  { path: "/about", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: "/hub", priority: 0.9, changeFrequency: "daily" },
  { path: "/learn", priority: 0.9, changeFrequency: "daily" },
  { path: "/bi", priority: 0.9, changeFrequency: "daily" },

  // Hub module listings - High priority
  { path: "/hub/projects", priority: 0.9, changeFrequency: "daily" },
  { path: "/hub/freelancers", priority: 0.9, changeFrequency: "daily" },

  // Learn module listings - High priority
  { path: "/learn/courses", priority: 0.9, changeFrequency: "daily" },
  { path: "/learn/paths", priority: 0.9, changeFrequency: "daily" },

  // BI module listings - Medium-high priority
  { path: "/bi/analytics", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/dashboards", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/datasets", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/reports", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/decisions", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/quality", priority: 0.8, changeFrequency: "daily" },
  { path: "/bi/organizations", priority: 0.7, changeFrequency: "weekly" },

  // Secondary marketing & resource pages - Medium priority
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.8, changeFrequency: "weekly" },
  { path: "/partners", priority: 0.8, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly" },
  { path: "/help", priority: 0.8, changeFrequency: "weekly" },

  // Legal pages - Lower priority, rarely change
  { path: "/privacy", priority: 0.5, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.5, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.5, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.5, changeFrequency: "yearly" },
];

// =============================================================================
// DYNAMIC ROUTES CONFIGURATION
// =============================================================================

interface DynamicRouteConfig {
  basePath: string;
  apiEndpoint: string;
  priority: number;
  changeFrequency:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  idField: string;
  lastModifiedField?: string;
}

/**
 * Dynamic route configurations for content that should be indexed
 * Each entry maps to an API endpoint that returns a list of public items
 */
const DYNAMIC_ROUTE_CONFIGS: DynamicRouteConfig[] = [
  // Hub: public project listings (no auth required)
  {
    basePath: "/hub/projects",
    apiEndpoint: "/api/v1/hub/public/projects?limit=100",
    priority: 0.8,
    changeFrequency: "daily",
    idField: "id",
    lastModifiedField: "updatedAt",
  },
  // Hub: public freelancer profiles (direct canonical profile URLs)
  {
    basePath: "/profile",
    apiEndpoint: "/api/v1/hub/public/freelancers?limit=100",
    priority: 0.8,
    changeFrequency: "weekly",
    idField: "id",
    lastModifiedField: "updatedAt",
  },
  // Learn: public course/module listings (no auth required)
  {
    basePath: "/learn/courses",
    apiEndpoint: "/api/v1/education/modules/public?limit=100",
    priority: 0.8,
    changeFrequency: "weekly",
    idField: "id",
    lastModifiedField: "updatedAt",
  },
  // Learn: public learning path listings (no auth required)
  {
    basePath: "/learn/paths",
    apiEndpoint: "/api/v1/education/paths/public?limit=50",
    priority: 0.8,
    changeFrequency: "weekly",
    idField: "id",
    lastModifiedField: "updatedAt",
  },
  // NOTE: The following routes are excluded because they require authentication:
  // - /hub/contracts (no public endpoint)
  // - /learn/certificates (no public list endpoint)
  // - /bi/dashboards, /bi/datasets, /bi/reports (auth-required BI endpoints)
  // - /bi/organizations (auth-required, returns 403)
  // Their listing pages remain as static routes in STATIC_ROUTES above.
];

// =============================================================================
// API FETCHING FUNCTIONS
// =============================================================================

interface DynamicItem {
  id?: string;
  slug?: string;
  _id?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  issuedAt?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

/**
 * Fetch dynamic item IDs from the API
 * Returns empty array on error to ensure sitemap still generates
 */
async function fetchDynamicItems(
  config: DynamicRouteConfig,
): Promise<DynamicItem[]> {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
  const apiUrl = rawApiUrl.replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${apiUrl}${config.apiEndpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      next: {
        revalidate: 3600, // Revalidate every hour
        tags: [`sitemap-${config.basePath}`],
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[Sitemap] Failed to fetch ${config.basePath}: ${response.status}`,
      );
      return [];
    }

    const data = await response.json();

    // Handle various API response structures (projects, freelancers, modules, paths, items, data, results)
    let items: unknown = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === "object") {
      const container = data as Record<string, unknown>;
      if (Array.isArray(container.projects)) items = container.projects;
      else if (Array.isArray(container.freelancers))
        items = container.freelancers;
      else if (Array.isArray(container.modules)) items = container.modules;
      else if (Array.isArray(container.paths)) items = container.paths;
      else if (Array.isArray(container.items)) items = container.items;
      else if (Array.isArray(container.data)) items = container.data;
      else if (Array.isArray(container.results)) items = container.results;
    }

    if (!Array.isArray(items)) {
      console.warn(
        `[Sitemap] Unexpected response structure for ${config.basePath}`,
      );
      return [];
    }

    return items as DynamicItem[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[Sitemap] Timeout fetching ${config.basePath}`);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Sitemap] Skipping dynamic entries for ${config.basePath} (API offline or unreachable: ${msg})`,
      );
    }
    return [];
  }
}

/**
 * Extract identifier from item based on config
 */
function getItemId(
  item: DynamicItem,
  config: DynamicRouteConfig,
): string | null {
  const id = item[config.idField] || item.id || item._id || item.slug;
  return id ? String(id) : null;
}

/**
 * Extract last modified date from item
 */
function getItemLastModified(
  item: DynamicItem,
  config: DynamicRouteConfig,
): Date {
  if (config.lastModifiedField) {
    const dateValue =
      item[config.lastModifiedField] ??
      item.updatedAt ??
      item.updated_at ??
      item.createdAt ??
      item.created_at ??
      item.publishedAt;

    if (dateValue && typeof dateValue === "string") {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return new Date();
}

// =============================================================================
// Sitemap URL GENERATION
// =============================================================================

/**
 * Generate hreflang alternates for a given path, including x-default
 */
function generateHreflangAlternates(path: string): Record<string, string> {
  const alternates: Record<string, string> = {};

  LOCALES.forEach((locale) => {
    // Use path-based locale: /en/about, /fr/about, /ar/about, /kab/about
    // For homepage: /en, /fr, /ar, /kab
    const localePath = path === "/" ? `/${locale}` : `/${locale}${path}`;
    alternates[locale] = `${BASE_URL}${localePath}`;
  });

  // x-default fallback for crawlers with unspecified language
  alternates["x-default"] = `${BASE_URL}${path}`;

  return alternates;
}

/**
 * Generate a sitemap entry for a static route
 */
function generateStaticSitemapEntry(
  config: StaticRouteConfig,
): MetadataRoute.Sitemap[number] {
  const url = `${BASE_URL}${config.path}`;

  return {
    url,
    lastModified: config.lastModified || new Date(),
    changeFrequency: config.changeFrequency,
    priority: config.priority,
    alternates: {
      languages: generateHreflangAlternates(config.path),
    },
  };
}

/**
 * Generate sitemap entries for dynamic routes
 */
async function generateDynamicSitemapEntries(
  config: DynamicRouteConfig,
): Promise<MetadataRoute.Sitemap> {
  const items = await fetchDynamicItems(config);

  if (items.length === 0) {
    return [];
  }

  return items
    .map((item) => {
      const id = getItemId(item, config);
      if (!id) return null;

      const path = `${config.basePath}/${id}`;
      const url = `${BASE_URL}${path}`;

      return {
        url,
        lastModified: getItemLastModified(item, config),
        changeFrequency: config.changeFrequency,
        priority: config.priority,
        alternates: {
          languages: generateHreflangAlternates(path),
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

// =============================================================================
// MAIN SITEMAP GENERATION
// =============================================================================

/**
 * Main sitemap generation function
 * Exported as default for Next.js metadata API
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Add all static routes
  for (const route of STATIC_ROUTES) {
    sitemapEntries.push(generateStaticSitemapEntry(route));
  }

  // Add dynamic routes with error handling for each
  for (const config of DYNAMIC_ROUTE_CONFIGS) {
    try {
      const entries = await generateDynamicSitemapEntries(config);
      sitemapEntries.push(...entries);
    } catch (error) {
      console.error(
        `[Sitemap] Failed to generate entries for ${config.basePath}:`,
        error,
      );
      // Continue with other routes even if one fails
    }
  }

  // Validate and deduplicate URLs
  const seenUrls = new Set<string>();
  const uniqueEntries = sitemapEntries.filter((entry) => {
    if (seenUrls.has(entry.url)) {
      console.warn(`[Sitemap] Duplicate URL removed: ${entry.url}`);
      return false;
    }
    seenUrls.add(entry.url);
    return true;
  });

  console.log(`[Sitemap] Generated ${uniqueEntries.length} URLs`);

  return uniqueEntries;
}

// =============================================================================
// SITEMAP INDEX GENERATION (for large sites - 50,000+ URLs)
// =============================================================================
// Uncomment and use if sitemap exceeds 50,000 URLs or 50MB limit
//
// export async function generateSitemapIndex(): Promise<MetadataRoute.Sitemap> {
//     const indexes = [
//         '/sitemap-static.xml',
//         '/sitemap-hub.xml',
//         '/sitemap-learn.xml',
//         '/sitemap-bi.xml',
//     ]
//
//     return indexes.map((url) => ({
//         url: `${BASE_URL}${url}`,
//         lastModified: new Date(),
//     }))
// }
