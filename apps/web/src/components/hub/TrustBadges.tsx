// /components/hub/TrustBadges.tsx - INTERNATIONALIZED
"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Award,
  Shield,
  Star,
  Phone,
  Mail,
  BadgeCheck,
  MapPin,
  Globe,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface TrustBadgesProps {
  phoneVerified?: boolean;
  emailVerified?: boolean;
  skillPassportVerified?: boolean;
  certificatesCount?: number;
  completedProjects?: number;
  rating?: number;
  location?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  maxBadges?: number;
}

export const TrustBadges: React.FC<TrustBadgesProps> = ({
  phoneVerified = false,
  emailVerified = false,
  skillPassportVerified = false,
  certificatesCount = 0,
  completedProjects = 0,
  rating = 0,
  location,
  showText = true,
  size = "md",
  className = "",
  maxBadges = 4,
}) => {
  const { t } = useTranslations("component");

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // Create badges array
  const badges = [
    {
      condition: skillPassportVerified,
      icon: <BadgeCheck className={iconSize[size]} />,
      text: t("comphub.trustBadges.skillPassport"),
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      condition: phoneVerified,
      icon: <Phone className={iconSize[size]} />,
      text: t("comphub.trustBadges.phoneVerified"),
      color: "text-green-600 bg-green-50 border-green-200",
    },
    {
      condition: emailVerified,
      icon: <Mail className={iconSize[size]} />,
      text: t("comphub.trustBadges.emailVerified"),
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      condition: certificatesCount > 0,
      icon: <Award className={iconSize[size]} />,
      text: t("comphub.trustBadges.certificatesCount", {
        count: certificatesCount.toString(),
        certificates: t("comphub.trustBadges.certificate", {
          count: String(certificatesCount),
        }),
      }),
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      condition: completedProjects > 0,
      icon: <CheckCircle className={iconSize[size]} />,
      text: t("comphub.trustBadges.projectsCount", {
        count: completedProjects.toString(),
        projects: t("comphub.trustBadges.project", {
          count: String(completedProjects),
        }),
      }),
      color: "text-orange-600 bg-orange-50 border-orange-200",
    },
    {
      condition: rating > 0,
      icon: <Star className={iconSize[size]} />,
      text: rating.toFixed(1),
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    },
    {
      condition: !!location,
      icon: <MapPin className={iconSize[size]} />,
      text: location,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
  ].filter((badge) => badge.condition);

  // Limit number of badges shown
  const displayBadges = maxBadges ? badges.slice(0, maxBadges) : badges;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {displayBadges.map((badge, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          className={`flex items-center space-x-1 px-2 py-1 rounded-lg border ${badge.color} transition-all duration-200`}
        >
          {badge.icon}
          {showText && (
            <span className={`font-medium ${sizeClasses[size]}`}>
              {badge.text}
            </span>
          )}
        </motion.div>
      ))}

      {/* Trust Score Badge (always shown if any other badges) */}
      {badges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/80"
        >
          <Shield className={iconSize[size]} />
          {showText && (
            <span className={`font-medium ${sizeClasses[size]}`}>
              {t("comphub.trustBadges.trusted")}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
};
