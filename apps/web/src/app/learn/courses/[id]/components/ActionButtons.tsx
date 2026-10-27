"use client";

import React from "react";
import {
  Share2,
  Bookmark,
  User,
  Star,
  MessageSquare,
  Heart,
  GraduationCap,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { apiHelpers } from "@/lib/api";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";

import { ModuleResponse } from "../types";

interface ActionButtonsProps {
  module: ModuleResponse;
  isRtl: boolean;
  enrolledCount?: number;
  onWriteReview?: () => void;
  canReview?: boolean;
  onShare?: () => void;
  onBookmark?: () => void;
  bookmarked?: boolean;
  onSupport?: () => void;
  onViewProfile?: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  module,
  isRtl,
  enrolledCount = 0,
  onWriteReview,
  canReview = false,
  onShare,
  onBookmark,
  bookmarked = false,
  onSupport,
  onViewProfile,
}) => {
  const t = useTranslations("learn");
  const router = useRouter();

  const actions = [
    {
      id: "share",
      label: t("course.social.share"),
      icon: <Share2 className="w-5 h-5" />,
      onClick: onShare,
    },
    {
      id: "bookmark",
      label: bookmarked
        ? t("course.social.bookmarked")
        : t("course.social.bookmark"),
      icon: (
        <Bookmark className={`w-5 h-5 ${bookmarked ? "fill-current" : ""}`} />
      ),
      onClick: onBookmark,
    },
    {
      id: "support",
      label: t("course.social.support"),
      icon: <MessageSquare className="w-5 h-5" />,
      onClick: onSupport,
    },
  ];

  // Only show the review button if the user can review
  if (canReview) {
    actions.push({
      id: "review",
      label: t("course.social.review"),
      icon: <Star className="w-5 h-5" />,
      onClick: onWriteReview,
    });
  }

  const firstPath = module?.paths?.[0] as any;
  const pathTitle =
    typeof firstPath === "object" && firstPath?.title
      ? firstPath.title
      : typeof firstPath === "string"
        ? firstPath
        : t("course.social.careerPathDescription");

  const handleExplorePath = async () => {
    let pathId =
      typeof firstPath === "object" && firstPath?.id
        ? firstPath.id
        : (module as any)?.pathId || (module as any)?.path_id;

    if (!pathId && module?.id) {
      try {
        const publicPaths = await apiHelpers.education.getPublicPaths();
        const matchingPath = publicPaths.find(
          (p: any) =>
            p.featured_modules?.some((m: any) => m.id === module.id) ||
            p.modules?.some((m: any) => m.id === module.id),
        );
        if (matchingPath?.id) {
          pathId = matchingPath.id;
        }
      } catch {
        /* fallback to catalog */
      }
    }

    if (pathId) {
      router.push(`/learn/paths/${pathId}`);
    } else {
      router.push("/learn/paths");
    }
  };

  const handleGiftCourse = async () => {
    const giftUrl = typeof window !== "undefined" ? window.location.href : "";
    const giftText = `${t("course.social.giftMessage")}\n${giftUrl}`;
    try {
      if (navigator.share && typeof navigator.share === "function") {
        await navigator.share({
          title: module?.title || t("course.social.gift"),
          text: giftText,
          url: giftUrl,
        });
      } else {
        await navigator.clipboard.writeText(giftUrl);
        toast.success(t("course.social.giftLinkCopied"));
      }
    } catch {
      try {
        await navigator.clipboard.writeText(giftUrl);
        toast.success(t("course.social.giftLinkCopied"));
      } catch {
        toast.error(t("course.social.failedToCopy"));
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <motion.button
            key={action.id}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={action.onClick}
            className={`
              p-6 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center gap-3 transition-all
              hover:shadow-md group cursor-pointer
            `}
          >
            <div
              className={`p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors`}
            >
              {action.icon}
            </div>
            <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center overflow-hidden">
              {module?.instructor?.profilePictureUrl ? (
                <img
                  src={module.instructor.profilePictureUrl}
                  alt={module.instructor.fullName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {module?.instructor?.fullName || t("course.social.instructor")}
              </h3>
              <p className="text-gray-500 dark:text-slate-400">
                {module?.instructor?.role ||
                  t("course.sidebar.instructorDefaultBio")}
              </p>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 dark:bg-slate-800/90 overflow-hidden shadow-sm"
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1">
              {t("course.social.studentsTaught", {
                count: enrolledCount > 0 ? `${enrolledCount}+` : "100+",
              })}
            </p>
          </div>

          <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-8 line-clamp-3">
            {module?.instructor?.bio || t("course.social.instructorBio")}
          </p>

          <PodaciumButton
            variant="outline"
            onClick={onViewProfile}
            fullWidth
            className="h-12 text-sm font-bold"
          >
            {t("course.social.viewProfile")}
          </PodaciumButton>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-4 italic">
              {t("course.social.careerLeap")}
            </h3>
            <p className="text-indigo-100 leading-relaxed">
              {module?.paths?.length
                ? t("course.social.partOfPath", { path: pathTitle })
                : t("course.social.careerPathDescription")}
            </p>
          </div>
          <PodaciumButton
            variant="craft"
            onClick={handleExplorePath}
            fullWidth
            className="mt-8 h-12 uppercase tracking-wider text-sm font-black text-indigo-600 dark:text-indigo-400"
          >
            {t("course.social.explorePath")}
          </PodaciumButton>
        </div>
      </div>

      <div className="flex justify-center gap-12 py-8 border-t border-gray-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onBookmark}
          className={`flex items-center gap-3 group cursor-pointer transition-colors ${
            bookmarked
              ? "text-red-500 font-bold"
              : "text-gray-400 hover:text-red-500"
          }`}
        >
          <Heart
            className={`w-6 h-6 ${bookmarked ? "fill-current text-red-500 dark:text-red-400" : "group-hover:fill-current"}`}
          />
          <span className="font-bold">{t("course.social.wishlist")}</span>
        </button>
        <button
          type="button"
          onClick={handleGiftCourse}
          className="flex items-center gap-3 text-gray-400 group cursor-pointer hover:text-blue-500 dark:text-blue-400 transition-colors"
        >
          <Gift className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="font-bold">{t("course.social.gift")}</span>
        </button>
      </div>
    </div>
  );
};
