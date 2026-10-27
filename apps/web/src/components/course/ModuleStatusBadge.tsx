"use client";

import { type ModuleStatus } from "@/lib/api/education";
import { useTranslations } from "@/lib/i18n";

interface ModuleStatusBadgeProps {
  status: ModuleStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ModuleStatus,
  { key: string; dot: string; color: string; bg: string }
> = {
  DRAFT: {
    key: "contentReview.statuses.draft",
    dot: "bg-gray-400",
    color: "text-gray-700 dark:text-slate-300",
    bg: "bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-800",
  },
  IN_REVIEW: {
    key: "contentReview.statuses.inReview",
    dot: "bg-amber-500",
    color: "text-amber-800",
    bg: "bg-amber-50 border border-amber-200",
  },
  PUBLISHED: {
    key: "contentReview.statuses.published",
    dot: "bg-emerald-500",
    color: "text-emerald-800",
    bg: "bg-emerald-50 border border-emerald-200",
  },
  ARCHIVED: {
    key: "contentReview.statuses.archived",
    dot: "bg-red-400",
    color: "text-red-700",
    bg: "bg-red-50 border border-red-200",
  },
};

/**
 * Displays the publication status of a module as a color-coded badge.
 */
export function ModuleStatusBadge({
  status,
  className = "",
}: ModuleStatusBadgeProps) {
  const t = useTranslations("admin");
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const label = t(config.key);
  const ariaLabel = t("contentReview.statusAriaLabel", { status: label });

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      <span
        className={`me-1.5 h-1.5 w-1.5 rounded-full ${config.dot}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
