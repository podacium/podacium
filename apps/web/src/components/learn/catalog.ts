/**
 * Pure data helpers for the shared learn-catalogue card.
 *
 * Deliberately free of React and i18n so the price/aggregation rules can be
 * unit-tested directly and shared by `/learn/courses` and `/learn/paths`.
 * Every formatter takes its labels as arguments instead of translating.
 */

import type { ModuleResponse, PathResponse } from "@/lib/api/education";

export interface LearnCardPrice {
  /** What the learner actually pays, in DZD. */
  current: number;
  /** Reference amount used for the strikethrough. */
  original: number;
  isFree: boolean;
  isDiscounted: boolean;
}

/** Shape of `PathResponse.featured_modules` entries, as far as the card cares. */
export interface PathModuleLike {
  total_lessons?: number;
  duration_minutes?: number;
  rating?: number;
  skills?: string[];
  tags?: string[];
  price?: { original?: number } | null;
}

export interface PathModuleSummary {
  totalLessons: number;
  totalMinutes: number;
  avgRating: number | null;
  skills: string[];
  tags: string[];
}

/**
 * Price rules for a course/module.
 *
 * The API stores `{ original, discounted }` where `discounted` is what the
 * learner pays and `original` is the reference price. `discounted === 0` means
 * free and `discounted < original` means discounted. A plain number is treated
 * as both values; anything missing degrades to "free", which is the behaviour
 * the course catalogue has always shown.
 */
export function parseCoursePrice(
  price: ModuleResponse["price"],
): LearnCardPrice {
  let current = 0;
  let original = 0;
  let hasOriginal = false;

  if (price && typeof price === "object") {
    const originalValue =
      typeof price.original === "number" ? price.original : 0;
    const discountedValue =
      typeof price.discounted === "number" ? price.discounted : null;

    original = originalValue;
    hasOriginal = true;
    current = discountedValue ?? originalValue;
  } else if (typeof price === "number" && price > 0) {
    current = price;
    original = price;
    hasOriginal = true;
  }

  return {
    current,
    original: hasOriginal ? original : current,
    isFree: current === 0,
    isDiscounted: hasOriginal && original > 0 && current < original,
  };
}

/**
 * Price rules for a learning path: the path's own price wins, otherwise the
 * card estimates 80% of its modules' list prices. Returns `null` when there is
 * nothing to show, so the card can leave the slot out entirely.
 */
export function parsePathPrice(path: PathResponse): LearnCardPrice | null {
  const price = path.price;

  if (price && typeof price === "object" && price.original != null) {
    const discounted =
      price.discounted != null ? price.discounted : price.original;

    if (discounted <= 0) return null;

    return {
      current: discounted,
      original: price.original,
      isFree: false,
      isDiscounted: discounted < price.original,
    };
  }

  const modules = path.featured_modules as PathModuleLike[] | undefined;
  const moduleSum =
    modules?.reduce((sum, mod) => sum + (mod.price?.original || 0), 0) || 0;
  const fallback = Math.floor(moduleSum * 0.8);

  if (fallback <= 0) return null;

  return {
    current: fallback,
    original: fallback,
    isFree: false,
    isDiscounted: false,
  };
}

/** Rolls a path's featured modules up into the counts and chips the card shows. */
export function summarizePathModules(
  modules: readonly PathModuleLike[] | undefined,
): PathModuleSummary {
  const list = modules ?? [];

  return {
    totalLessons: list.reduce((sum, mod) => sum + (mod.total_lessons || 0), 0),
    totalMinutes: list.reduce(
      (sum, mod) => sum + (mod.duration_minutes || 0),
      0,
    ),
    avgRating:
      list.length > 0
        ? list.reduce((sum, mod) => sum + (mod.rating || 0), 0) / list.length
        : null,
    skills: Array.from(new Set(list.flatMap((mod) => mod.skills || []))).slice(
      0,
      2,
    ),
    tags: Array.from(new Set(list.flatMap((mod) => mod.tags || []))).slice(
      0,
      2,
    ),
  };
}

/**
 * `75` + "h"/"min" labels → `"1h 15min"`. Locale-agnostic: the unit labels are
 * passed in, so Arabic/French/Kabyle render without a second code path.
 */
export function formatDuration(
  minutes: number | null | undefined,
  hourLabel: string,
  minuteLabel: string,
): string | null {
  if (!minutes || minutes <= 0) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0
    ? `${hours}${hourLabel} ${rest}${minuteLabel}`
    : `${rest}${minuteLabel}`;
}
