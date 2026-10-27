/**
 * Structured Data Components for SEO.
 *
 * Provides reusable JSON-LD schema components for:
 * - BreadcrumbList (all pages)
 * - Course (education pages)
 * - Product (freelancing projects)
 * - FAQPage (help/FAQ pages)
 * - ProfilePage (user profiles)
 */
import React from "react";
import JsonLd from "./JsonLd";
import { SITE_CONFIG } from "@/lib/metadata.config";

const BASE_URL = SITE_CONFIG?.url || "https://podacium.com";

// =============================================================================
// BREADCRUMB
// =============================================================================

interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
  inLanguage?: string;
}

function formatUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${BASE_URL}${cleanUrl}`;
}

/**
 * BreadcrumbList JSON-LD for navigation hierarchy.
 * Should be included on every page.
 */
export function BreadcrumbJsonLd({ items, inLanguage }: BreadcrumbJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const itemUrl = formatUrl(item.url);
      const element: Record<string, any> = {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      };
      if (itemUrl) {
        element.item = itemUrl;
      }
      return element;
    }),
  };

  if (inLanguage) {
    data.inLanguage = inLanguage;
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// WEBPAGE
// =============================================================================

export interface WebPageJsonLdProps {
  name: string;
  description?: string;
  url: string;
  inLanguage?: string;
  breadcrumbItems?: BreadcrumbItem[];
}

/**
 * WebPage JSON-LD for individual semantic pages linked to the site root graph.
 */
export function WebPageJsonLd({
  name,
  description,
  url,
  inLanguage = "en",
  breadcrumbItems,
}: WebPageJsonLdProps) {
  const formattedUrl = formatUrl(url) || BASE_URL;
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${formattedUrl}#webpage`,
    url: formattedUrl,
    name,
    inLanguage,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: SITE_CONFIG?.name || "Podacium",
    },
  };

  if (description) {
    data.description = description;
  }

  if (breadcrumbItems && breadcrumbItems.length > 0) {
    data.breadcrumb = {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems.map((item, index) => {
        const itemUrl = formatUrl(item.url);
        const element: Record<string, any> = {
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
        };
        if (itemUrl) {
          element.item = itemUrl;
        }
        return element;
      }),
    };
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// COURSE
// =============================================================================

interface CourseJsonLdProps {
  name: string;
  description: string;
  provider?: string;
  instructor?: string;
  url: string;
  imageUrl?: string;
  duration?: string; // ISO 8601 duration (e.g., "PT2H30M")
  level?: string; // Beginner, Intermediate, Advanced
  language?: string;
  rating?: { value: number; count: number };
  price?: { amount: number; currency: string };
}

/**
 * Course JSON-LD for education/course pages.
 * @see https://developers.google.com/search/docs/appearance/structured-data/course
 */
export function CourseJsonLd({
  name,
  description,
  provider = "Podacium",
  instructor,
  url,
  imageUrl,
  duration,
  level,
  language = "en",
  rating,
  price,
}: CourseJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    url: formatUrl(url),
    provider: {
      "@type": "Organization",
      name: provider,
      sameAs: BASE_URL,
    },
    inLanguage: language,
    hasCourseInstance: [
      {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: duration || undefined,
      },
    ],
  };

  if (instructor) {
    data.author = {
      "@type": "Person",
      name: instructor,
    };
  }

  if (imageUrl) data.image = imageUrl;
  if (duration) data.timeRequired = duration;
  if (level) {
    data.educationalLevel = level;
    data.coursePrerequisites =
      level === "Beginner" ? "None" : `Basic knowledge required`;
  }

  if (rating && rating.count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.value,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (price) {
    data.offers = {
      "@type": "Offer",
      price: price.amount,
      priceCurrency: price.currency,
      availability: "https://schema.org/InStock",
    };
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// PRODUCT (for freelancing projects)
// =============================================================================

interface ProductJsonLdProps {
  name: string;
  description: string;
  url: string;
  price?: { amount: number; currency: string };
  category?: string;
}

/**
 * Product JSON-LD for freelancing project listings.
 */
export function ProductJsonLd({
  name,
  description,
  url,
  price,
  category,
}: ProductJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url: `${BASE_URL}${url}`,
    brand: {
      "@type": "Organization",
      name: "Podacium",
    },
  };

  if (category) data.category = category;

  if (price) {
    data.offers = {
      "@type": "Offer",
      price: price.amount,
      priceCurrency: price.currency,
      availability: "https://schema.org/InStock",
    };
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// FAQ PAGE
// =============================================================================

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageJsonLdProps {
  items: FAQItem[];
  dateModified?: string;
}

/**
 * FAQPage JSON-LD for help/FAQ pages.
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export function FAQPageJsonLd({ items, dateModified }: FAQPageJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  if (dateModified) {
    data.dateModified = dateModified;
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// PROFILE PAGE
// =============================================================================

interface ProfileJsonLdProps {
  name: string;
  url: string;
  description?: string;
  imageUrl?: string;
  jobTitle?: string;
  skills?: string[];
}

/**
 * ProfilePage JSON-LD for freelancer/user profiles.
 */
export function ProfileJsonLd({
  name,
  url,
  description,
  imageUrl,
  jobTitle,
  skills,
}: ProfileJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name,
      url: `${BASE_URL}${url}`,
      description,
      image: imageUrl,
      jobTitle,
      knowsAbout: skills,
    },
  };

  return <JsonLd data={data} />;
}

// =============================================================================
// JOB POSTING (for freelance projects / gigs)
// =============================================================================

interface JobPostingJsonLdProps {
  title: string;
  description: string;
  url: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string;
  hiringOrganization?: string;
  budget?: { amount: number; currency: string };
  skills?: string[];
}

/**
 * JobPosting JSON-LD for freelancing project listings.
 * @see https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
export function JobPostingJsonLd({
  title,
  description,
  url,
  datePosted = new Date().toISOString(),
  validThrough,
  employmentType = "CONTRACTOR",
  hiringOrganization = "Podacium Client",
  budget,
  skills,
}: JobPostingJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    url: formatUrl(url),
    datePosted,
    employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: hiringOrganization,
      sameAs: BASE_URL,
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Algeria",
    },
  };

  if (validThrough) {
    data.validThrough = validThrough;
  }

  if (skills && skills.length > 0) {
    data.skills = skills.join(", ");
  }

  if (budget) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: budget.currency,
      value: {
        "@type": "QuantitativeValue",
        value: budget.amount,
        unitText: "PROJECT",
      },
    };
  }

  return <JsonLd data={data} />;
}

// =============================================================================
// DATASET (for BI public datasets)
// =============================================================================

interface DatasetJsonLdProps {
  name: string;
  description: string;
  url: string;
  license?: string;
  creator?: string;
  keywords?: string[];
  dateModified?: string;
}

/**
 * Dataset JSON-LD for Business Intelligence datasets.
 * @see https://developers.google.com/search/docs/appearance/structured-data/dataset
 */
export function DatasetJsonLd({
  name,
  description,
  url,
  license = "https://creativecommons.org/licenses/by/4.0/",
  creator = "Podacium Business Intelligence",
  keywords,
  dateModified,
}: DatasetJsonLdProps) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: formatUrl(url),
    license,
    creator: {
      "@type": "Organization",
      name: creator,
      sameAs: BASE_URL,
    },
    isAccessibleForFree: true,
  };

  if (keywords && keywords.length > 0) {
    data.keywords = keywords;
  }

  if (dateModified) {
    data.dateModified = dateModified;
  }

  return <JsonLd data={data} />;
}

export default {
  BreadcrumbJsonLd,
  WebPageJsonLd,
  CourseJsonLd,
  ProductJsonLd,
  JobPostingJsonLd,
  DatasetJsonLd,
  FAQPageJsonLd,
  ProfileJsonLd,
};
