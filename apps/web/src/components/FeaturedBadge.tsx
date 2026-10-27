"use client";

import React from "react";
import { motion } from "framer-motion";
import { Star, Zap, BadgeCheck } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface FeaturedBadgeProps {
  type: "featured" | "boosted" | "premium" | "skill_passport";
  boost?: number;
  expiresAt?: string | null;
  className?: string;
}

const BADGE_CONFIG = {
  featured: {
    icon: Star,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    labelKey: "component.badge.featured",
  },
  boosted: {
    icon: Zap,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    iconColor: "text-purple-500",
    labelKey: "component.badge.boosted",
  },
  premium: {
    icon: Star,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    iconColor: "text-emerald-500",
    labelKey: "component.badge.premium",
  },
  skill_passport: {
    icon: BadgeCheck,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    labelKey: "component.badge.verified",
  },
};

export default function FeaturedBadge({
  type,
  boost,
  expiresAt,
  className = "",
}: FeaturedBadgeProps) {
  const { t } = useTranslations();
  const cfg = BADGE_CONFIG[type];
  const Icon = cfg.icon;
  const boostPercent = boost !== undefined ? Math.round(boost * 100) : null;
  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString()
    : "";
  const titleText = expiresAt
    ? t("component.badge.expires", { date: formattedDate })
    : undefined;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
      title={titleText}
    >
      <Icon className={`w-3 h-3 ${cfg.iconColor}`} />
      {t(cfg.labelKey)}
      {boostPercent !== null && boostPercent < 100 && (
        <span className="opacity-60">({boostPercent}%)</span>
      )}
    </motion.span>
  );
}
