// /components/hub/ProjectCard.tsx - INTERNATIONALIZED
"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Clock,
  Users,
  Banknote,
  MapPin,
  CheckCircle,
  Calendar,
  Briefcase,
  Award,
  CheckSquare,
  ChevronRight,
} from "lucide-react";
import { ProjectResponse, ProjectStatus } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import FeaturedBadge from "@/components/FeaturedBadge";
import { useTranslations } from "@/lib/i18n";

interface ProjectCardProps {
  project: ProjectResponse;
  showActions?: boolean;
  className?: string;
  variant?: "grid" | "list";
  onClick?: () => void;
  compact?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  showActions = true,
  className = "",
  variant = "grid",
  onClick,
  compact = false,
}) => {
  const { t } = useTranslations("component");

  const isOwner = project.is_owner;
  const hasApplied = project.has_applied;

  // Format budget from description (Algerian Dinar)
  const formatBudget = () => {
    const description = project.description || "";
    const budgetMatch = description.match(/💰 Budget: ([\d,]+) - ([\d,]+) DA/);
    if (budgetMatch) {
      const min = parseInt(budgetMatch[1].replace(/,/g, ""));
      const max = parseInt(budgetMatch[2].replace(/,/g, ""));
      return `${min.toLocaleString()} - ${max.toLocaleString()} DA`;
    }
    return t("comphub.projectCard.budgetNegotiable");
  };

  // Get gradient based on project ID
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

  // Calculate days since posted
  const getPostedDate = () => {
    try {
      const created = new Date(project.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - created.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return t("comphub.projectCard.today");
      if (diffDays === 1) return t("comphub.projectCard.yesterday");
      if (diffDays < 7)
        return t("comphub.projectCard.daysAgo", { days: diffDays.toString() });
      if (diffDays < 30)
        return t("comphub.projectCard.weeksAgo", {
          weeks: Math.floor(diffDays / 7).toString(),
        });
      return t("comphub.projectCard.monthsAgo", {
        months: Math.floor(diffDays / 30).toString(),
      });
    } catch {
      return t("comphub.projectCard.recently");
    }
  };

  // Get clean description without budget
  const getCleanDescription = () => {
    const description = project.description || "";
    return (
      description.replace(/💰 Budget:.*/, "").trim() ||
      t("comphub.projectCard.noDescription")
    );
  };

  // Grid view (compact)
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-r ${getGradient(project.id)} flex items-center justify-center text-white font-bold`}
              >
                {project.title?.charAt(0) || "P"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-700 dark:text-blue-300 transition-colors">
                    {project.title}
                  </h3>
                  {project.featuredBoost ? (
                    <FeaturedBadge
                      type="featured"
                      boost={project.featuredBoost}
                      expiresAt={project.featuredExpiresAt}
                    />
                  ) : null}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {getPostedDate()}
                  </span>
                </div>
              </div>
            </div>
            <StatusBadge status={project.status as ProjectStatus} size="sm" />
          </div>

          {/* Description */}
          <p className="text-gray-600 dark:text-slate-400 text-sm line-clamp-2 mb-3">
            {getCleanDescription()}
          </p>

          {/* Skills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {project.skills?.slice(0, 3).map((skill, index) => (
              <span
                key={`${skill}-${index}`}
                className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium border border-blue-200 dark:border-blue-800/80"
              >
                {skill}
              </span>
            ))}
            {project.skills && project.skills.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-md text-xs font-medium">
                +{project.skills.length - 3}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Banknote className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {formatBudget()}
                </span>
              </div>
            </div>
            {hasApplied && (
              <div className="flex items-center space-x-1 text-green-600 bg-green-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg text-xs">
                <CheckSquare className="w-3 h-3" />
                <span className="font-medium">
                  {t("comphub.projectCard.applied")}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view (full)
  if (variant === "grid") {
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
            className={`h-1.5 rounded-full bg-gradient-to-r ${getGradient(project.id)} mb-5`}
          ></div>

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${getGradient(project.id)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
              >
                {project.title?.charAt(0) || "P"}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg line-clamp-2 group-hover:text-blue-700 dark:text-blue-300 transition-colors mb-1">
                  {project.title}
                </h3>
                {project.featuredBoost ? (
                  <FeaturedBadge
                    type="featured"
                    boost={project.featuredBoost}
                    expiresAt={project.featuredExpiresAt}
                  />
                ) : null}
                {project.owner && (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-slate-400">
                        {project.owner.fullName}
                      </span>
                    </div>
                    {project.owner.phoneVerified && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
            <StatusBadge status={project.status as ProjectStatus} />
          </div>

          {/* Description */}
          <p className="text-gray-600 dark:text-slate-400 text-sm mb-5 line-clamp-3">
            {getCleanDescription()}
          </p>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {project.skills?.slice(0, 5).map((skill, index) => (
              <motion.span
                key={`${skill}-${index}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
              >
                {skill}
              </motion.span>
            ))}
            {project.skills && project.skills.length > 5 && (
              <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-medium">
                +{project.skills.length - 5}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {/* Budget - Takes 2 columns */}
            <div className="col-span-2">
              <div className="flex flex-col items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-emerald-800/80 h-full">
                <Banknote className="w-6 h-6 text-green-600 mb-2" />
                <span className="text-xs text-green-700 font-medium mb-1">
                  {t("comphub.projectCard.stats.budget")}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate w-full text-center">
                  {formatBudget()}
                </span>
              </div>
            </div>

            {/* Posted - Takes 1 column */}
            <div className="col-span-1">
              <div className="flex flex-col items-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 dark:border-blue-800/80 h-full">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                  {t("comphub.projectCard.stats.posted")}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {getPostedDate()}
                </span>
              </div>
            </div>

            {/* Type - Takes 1 column */}
            <div className="col-span-1">
              <div className="flex flex-col items-center p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 dark:border-purple-800/80 h-full">
                <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
                <span className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">
                  {t("comphub.projectCard.stats.type")}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {t("comphub.projectCard.stats.project")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              {project.owner?.city && (
                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {project.owner.city}
                    {project.owner.country && `, ${project.owner.country}`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {hasApplied && (
                <div className="flex items-center space-x-1 text-green-600 bg-green-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg text-sm">
                  <CheckSquare className="w-4 h-4" />
                  <span className="font-medium">
                    {t("comphub.projectCard.applied")}
                  </span>
                </div>
              )}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 dark:text-blue-400 transition-colors" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:border-blue-700 transition-all duration-300 p-6 mb-4 ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-5 flex-1">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${getGradient(project.id)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
          >
            {project.title?.charAt(0) || "P"}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    {project.title}
                  </h3>
                  <StatusBadge status={project.status as ProjectStatus} />
                  {project.featuredBoost ? (
                    <FeaturedBadge
                      type="featured"
                      boost={project.featuredBoost}
                      expiresAt={project.featuredExpiresAt}
                    />
                  ) : null}
                </div>

                <p className="text-gray-600 dark:text-slate-400 mt-2 line-clamp-2">
                  {getCleanDescription()}
                </p>
              </div>
            </div>

            {/* Skills */}
            <div className="flex flex-wrap gap-2">
              {project.skills?.map((skill, index) => (
                <span
                  key={`${skill}-${index}`}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-800/80"
                >
                  {skill}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-slate-400">
              <div className="flex items-center space-x-2">
                <Banknote className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-900 dark:text-slate-100">
                  {formatBudget()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span>{getPostedDate()}</span>
              </div>
              {project.owner && (
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>
                    {t("comphub.projectCard.byOwner", {
                      name: project.owner.fullName,
                    })}
                  </span>
                  {project.owner.phoneVerified && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-3">
          <ChevronRight className="w-5 h-5 text-gray-400 hover:text-blue-500 dark:text-blue-400 transition-colors" />
          {hasApplied && (
            <div className="flex items-center space-x-1 text-green-600 bg-green-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg text-sm">
              <CheckSquare className="w-4 h-4" />
              <span className="font-medium">
                {t("comphub.projectCard.applied")}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
