"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Star, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export type SubRatings = Record<string, number>;

export interface ReviewFormData {
  rating: number;
  subRatings: SubRatings;
  comment: string;
}

interface RatingFormProps {
  role: "CLIENT" | "FREELANCER";
  initialData?: ReviewFormData;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function RatingForm({
  role,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RatingFormProps) {
  const t = useTranslations("hub.reviews");
  const subRatingKeys =
    role === "CLIENT"
      ? ["work_quality", "communication", "timeliness", "professionalism"]
      : [
          "requirements_clarity",
          "communication",
          "fairness",
          "payment_promptness",
        ];

  const subRatingGroup =
    role === "CLIENT" ? "freelancerSubRatings" : "clientSubRatings";

  const defaultSubRatings = subRatingKeys.reduce((acc, key) => {
    acc[key] = 5;
    return acc;
  }, {} as SubRatings);

  const [rating, setRating] = useState<number>(initialData?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [subRatings, setSubRatings] = useState<SubRatings>(
    initialData?.subRatings || defaultSubRatings,
  );
  const [comment, setComment] = useState(initialData?.comment || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubRatingChange = (key: string, value: number) => {
    setSubRatings((prev) => ({ ...prev, [key]: value }));
    // Auto-calculate average for main rating if desired, but here we let them be separate
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Provide default comments or validate
    if (rating < 1 || rating > 5) {
      setError(t("invalidRating"));
      return;
    }

    try {
      await onSubmit({ rating, subRatings, comment });
    } catch (err: any) {
      setError(err.message || t("submitFailed"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg flex items-center text-sm">
          <AlertCircle className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Rating */}
      <div className="flex flex-col items-center justify-center space-y-2 py-4">
        <label className="text-lg font-medium text-gray-900 dark:text-slate-100 dark:text-white">
          {t("rating")}
        </label>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              type="button"
              className="focus:outline-none"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  star <= (hoverRating || rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300 dark:text-gray-600 dark:text-slate-400"
                }`}
              />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-slate-800 dark:border-gray-800 my-4" />

      {/* Sub Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subRatingKeys.map((key) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700 dark:text-slate-300 dark:text-gray-300">
                {t(`${subRatingGroup}.${key}` as any)}
              </span>
              <span className="text-gray-500 dark:text-slate-400 font-medium">
                {subRatings[key]} / 5
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={subRatings[key]}
              onChange={(e) =>
                handleSubRatingChange(key, parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-200 dark:bg-slate-800/90 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
            />
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-slate-800 dark:border-gray-800 my-4" />

      {/* Comment */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 dark:text-gray-300">
          {t("comment")}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full text-base p-3 border border-gray-300 dark:border-slate-700 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-900 dark:bg-[#0a0a0a] text-gray-900 dark:text-slate-100 dark:text-white focus:ring-2 focus:ring-primary-500 min-h-[120px]"
          placeholder={t("commentPlaceholder")}
          maxLength={2000}
        />
        <div className="text-right text-xs text-gray-500 dark:text-slate-400">
          {comment.length} / 2000
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4 border-t border-gray-200 dark:border-slate-800 dark:border-gray-800">
        {onCancel && (
          <PodaciumButton
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </PodaciumButton>
        )}
        <PodaciumButton type="submit" variant="primary" loading={isSubmitting}>
          {initialData ? t("saveChanges") : t("submit")}
        </PodaciumButton>
      </div>
    </form>
  );
}
