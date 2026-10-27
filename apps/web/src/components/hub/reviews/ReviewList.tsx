"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Star, ShieldAlert, Edit2 } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

function formatTimeAgo(dateString: string, t: any): string {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return t("hub.reviews.timeAgo.justNow");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return minutes === 1
      ? t("hub.reviews.timeAgo.minutes", { count: 1 })
      : t("hub.reviews.timeAgo.minutes_plural", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return hours === 1
      ? t("hub.reviews.timeAgo.hours", { count: 1 })
      : t("hub.reviews.timeAgo.hours_plural", { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 30)
    return days === 1
      ? t("hub.reviews.timeAgo.days", { count: 1 })
      : t("hub.reviews.timeAgo.days_plural", { count: days });

  const months = Math.floor(days / 30);
  if (months < 12)
    return months === 1
      ? t("hub.reviews.timeAgo.months", { count: 1 })
      : t("hub.reviews.timeAgo.months_plural", { count: months });

  const years = Math.floor(days / 365);
  return years === 1
    ? t("hub.reviews.timeAgo.years", { count: 1 })
    : t("hub.reviews.timeAgo.years_plural", { count: years });
}

export interface ReviewResponse {
  id: number;
  contractId: number;
  authorId: number;
  targetId: number;
  reviewType: "CLIENT_TO_FREELANCER" | "FREELANCER_TO_CLIENT";
  rating: number;
  subRatings: Record<string, number>;
  comment?: string;
  isPublic: boolean;
  status: "ACTIVE" | "REDACTED" | "PENDING_APPEAL";
  editCount: number;
  createdAt: string;
  author?: {
    id: number;
    fullName: string;
    profilePictureUrl?: string;
  };
}

interface ReviewListProps {
  reviews: ReviewResponse[];
  currentUserId: number;
  onEditClick?: (review: ReviewResponse) => void;
  onAppealClick?: (review: ReviewResponse) => void;
}

export function ReviewList({
  reviews,
  currentUserId,
  onEditClick,
  onAppealClick,
}: ReviewListProps) {
  const t = useTranslations("hub.reviews");

  if (!reviews || reviews.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-slate-900/60 dark:bg-[#111] rounded-xl border border-gray-200 dark:border-slate-800 dark:border-gray-800">
        <p className="text-gray-500 dark:text-slate-400 dark:text-gray-400">
          {t("noReviews")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {reviews.map((review) => {
          const isAuthor = review.authorId === currentUserId;
          const isTarget = review.targetId === currentUserId;

          // Is it a blind review (hidden)?
          const isBlind = !review.isPublic && !isAuthor;

          const dateStr = review.createdAt
            ? formatTimeAgo(review.createdAt, t)
            : "";

          const subRatingGroup =
            review.reviewType === "CLIENT_TO_FREELANCER"
              ? "freelancerSubRatings"
              : "clientSubRatings";

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              key={review.id}
              className={`p-6 rounded-xl border transition-all ${
                isBlind
                  ? "bg-gray-50 dark:bg-slate-900/60 dark:bg-gray-900 border-gray-200 dark:border-slate-800 dark:border-gray-800 border-dashed"
                  : "bg-white dark:bg-slate-900 dark:bg-[#0a0a0a] border-gray-200 dark:border-slate-800 dark:border-gray-800 shadow-sm"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-800/90 dark:bg-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {review.author?.profilePictureUrl ? (
                      <img
                        src={review.author.profilePictureUrl}
                        alt={review.author?.fullName || t("anonymousUser")}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 dark:text-slate-400 font-medium">
                        {(review.author?.fullName || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-slate-100 dark:text-white">
                      {review.author?.fullName || t("anonymousUser")}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {dateStr} {review.editCount > 0 && t("edited")}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  {isAuthor && onEditClick && (
                    <button
                      onClick={() => onEditClick(review)}
                      className="p-2 text-gray-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title={t("editReview")}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {isTarget && review.status === "ACTIVE" && onAppealClick && (
                    <button
                      onClick={() => onAppealClick(review)}
                      className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t("appeal")}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              {isBlind ? (
                <div className="py-4 text-center">
                  <p className="text-gray-500 dark:text-slate-400 italic text-sm">
                    {t("blindReview")}
                  </p>
                </div>
              ) : review.status === "REDACTED" ? (
                <div className="py-4 text-center">
                  <p className="text-red-500 dark:text-red-400 italic text-sm">
                    {t("redactedMessage")}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Main Rating */}
                  <div className="flex items-center space-x-1 rtl:space-x-reverse mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300 dark:text-gray-700 dark:text-slate-300"
                        }`}
                      />
                    ))}
                    <span className="ml-2 rtl:mr-2 rtl:ml-0 font-medium text-sm text-gray-700 dark:text-slate-300 dark:text-gray-300">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>

                  {/* Comment */}
                  {review.comment && (
                    <p className="text-gray-700 dark:text-slate-300 dark:text-gray-300 text-sm whitespace-pre-wrap mb-4">
                      {review.comment}
                    </p>
                  )}

                  {/* Sub Ratings Tags */}
                  {review.subRatings &&
                    Object.keys(review.subRatings).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-slate-800 dark:border-gray-800">
                        {Object.entries(review.subRatings).map(([key, val]) => (
                          <div
                            key={key}
                            className="flex items-center space-x-1 rtl:space-x-reverse bg-gray-100 dark:bg-slate-800 dark:bg-gray-800 px-2 py-1 rounded text-xs text-gray-600 dark:text-slate-400 dark:text-gray-400"
                          >
                            <span className="capitalize">
                              {t(`${subRatingGroup}.${key}` as any) || key}:
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-slate-100 dark:text-white">
                              {val}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {review.status === "PENDING_APPEAL" && (
                <div className="mt-4 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 p-2 rounded text-xs flex items-center">
                  <ShieldAlert className="w-3 h-3 mr-1 rtl:mr-0 rtl:ml-1 flex-shrink-0" />
                  {t("underAppealMessage")}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
