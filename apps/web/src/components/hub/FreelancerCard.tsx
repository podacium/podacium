// /components/hub/FreelancerCard.tsx - INTERNATIONALIZED
"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Star,
  MapPin,
  Briefcase,
  Award,
  CheckCircle,
  BadgeCheck,
  Users,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface FreelancerCardProps {
  freelancer: any;
  showActions?: boolean;
  className?: string;
  variant?: "grid" | "list";
  onClick?: () => void;
  compact?: boolean;
}

export const FreelancerCard: React.FC<FreelancerCardProps> = ({
  freelancer,
  showActions = true,
  className = "",
  variant = "grid",
  onClick,
  compact = false,
}) => {
  const { t } = useTranslations("component");

  // Helper functions to get values regardless of property naming
  const getFullName = () => {
    return (
      freelancer.full_name ||
      freelancer.fullName ||
      t("comphub.freelancerCard.defaultName")
    );
  };

  const isPhoneVerified = () => {
    return freelancer.phone_verified || freelancer.phoneVerified || false;
  };

  const isSkillPassportVerified = () => {
    return freelancer.skillPassportVerified || false;
  };

  const getRating = () => {
    return freelancer.avg_rating || 0;
  };

  const getCertificatesCount = () => {
    return freelancer.certificates_count || 0;
  };

  const getCompletedProjects = () => {
    return freelancer.completed_projects || 0;
  };

  const getTotalEarnings = () => {
    return freelancer.total_earnings || 0;
  };

  const getSkills = () => {
    return freelancer.skills || [];
  };

  const getCity = () => {
    return freelancer.city;
  };

  const getCountry = () => {
    return freelancer.country;
  };

  const getRole = () => {
    return freelancer.role || "FREELANCER";
  };

  const getBio = () => {
    return freelancer.bio || t("comphub.freelancerCard.defaultBio");
  };

  const getProfilePictureUrl = () => {
    return freelancer.profile_picture_url || freelancer.profilePictureUrl;
  };

  // Calculate rating display
  const rating = getRating();
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  // Get gradient based on freelancer ID
  const getGradient = (id: number) => {
    const gradients = [
      "from-blue-500 to-indigo-500",
      "from-indigo-500 to-purple-500",
      "from-purple-500 to-pink-500",
      "from-pink-500 to-rose-500",
      "from-rose-500 to-red-500",
      "from-red-500 to-orange-500",
    ];
    return gradients[id % gradients.length];
  };

  // Format earnings
  const formatEarnings = () => {
    const earnings = getTotalEarnings();
    if (earnings >= 1000000) return `${(earnings / 1000000).toFixed(1)}M+ DA`;
    if (earnings >= 1000) return `${(earnings / 1000).toFixed(1)}K+ DA`;
    return `${earnings} DA`;
  };

  // Calculate trust score
  const calculateTrustScore = () => {
    let score = 0;
    if (isPhoneVerified()) score += 30;
    if (getCertificatesCount() > 0) score += 20;
    if (getCompletedProjects() > 0)
      score += Math.min(getCompletedProjects() * 10, 50);
    if (getSkills().length > 0) score += Math.min(getSkills().length * 5, 20);
    return Math.min(score, 100);
  };

  // Grid view (compact) - updated to use helper functions
  if (variant === "grid" && compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        className={`relative group ${className}`}
      >
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:border-blue-700 transition-all duration-300 p-5 h-full cursor-pointer"
          onClick={onClick}
        >
          {/* Header */}
          <div className="flex items-center space-x-4 mb-4">
            {getProfilePictureUrl() ? (
              <div className="relative">
                <img
                  src={getProfilePictureUrl()}
                  alt={getFullName()}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md"
                />
                {isPhoneVerified() && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${getGradient(freelancer.id)} flex items-center justify-center text-white font-bold text-lg shadow-md`}
              >
                {getFullName().charAt(0) || "F"}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-700 dark:text-blue-300 transition-colors">
                  {getFullName()}
                </h3>
                {isSkillPassportVerified() && (
                  <BadgeCheck className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <Briefcase className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {getRole()}
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          <p className="text-gray-600 dark:text-slate-400 text-sm line-clamp-2 mb-4">
            {getBio()}
          </p>

          {/* Skills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {getSkills()
              .slice(0, 3)
              .map((skill: string, index: number) => (
                <span
                  key={`${skill}-${index}`}
                  className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium border border-blue-200 dark:border-blue-800/80"
                >
                  {skill}
                </span>
              ))}
            {getSkills().length > 3 && (
              <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-md text-xs font-medium">
                +{getSkills().length - 3}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-500" />
                <span>{rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Award className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                <span>{getCompletedProjects()}</span>
              </div>
            </div>
            {getCity() && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span>{getCity()}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view (full)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, transition: { type: "spring", stiffness: 300 } }}
      className={`relative group ${className}`}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all duration-300 p-6 h-full cursor-pointer"
        onClick={onClick}
      >
        {/* Header with gradient bar */}
        <div
          className={`h-1.5 rounded-full bg-gradient-to-r ${getGradient(freelancer.id)} mb-5`}
        ></div>

        {/* Profile Header */}
        <div className="flex items-start space-x-5 mb-5">
          {freelancer.profile_picture_url ? (
            <div className="relative">
              <img
                src={freelancer.profile_picture_url}
                alt={getFullName()}
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg"
              />
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full p-2 border-4 border-white shadow-lg">
                <Award className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${getGradient(freelancer.id)} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}
              >
                {getFullName().charAt(0) || "F"}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-2 border-4 border-white shadow-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xl line-clamp-1 group-hover:text-blue-700 dark:text-blue-300 transition-colors mb-1">
                  {getFullName()}
                </h3>
                {isSkillPassportVerified() && (
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md mb-1">
                    <BadgeCheck className="w-4 h-4" />
                    {t("comphub.freelancerCard.verified")}
                  </span>
                )}
                <p className="text-gray-600 dark:text-slate-400 text-sm mb-2">
                  {t("comphub.freelancerCard.role", {
                    role: getRole(),
                    count: getCompletedProjects().toString(),
                  })}
                </p>
              </div>
              {freelancer.phone_verified && (
                <div className="flex items-center space-x-1 text-green-600 bg-green-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg text-sm">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">
                    {t("comphub.freelancerCard.verified")}
                  </span>
                </div>
              )}
            </div>

            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < fullStars
                          ? "text-yellow-500 fill-yellow-500"
                          : i === fullStars && hasHalfStar
                            ? "text-yellow-500 fill-yellow-300"
                            : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {rating.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  ({getCompletedProjects()} projects)
                </span>
              </div>
            )}

            {/* Location */}
            {(freelancer.city || freelancer.country) && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400">
                <MapPin className="w-4 h-4" />
                <span>
                  {freelancer.city && freelancer.country
                    ? `${freelancer.city}, ${freelancer.country}`
                    : freelancer.city || freelancer.country}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        <p className="text-gray-600 dark:text-slate-400 text-sm mb-6 line-clamp-3">
          {freelancer.bio || t("comphub.freelancerCard.noBio")}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {getSkills()
            .slice(0, 6)
            .map((skill: string, index: number) => (
              <motion.span
                key={`${skill}-${index}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
              >
                {skill}
              </motion.span>
            ))}
          {freelancer.skills && freelancer.skills.length > 6 && (
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-medium">
              +{freelancer.skills.length - 6}
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
            <Award className="w-5 h-5 text-purple-500 dark:text-purple-400 mb-1" />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t("comphub.freelancerCard.stats.projects")}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {getCompletedProjects()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
            <DollarSign className="w-5 h-5 text-green-500 mb-1" />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t("comphub.freelancerCard.stats.earnings")}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {formatEarnings()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
            <CheckCircle className="w-5 h-5 text-blue-500 dark:text-blue-400 mb-1" />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t("comphub.freelancerCard.stats.rating")}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {rating.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
            <Users className="w-5 h-5 text-orange-500 mb-1" />
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {t("comphub.freelancerCard.stats.trust")}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {isPhoneVerified() ? "95%" : "70%"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-5 border-t border-gray-200 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            {(freelancer.certificates_count || 0) > 0 && (
              <div className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400">
                <Award className="w-4 h-4" />
                <span>
                  {t("comphub.freelancerCard.certifications", {
                    count: getCertificatesCount().toString(),
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 dark:text-blue-400 transition-colors" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
