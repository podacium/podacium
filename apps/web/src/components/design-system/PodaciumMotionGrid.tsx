"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Frames } from "./motion-grid-frames";
import { getRestingFrame } from "./motion-grid-frames";

export interface MotionGridCellRenderProps {
  active: boolean;
  row: number;
  col: number;
  index: number;
  cellSize: number;
}

export interface PodaciumMotionGridProps {
  /** Sequence of `[row, column]` frames to play. */
  frames: Frames;
  /** Grid dimensions as `[rows, columns]`. Defaults to `[5, 5]`. */
  gridSize?: [number, number];
  /** Milliseconds each frame is shown. Defaults to `120`. */
  interval?: number;
  /** Loop the sequence forever. Defaults to `true`. */
  loop?: boolean;
  /** Freeze the sequence on the current frame. */
  paused?: boolean;
  /** Initial frame index. Defaults to `0`. */
  initialFrame?: number;
  /** Called whenever the visible frame changes. */
  onFrameChange?: (frameIndex: number) => void;
  /** Called once when a non-looping sequence reaches its final frame. */
  onComplete?: () => void;
  /** Cell renderer. Pass a `<PodaciumMotionGridCells />` element or a function. */
  children:
    | React.ReactElement<PodaciumMotionGridCellProps>
    | ((props: MotionGridCellRenderProps) => React.ReactNode);
  /** Accessible label. When omitted the grid is treated as decorative. */
  label?: string;
  className?: string;
  /** Cell edge length in pixels. Defaults to `4`. */
  cellSize?: number;
  /** Gap between cells in pixels. Defaults to `3`. */
  gap?: number;
  style?: React.CSSProperties;
  /** Force the sequence to rest on a single frame (e.g. for reduced motion). */
  static?: boolean;
}

/**
 * A compact, compositor-friendly sprite grid.
 *
 * Only `transform` and `opacity` animate on the cells, so even several
 * indicators can run without triggering layout or paint work per frame.
 */
export const PodaciumMotionGrid = React.forwardRef<
  HTMLDivElement,
  PodaciumMotionGridProps
>(function PodaciumMotionGrid(
  {
    frames,
    gridSize = [5, 5],
    interval = 120,
    loop = true,
    paused = false,
    initialFrame = 0,
    onFrameChange,
    onComplete,
    children,
    label,
    className,
    cellSize = 4,
    gap = 3,
    style,
    static: forceStatic = false,
  },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion) || forceStatic;

  const safeFrames = React.useMemo(
    () => (frames.length > 0 ? frames : [[]]),
    [frames],
  );
  const safeInitialFrame = Math.min(
    Math.max(initialFrame, 0),
    safeFrames.length - 1,
  );
  const [frameIndex, setFrameIndex] = React.useState(safeInitialFrame);

  const restingFrame = React.useMemo(
    () => getRestingFrame(safeFrames),
    [safeFrames],
  );

  const displayIndex = reducedMotion
    ? restingFrame
    : Math.min(frameIndex, safeFrames.length - 1);

  // Advance the sequence with a timeout so each state can pick its own pace.
  React.useEffect(() => {
    if (paused || reducedMotion || safeFrames.length <= 1) return;
    if (!loop && frameIndex >= safeFrames.length - 1) return;

    const timer = window.setTimeout(
      () => {
        setFrameIndex((current) => {
          const next = current + 1;
          if (next >= safeFrames.length) return loop ? 0 : current;
          return next;
        });
      },
      Math.max(16, interval),
    );

    return () => window.clearTimeout(timer);
  }, [frameIndex, interval, loop, paused, reducedMotion, safeFrames.length]);

  // Keep callbacks out of effect dependencies so inline handlers stay cheap.
  const frameChangeRef = React.useRef(onFrameChange);
  const completeRef = React.useRef(onComplete);
  frameChangeRef.current = onFrameChange;
  completeRef.current = onComplete;

  React.useEffect(() => {
    frameChangeRef.current?.(displayIndex);
  }, [displayIndex]);

  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (
      !loop &&
      !reducedMotion &&
      displayIndex === safeFrames.length - 1 &&
      !completedRef.current
    ) {
      completedRef.current = true;
      completeRef.current?.();
    }
  }, [displayIndex, loop, reducedMotion, safeFrames.length]);

  const [rows, cols] = gridSize;

  const activeKeys = React.useMemo(() => {
    const frame = safeFrames[displayIndex] ?? [];
    return new Set(frame.map(([row, col]) => `${row}:${col}`));
  }, [displayIndex, safeFrames]);

  const cells = React.useMemo(() => {
    const items: React.ReactNode[] = [];
    const total = Math.max(0, rows) * Math.max(0, cols);

    for (let index = 0; index < total; index += 1) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const key = `${row}:${col}`;
      const active = activeKeys.has(key);

      if (typeof children === "function") {
        items.push(
          <React.Fragment key={key}>
            {children({ active, row, col, index, cellSize })}
          </React.Fragment>,
        );
        continue;
      }

      items.push(
        React.cloneElement(children, {
          key,
          active,
          row,
          col,
          index,
          cellSize,
          "data-active": active,
        }),
      );
    }

    return items;
  }, [activeKeys, cellSize, children, cols, rows]);

  return (
    <div
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-grid shrink-0 align-middle", className)}
      style={{
        gridTemplateColumns: `repeat(${Math.max(0, cols)}, ${cellSize}px)`,
        gap,
        ...style,
      }}
    >
      {cells}
    </div>
  );
});
PodaciumMotionGrid.displayName = "PodaciumMotionGrid";

export interface PodaciumMotionGridCellProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "children"
> {
  /** Whether the cell is lit in the current frame. */
  active?: boolean;
  /** Row index, provided by the parent grid. */
  row?: number;
  /** Column index, provided by the parent grid. */
  col?: number;
  /** Flat index, provided by the parent grid. */
  index?: number;
  /** Cell edge length in pixels, provided by the parent grid. */
  cellSize?: number;
  /** Passed by the grid for styling hooks. */
  "data-active"?: boolean;
}

/**
 * Default cell: a faint resting dot with a bright dot that scales and fades in.
 * Styling inherits `currentColor`, so tone is controlled by the parent.
 */
export const PodaciumMotionGridCells = React.forwardRef<
  HTMLSpanElement,
  PodaciumMotionGridCellProps
>(function PodaciumMotionGridCells(
  {
    active = false,
    cellSize = 4,
    className,
    style,
    row,
    col,
    index,
    "data-active": dataActive,
    ...props
  },
  ref,
) {
  return (
    <span
      ref={ref}
      data-motion-grid-cell=""
      data-row={row}
      data-col={col}
      data-cell-index={index}
      data-active={active || dataActive || undefined}
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={{ width: cellSize, height: cellSize, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-current opacity-15 dark:opacity-25"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-current transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none"
        style={{
          opacity: active ? 0.95 : 0,
          transform: active ? "scale(1)" : "scale(0.45)",
        }}
      />
    </span>
  );
});
PodaciumMotionGridCells.displayName = "PodaciumMotionGridCells";

export type { Frames } from "./motion-grid-frames";
