import type { Metadata } from "next";
import {
  SITE_CONFIG,
  generatePathMetadata,
  generateI18nAlternates,
} from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;

  // Fetch path data from the public API to build rich, unique metadata.
  // Falls back to generic metadata on error.
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${apiUrl}/api/education/paths/public/${slug}`,
      {
        signal: controller.signal,
        next: { revalidate: 3600 },
      },
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const path = data?.path || data?.data || data;

      if (path && (path.title || path.name)) {
        const title = path.title || path.name;
        const description = path.description || "";
        const courseCount =
          path.totalModules || path.modules?.length || path.total_modules;
        const duration =
          path.totalDuration ||
          path.estimatedCompletionTime ||
          path.total_duration;

        const metadata = generatePathMetadata(
          title,
          description,
          slug,
          path.thumbnailUrl || path.thumbnail_url,
          courseCount,
          duration,
        );
        return {
          ...metadata,
          alternates: generateI18nAlternates(`/learn/paths/${slug}`),
        };
      }
    }
  } catch {
    // Fall through to generic metadata below
  }

  const alternates = generateI18nAlternates(`/learn/paths/${slug}`);

  return {
    title: `Learning Path | ${SITE_CONFIG.name} Learn`,
    description: `Follow structured learning paths on ${SITE_CONFIG.name} Learn.`,
    robots: { index: true, follow: true },
    alternates,
    openGraph: {
      type: "article",
      url: alternates.canonical,
      title: `Learning Path | ${SITE_CONFIG.name} Learn`,
      description: `Follow structured learning paths on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Learning Path | ${SITE_CONFIG.name} Learn`,
      description: `Follow structured learning paths on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function LearnPathDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
