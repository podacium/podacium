"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Building2,
  GraduationCap,
  Image,
  Star,
  Users,
  User,
} from "lucide-react";
import { PodaciumTabs } from "@/components/design-system/PodaciumTabs";
import {
  OverviewTab,
  LearningTab,
  FreelancingTab,
  BusinessTab,
  TeachingTab,
  PortfolioTab,
  ReviewsTab,
  SocialTab,
} from "./profile-tabs";
import type { ProfileData } from "./ProfilePageClient";

interface ProfileTabsSectionProps {
  profile: ProfileData;
  activeTab: string;
  tabs: { id: string; label: string }[];
  onTabChange: (tabId: string) => void;
  viewAs?: "public" | "followers" | "self";
}

const tabIcons: Record<string, React.ReactNode> = {
  overview: <User className="w-4 h-4" />,
  learning: <BookOpen className="w-4 h-4" />,
  freelancing: <Briefcase className="w-4 h-4" />,
  business: <Building2 className="w-4 h-4" />,
  teaching: <GraduationCap className="w-4 h-4" />,
  portfolio: <Image className="w-4 h-4" />,
  reviews: <Star className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
};

export function ProfileTabsSection({
  profile,
  activeTab,
  tabs,
  onTabChange,
}: ProfileTabsSectionProps) {
  const tabConfig = tabs.map((t) => ({
    id: t.id,
    label: t.label,
    icon: tabIcons[t.id],
  }));

  const renderTabContent = (tabId: string) => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={tabId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tabId === "overview" && <OverviewTab profile={profile} />}
          {tabId === "learning" && <LearningTab profile={profile} />}
          {tabId === "freelancing" && <FreelancingTab profile={profile} />}
          {tabId === "business" && <BusinessTab profile={profile} />}
          {tabId === "teaching" && <TeachingTab profile={profile} />}
          {tabId === "portfolio" && <PortfolioTab profile={profile} />}
          {tabId === "reviews" && <ReviewsTab profile={profile} />}
          {tabId === "social" && <SocialTab profile={profile} />}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <PodaciumTabs
      tabs={tabConfig}
      defaultTab={activeTab}
      onChange={onTabChange}
      variant="pills"
      className="mb-0"
      tabsClassName="overflow-x-auto"
    >
      {renderTabContent}
    </PodaciumTabs>
  );
}
