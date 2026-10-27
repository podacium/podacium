import type { Metadata } from "next";
import {
  SITE_CONFIG,
  generateProjectMetadata,
  generateI18nAlternates,
} from "@/lib/metadata.config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: slug } = await params;

  // Fetch project data from the public API to build rich, unique metadata.
  // Falls back to generic metadata on error.
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || SITE_CONFIG.apiUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${apiUrl}/api/public/projects/${slug}`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const project = data?.project || data?.data || data;

      if (project && (project.title || project.name)) {
        const title = project.title || project.name;
        const description = project.description || project.details || "";
        const skills = project.skills || [];
        const owner = project.owner || {};
        const clientName =
          owner.fullName ||
          owner.full_name ||
          project.clientName ||
          project.client_name;
        const budgetRangeMin = project.budget_range_min ?? project.budgetMin;
        const budgetRangeMax = project.budget_range_max ?? project.budgetMax;
        const budget = budgetRangeMax
          ? `${budgetRangeMin || 0} - ${budgetRangeMax} DZD`
          : budgetRangeMin
            ? `From ${budgetRangeMin} DZD`
            : undefined;

        const metadata = generateProjectMetadata(
          title,
          description,
          slug,
          budget,
          skills,
          clientName,
        );
        return {
          ...metadata,
          alternates: generateI18nAlternates(`/hub/projects/${slug}`),
        };
      }
    }
  } catch {
    // Fall through to generic metadata below
  }

  const alternates = generateI18nAlternates(`/hub/projects/${slug}`);

  return {
    title: `Project Details | ${SITE_CONFIG.name} Hub`,
    description: `View project details and submit proposals on ${SITE_CONFIG.name} Hub.`,
    robots: { index: true, follow: true },
    alternates,
    openGraph: {
      type: "article",
      url: alternates.canonical,
      title: `Project Details | ${SITE_CONFIG.name} Hub`,
      description: `View project details and submit proposals on ${SITE_CONFIG.name} Hub.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: `Project Details | ${SITE_CONFIG.name} Hub`,
      description: `View project details and submit proposals on ${SITE_CONFIG.name} Hub.`,
      images: [`${SITE_CONFIG.url}/og-image.jpg`],
    },
  };
}

export default function HubProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
