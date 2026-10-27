"use client";

/**
 * RecommendationCard
 *
 * Renders a single learning-path recommendation with a direct link to the
 * path detail page. Uses `target_url` from the backend so the frontend never
 * has to construct URLs itself.
 */

import Link from "next/link";
import { Sparkles, ArrowRight, Star } from "lucide-react";
import type { LearningPathRecommendation } from "@/lib/api/education";
import { useTranslations } from "@/lib/i18n";

interface RecommendationCardProps {
  recommendation: LearningPathRecommendation;
  /** Optional override for the CTA label */
  ctaLabel?: string;
  className?: string;
}

export function RecommendationCard({
  recommendation,
  ctaLabel,
  className = "",
}: RecommendationCardProps) {
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");
  const tDashboard = useTranslations("dashboard");
  const { path, match_score, reason, target_url, modules } = recommendation;

  const matchPercent = Math.round(match_score * 100);
  const moduleCount = modules.length;

  return (
    <article
      className={`group relative flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800/90 rounded-2xl border border-blue-200/80 dark:border-slate-800 p-5 hover:shadow-md transition-all duration-200 ${className}`}
      aria-label={tCommon("uiLabels.recommendationAria", { title: path.title })}
    >
      {/* Match badge */}
      {matchPercent > 0 && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800/80">
          <Star
            className="w-3 h-3 fill-blue-500 text-blue-500 dark:text-blue-400"
            aria-hidden="true"
          />
          <span>
            {matchPercent}% {t("paths.recommendations.match")}
          </span>
        </div>
      )}

      {/* Icon + title */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex-shrink-0"
          aria-hidden="true"
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 leading-snug line-clamp-2">
            {path.title}
          </h3>
          {path.description && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
              {path.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mb-3">
        <span>
          {moduleCount} {t("paths.labels.modules")}
        </span>
        {path.totalDuration && (
          <>
            <span aria-hidden="true">·</span>
            <span>{path.totalDuration}</span>
          </>
        )}
      </div>

      {/* Reason */}
      <p className="text-xs text-blue-600 dark:text-blue-400 italic mb-4 line-clamp-2">
        {reason ||
          tDashboard(
            `recommendations.reasons.${recommendation.reason_type || "default"}`,
          )}
      </p>

      {/* CTA — direct link to the path using target_url from backend */}
      <Link
        href={target_url}
        className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 text-sm font-semibold rounded-xl border border-blue-200 dark:border-blue-800/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={`${ctaLabel ?? t("buttons.explorePath")}: ${path.title}`}
      >
        {ctaLabel ?? t("buttons.explorePath")}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

export default RecommendationCard;
