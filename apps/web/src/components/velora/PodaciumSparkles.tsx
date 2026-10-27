import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative one-shot sparkle burst around a short piece of text.
 *
 * Deliberate constraints, all of them load-bearing:
 *
 * - **The text is never hidden.** Sparkles are absolutely positioned siblings,
 *   so the label stays real DOM text: no LCP penalty, no hydration flash, no
 *   SEO or screen-reader cost. The sparkle layer is `aria-hidden`.
 * - **CSS-only.** No canvas, no rAF loop, no `useReducedMotion` hook, so it
 *   renders identically on the server and cannot fight hydration.
 * - **One-shot by default.** `loop` opts into a twinkle where each star is lit
 *   for 48% of a 4 s cycle, phased `cycle / count` apart — so roughly
 *   `count × 0.48` stars are visible at any instant (about 3 of six), never in
 *   sync. Density comes from the duty cycle and the count, not from spamming
 *   elements: a lit window shorter than the phase gap gives you one blinking
 *   star no matter how many you render.
 * - **Reduced motion is honoured twice.** The OS preference and the in-app
 *   `data-reduced-motion` toggle (owned by `ThemeContext`) both stop the
 *   animation, which leaves the sparkles at their base `opacity: 0`.
 *
 * Use it on a badge, a "new" pill or a single accent line — never on the hero
 * `h1`, which must stay animation-free as the LCP element (see `DESIGN.md`).
 */
export interface PodaciumSparklesProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** Number of sparkles to draw. Clamped to the curated layout (1–6). */
  count?: number;
  /** Extra delay before the burst starts, in ms. Use to follow a reveal. */
  delay?: number;
  /** Twinkle continuously instead of firing a single burst on mount. */
  loop?: boolean;
}

/** Four-point star drawn with soft joins, in a 24×24 box. */
const SPARKLE_PATH =
  "M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12 6.4-.9 11.1-5.6 12-12Z";

/** Brand gradient stops, in order. Mirrored pairs never land side by side. */
const SPARKLE_TONES = [
  "var(--color-brand-from)",
  "var(--color-brand-via)",
  "var(--color-brand-to)",
] as const;

interface SparkleSpec {
  /** Offset from the start edge of the outset layer, in %. */
  start: number;
  /** Offset from the top edge of the outset layer, in %. */
  top: number;
  /** Rendered size in px. */
  size: number;
  /** Stagger, in ms, so the burst reads as twinkling rather than blinking. */
  delay: number;
}

/**
 * Hand-placed instead of pseudo-random: modulo arithmetic over an index
 * clusters (e.g. `(i * 67) % 100` repeats every third point), and tuned
 * positions keep the burst on the edges so it never sits on the glyphs.
 */
const SPARKLE_LAYOUT: readonly SparkleSpec[] = [
  { start: 98, top: 4, size: 13, delay: 0 },
  { start: 6, top: 78, size: 9, delay: 160 },
  { start: 26, top: -8, size: 8, delay: 300 },
  { start: 84, top: 90, size: 10, delay: 80 },
  { start: 54, top: 102, size: 8, delay: 380 },
  { start: 12, top: 12, size: 7, delay: 240 },
  { start: 70, top: -10, size: 9, delay: 120 },
  { start: 36, top: 98, size: 7, delay: 440 },
];

/** Must match the `sparkle-twinkle` duration in `globals.css`. */
const SPARKLE_CYCLE_MS = 4000;

export function PodaciumSparkles({
  children,
  className,
  count = 4,
  delay = 0,
  loop = false,
  ...props
}: PodaciumSparklesProps) {
  const visible = SPARKLE_LAYOUT.slice(
    0,
    Math.min(Math.max(count, 0), SPARKLE_LAYOUT.length),
  );

  return (
    <span
      data-slot="sparkles-text"
      className={cn("relative inline-block", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        data-slot="sparkle-layer"
        className="pointer-events-none absolute -inset-2 z-10"
      >
        {visible.map((sparkle, index) => {
          // A one-shot burst staggers tightly; a loop spreads the phases across
          // the whole cycle so the stars never pop in unison.
          const stagger = loop
            ? Math.round(index * (SPARKLE_CYCLE_MS / visible.length))
            : sparkle.delay;

          return (
            <svg
              key={`${sparkle.start}-${sparkle.top}`}
              viewBox="0 0 24 24"
              className="podacium-sparkle absolute"
              data-loop={loop ? "true" : undefined}
              style={
                {
                  insetInlineStart: `${sparkle.start}%`,
                  top: `${sparkle.top}%`,
                  width: sparkle.size,
                  height: sparkle.size,
                  fill: SPARKLE_TONES[index % SPARKLE_TONES.length],
                  translate: "-50% -50%",
                  "--sparkle-delay": `${stagger + delay}ms`,
                } as CSSProperties
              }
            >
              <path d={SPARKLE_PATH} />
            </svg>
          );
        })}
      </span>
      <span className="relative">{children}</span>
    </span>
  );
}
