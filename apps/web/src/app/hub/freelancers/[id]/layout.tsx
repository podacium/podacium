import type { Metadata } from "next";
import {
  SITE_CONFIG,
  generateFreelancerMetadata,
  generateI18nAlternates,
} from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;

  // Fetch freelancer data from the public API to build rich, unique metadata.
  // Falls back to generic metadata on error.
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${apiUrl}/api/public/freelancers/${slug}`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const freelancer = data?.freelancer || data?.data || data;

      if (
        freelancer &&
        (freelancer.full_name || freelancer.fullName || freelancer.name)
      ) {
        const name =
          freelancer.full_name || freelancer.fullName || freelancer.name;
        const bio = freelancer.bio || freelancer.headline || "";
        const avatarUrl =
          freelancer.profile_picture_url ||
          freelancer.profilePictureUrl ||
          freelancer.avatarUrl;
        const skills = freelancer.skills || [];

        const metadata = generateFreelancerMetadata(
          name,
          bio ||
            `${skills.slice(0, 3).join(", ") || "Professional"} freelancer`,
          slug,
          avatarUrl,
          skills,
        );
        return {
          ...metadata,
          alternates: generateI18nAlternates(`/hub/freelancers/${slug}`),
        };
      }
    }
  } catch {
    // Fall through to generic metadata below
  }

  const alternates = generateI18nAlternates(`/hub/freelancers/${slug}`);

  return {
    title: `Freelancer Profile | ${SITE_CONFIG.name} Hub`,
    description: `View freelancer profiles and portfolios on ${SITE_CONFIG.name} Hub.`,
    robots: { index: true, follow: true },
    alternates,
    openGraph: {
      type: "profile",
      url: alternates.canonical,
      title: `Freelancer Profile | ${SITE_CONFIG.name} Hub`,
      description: `View freelancer profiles and portfolios on ${SITE_CONFIG.name} Hub.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Freelancer Profile | ${SITE_CONFIG.name} Hub`,
      description: `View freelancer profiles and portfolios on ${SITE_CONFIG.name} Hub.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function HubFreelancerDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
