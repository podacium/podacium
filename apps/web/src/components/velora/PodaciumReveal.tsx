import type { CSSProperties, ReactNode } from "react";

type Entrance = "fade" | "up" | "scale";
type RevealTag = "div" | "section" | "span" | "li";

export interface PodaciumRevealProps {
  children: ReactNode;
  className?: string;
  /** Entrance style. All three are direction-agnostic, so RTL just works. */
  entrance?: Entrance;
  /** Delay before the entrance starts, in ms. Use for staggering siblings. */
  delay?: number;
  /** Override the entrance duration, in ms. Defaults to `--duration-reveal`. */
  duration?: number;
  /** Travel distance for `up` entrances, in px. */
  distance?: number;
  as?: RevealTag;
}

/**
 * CSS-only entrance reveal.
 *
 * Deliberately not JS-driven: the animation starts at first paint, so there is
 * no invisible-until-hydration flash and no LCP penalty, and it collapses to a
 * static render under `prefers-reduced-motion`.
 */
export function PodaciumReveal({
  children,
  className,
  entrance = "up",
  delay = 0,
  duration,
  distance = 20,
  as: Tag = "div",
}: PodaciumRevealProps) {
  const style = {
    "--reveal-delay": `${delay}ms`,
    "--reveal-distance": `${distance}px`,
    ...(duration ? { "--reveal-duration": `${duration}ms` } : null),
  } as CSSProperties;

  return (
    <Tag
      data-entrance={entrance}
      style={style}
      className={className ? `podacium-reveal ${className}` : "podacium-reveal"}
    >
      {children}
    </Tag>
  );
}
