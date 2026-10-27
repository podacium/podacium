import type { Metadata } from "next";
import { SITE_CONFIG, generateI18nAlternates } from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;
  const canonicalUrl = `${SITE_CONFIG.url}/bi/datasets/${slug}`;

  return {
    title: `Dataset | ${SITE_CONFIG.name} BI`,
    description: `Explore and analyze datasets on ${SITE_CONFIG.name} BI.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: generateI18nAlternates(`/bi/datasets/${slug}`),
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `Dataset | ${SITE_CONFIG.name} BI`,
      description: `Explore and analyze datasets on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Dataset | ${SITE_CONFIG.name} BI`,
      description: `Explore and analyze datasets on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function BiDatasetDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
