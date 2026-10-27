"use client";

import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import { apiHelpers, CourseReviewCreate } from "@/lib/api";
import { StarRating } from "./StarRating";

interface ReviewFormProps {
  moduleId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  existingRating?: number;
  existingComment?: string;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  moduleId,
  isOpen,
  onClose,
  onSubmitted,
  existingRating,
  existingComment,
}) => {
  const t = useTranslations();
  const [rating, setRating] = useState(existingRating || 0);
  const [comment, setComment] = useState(existingComment || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError(t("course.reviews.ratingRequired"));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const data: CourseReviewCreate = { rating };
      if (comment.trim()) {
        data.comment = comment.trim();
      }
      await apiHelpers.education.submitCourseReview(moduleId, data);
      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err?.message || t("course.reviews.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 end-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>

              {/* Title */}
              <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-6">
                {t("course.reviews.writeReview")}
              </h3>

              {/* Star Rating */}
              <div className="mb-6">
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>

              {/* Comment */}
              <div className="mb-6">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("course.reviews.comment")}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                />
                <p className="text-xs text-gray-400 mt-1 text-end">
                  {comment.length}/2000
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm rounded-xl">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-6 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  {t("course.reviews.cancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || rating === 0}
                  className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    rating === 0
                      ? "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    t("course.reviews.submit")
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
