import type { Metadata } from "next";
import {
  SITE_CONFIG,
  generateLiveSessionMetadata,
  generateI18nAlternates,
} from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: sessionId } = await params;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${apiUrl}/api/v1/live-sessions/sessions/${sessionId}`,
      { signal: controller.signal, next: { revalidate: 3600 } },
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const session = await response.json();
      if (session?.title) {
        const metadata = generateLiveSessionMetadata(
          session.title,
          session.description || "",
          sessionId,
          session.thumbnailUrl || undefined,
          session.owner?.name,
          session.scheduledAt || undefined,
          session.category || undefined,
        );
        return {
          ...metadata,
          alternates: generateI18nAlternates(`/live/${sessionId}`),
        };
      }
    }
  } catch {
    /* fall through */
  }

  const alternates = generateI18nAlternates(`/live/${sessionId}`);

  return {
    title: `Live Session | ${SITE_CONFIG.name}`,
    description: `Join this live session on ${SITE_CONFIG.name}.`,
    robots: { index: true, follow: true },
    alternates,
    openGraph: {
      type: "article",
      url: alternates.canonical,
      title: `Live Session | ${SITE_CONFIG.name}`,
      description: `Join this live session on ${SITE_CONFIG.name}.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Live Session | ${SITE_CONFIG.name}`,
      description: `Join this live session on ${SITE_CONFIG.name}.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function LiveSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
