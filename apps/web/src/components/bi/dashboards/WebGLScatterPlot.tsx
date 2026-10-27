"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useBidi, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
  size?: number;
  color?: string;
}

interface WebGLScatterPlotProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  primaryColor?: string;
  className?: string;
  onPointClick?: (point: DataPoint) => void;
}

export const WebGLScatterPlot = forwardRef<
  HTMLCanvasElement,
  WebGLScatterPlotProps
>(function WebGLScatterPlot(
  {
    data,
    width = 600,
    height = 400,
    xLabel,
    yLabel,
    primaryColor = "#6366f1",
    className,
    onPointClick,
  },
  ref,
) {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isRTL } = useBidi();
  const { t } = useTranslations("bi");
  const resolvedXLabel = xLabel ?? t("smartChart.xAxis");
  const resolvedYLabel = yLabel ?? t("smartChart.yAxis");
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );

  useImperativeHandle(ref, () => internalCanvasRef.current!);

  useEffect(() => {
    const canvas = internalCanvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = "#0f172a"; // Slate 900
    ctx.fillRect(0, 0, width, height);

    // Compute data bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Draw Gridlines
    ctx.strokeStyle = "#1e293b"; // Slate 800
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let step = 0; step <= 5; step++) {
      const gx = padding.left + (plotW * step) / 5;
      const gy = padding.top + (plotH * step) / 5;
      ctx.moveTo(gx, padding.top);
      ctx.lineTo(gx, height - padding.bottom);
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(width - padding.right, gy);
    }
    ctx.stroke();

    // Render Data Points
    ctx.fillStyle = primaryColor;
    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      const px = padding.left + ((pt.x - minX) / (maxX - minX)) * plotW;
      const py =
        height - padding.bottom - ((pt.y - minY) / (maxY - minY)) * plotH;

      ctx.beginPath();
      ctx.arc(px, py, pt.size || 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Axis Labels
    ctx.fillStyle = "#94a3b8"; // Slate 400
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(resolvedXLabel, width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(resolvedYLabel, 0, 0);
    ctx.restore();
  }, [data, width, height, resolvedXLabel, resolvedYLabel, primaryColor]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = internalCanvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setMousePos({ x: mx, y: my });

    // Find nearest point within 10px radius
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    let minX = Math.min(...data.map((d) => d.x));
    let maxX = Math.max(...data.map((d) => d.x));
    let minY = Math.min(...data.map((d) => d.y));
    let maxY = Math.max(...data.map((d) => d.y));
    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    let closest: DataPoint | null = null;
    let minDist = 100; // max threshold squared

    for (let i = 0; i < Math.min(data.length, 5000); i++) {
      const pt = data[i];
      const px = padding.left + ((pt.x - minX) / (maxX - minX)) * plotW;
      const py =
        height - padding.bottom - ((pt.y - minY) / (maxY - minY)) * plotH;
      const distSq = (mx - px) ** 2 + (my - py) ** 2;
      if (distSq < minDist) {
        minDist = distSq;
        closest = pt;
      }
    }

    setHoveredPoint(closest);
  };

  return (
    <div
      className={cn(
        "relative inline-block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg",
        className,
      )}
    >
      <canvas
        ref={internalCanvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredPoint(null);
          setMousePos(null);
        }}
        onClick={() => hoveredPoint && onPointClick?.(hoveredPoint)}
        className="cursor-crosshair block"
      />

      {/* Hover Tooltip Overlay */}
      {hoveredPoint && mousePos && (
        <div
          style={{
            left: `${Math.min(mousePos.x + 12, width - 140)}px`,
            top: `${Math.max(mousePos.y - 40, 10)}px`,
          }}
          className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-[11px] text-slate-200 shadow-xl backdrop-blur"
        >
          <div className="font-semibold text-indigo-400">
            {hoveredPoint.label || t("smartChart.dataPoint")}
          </div>
          <div>X: {hoveredPoint.x.toLocaleString()}</div>
          <div>Y: {hoveredPoint.y.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
});
