/**
 * =============================================================================
 * Podaicium SEO Metadata Configuration
 * =============================================================================
 * Centralized metadata configuration for consistent SEO across all pages.
 * All metadata must follow Google Search Console best practices.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/metadata
 * @see https://developers.google.com/search/docs/appearance/title-link
 * @see https://developers.google.com/search/docs/appearance/snippet
 */

import type { Metadata, Viewport } from "next";

// =============================================================================
// PRODUCTION CONFIGURATION
// =============================================================================

export const SITE_CONFIG = {
  name: "Podacium",
  tagline: "Learn. Work. Analyze. Grow.",
  description:
    "Podacium is an all-in-one platform combining online education, freelance marketplace, and business intelligence tools. Empowering professionals across MENA and beyond.",
  url: "https://podacium.com",
  apiUrl: "https://backend-api.podacium.com",
  locales: ["en", "fr", "ar", "kab"] as const,
  defaultLocale: "en" as const,
  authors: [{ name: "Podacium Team", url: "https://podacium.com/about" }],
  creator: "Podacium Inc.",
  publisher: "Podacium Inc.",
  keywords: [
    "online learning",
    "e-learning platform",
    "freelance marketplace",
    "business intelligence",
    "data analytics",
    "online courses",
    "professional development",
    "MENA jobs",
    "remote work",
    "BI tools",
    "data visualization",
    "learning management system",
    "freelance platform",
    "project management",
    "certificates",
    "upskilling",
    "career growth",
    "EdTech",
    "Arabic courses",
    "French courses",
    "English courses",
  ],
  category: "Education & Business Platform",
  verification: {
    // Google Search Console site verification.
    // 1. Go to https://search.google.com/search-console → Add property → podacium.com
    // 2. Choose "HTML tag" verification method → copy the `content` value
    // 3. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<that-value> in your .env.local
    //    and .env.production files (NOT committed to git — keep it secret).
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    bing: "E52A9F6617A98B7771FE57D4FAB563CF",
  },
  social: {
    twitter: "@podacium",
    linkedin: "podacium",
    facebook: "podacium",
    instagram: "podacium",
    youtube: "@PodaciumDZ",
  },
} as const;

// =============================================================================
// VIEWPORT CONFIGURATION
// =============================================================================

export const defaultViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  colorScheme: "light dark",
};

// =============================================================================
// BASE METADATA (Root Layout)
// =============================================================================

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [...SITE_CONFIG.keywords],
  authors: [...SITE_CONFIG.authors],
  creator: SITE_CONFIG.creator,
  publisher: SITE_CONFIG.publisher,
  category: SITE_CONFIG.category,

  // Robots configuration at root level
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

  // Verification tags
  verification: {
    google: SITE_CONFIG.verification.google || undefined,
  },

  // Canonical and alternate languages
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

  // Icons configuration
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "16x16 32x32", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        url: "/favicon-white.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },

  // Manifest
  manifest: "/manifest.json",

  // OpenGraph base configuration
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["fr_FR", "ar_AR"],
    siteName: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
      },
    ],
  },

  // Twitter Card configuration
  twitter: {
    card: "summary_large_image",
    site: SITE_CONFIG.social.twitter,
    creator: SITE_CONFIG.social.twitter,
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    images: ["/og-image.jpg"],
  },

  // Apple specific
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_CONFIG.name,
  },

  // Format detection
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true,
    url: true,
  },

  // Archives and search
  archives: ["https://podacium.com/blog"],

  // Application metadata
  applicationName: SITE_CONFIG.name,
  generator: "Next.js 15",
  referrer: "origin-when-cross-origin",
};

// =============================================================================
// PAGE-SPECIFIC METADATA GENERATORS
// =============================================================================

interface PageMetadataConfig {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogType?: "website" | "article" | "profile";
  keywords?: readonly string[];
  noindex?: boolean;
  nofollow?: boolean;
  alternateLocales?: Record<string, string>;
}

