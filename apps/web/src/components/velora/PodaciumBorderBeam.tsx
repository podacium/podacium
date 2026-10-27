import { cn } from "@/lib/utils";

export interface PodaciumBorderBeamProps {
  className?: string;
  /** Seconds for one full pass of the light. */
  duration?: number;
}

/**
 * A travelling light along the top edge of a surface.
 *
 * Pure CSS keyframes (see `border-beam` in globals.css) so it costs no JS
 * frames, and it is switched off under `prefers-reduced-motion`.
 */
export function PodaciumBorderBeam({
  className,
  duration = 9,
}: PodaciumBorderBeamProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden",
        className,
      )}
    >
      <span
        className="animate-border-beam block h-px w-1/3 bg-gradient-to-r from-transparent via-brand-from to-transparent"
        style={{ animationDuration: `${duration}s` }}
      />
    </div>
  );
}
