"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, Trash2, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "@/lib/i18n";
import {
  apiHelpers,
  CourseReviewResponse,
  PaginatedReviewsResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "./StarRating";

interface ReviewListProps {
  moduleId: string;
  refreshTrigger?: number;
}

function getRelativeTime(
  dateString: string,
  locale: string,
  t: (k: string) => string,
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return t("common.notifications.justNow");

  try {
    const rtf = new Intl.RelativeTimeFormat(locale === "kab" ? "fr" : locale, {
      numeric: "auto",
    });
    if (diffMonth > 0) return rtf.format(-diffMonth, "month");
    if (diffDay > 0) return rtf.format(-diffDay, "day");
    if (diffHour > 0) return rtf.format(-diffHour, "hour");
    if (diffMin > 0) return rtf.format(-diffMin, "minute");
  } catch {
    // fallback
  }
  return t("common.notifications.justNow");
}

export const ReviewList: React.FC<ReviewListProps> = ({
  moduleId,
  refreshTrigger,
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<CourseReviewResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const PAGE_SIZE = 10;

  const fetchReviews = useCallback(
    async (pageNum: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const data: PaginatedReviewsResponse =
          await apiHelpers.education.getCourseReviews(
            moduleId,
            pageNum,
            PAGE_SIZE,
          );

        if (append) {
          setReviews((prev) => [...prev, ...data.reviews]);
        } else {
          setReviews(data.reviews);
        }
        setTotal(data.total);
        setAverageRating(data.average_rating ?? undefined);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [moduleId],
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews, refreshTrigger]);

  const handleDelete = async (reviewId: number) => {
    try {
      setDeletingId(reviewId);
      await apiHelpers.education.deleteCourseReview(moduleId, reviewId);
      // Refresh the list
      await fetchReviews(1);
    } catch (err) {
      console.error("Failed to delete review:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadMore = () => {
    fetchReviews(page + 1, true);
  };

  const hasMore = reviews.length < total;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-800/90" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-slate-800/90 rounded" />
                <div className="h-3 w-16 bg-gray-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
            <div className="h-4 w-full bg-gray-100 dark:bg-slate-800 rounded mt-3" />
            <div className="h-4 w-2/3 bg-gray-100 dark:bg-slate-800 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
          <MessageSquare className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-slate-400 text-lg font-medium">
          {t("course.reviews.noReviewsYet")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      {averageRating && (
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="text-3xl font-black text-gray-900 dark:text-slate-100">
            {averageRating.toFixed(1)}
          </div>
          <div>
            <StarRating value={Math.round(averageRating)} readOnly size="sm" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {total === 1
                ? t("course.reviews.reviewCount", { count: String(total) })
                : t("course.reviews.reviewsCount", { count: String(total) })}
            </p>
          </div>
        </div>
      )}

      {/* Reviews */}
      <AnimatePresence mode="popLayout">
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {review.user_profile_picture_url ? (
                    <img
                      src={review.user_profile_picture_url}
                      alt={review.user_full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                <div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                    {review.user_full_name}
                  </p>
                  <div className="flex items-center gap-2">
                    <StarRating value={review.rating} readOnly size="sm" />
                    <span className="text-xs text-gray-400">
                      {getRelativeTime(review.created_at, locale, t)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete button (only for own reviews) */}
              {user && user.id === review.user_id && (
                <button
                  onClick={() => handleDelete(review.id)}
                  disabled={deletingId === review.id}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                  title={t("course.reviews.deleteReview")}
                >
                  {deletingId === review.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {review.comment && (
              <p className="mt-3 text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                {review.comment}
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Load More */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-8 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors inline-flex items-center gap-2"
          >
            {isLoadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("course.reviews.loadMore")
            )}
          </button>
        </div>
      )}
    </div>
  );
};
