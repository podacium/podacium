"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PodaciumRetroGridProps {
  /** Rotation of the grid, in degrees. */
  angle?: number;
  /** Cell size in CSS pixels. */
  cell?: number;
  /** 0–1 stroke opacity. */
  opacity?: number;
  /** Drift speed in CSS pixels per second. */
  speed?: number;
  /** Stroke colour. Defaults to the element's computed `color`. */
  color?: string;
  className?: string;
}

/**
 * Decorative drifting perspective grid drawn on a canvas.
 *
 * - Caps DPR at 2 so 3x phones do not pay for pixels nobody sees.
 * - Draws a single static frame when the user prefers reduced motion.
 * - Pauses the loop when unmounted; no listeners are left behind.
 */
export function PodaciumRetroGrid({
  angle = 65,
  cell = 48,
  opacity = 0.35,
  speed = 14,
  color,
  className,
}: PodaciumRetroGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rad = (angle * Math.PI) / 180;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    let width = 0;
    let height = 0;
    let offset = 0;
    let stroke = color ?? "";

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(rad);
      ctx.translate(offset, offset);
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;

      const span = Math.hypot(width, height);
      const count = Math.ceil(span / cell) + 1;

      for (let i = -count; i <= count; i++) {
        const p = i * cell;
        ctx.beginPath();
        ctx.moveTo(p, -span);
        ctx.lineTo(p, span);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-span, p);
        ctx.lineTo(span, p);
        ctx.stroke();
      }

      ctx.restore();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      // Resolve `currentColor` once per resize instead of once per frame.
      if (!color) stroke = getComputedStyle(canvas).color;
      draw();
    };

    let last = 0;
    const tick = (time: number) => {
      if (!last) last = time;
      const delta = Math.min((time - last) / 1000, 0.05);
      last = time;
      offset = (offset + speed * delta) % cell;
      draw();
      frame = requestAnimationFrame(tick);
    };

    resize();
    if (!reduceMotion) frame = requestAnimationFrame(tick);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [angle, cell, opacity, speed, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}
