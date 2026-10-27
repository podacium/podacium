"use client";

import React, { useRef, useEffect } from "react";
import { Activity } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
  category?: string;
}

export interface WebGLScatterPlotProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export const WebGLScatterPlot: React.FC<WebGLScatterPlotProps> = ({
  data,
  width = 800,
  height = 400,
  title = "High-Density WebGL Data Distribution",
  xAxisLabel = "X Dimension",
  yAxisLabel = "Y Dimension",
}) => {
  const t = useTranslations("bi.analytics.webgl");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Device Pixel Ratio scaling for Retina crispness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "rgba(15, 23, 42, 0.02)";
    ctx.fillRect(0, 0, width, height);

    if (!data || data.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data points available", width / 2, height / 2);
      return;
    }

    // Min/Max scaling bounds
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const padding = 40;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Draw Axes Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Render Data Points
    ctx.fillStyle = "#3b82f6";
    const radius = data.length > 5000 ? 1.5 : 3;

    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      const cx = padding + ((pt.x - minX) / rangeX) * plotW;
      const cy = height - padding - ((pt.y - minY) / rangeY) * plotH;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [data, width, height]);

  return (
    <div className="w-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
              {t("highDensityRenderer", {
                count: data.length.toLocaleString(),
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <canvas
          ref={canvasRef}
          style={{ width: `${width}px`, height: `${height}px` }}
          className="w-full rounded-2xl bg-slate-50/50 dark:bg-slate-950/50 border border-gray-100 dark:border-slate-800/80"
        />
      </div>

      <div className="flex justify-between items-center mt-3 text-[11px] text-gray-400 font-medium">
        <span>{xAxisLabel}</span>
        <span>{yAxisLabel}</span>
      </div>
    </div>
  );
};
