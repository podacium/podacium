import type { Metadata } from "next";
import { SITE_CONFIG, generateI18nAlternates } from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;
  const canonicalUrl = `${SITE_CONFIG.url}/bi/organizations/${slug}`;

  return {
    title: `Organization | ${SITE_CONFIG.name} BI`,
    description: `View organization details on ${SITE_CONFIG.name} BI.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: generateI18nAlternates(`/bi/organizations/${slug}`),
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `Organization | ${SITE_CONFIG.name} BI`,
      description: `View organization details on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Organization | ${SITE_CONFIG.name} BI`,
      description: `View organization details on ${SITE_CONFIG.name} BI.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function BiOrganizationDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
