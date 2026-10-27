/**
 * Internationalized SEO Metadata Generator
 *
 * Reads the current locale and returns localized metadata for each page.
 * Uses translation keys from common.json `meta.*` namespace.
 */
import type { Metadata } from "next";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { SITE_CONFIG } from "@/lib/metadata.config";

type MetaKey = string;

interface I18nMetadataOptions {
  /** The meta key from common.json (e.g. "home", "about", "biDashboards") */
  key: MetaKey;
  /** The URL path for this page (e.g. "/about", "/bi/dashboards") */
  path: string;
  /** Whether search engines should index this page */
  noindex?: boolean;
  /** Additional keywords for this page */
  keywords?: readonly string[] | string[];
  /** OpenGraph image override */
  ogImage?: string;
  /** OpenGraph type */
  ogType?: "website" | "article" | "profile";
  /** Explicit title override if not in translations */
  titleOverride?: string;
  /** Explicit description override if not in translations */
  descriptionOverride?: string;
}

const REGIONAL_LOCALES: Record<string, string> = {
  ar: "ar_DZ",
  fr: "fr_DZ",
  kab: "kab_DZ",
  en: "en_US",
};

/**
 * Generate fully internationalized metadata for a page.
 * Call this from `export async function generateMetadata()` in layout.tsx files.
 */
export async function generateI18nMetadata(
  options: I18nMetadataOptions,
): Promise<Metadata> {
  const {
    key,
    path,
    noindex = false,
    keywords,
    ogImage,
    ogType = "website",
    titleOverride,
    descriptionOverride,
  } = options;

  const locale = await getLocale();
  const messages = await loadMessages(locale);

  // Resolve meta translations with resilient fallbacks
  const meta = messages?.meta?.[key] || messages?.[key]?.meta;
  const title =
    titleOverride ||
    meta?.title ||
    messages?.[key]?.title ||
    `${key} | ${SITE_CONFIG.name}`;
  const description =
    descriptionOverride ||
    meta?.description ||
    messages?.[key]?.description ||
    messages?.common?.meta?.defaultDescription ||
    SITE_CONFIG.description;

  const cleanPath =
    path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  const localePath =
    locale === SITE_CONFIG.defaultLocale ? cleanPath : `/${locale}${cleanPath}`;
  const canonicalUrl = `${SITE_CONFIG.url}${localePath || "/"}`;

  const currentOgLocale = REGIONAL_LOCALES[locale] || "en_US";
  const alternateOgLocales = Object.values(REGIONAL_LOCALES).filter(
    (l) => l !== currentOgLocale,
  );

  return {
    title,
    description,
    keywords: keywords
      ? [...SITE_CONFIG.keywords, ...keywords]
      : [...SITE_CONFIG.keywords],
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${SITE_CONFIG.url}/en${cleanPath}`,
        fr: `${SITE_CONFIG.url}/fr${cleanPath}`,
        ar: `${SITE_CONFIG.url}/ar${cleanPath}`,
        kab: `${SITE_CONFIG.url}/kab${cleanPath}`,
        "x-default": `${SITE_CONFIG.url}${cleanPath || "/"}`,
      } as Record<string, string>,
    },
    openGraph: {
      type: ogType,
      locale: currentOgLocale,
      alternateLocale: alternateOgLocales,
      siteName: SITE_CONFIG.name,
      url: canonicalUrl,
      title,
      description,
      images: [
        {
          url: ogImage || "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: SITE_CONFIG.social.twitter,
      creator: SITE_CONFIG.social.twitter,
      title,
      description,
      images: [ogImage || "/og-image.jpg"],
    },
  };
}
