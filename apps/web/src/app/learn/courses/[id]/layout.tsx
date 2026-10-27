import type { Metadata } from "next";
import {
  SITE_CONFIG,
  generateCourseMetadata,
  generateI18nAlternates,
} from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;

  // Fetch course data from the public API to build rich, unique metadata
  // for every course page. Falls back to generic metadata on error.
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${apiUrl}/api/education/modules/public/${slug}`,
      {
        signal: controller.signal,
        next: { revalidate: 3600 },
      },
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const courseModule = data?.module || data?.data || data;

      if (courseModule && courseModule.title) {
        const metadata = generateCourseMetadata(
          courseModule.title,
          courseModule.description || courseModule.fullDescription || "",
          slug,
          courseModule.thumbnailUrl,
          courseModule.instructor?.fullName,
          courseModule.durationMinutes
            ? `${courseModule.durationMinutes}`
            : undefined,
          courseModule.level,
        );
        return {
          ...metadata,
          alternates: generateI18nAlternates(`/learn/courses/${slug}`),
        };
      }
    }
  } catch {
    // Fall through to generic metadata below
  }

  const alternates = generateI18nAlternates(`/learn/courses/${slug}`);

  return {
    title: `Course | ${SITE_CONFIG.name} Learn`,
    description: `Explore courses and advance your skills on ${SITE_CONFIG.name} Learn.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates,
    openGraph: {
      type: "article",
      url: alternates.canonical,
      title: `Course | ${SITE_CONFIG.name} Learn`,
      description: `Explore courses and advance your skills on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Course | ${SITE_CONFIG.name} Learn`,
      description: `Explore courses and advance your skills on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function LearnCourseDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
