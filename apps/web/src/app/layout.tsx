import type { Metadata, Viewport } from "next";
import "@fontsource/baloo-bhaijaan-2/400.css";
import "@fontsource/baloo-bhaijaan-2/500.css";
import "@fontsource/baloo-bhaijaan-2/600.css";
import "@fontsource/baloo-bhaijaan-2/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import React from "react";
import Providers from "@/components/Providers";
import { IntlProvider } from "@/lib/i18n";
import { getLocale, loadMessages, getDir } from "@/lib/locale-loader";
import CookieBanner from "@/components/CookieBanner";
import OAuthHandler from "@/components/OAuthHandler";
import LiveChat from "@/components/LiveChat";
import LanguagePickerOverlay from "@/components/LanguagePickerOverlay";
import { CommandPalette } from "@/components/CommandPalette";
import HelpLauncher from "@/components/HelpLauncher";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import SWUpdateToast from "@/components/SWUpdateToast";
import NetworkStatusToast from "@/components/NetworkStatusToast";
import MobileBottomNav from "@/components/MobileBottomNav";
import Navbar from "@/components/Navbar";
import { RootNavbarProvider } from "@/lib/navigation/chromeContext";
import { defaultViewport, SITE_CONFIG } from "@/lib/metadata.config";
import JsonLd from "@/components/JsonLd";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import { Toaster } from "sonner";

// Locale detection uses cookies/headers which requires dynamic rendering
// Individual pages can opt into static generation where appropriate

// Re-export viewport from metadata config
export const viewport: Viewport = defaultViewport;

// Shared locale data fetcher — called once, not twice per request
async function getLocaleData() {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const dir = getDir(locale);
  return { locale, messages, dir };
}

// Internationalized root metadata
export async function generateMetadata(): Promise<Metadata> {
  const { messages, locale } = await getLocaleData();
  const meta = messages?.meta?.home;

  const title = meta?.title || `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;
  const description = meta?.description || SITE_CONFIG.description;

  return {
    metadataBase: new URL(SITE_CONFIG.url),
    title: {
      default: title,
      template: `%s | ${SITE_CONFIG.name}`,
    },
    description,
    keywords: [...SITE_CONFIG.keywords],
    authors: [...SITE_CONFIG.authors],
    creator: SITE_CONFIG.creator,
    publisher: SITE_CONFIG.publisher,
    category: SITE_CONFIG.category,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: SITE_CONFIG.verification.google || undefined,
      other: {
        "msvalidate.01": [SITE_CONFIG.verification.bing],
      },
    },
    alternates: {
      canonical: SITE_CONFIG.url,
      languages: {
        en: "/en",
        fr: "/fr",
        ar: "/ar",
        kab: "/kab",
        "x-default": "/",
      } as Record<string, string>,
    },
    icons: {
      icon: [
        { url: "/favicon.png", sizes: "48x48", type: "image/png" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.png",
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
      other: [
        { rel: "apple-touch-icon", url: "/apple-icon.png", sizes: "180x180" },
      ],
    },
    manifest: "/manifest.json",
    openGraph: {
      type: "website",
      locale:
        locale === "ar"
          ? "ar_DZ"
          : locale === "fr"
            ? "fr_DZ"
            : locale === "kab"
              ? "kab_DZ"
              : "en_US",
      alternateLocale: ["en_US", "fr_DZ", "ar_DZ", "kab_DZ"].filter(
        (l) =>
          l !==
          (locale === "ar"
            ? "ar_DZ"
            : locale === "fr"
              ? "fr_DZ"
              : locale === "kab"
                ? "kab_DZ"
                : "en_US"),
      ),
      siteName: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      title,
      description,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      site: SITE_CONFIG.social.twitter,
      creator: SITE_CONFIG.social.twitter,
      title,
      description,
      images: ["/og-image.jpg"],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: SITE_CONFIG.name,
    },
    formatDetection: {
      telephone: true,
      date: true,
      address: true,
      email: true,
      url: true,
    },
    applicationName: SITE_CONFIG.name,
    generator: "Next.js 15",
    referrer: "origin-when-cross-origin",
  };
}

// Dynamic unified linked @graph schema connecting Organization and WebSite entities
function getRootJsonLd(locale: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_CONFIG.url}/#organization`,
        name: SITE_CONFIG.name,
        legalName: "Podacium SARL",
        url: SITE_CONFIG.url,
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_CONFIG.url}/#logo`,
          url: `${SITE_CONFIG.url}/og-image.jpg`,
          caption: SITE_CONFIG.name,
        },
        image: {
          "@id": `${SITE_CONFIG.url}/#logo`,
        },
        description,
        foundingDate: "2025-01-15",
        address: {
          "@type": "PostalAddress",
          addressCountry: "DZ",
          streetAddress: "Es-Senia",
          addressLocality: "Oran",
          addressRegion: "Oran",
          postalCode: "31000",
        },
        areaServed: [
          { "@type": "Country", name: "Algeria" },
          { "@type": "GeoShape", name: "MENA" },
        ],
        knowsAbout: [
          "Software Development",
          "Education Technology",
          "Freelancing Platform",
          "Business Intelligence",
          "Data Analytics",
        ],
        sameAs: [
          `https://twitter.com/${SITE_CONFIG.social.twitter.replace("@", "")}`,
          `https://linkedin.com/company/${SITE_CONFIG.social.linkedin}`,
          `https://facebook.com/${SITE_CONFIG.social.facebook}`,
          `https://instagram.com/${SITE_CONFIG.social.instagram}`,
          `https://youtube.com/${SITE_CONFIG.social.youtube}`,
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: `${SITE_CONFIG.url}/contact`,
          availableLanguage: ["en", "fr", "ar", "kab"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_CONFIG.url}/#website`,
        url: SITE_CONFIG.url,
        name: SITE_CONFIG.name,
        description,
        publisher: {
          "@id": `${SITE_CONFIG.url}/#organization`,
        },
        inLanguage: locale,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_CONFIG.url}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

