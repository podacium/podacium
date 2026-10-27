"use client";

/**
 * LearnCard
 *
 * The single catalogue tile behind `/learn/courses` and `/learn/paths`. Both
 * pages used to hand-roll a near-identical `motion.div`; this owns the surface,
 * the hover behaviour, the CTA and the progress bar so the two catalogues stay
 * in sync.
 *
 * Deliberate choices:
 * - **No 3D tilt.** The card already has a lift, an artwork zoom, a shadow
 *   bloom and a CTA sheen. A cursor-following tilt fought all of them, moved the
 *   CTA under the pointer, did nothing on touch, and behaved badly on a 3-column
 *   grid. The lift is one transform, in and out.
 * - **Hover is CSS, entrance is JS.** Hover only touches `transform`, `opacity`
 *   and `shadow`, so the compositor handles it with no React re-render. The
 *   scroll reveal stays framer-motion (`whileInView once`) per DESIGN.md.
 * - **Reduced motion is real.** `useReducedMotion()` drops the lift and the
 *   reveal, and the artwork zoom only exists under `motion-safe`.
 * - **Badges are always visible.** They used to fade in on hover, which meant
 *   touch users never saw "Featured" or "New".
 * - **The card is not a link.** Only the CTA is, so there are no nested
 *   interactives and the heading/price stay selectable text.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Clock, Layers, Star } from "lucide-react";

import { buttonVariants } from "@/components/design-system/PodaciumButton";
import { useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LearnCardPrice } from "./catalog";

export type LearnCardBadgeTone = "featured" | "new";
export type LearnCardChipTone = "skill" | "tag";

export interface LearnCardBadge {
  label: string;
  tone: LearnCardBadgeTone;
}

export interface LearnCardChip {
  label: string;
  tone?: LearnCardChipTone;
}

export interface LearnCardStat {
  value: string;
  label: string;
}

export interface LearnCardData {
  id: string;
  href: string;
  title: string;
  description: string;
  imageUrl: string;
  /** Micro-label above the title (course category). Ignored when `chips` is set. */
  eyebrow?: string;
  /** Pill row above the title (path skills/tags). */
  chips?: LearnCardChip[];
  level?: string;
  rating?: number | null;
  /** Pre-formatted duration, e.g. `"3h 20min"`. */
  duration?: string | null;
  /** Pre-formatted item count for the artwork pill, e.g. `"12 lessons"`. */
  count?: string;
  badges?: LearnCardBadge[];
  stats?: LearnCardStat[];
  price?: LearnCardPrice | null;
  /** Currency suffix, e.g. `"DA"`. */
  currency?: string;
  /** Label for a zero-price item, e.g. `"Free"`. */
  freeLabel?: string;
  ctaLabel: string;
  isEnrolled?: boolean;
  /** Enrolment progress, 0–100. Only rendered when enrolled. */
  progress?: number;
  progressLabel?: string;
}

export interface LearnCardProps {
  data: LearnCardData;
  /**
   * `course` keeps the title in the card body; `path` overlays it on the
   * artwork. Everything else is shared.
   */
  variant?: "course" | "path";
  className?: string;
}

const BADGE_TONES: Record<LearnCardBadgeTone, string> = {
  featured: "bg-amber-400 text-amber-950",
  new: "bg-primary text-primary-foreground",
};

const CHIP_TONES: Record<LearnCardChipTone, string> = {
  skill:
    "border-primary/15 bg-primary/5 text-primary dark:border-primary/25 dark:bg-primary/10",
  tag: "border-purple-200/70 bg-purple-50 text-purple-600 dark:border-purple-900/50 dark:bg-purple-950/50 dark:text-purple-400",
};

