// apps/web/src/app/about/types.ts

export interface FounderProfile {
  id: number;
  name: string;
  role: string;
  bio: string;
  avatarInitials: string;
  avatarGradient: string;
  accentColor: "blue" | "green" | "purple" | "amber";
  photoUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  parcours: {
    education: string[];
    highlights: string[];
  };
}

export interface EcosystemPillar {
  id: string;
  number: string;
  title: string;
  badge: string;
  description: string;
  features: string[];
  color: string;
  accentBg: string;
  borderColor: string;
  gradient: string;
  ctaText: string;
  ctaLink: string;
  iconName: "book" | "briefcase" | "chart";
  topHairline?: string;
  glowColor?: string;
  iconGradient?: string;
  badgeStyle?: string;
  bulletStyle?: string;
  ctaStyle?: string;
  cardBorder?: string;
  watermarkColor?: string;
}

export interface TrustPartner {
  id: string;
  name: string;
  badge: string;
  description: string;
  category: "academic" | "framework" | "payment" | "compliance";
}

export interface SecurityPillar {
  id: string;
  title: string;
  description: string;
  iconName: "shield" | "award" | "lock";
  badge: string;
}

export interface JourneyMilestone {
  id: number;
  year: string;
  title: string;
  subtitle: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  tags: string[];
}

export interface VisionTarget {
  id: number;
  value: string;
  label: string;
  detail: string;
  color: "blue" | "green" | "purple" | "indigo";
}