// Fonts are loaded via @fontsource imports above.
// CSS variables are set in globals.css for Tailwind fontFamily resolution.

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, messages, dir } = await getLocaleData();
  const isRTL = dir === "rtl";
  const rootJsonLd = getRootJsonLd(
    locale,
    messages?.meta?.home?.description || SITE_CONFIG.description,
  );

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${isRTL ? "rtl" : "ltr"}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="text-direction" content={dir} />

        {/* FOUC Prevention Script for Dark Mode, Font Size, and Density */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('podacium-theme') || 'system';
                  var fs = localStorage.getItem('podacium-font-size') || 'medium';
                  var d = localStorage.getItem('podacium-density') || 'comfortable';
                  var rm = localStorage.getItem('podacium-reduced-motion') === 'true';
                  var hc = localStorage.getItem('podacium-high-contrast') === 'true';

                  var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }

                  document.documentElement.setAttribute('data-font-size', fs);
                  document.documentElement.setAttribute('data-density', d);
                  if (rm) document.documentElement.setAttribute('data-reduced-motion', 'true');
                  if (hc) document.documentElement.setAttribute('data-high-contrast', 'true');
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* Additional SEO meta tags */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="application-name" content={SITE_CONFIG.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SITE_CONFIG.name} />
        <meta
          name="format-detection"
          content="telephone=yes,date=yes,address=yes,email=yes,url=yes"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Service Worker registration (only in production on remote domains) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for (let registration of registrations) {
                        registration.unregister();
                      }
                    });
                  } else {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      console.log('SW registered', reg.scope);
                    }).catch(function(err) {
                      console.log('SW registration failed', err);
                    });
                  }
                });
              }
            `,
          }}
        />

        {/* Preconnect to API domain for performance */}
        <link rel="preconnect" href={SITE_CONFIG.apiUrl} />
        <link rel="dns-prefetch" href={SITE_CONFIG.apiUrl} />

        {/* JSON-LD Structured Data */}
        <JsonLd data={rootJsonLd} />
      </head>
      <body
        className={`min-h-screen bg-background ${locale === "ar" ? "font-display" : "font-sans"} text-foreground antialiased ${isRTL ? "rtl" : "ltr"}`}
      >
        <IntlProvider locale={locale} messages={messages}>
          <Providers>
            <ImpersonationBanner />
            <Navbar isRootInstance />
            <RootNavbarProvider>{children}</RootNavbarProvider>
            <CommandPalette />
            <CookieBanner />
            <LiveChat />
            <LanguagePickerOverlay />
            <HelpLauncher />
            <PWAInstallBanner />
            <SWUpdateToast />
            <NetworkStatusToast />
            <MobileBottomNav />
          </Providers>
          <Toaster
            position={isRTL ? "top-left" : "top-right"}
            richColors
            closeButton
            dir={dir}
          />
        </IntlProvider>
      </body>
    </html>
  );
}
