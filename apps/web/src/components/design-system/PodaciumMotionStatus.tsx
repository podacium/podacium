"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import {
  MOTION_GRID_STATES,
  MOTION_STATUS_FALLBACK_LABELS,
  type MotionStatusState,
  type MotionStatusTone,
} from "./motion-grid-frames";
import {
  PodaciumMotionGrid,
  PodaciumMotionGridCells,
} from "./PodaciumMotionGrid";

const motionStatusVariants = cva(
  "relative inline-flex max-w-full select-none items-center overflow-hidden transition-colors",
  {
    variants: {
      variant: {
        brand: "shadow-lg",
        glass:
          "border border-white/60 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60",
        soft: "border",
        outline: "border border-border bg-background/70 dark:bg-slate-900/60",
        ghost: "bg-transparent",
        mono: "border border-white/10 bg-slate-900 text-slate-100 shadow-lg shadow-black/20",
      },
      size: {
        sm: "h-8 gap-2 rounded-full px-3 text-[11px]",
        md: "h-10 gap-2.5 rounded-full px-3.5 text-xs",
        lg: "h-12 gap-3 rounded-full px-5 text-sm",
      },
      layout: {
        pill: "",
        inline:
          "h-auto gap-2 rounded-none border-0 bg-transparent px-0 py-0 shadow-none backdrop-blur-none",
        stacked: "h-auto flex-col gap-1.5 rounded-2xl px-4 py-3",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "md",
      layout: "pill",
    },
  },
);

const TONE_TEXT: Record<MotionStatusTone, string> = {
  neutral: "text-primary",
  info: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-destructive",
};

const TONE_BRAND: Record<MotionStatusTone, string> = {
  neutral:
    "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/30",
  info: "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/30",
  success: "bg-emerald-600 text-white shadow-emerald-500/30",
  warning: "bg-amber-400 text-slate-950 shadow-amber-500/30",
  danger: "bg-destructive text-destructive-foreground shadow-destructive/30",
};

const TONE_SOFT: Record<MotionStatusTone, string> = {
  neutral:
    "border-primary/15 bg-primary/[0.07] text-primary dark:bg-primary/15",
  info: "border-primary/15 bg-primary/[0.07] text-primary dark:bg-primary/15",
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger:
    "border-destructive/20 bg-destructive/10 text-destructive dark:text-red-400",
};

const SIZE_GRID = {
  sm: { cellSize: 3, gap: 2 },
  md: { cellSize: 4, gap: 3 },
  lg: { cellSize: 5, gap: 4 },
} as const;

const LABEL_TONE: Record<MotionStatusTone, string> = {
  neutral: "text-foreground",
  info: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-destructive dark:text-red-400",
};

export interface PodaciumMotionStatusProps
  extends
    Omit<HTMLMotionProps<"div">, "children" | "layout">,
    VariantProps<typeof motionStatusVariants> {
  /** Semantic activity state. Omit to use `defaultState` internally. */
  state?: MotionStatusState;
  /** Initial state when uncontrolled. Defaults to `"idle"`. */
  defaultState?: MotionStatusState;
  /** Override the translated label. */
  label?: string;
  /** Override the tone derived from the state. */
  tone?: MotionStatusTone;
  /** Show the text label next to the grid. Defaults to `true`. */
  showLabel?: boolean;
  /** Animate label swaps. Defaults to `true`. */
  animatedLabel?: boolean;
  /** Freeze the grid on a single frame. */
  paused?: boolean;
  /** Override the per-state looping behaviour. */
  loop?: boolean;
  /** Override the per-state frame interval. */
  interval?: number;
  /** Polite live-region announcement. Set `"off"` inside dense chat lists. */
  "aria-live"?: "polite" | "off" | "assertive";
  gridClassName?: string;
  labelClassName?: string;
}

/**
 * A premium activity pill: an animated dot-matrix glyph plus a rotating label.
 *
 * Designed for async surfaces — agent "thinking", uploads, syncs, saves and
 * optimistic mutations. Colors come from Podacium tokens, so light/dark and
 * RTL are handled natively. Motion is skipped for reduced-motion users.
 */
export const PodaciumMotionStatus = React.forwardRef<
  HTMLDivElement,
  PodaciumMotionStatusProps
>(function PodaciumMotionStatus(
  {
    state,
    defaultState = "idle",
    label,
    tone: toneOverride,
    showLabel = true,
    animatedLabel = true,
    paused = false,
    loop,
    interval,
    variant = "brand",
    size = "md",
    layout = "pill",
    className,
    gridClassName,
    labelClassName,
    "aria-live": ariaLive = "polite",
    ...props
  },
  ref,
) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion();

  const resolvedState: MotionStatusState = state ?? defaultState;
  const config = MOTION_GRID_STATES[resolvedState];
  const tone = toneOverride ?? config.tone;

  const resolvedLabel =
    label ??
    t(
      `component.motionStatus.${resolvedState}`,
      undefined,
      MOTION_STATUS_FALLBACK_LABELS[resolvedState],
    );

  const isSurface = layout !== "inline";
  const isBrandSurface = variant === "brand" && isSurface;
  const isSoftSurface = variant === "soft" && isSurface;
  const isMono = variant === "mono";

  const surfaceClass = isBrandSurface
    ? TONE_BRAND[tone]
    : isSoftSurface
      ? TONE_SOFT[tone]
      : undefined;

  // Grid and label colors for non-brand surfaces.
  const gridToneClass =
    isBrandSurface || isSoftSurface || isMono ? undefined : TONE_TEXT[tone];

  const labelToneClass = isBrandSurface
    ? tone === "warning"
      ? "text-slate-950"
      : "text-white"
    : isSoftSurface
      ? undefined
      : isMono
        ? "text-slate-100"
        : variant === "ghost"
          ? "text-muted-foreground"
          : LABEL_TONE[tone];

  const gridSize = SIZE_GRID[size ?? "md"];

  return (
    <motion.div
      ref={ref}
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
      aria-label={showLabel ? undefined : resolvedLabel}
      data-state={resolvedState}
      data-tone={tone}
      className={cn(
        motionStatusVariants({ variant, size, layout }),
        surfaceClass,
        variant === "ghost" && "border-0 bg-transparent shadow-none",
        className,
      )}
      {...props}
    >
      {isBrandSurface && (
        <span
          aria-hidden
          className="shimmer-sweep pointer-events-none absolute inset-0 opacity-50 motion-reduce:hidden"
        />
      )}

      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          gridToneClass,
          gridClassName,
        )}
      >
        <PodaciumMotionGrid
          key={resolvedState}
          gridSize={[5, 5]}
          frames={config.frames}
          interval={interval ?? config.interval}
          loop={loop ?? config.loop}
          paused={paused}
          cellSize={gridSize.cellSize}
          gap={gridSize.gap}
          className="relative z-10"
        >
          <PodaciumMotionGridCells />
        </PodaciumMotionGrid>
      </span>

      {showLabel && (
        <span
          className={cn(
            "relative min-w-0 truncate font-medium tracking-tight",
            labelToneClass,
            layout === "stacked" && "text-center",
            labelClassName,
          )}
        >
          {animatedLabel && !prefersReducedMotion ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={resolvedLabel}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="inline-block"
              >
                {resolvedLabel}
              </motion.span>
            </AnimatePresence>
          ) : (
            <span className="inline-block">{resolvedLabel}</span>
          )}
        </span>
      )}
    </motion.div>
  );
});
PodaciumMotionStatus.displayName = "PodaciumMotionStatus";

export type { MotionStatusState, MotionStatusTone };
