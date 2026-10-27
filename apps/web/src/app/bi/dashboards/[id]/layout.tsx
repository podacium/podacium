import type { Metadata } from "next";
import { SITE_CONFIG, generateI18nAlternates } from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;
  const canonicalUrl = `${SITE_CONFIG.url}/bi/dashboards/${slug}`;

  return {
    title: `Dashboard | ${SITE_CONFIG.name} BI`,
    description: `View interactive data dashboards on ${SITE_CONFIG.name} BI.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: generateI18nAlternates(`/bi/dashboards/${slug}`),
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `Dashboard | ${SITE_CONFIG.name} BI`,
      description: `View interactive data dashboards on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Dashboard | ${SITE_CONFIG.name} BI`,
      description: `View interactive data dashboards on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function BiDashboardDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