export function LearnCard({
  data,
  variant = "course",
  className,
}: LearnCardProps) {
  const { isRTL } = useBidi();
  const reduceMotion = useReducedMotion();
  const titleOnImage = variant === "path";

  const {
    href,
    title,
    description,
    imageUrl,
    eyebrow,
    chips = [],
    level,
    rating,
    duration,
    count,
    badges = [],
    stats = [],
    price,
    currency,
    freeLabel,
    ctaLabel,
    isEnrolled = false,
    progress = 0,
    progressLabel,
  } = data;

  const progressRatio = Math.min(Math.max(progress, 0), 100) / 100;
  const showProgress = isEnrolled && progress > 0;
  const discountPercent =
    price?.isDiscounted && price.original > 0
      ? Math.round(((price.original - price.current) / price.original) * 100)
      : null;

  return (
    <motion.article
      data-slot="learn-card"
      data-variant={variant}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[2rem]",
        "border border-border bg-card text-foreground",
        "shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow duration-500",
        "hover:shadow-[0_24px_56px_-12px_rgb(0,0,0,0.16)]",
        className,
      )}
    >
      {/* Artwork + overlays */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {/* Decorative: the title and stats below carry the meaning. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        />

        {/* Duration (start) + item count (end) */}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center gap-2">
          {duration ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 shadow-lg backdrop-blur-md">
              <Clock className="h-3.5 w-3.5 text-white/90" aria-hidden />
              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                {duration}
              </span>
            </span>
          ) : null}

          {count ? (
            <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-primary/90 px-3 py-1.5 shadow-lg shadow-primary/20 backdrop-blur-md">
              <Layers
                className="h-3.5 w-3.5 text-primary-foreground"
                aria-hidden
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-primary-foreground">
                {count}
              </span>
            </span>
          ) : null}
        </div>

        {/* Badges — always visible, unlike the old hover-only version */}
        {badges.length > 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-14 flex flex-wrap justify-center gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-xl",
                  BADGE_TONES[badge.tone],
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {(level || (rating != null && rating > 0) || titleOnImage) && (
          <div className="absolute inset-x-6 bottom-5 text-white">
            {(level || (rating != null && rating > 0)) && (
              <div className="mb-2 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                {level ? (
                  <span className="rounded border border-white/15 bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                    {level}
                  </span>
                ) : null}
                {rating != null && rating > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded border border-white/5 bg-black/20 px-2 py-0.5 backdrop-blur-sm">
                    <Star
                      className="h-3 w-3 fill-amber-400 text-amber-400"
                      aria-hidden
                    />
                    <span>{rating.toFixed(1)}</span>
                  </span>
                ) : null}
              </div>
            )}

            {titleOnImage ? (
              <h3 className="text-lg font-bold leading-snug tracking-tight drop-shadow-md line-clamp-2 transition-colors duration-300 group-hover:text-blue-200">
                {title}
              </h3>
            ) : null}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative flex flex-grow flex-col p-6 sm:p-7">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />

        {chips.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "rounded-md border px-2 py-1 text-[9px] font-bold uppercase",
                  CHIP_TONES[chip.tone ?? "skill"],
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : eyebrow ? (
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">
            {eyebrow}
          </span>
        ) : null}

        {!titleOnImage && (
          <h3 className="mb-3 text-lg font-bold leading-snug tracking-tight line-clamp-2 transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
        )}

        <p className="mb-6 flex-grow text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {description}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            {stats.length > 0 && (
              <div className="flex items-center gap-6">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col">
                    <span className="text-xl font-black leading-none">
                      {stat.value}
                    </span>
                    <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {price && (
              <div className="flex flex-col">
                {price.isDiscounted && (
                  <span className="mb-1 text-[10px] font-bold leading-none text-muted-foreground line-through">
                    {price.original.toLocaleString()} {currency}
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-xl font-black leading-none",
                      price.isFree &&
                        "uppercase tracking-tight text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {price.isFree
                      ? (freeLabel ?? "Free")
                      : price.current.toLocaleString()}
                  </span>
                  {!price.isFree && currency ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {currency}
                    </span>
                  ) : null}
                  {discountPercent !== null ? (
                    <span className="ms-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter text-white">
                      -{discountPercent}%
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <Link
            href={href}
            aria-label={`${ctaLabel}: ${title}`}
            className={cn(
              buttonVariants({ size: "xl" }),
              "group/btn gap-1.5 rounded-2xl px-6 text-[11px] font-black uppercase tracking-widest",
              isEnrolled
                ? "bg-emerald-600 shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30"
                : "shadow-lg shadow-primary/25",
            )}
          >
            <span>{ctaLabel}</span>
            <ChevronRight
              aria-hidden
              className={cn(
                "h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1",
                isRTL && "rotate-180 group-hover/btn:-translate-x-1",
              )}
            />
          </Link>
        </div>
      </div>

      {/* Enrolment progress */}
      {showProgress && (
        <div className="px-6 pb-6 sm:px-7 sm:pb-7">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span>{progressLabel}</span>
            <span className="text-primary">{Math.round(progress)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={progressLabel}
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <motion.div
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: progressRatio }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.1, ease: [0.23, 1, 0.32, 1] }
              }
              className="h-full origin-left overflow-hidden rounded-full bg-primary rtl:origin-right"
            >
              <div
                aria-hidden
                className="h-full w-full animate-shimmer bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.28)_50%,transparent_75%)] bg-[length:200%_100%]"
              />
            </motion.div>
          </div>
        </div>
      )}
    </motion.article>
  );
}

export default LearnCard;