/**
 * Standardized Google Search Central compliant hreflang generator
 * Generates self-referencing alternates for all supported locales + x-default
 */
export function generateI18nAlternates(canonicalPath: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    SITE_CONFIG.url ||
    "https://podacium.com";
  const cleanPath = canonicalPath.replace(/^\/(en|fr|ar|kab)/, "");
  const normalizedPath =
    cleanPath === "" || cleanPath === "/"
      ? ""
      : cleanPath.startsWith("/")
        ? cleanPath
        : `/${cleanPath}`;

  return {
    canonical: `${baseUrl}/fr${normalizedPath}`,
    languages: {
      fr: `${baseUrl}/fr${normalizedPath}`,
      ar: `${baseUrl}/ar${normalizedPath}`,
      en: `${baseUrl}/en${normalizedPath}`,
      kab: `${baseUrl}/kab${normalizedPath}`,
      "x-default": `${baseUrl}/fr${normalizedPath}`, // French as Algerian commercial default
    },
  };
}

/**
 * Generate complete metadata for a specific page
 */
export function generatePageMetadata(config: PageMetadataConfig): Metadata {
  const fullUrl = `${SITE_CONFIG.url}${config.path}`;
  const canonicalUrl = config.path === "/" ? SITE_CONFIG.url : fullUrl;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords
      ? [...SITE_CONFIG.keywords, ...config.keywords]
      : [...SITE_CONFIG.keywords],

    // Robots control
    robots: {
      index: !config.noindex,
      follow: !config.nofollow,
      googleBot: {
        index: !config.noindex,
        follow: !config.nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: canonicalUrl,
      languages: config.alternateLocales || {
        en: `${SITE_CONFIG.url}/en${config.path === "/" ? "" : config.path}`,
        fr: `${SITE_CONFIG.url}/fr${config.path === "/" ? "" : config.path}`,
        ar: `${SITE_CONFIG.url}/ar${config.path === "/" ? "" : config.path}`,
        kab: `${SITE_CONFIG.url}/kab${config.path === "/" ? "" : config.path}`,
        "x-default": `${SITE_CONFIG.url}/fr${config.path === "/" ? "" : config.path}`,
      },
    },

    // OpenGraph
    openGraph: {
      type: config.ogType || "website",
      locale: "en_US",
      alternateLocale: ["fr_FR", "ar_AR"],
      siteName: SITE_CONFIG.name,
      url: canonicalUrl,
      title: config.title,
      description: config.description,
      images: [
        {
          url: config.ogImage || "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
    },

    // Twitter
    twitter: {
      card: "summary_large_image",
      site: SITE_CONFIG.social.twitter,
      creator: SITE_CONFIG.social.twitter,
      title: config.title,
      description: config.description,
      images: [config.ogImage || "/og-image.jpg"],
    },
  };
}

/**
 * Generate metadata for dynamic pages (courses, projects, freelancers, etc.)
 */
export function generateDynamicMetadata(
  title: string,
  description: string,
  path: string,
  image?: string,
  publishedTime?: string,
  modifiedTime?: string,
  authors?: string[],
  ogType: "website" | "article" | "profile" = "article",
): Metadata {
  const metadata = generatePageMetadata({
    title,
    description,
    path: path.startsWith("http") ? new URL(path).pathname : path,
    ogImage: image,
    ogType,
  });

  // If path is a full URL, use it as canonical directly
  if (path.startsWith("http") && metadata.alternates) {
    metadata.alternates.canonical = path;
  }

  const ogData: Record<string, unknown> = {
    ...metadata.openGraph,
    type: ogType,
  };

  if (ogType === "article") {
    if (publishedTime) ogData.publishedTime = publishedTime;
    if (modifiedTime) ogData.modifiedTime = modifiedTime;
    ogData.authors = authors || [SITE_CONFIG.name];
  }

  return {
    ...metadata,
    openGraph: ogData as Metadata["openGraph"],
  };
}

// =============================================================================
// PRE-BUILT PAGE METADATA CONFIGURATIONS
// =============================================================================
//
// CANONICAL STATIC REFERENCE — This object defines the ideal title, description,
// path, and keywords for every public page on Podacium. It is the single source
// of truth for page metadata intent.
//
// ACTIVE SYSTEM: Per-page layouts use `generateI18nMetadata()` (from
// i18n-metadata.ts) which reads localized titles/descriptions from locale JSON
// files. The PAGE_METADATA entries below are the canonical English defaults and
// should be mirrored in each locale's `meta.*` block.
//
// To switch a page from locale-driven metadata to static metadata, call
// `generatePageMetadata(PAGE_METADATA.pageKey)` in the layout instead of
// `generateI18nMetadata()`.
// =============================================================================

export const PAGE_METADATA = {
  // Marketing Pages
  home: {
    title: "Podacium — Learn. Work. Analyze. Grow.",
    description:
      "The all-in-one platform for online learning, freelance work, and business intelligence. Join thousands of professionals across MENA advancing their careers.",
    path: "/",
    keywords: [
      "online learning platform",
      "freelance marketplace",
      "business intelligence tools",
    ],
  },

  about: {
    title: "About Podacium — Our Mission & Vision",
    description:
      "Discover how Podacium is transforming education and work across MENA. Learn about our mission to empower professionals through learning, freelancing, and data-driven insights.",
    path: "/about",
    keywords: ["about podacium", "our mission", "EdTech MENA", "company story"],
  },

  pricing: {
    title: "Podacium Pricing — Plans for Every Professional",
    description:
      "Choose the perfect plan for your needs. From free tier to enterprise, unlock learning, freelancing, and BI tools that accelerate your career growth.",
    path: "/pricing",
    keywords: ["pricing plans", "subscription", "free tier", "enterprise"],
  },

  contact: {
    title: "Contact Podacium — We're Here to Help",
    description:
      "Get in touch with the Podacium team. Whether you have questions about learning, freelancing, or BI tools, we're ready to assist you.",
    path: "/contact",
    keywords: ["contact us", "customer support", "help center"],
  },

  careers: {
    title: "Careers at Podacium — Join Our Team",
    description:
      "Be part of the future of education and work. Explore open positions at Podacium and help us build the platform that empowers professionals across MENA.",
    path: "/careers",
    keywords: ["jobs", "hiring", "careers", "work with us"],
  },

  partners: {
    title: "Partner with Podacium — Collaboration Opportunities",
    description:
      "Explore partnership opportunities with Podacium. Whether you're a university, business, or NGO, let's create impact together across education and technology.",
    path: "/partners",
    keywords: ["partnerships", "university collaboration", "business partners"],
  },

  // Legal Pages
  privacy: {
    title: "Privacy Policy — How Podacium Protects Your Data",
    description:
      "Learn how Podacium collects, uses, and protects your personal information. Transparency and data security are our top priorities.",
    path: "/privacy",
    keywords: [
      "privacy policy",
      "data protection",
      "Algerian Law 18-07",
      "personal data",
    ],
  },

  terms: {
    title: "Terms of Service — Podacium User Agreement",
    description:
      "Read the terms and conditions governing your use of Podacium's learning, freelancing, and business intelligence services.",
    path: "/terms",
    keywords: ["terms of service", "user agreement", "legal terms"],
  },

  cookies: {
    title: "Cookie Policy — How Podacium Uses Cookies",
    description:
      "Understand how Podacium uses cookies and similar technologies to enhance your learning and work experience on our platform.",
    path: "/cookies",
    keywords: ["cookie policy", "tracking", "privacy"],
  },

  refund: {
    title: "Refund Policy — Podacium Money-Back Guarantee",
    description:
      "Learn about Podacium's refund policy for courses, subscriptions, and services. We believe in fair and transparent billing practices.",
    path: "/refund",
    keywords: ["refund policy", "money back", "cancellation"],
  },

  // Hub Module
  hub: {
    title: "Podacium Hub — Find Work & Hire Talent",
    description:
      "Connect with top freelancers and exciting projects on Podacium Hub. The premier marketplace for skills and opportunities across MENA.",
    path: "/hub",
    keywords: ["freelance marketplace", "hire freelancers", "find work"],
  },

  hubProjects: {
    title: "Browse Projects — Find Freelance Opportunities",
    description:
      "Discover exciting freelance projects across development, design, marketing, and more. Apply to opportunities that match your skills.",
    path: "/hub/projects",
    keywords: ["freelance projects", "job board", "gig economy"],
  },

  hubFreelancers: {
    title: "Hire Freelancers — Top Talent on Podacium",
    description:
      "Browse skilled freelancers ready to bring your projects to life. From developers to designers, find the perfect talent for your needs.",
    path: "/hub/freelancers",
    keywords: ["hire freelancers", "top talent", "contractors"],
  },

  hubContracts: {
    title: "Contract Management — Secure Freelance Agreements",
    description:
      "Manage your freelance contracts with confidence. Milestone-based payments, dispute resolution, and secure collaboration tools.",
    path: "/hub/contracts",
    keywords: ["freelance contracts", "secure payments", "milestone tracking"],
  },

  // Learn Module
  learn: {
    title: "Podacium Learn — Online Courses & Certifications",
    description:
      "Advance your career with expert-led courses and industry-recognized certifications. Learn in-demand skills across tech, business, and creative fields.",
    path: "/learn",
    keywords: [
      "online courses",
      "certifications",
      "e-learning",
      "skill development",
    ],
  },

  learnCourses: {
    title: "Browse Courses — Learn New Skills Online",
    description:
      "Explore hundreds of courses taught by industry experts. From programming to design, find the perfect course to advance your career.",
    path: "/learn/courses",
    keywords: ["online courses", "skill learning", "professional development"],
  },

  learnPaths: {
    title: "Learning Paths — Structured Career Development",
    description:
      "Follow curated learning paths designed by industry experts. Structured curricula that take you from beginner to job-ready professional.",
    path: "/learn/paths",
    keywords: ["learning paths", "career tracks", "structured learning"],
  },

  // BI Module
  bi: {
    title: "Podacium BI — Business Intelligence & Analytics",
    description:
      "Transform your data into actionable insights. Create dashboards, analyze datasets, and make data-driven decisions with Podacium BI.",
    path: "/bi",
    keywords: [
      "business intelligence",
      "data analytics",
      "dashboards",
      "BI tools",
    ],
  },

  biAnalytics: {
    title: "Analytics Tools — Data Visualization & Insights",
    description:
      "Powerful analytics tools to visualize and understand your data. Create stunning charts, reports, and interactive dashboards.",
    path: "/bi/analytics",
    keywords: ["data visualization", "analytics tools", "charts", "graphs"],
  },

  biDashboards: {
    title: "Dashboard Gallery — Public BI Dashboards",
    description:
      "Explore community-created dashboards and share your own. Discover insights from public datasets and inspire your analytics journey.",
    path: "/bi/dashboards",
    keywords: ["dashboards", "data visualization", "public datasets"],
  },

  biDatasets: {
    title: "Dataset Repository — Open Data & Resources",
    description:
      "Access and contribute to our repository of public datasets. Clean, curated data for your analysis and research projects.",
    path: "/bi/datasets",
    keywords: ["datasets", "open data", "data repository"],
  },

  companies: {
    title: "Algerian Enterprise & Company Directory — 58 Wilayas Ecosystem",
    description:
      "Discover verified Algerian companies, high-growth startups, and sovereign institutions across 58 Wilayas with KYB status and ratings.",
    path: "/companies",
    keywords: [
      "algerian companies",
      "algeria directory",
      "enterprise algeria",
      "startups algeria",
      "58 wilayas",
    ],
  },

  biOrganizations: {
    title: "BI Organizations — Analytics Communities",
    description:
      "Connect with organizations leveraging data for impact. Discover analytics teams, data communities, and business intelligence networks.",
    path: "/bi/organizations",
    keywords: ["data organizations", "analytics communities", "BI networks"],
  },

  biReports: {
    title: "Reports Gallery — Data-Driven Insights",
    description:
      "Browse and share data reports from the Podacium community. Discover insights, trends, and analysis from public datasets.",
    path: "/bi/reports",
    keywords: ["data reports", "analytics reports", "insights"],
  },

  biQuality: {
    title: "Data Quality Tools — Clean & Validate Data",
    description:
      "Ensure your data meets the highest standards. Automated quality checks, validation rules, and data cleansing tools.",
    path: "/bi/quality",
    keywords: ["data quality", "data validation", "data cleansing"],
  },

  biDecisions: {
    title: "Decision Support — Data-Driven Decision Making",
    description:
      "Make better decisions with AI-powered recommendations. Analyze scenarios, predict outcomes, and optimize your strategies.",
    path: "/bi/decisions",
    keywords: ["decision support", "AI recommendations", "scenario analysis"],
  },

  // Auth Pages (NOINDEX)
  login: {
    title: "Sign In — Access Your Podacium Account",
    description:
      "Sign in to your Podacium account to access courses, projects, and analytics tools.",
    path: "/auth/login",
    noindex: true,
  },

  signup: {
    title: "Create Account — Join Podacium Today",
    description:
      "Create your free Podacium account and start learning, freelancing, or analyzing data today.",
    path: "/auth/signup",
    noindex: true,
  },

  forgotPassword: {
    title: "Reset Password — Podacium Account Recovery",
    description:
      "Reset your Podacium account password. We'll send you instructions to regain access.",
    path: "/auth/forgot-password",
    noindex: true,
  },

  // User Dashboard (NOINDEX)
  dashboard: {
    title: "Dashboard — Your Podacium Home",
    description:
      "Your personalized Podacium dashboard. Track your learning progress, manage projects, and view analytics.",
    path: "/dashboard",
    noindex: true,
  },

  profile: {
    title: "Your Profile — Manage Your Account",
    description:
      "Manage your Podacium profile, skills, and portfolio. Update your information and visibility settings.",
    path: "/profile",
    noindex: true,
  },

  settings: {
    title: "Account Settings — Podacium Preferences",
    description:
      "Configure your Podacium account settings, notifications, and privacy preferences.",
    path: "/settings",
    noindex: true,
  },

  notifications: {
    title: "Notifications — Your Podacium Activity",
    description:
      "Stay updated with your Podacium notifications. Course updates, project messages, and system alerts.",
    path: "/notifications",
    noindex: true,
  },

  billing: {
    title: "Billing & Subscriptions — Podacium Account",
    description:
      "Manage your Podacium subscription, payment methods, and billing history.",
    path: "/billing",
    noindex: true,
  },

  // Auxiliary & System Pages
  unauthorized: {
    title: "Unauthorized Access — Podacium",
    description:
      "You do not have permission to access this page. Please sign in with an authorized account.",
    path: "/unauthorized",
    noindex: true,
  },

  verify: {
    title: "Verify Your Account — Podacium",
    description:
      "Confirm your email address to activate your Podacium account and start learning or working.",
    path: "/auth/verify-email",
    noindex: true,
  },

  onboarding: {
    title: "Welcome to Podacium — Setup Your Profile",
    description:
      "Complete your profile setup to get personalized course recommendations and professional opportunities.",
    path: "/onboarding",
    noindex: true,
  },

  aiAnalytics: {
    title: "AI Insights & Analytics — Podacium",
    description:
      "Harness the power of AI to analyze your learning progress and professional growth.",
    path: "/ai-analytics",
    noindex: true,
  },

  payment: {
    title: "Secure Checkout — Podacium",
    description:
      "Complete your purchase securely. We support multiple payment methods for your convenience.",
    path: "/payment",
    noindex: true,
  },

  paymentSuccess: {
    title: "Payment Successful — Podacium",
    description:
      "Your payment has been processed successfully. Thank you for your purchase on Podacium.",
    path: "/payment/success",
    noindex: true,
  },

  paymentFailure: {
    title: "Payment Failed — Podacium",
    description:
      "We could not process your payment. Please try again or use a different payment method.",
    path: "/payment/failure",
    noindex: true,
  },

  paymentCheckout: {
    title: "Checkout — Podacium",
    description:
      "Review your order and complete your purchase securely on Podacium.",
    path: "/payment/mock-checkout",
    noindex: true,
  },

  // Hub Private Pages
  hubMessages: {
    title: "Messages — Podacium Hub",
    description:
      "Manage your conversations with clients and freelancers. Stay connected on Podacium Hub.",
    path: "/hub/messages",
    noindex: true,
  },

  hubProposals: {
    title: "My Proposals — Podacium Hub",
    description:
      "Track and manage your project proposals and applications on Podacium Hub.",
    path: "/hub/proposals",
    noindex: true,
  },

  hubProjectsNew: {
    title: "Post a New Project — Podacium Hub",
    description:
      "Create and post a new project to find talented freelancers on Podacium Hub.",
    path: "/hub/projects/new",
    noindex: true,
  },

  // BI Private Pages
  biDashboardsNew: {
    title: "Create Dashboard — Podacium BI",
    description:
      "Build custom interactive data dashboards with drag-and-drop widgets on Podacium BI.",
    path: "/bi/dashboards/new",
    noindex: true,
  },

  biDatasetsUpload: {
    title: "Upload Dataset — Podacium BI",
    description:
      "Upload your CSV, Excel, or JSON datasets for analysis and visualization on Podacium BI.",
    path: "/bi/datasets/upload",
    noindex: true,
  },

  biOrganizationInvitations: {
    title: "Organization Invitations — Podacium BI",
    description:
      "View and accept invitations to join analytics organizations on Podacium BI.",
    path: "/bi/organizations/invitations",
    noindex: true,
  },

  // Utility Pages
  docs: {
    title: "Documentation — Podacium Developer Docs",
    description:
      "Comprehensive documentation for Podacium's Learning, Freelance Hub, and Business Intelligence APIs and platform features.",
    path: "/docs",
    noindex: true,
  },

  help: {
    title: "Help Center — Podacium Support",
    description:
      "Get help with courses, freelance projects, billing, and BI tools. Browse FAQs and contact Podacium support.",
    path: "/help",
    noindex: true,
  },

  admin: {
    title: "Admin Dashboard — Podacium",
    description:
      "Administrative dashboard for Podacium platform management. Manage users, courses, and system settings.",
    path: "/admin",
    noindex: true,
  },
} as const;

// =============================================================================
// DYNAMIC METADATA HELPERS
// =============================================================================

export function generateCourseMetadata(
  title: string,
  description: string,
  slug: string,
  thumbnailUrl?: string,
  instructor?: string,
  duration?: string,
  level?: string,
): Metadata {
  const enhancedDescription = `${description} Learn ${title} with ${instructor || "expert instructors"}. Duration: ${duration || "self-paced"}. Level: ${level || "All levels"}.`;

  return generateDynamicMetadata(
    `${title} — Online Course | Podacium`,
    enhancedDescription.slice(0, 160),
    `/learn/courses/${slug}`,
    thumbnailUrl,
    undefined,
    undefined,
    instructor ? [instructor] : undefined,
  );
}

export function generatePathMetadata(
  title: string,
  description: string,
  slug: string,
  thumbnailUrl?: string,
  courseCount?: number,
  duration?: string,
): Metadata {
  const enhancedDescription = `${description} A curated learning path with ${courseCount || "multiple"} courses. ${duration ? `Complete in ${duration}.` : ""} Start your journey today.`;

  return generateDynamicMetadata(
    `${title} — Learning Path | Podacium`,
    enhancedDescription.slice(0, 160),
    `/learn/paths/${slug}`,
    thumbnailUrl,
  );
}

export function generateProjectMetadata(
  title: string,
  description: string,
  slug: string,
  budget?: string,
  skills?: string[],
  clientName?: string,
): Metadata {
  const skillsText = skills?.slice(0, 5).join(", ") || "";
  const enhancedDescription = `${description.slice(0, 100)}${description.length > 100 ? "..." : ""} Budget: ${budget || "Negotiable"}. Skills: ${skillsText}. Posted by ${clientName || "verified client"}.`;

  return generateDynamicMetadata(
    `${title} — Freelance Project | Podacium Hub`,
    enhancedDescription.slice(0, 160),
    `/hub/projects/${slug}`,
  );
}

export function generateFreelancerMetadata(
  name: string,
  headline: string,
  slug: string,
  avatarUrl?: string,
  skills?: string[],
  rating?: number,
): Metadata {
  const skillsText = skills?.slice(0, 5).join(", ") || "";
  const ratingText = rating ? `${rating}/5 rating. ` : "";
  const enhancedDescription = `${ratingText}${headline} Skills: ${skillsText}. Hire ${name.split(" ")[0]} on Podacium Hub for your next project.`;

  return generateDynamicMetadata(
    `${name} — ${headline} | Podacium Freelancer`,
    enhancedDescription.slice(0, 160),
    `/hub/freelancers/${slug}`,
    avatarUrl,
    undefined,
    undefined,
    undefined,
    "profile",
  );
}

export function generateDashboardMetadata(
  title: string,
  description: string,
  slug: string,
  thumbnailUrl?: string,
  author?: string,
  organization?: string,
): Metadata {
  const authorText = author ? `Created by ${author}. ` : "";
  const orgText = organization ? `From ${organization}. ` : "";
  const enhancedDescription = `${authorText}${orgText}${description}`;

  return generateDynamicMetadata(
    `${title} — BI Dashboard | Podacium`,
    enhancedDescription.slice(0, 160),
    `/bi/dashboards/${slug}`,
    thumbnailUrl,
  );
}

export function generateDatasetMetadata(
  title: string,
  description: string,
  slug: string,
  rows?: number,
  columns?: number,
  tags?: string[],
): Metadata {
  const sizeText =
    rows && columns
      ? `${rows.toLocaleString()} rows × ${columns} columns. `
      : "";
  const tagsText = tags?.slice(0, 5).join(", ") || "";
  const enhancedDescription = `${sizeText}${description.slice(0, 120)} Tags: ${tagsText}.`;

  return generateDynamicMetadata(
    `${title} — Dataset | Podacium BI`,
    enhancedDescription.slice(0, 160),
    `/bi/datasets/${slug}`,
  );
}

export function generateCertificateMetadata(
  id: string,
  recipientName: string,
  courseName: string,
  issueDate: string,
): Metadata {
  return generateDynamicMetadata(
    `${recipientName} — ${courseName} Certificate | Podacium`,
    `Verify ${recipientName}'s certificate for completing ${courseName} on Podacium. Issued: ${issueDate}.`,
    `/learn/certificates/${id}`,
  );
}

export function generateLiveSessionMetadata(
  title: string,
  description: string,
  sessionId: string,
  thumbnailUrl?: string,
  ownerName?: string,
  scheduledAt?: string,
  category?: string,
): Metadata {
  const catText = category ? ` Category: ${category}.` : "";
  const hostText = ownerName ? ` Hosted by ${ownerName}.` : "";
  const enhancedDescription = `${description}${hostText}${catText} Join live on Podacium.`;

  return generateDynamicMetadata(
    `${title} — Live Session | Podacium`,
    enhancedDescription.slice(0, 160),
    `/live/${sessionId}`,
    thumbnailUrl,
    scheduledAt,
    undefined,
    ownerName ? [ownerName] : undefined,
  );
}
