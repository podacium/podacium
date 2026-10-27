"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingItem, trendingApi } from "@/lib/api/trending";
import { useTranslations } from "@/lib/i18n";

interface TrendingSectionProps {
  entityType: "course" | "project" | "freelancer";
  variant: "mini" | "full";
}

const LIMIT_MAP = { mini: 5, full: 12 } as const;
const LINK_MAP: Record<string, (id: string) => string> = {
  course: (id) => `/learn/courses/${id}`,
  project: (id) => `/hub/projects/${id}`,
  freelancer: (id) => `/profile/${id}`,
};

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "bg-emerald-100 text-emerald-800"
      : pct >= 40
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {pct}
    </span>
  );
}

function Skeleton({ count, ariaLabel }: { count: number; ariaLabel: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={ariaLabel}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800/90" />
          <div className="flex-1 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
          <div className="w-10 h-5 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="text-center py-6 text-sm text-red-600 dark:text-red-400"
      role="alert"
    >
      {message}
    </div>
  );
}

function EmptyState({ emptyText }: { emptyText: string }) {
  return (
    <div className="text-center py-6 text-sm text-gray-500 dark:text-slate-400">
      {emptyText}
    </div>
  );
}

export function TrendingSection({ entityType, variant }: TrendingSectionProps) {
  const t = useTranslations("trending");
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = LIMIT_MAP[variant];
  const isMini = variant === "mini";

  const label =
    entityType === "course"
      ? t("courses")
      : entityType === "project"
        ? t("projects")
        : t("freelancers");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    trendingApi
      .getTrending(entityType, limit)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? t("failedToLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, limit, t]);

  const getLink = LINK_MAP[entityType];

  return (
    <section className={isMini ? "" : "py-8"}>
      <div className="flex items-center justify-between mb-4">
        <h2
          className={`font-bold text-gray-900 dark:text-slate-100 ${isMini ? "text-base" : "text-2xl"}`}
        >
          {t("title", { entity: label })}
        </h2>
        {!isMini && items.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {t("updatedRecently")}
          </span>
        )}
      </div>

      {loading && <Skeleton count={limit} ariaLabel={t("loading")} />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState emptyText={t("empty", { entity: label })} />
      )}

      {!loading && !error && items.length > 0 && (
        <div
          className={
            isMini
              ? "space-y-2"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          }
        >
          {items.map((item) => {
            const content = (
              <>
                <span
                  className={`flex-shrink-0 font-bold text-gray-400 ${
                    isMini ? "w-5 text-sm" : "w-8 text-lg"
                  }`}
                >
                  #{item.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-gray-900 dark:text-slate-100 truncate ${isMini ? "text-sm" : "text-base"}`}
                  >
                    {item.title}
                  </p>
                  {!isMini && item.description && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                <ScoreBadge score={item.score} />
              </>
            );

            if (getLink) {
              return (
                <Link
                  key={`${item.entity_type}-${item.entity_id}`}
                  href={getLink(item.entity_id)}
                  className={`flex items-center gap-3 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 ${
                    isMini
                      ? "p-2"
                      : "p-4 border border-gray-200 dark:border-slate-800"
                  }`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={`${item.entity_type}-${item.entity_id}`}
                className={`flex items-center gap-3 rounded-lg ${
                  isMini
                    ? "p-2"
                    : "p-4 border border-gray-200 dark:border-slate-800"
                }`}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TrendingSection;
