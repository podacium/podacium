"use client";

import { useCallback } from "react";
import { useLocale } from "@/lib/i18n";

export function useFormatDate() {
  const locale = useLocale();

  const formatDate = useCallback(
    (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    },
    [locale],
  );

  const formatRelativeTime = useCallback(
    (dateString: string): string => {
      try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) {
          if (locale === "ar") {
            return diffMins === 1 ? "منذ دقيقة واحدة" : `منذ ${diffMins} دقائق`;
          }
          return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
        } else if (diffHours < 24) {
          if (locale === "ar") {
            return diffHours === 1
              ? "منذ ساعة واحدة"
              : `منذ ${diffHours} ساعات`;
          }
          return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
        } else if (diffDays < 7) {
          if (locale === "ar") {
            return diffDays === 1 ? "منذ يوم واحد" : `منذ ${diffDays} أيام`;
          }
          return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
        } else {
          return date.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        return "Recently";
      }
    },
    [locale],
  );

  return { formatDate, formatRelativeTime };
}

export function useFormatCurrency() {
  const locale = useLocale();

  const formatCurrency = useCallback(
    (amount: number | undefined | null, currency: string = "DA"): string => {
      if (amount === undefined || amount === null) return "";
      return `${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    },
    [locale],
  );

  return { formatCurrency };
}
