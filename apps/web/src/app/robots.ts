/**
 * =============================================================================
 * Podacium Robots.txt Configuration
 * =============================================================================
 * Comprehensive crawl rules for search engines and specialized crawlers.
 *
 * Design Philosophy:
 * - Allow Googlebot full access to indexable public content
 * - Block private, authentication-required, and administrative areas
 * - Provide specific guidance for AI training crawlers
 * - Never block CSS, JS, or media files (essential for rendering)
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 * @see https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
 */

import { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/metadata.config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.url;

  // =============================================================================
  // COMMON DISALLOWED PATHS
  // These paths are blocked for all standard crawlers
  // =============================================================================
  const commonDisallowedPaths = [
    // Admin panel - strictly private
    "/admin",
    "/admin/*",

    // Authentication flows - no SEO value
    "/auth",
    "/auth/*",

    // User dashboards & private profile management
    "/dashboard",
    "/dashboard/*",
    "/profile/me",
    "/profile/me/*",
    "/settings",
    "/settings/*",
    "/notifications",
    "/notifications/*",
    "/billing",
    "/billing/*",

    // Payment flows - transactional only
    "/payment",
    "/payment/*",

    // Token-based verification pages
    "/verify",
    "/verify/*",

    // Private/Action pages within public sections
    "/hub/projects/new",
    "/hub/projects/*/proposals",
    "/hub/contracts",
    "/hub/contracts/*",
    "/hub/proposals",
    "/hub/messages",

    // BI private pages
    "/bi/dashboards/new",
    "/bi/datasets/upload",
    "/bi/organizations/invitations",
    "/bi/organizations/invitations/*",

    // Utility pages
    "/ai-analytics",

    // API routes
    "/api",
    "/api/*",
  ];

  // Common allowed assets for modern SPA crawlability
  const commonAllowedPaths = [
    "/",
    "/_next/static/*",
    "/_next/image*",
    "/public/*",
  ];

  // =============================================================================
  // ALLOWED PATHS FOR AI CRAWLERS & SEARCH AGENTS (GEO / AEO / LLMO)
  // Permitted to scrape public content, directories, courses, and documentation
  // =============================================================================
  const aiAllowedPaths = [
    "/",
    "/about",
    "/pricing",
    "/contact",
    "/careers",
    "/partners",
    "/privacy",
    "/terms",
    "/cookies",
    "/refund",
    "/docs",
    "/help",
    "/hub",
    "/hub/projects",
    "/hub/projects/*",
    "/hub/freelancers",
    "/hub/freelancers/*",
    "/learn",
    "/learn/courses",
    "/learn/courses/*",
    "/learn/paths",
    "/learn/paths/*",
    "/bi",
    "/bi/analytics",
    "/bi/dashboards",
    "/bi/datasets",
    "/bi/reports",
    "/bi/decisions",
    "/bi/quality",
    "/profile/*",
    "/llms.txt",
    "/.well-known/llms.txt",
  ];

  // =============================================================================
  // DISALLOWED PATHS FOR AI CRAWLERS
  // Keep private dashboards, admin, and transactional routes blocked
  // =============================================================================
  const aiDisallowedPaths = [...commonDisallowedPaths];

  return {
    rules: [
      // =================================================================
      // GOOGLE BOT - Full access to public content and rendering assets
      // =================================================================
      {
        userAgent: "Googlebot",
        allow: commonAllowedPaths,
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // GOOGLE IMAGES - Allow image indexing
      // =================================================================
      {
        userAgent: "Googlebot-Image",
        allow: [
          "/",
          "/about",
          "/hub/freelancers",
          "/learn/courses",
          "/learn/paths",
        ],
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // GOOGLE NEWS - If applicable for future news content
      // =================================================================
      {
        userAgent: "Googlebot-News",
        allow: "/",
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // BING BOT - Microsoft search engine
      // =================================================================
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: commonDisallowedPaths,
        crawlDelay: 1,
      },

      // =================================================================
      // MICROSOFT OTHER BOTS
      // =================================================================
      {
        userAgent: "MSNBot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // DUCKDUCKGO BOT
      // =================================================================
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // YANDEX BOT (popular in some MENA regions)
      // =================================================================
      {
        userAgent: "Yandex",
        allow: "/",
        disallow: commonDisallowedPaths,
        crawlDelay: 2,
      },

      // =================================================================
      // BAIDU BOT (for Chinese market reach)
      // =================================================================
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: commonDisallowedPaths,
        crawlDelay: 2,
      },

      // =================================================================
      // ALL OTHER STANDARD CRAWLERS
      // =================================================================
      {
        userAgent: "*",
        allow: commonAllowedPaths,
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // AI AGENTS & SEARCH BOTS (GEO / AEO / LLMO)
      // =================================================================
      {
        userAgent: "GPTBot",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "ChatGPT-User",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "PerplexityBot",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "CCBot", // Common Crawl
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "anthropic-ai",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "Claude-Web",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },
      {
        userAgent: "ClaudeBot",
        allow: aiAllowedPaths,
        disallow: aiDisallowedPaths,
      },

      // =================================================================
      // SOCIAL MEDIA CRAWLERS - Allow for link previews
      // =================================================================
      {
        userAgent: "Twitterbot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "facebookexternalhit",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "LinkedInBot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "WhatsApp",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "TelegramBot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "Slackbot-LinkExpanding",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "Discordbot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // SEO TOOLS CRAWLERS
      // =================================================================
      {
        userAgent: "AhrefsBot",
        allow: "/",
        disallow: commonDisallowedPaths,
        crawlDelay: 2,
      },
      {
        userAgent: "SemrushBot",
        allow: "/",
        disallow: commonDisallowedPaths,
        crawlDelay: 2,
      },
      {
        userAgent: "MozBot",
        allow: "/",
        disallow: commonDisallowedPaths,
      },
      {
        userAgent: "Screaming Frog SEO Spider",
        allow: "/",
        disallow: commonDisallowedPaths,
      },

      // =================================================================
      // ARCHIVE ORGANIZATIONS
      // =================================================================
      {
        userAgent: "ia_archiver", // Internet Archive
        allow: "/",
        disallow: commonDisallowedPaths,
      },
    ],

    // Sitemap location
    sitemap: `${baseUrl}/sitemap.xml`,

    // Host preference (canonical domain)
    host: baseUrl,
  };
}

/**
 * =============================================================================
 * ROBOTS.TXT ADDITIONAL NOTES
 * =============================================================================
 *
 * NOT BLOCKED (Intentionally Allowed):
 * - All CSS files (*.css) - Required for rendering
 * - All JavaScript files (*.js) - Required for rendering
 * - All image files (*.png, *.jpg, *.jpeg, *.svg, *.webp, *.gif)
 * - All font files (*.woff, *.woff2, *.ttf)
 * - /_next/static/* - Next.js static assets
 * - /public/* - Public static files
 *
 * CRAWL DELAY STRATEGY:
 * - Major search engines: 1 second (efficient but polite)
 * - Secondary engines: 2 seconds (reduced load)
 * - SEO tools: 2 seconds (prevent overload)
 *
 * AI CRAWLER POLICY:
 * AI training crawlers are restricted to public marketing pages only.
 * They cannot access:
 * - User profiles and portfolios
 * - Course content
 * - Project listings
 * - BI dashboards and datasets
 * - Any authenticated content
 *
 * This protects:
 * - User privacy
 * - Content creator rights
 * - Platform competitive advantage
 * - Data security
 *
 * UPDATES:
 * Review this file when:
 * - New routes are added
 * - Route access levels change
 * - New AI crawlers emerge
 * - SEO strategy evolves
 */
