import type { Metadata } from "next";
import { SITE_CONFIG, generateI18nAlternates } from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonicalUrl = `${SITE_CONFIG.url}/learn/certificates/${id}`;

  return {
    title: `Certificate | ${SITE_CONFIG.name} Learn`,
    description: `View and verify certificates on ${SITE_CONFIG.name} Learn.`,
    robots: {
      index: true,
      follow: true,
    },
    alternates: generateI18nAlternates(`/learn/certificates/${id}`),
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `Certificate | ${SITE_CONFIG.name} Learn`,
      description: `View and verify certificates on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Certificate | ${SITE_CONFIG.name} Learn`,
      description: `View and verify certificates on ${SITE_CONFIG.name} Learn.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function LearnCertificateDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
