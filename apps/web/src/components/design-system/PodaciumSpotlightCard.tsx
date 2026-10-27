"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useOptionalTheme } from "@/contexts/ThemeContext";

/**
 * A large brand-gradient card that drifts a few pixels toward the pointer while
 * its content drifts a little further, then springs back on leave. Reserved for
 * a single brand moment per marketing section — see DESIGN.md (Blue-Means-Action,
 * scarcity of the brand gesture). Not for dense app UI, lists, or anything whose
 * content moves under the cursor.
 */
const spotlightCardVariants = cva(
  cn(
    "relative isolate w-full overflow-hidden rounded-3xl text-brand-foreground shadow-sm",
    "has-[:focus-visible]:shadow-xl",
    "motion-safe:transition-[translate,box-shadow] motion-safe:duration-300",
    "motion-safe:has-[:focus-visible]:-translate-y-1",
  ),
  {
    variants: {
      /** Which slice of the blue→indigo→purple brand family to use. */
      tone: {
        brand: "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600",
        blue: "bg-gradient-to-br from-blue-600 to-indigo-600",
        indigo: "bg-gradient-to-br from-indigo-600 to-purple-600",
        purple: "bg-gradient-to-br from-purple-600 to-indigo-600",
      },
    },
    defaultVariants: {
      tone: "blue",
    },
  },
);

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const SPRING = { stiffness: 180, damping: 20, mass: 0.6 };

export interface SpotlightCardProps
  extends
    Omit<
      HTMLMotionProps<"div">,
      | "children"
      | "style"
      | "onDrag"
      | "onDragStart"
      | "onDragEnd"
      | "onAnimationStart"
    >,
    VariantProps<typeof spotlightCardVariants> {
  /** Furthest the card shifts toward the pointer, in px. */
  strength?: number;
  /** How much further the content moves than the card (parallax), as a multiple. */
  depth?: number;
  /** Show the film-grain texture over the gradient. */
  grain?: boolean;
  /** Classes for the inner content wrapper (padding lives here). */
  contentClassName?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const PodaciumSpotlightCard = React.forwardRef<
  HTMLDivElement,
  SpotlightCardProps
>(function PodaciumSpotlightCard(
  {
    tone = "blue",
    strength = 10,
    depth = 0.6,
    grain = true,
    contentClassName,
    className,
    style,
    children,
    onPointerMove,
    onPointerLeave,
    ...props
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  // ThemeContext owns the persisted in-app motion preference; `useReducedMotion`
  // only sees the OS query. Honour both.
  const theme = useOptionalTheme();
  const reducedMotion = Boolean(prefersReducedMotion || theme?.reducedMotion);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, SPRING);
  const y = useSpring(py, SPRING);
  const cx = useTransform(x, (v) => v * depth);
  const cy = useTransform(y, (v) => v * depth);

  React.useEffect(() => {
    if (!reducedMotion) return;
    px.set(0);
    py.set(0);
  }, [reducedMotion, px, py]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!reducedMotion && event.pointerType !== "touch") {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        px.set(((event.clientX - rect.left) / rect.width - 0.5) * 2 * strength);
        py.set(((event.clientY - rect.top) / rect.height - 0.5) * 2 * strength);
      }
    }
    onPointerMove?.(event);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    px.set(0);
    py.set(0);
    onPointerLeave?.(event);
  };

  return (
    <motion.div
      {...props}
      ref={ref}
      data-slot="spotlight-card"
      data-tone={tone}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ ...(reducedMotion ? null : { x, y }), ...style }}
      className={cn(spotlightCardVariants({ tone }), className)}
    >
      {grain && (
        <div
          aria-hidden="true"
          data-slot="spotlight-card-grain"
          className="pointer-events-none absolute inset-0 z-0 opacity-40 mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
      )}
      <motion.div
        style={reducedMotion ? undefined : { x: cx, y: cy }}
        className={cn("relative z-10 h-full p-8 sm:p-10", contentClassName)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
});

PodaciumSpotlightCard.displayName = "PodaciumSpotlightCard";

export { spotlightCardVariants };
export default PodaciumSpotlightCard;
