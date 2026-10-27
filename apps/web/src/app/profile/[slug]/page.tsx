import type { Metadata } from "next";
import ProfilePageClient from "@/components/profile/ProfilePageClient";
import { ProfileJsonLd } from "@/components/StructuredData";
import { SITE_CONFIG, generateI18nAlternates } from "@/lib/metadata.config";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchProfileData(slug: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${apiUrl}/api/v1/profiles/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const profile = await fetchProfileData(resolvedParams.slug);

  if (!profile) {
    return {
      title: "Profile Not Found | Podacium",
      description: "The requested user profile on Podacium could not be found.",
    };
  }

  const title = `${profile.full_name}${profile.headline ? ` - ${profile.headline}` : ""} | Podacium`;
  const description =
    profile.bio ||
    profile.tagline ||
    `View ${profile.full_name}'s professional profile, skills, and portfolio on Podacium.`;
  const profileUrl = `${SITE_CONFIG.url}/profile/${resolvedParams.slug}`;
  const avatarUrl =
    profile.avatar_url || `${SITE_CONFIG.url}/images/default-avatar.png`;

  return {
    title,
    description,
    alternates: generateI18nAlternates(`/profile/${resolvedParams.slug}`),
    openGraph: {
      title,
      description,
      url: profileUrl,
      siteName: SITE_CONFIG.name,
      type: "profile",
      images: [
        {
          url: avatarUrl,
          width: 800,
          height: 800,
          alt: profile.full_name,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [avatarUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ProfileSlugPage({ params }: PageProps) {
  const resolvedParams = await params;
  const profile = await fetchProfileData(resolvedParams.slug);

  return (
    <>
      {profile && (
        <ProfileJsonLd
          name={profile.full_name}
          jobTitle={profile.headline || profile.role}
          url={`/profile/${resolvedParams.slug}`}
          imageUrl={profile.avatar_url}
          description={profile.bio}
          skills={profile.skills}
        />
      )}
      <ProfilePageClient />
    </>
  );
}
