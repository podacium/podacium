"use client";

import React, { useMemo } from "react";

interface FrictionHeatmapScrubberProps {
  telemetryBins?: number[]; // Array of 100 frequency counts
  className?: string;
}

export const FrictionHeatmapScrubber: React.FC<
  FrictionHeatmapScrubberProps
> = ({ telemetryBins = [], className = "" }) => {
  const pathD = useMemo(() => {
    if (!telemetryBins || telemetryBins.length === 0) return "";

    const bins =
      telemetryBins.length === 100 ? telemetryBins : Array(100).fill(0);
    const maxVal = Math.max(1, ...bins);
    const width = 1000;
    const height = 24;

    const points = bins.map((count, index) => {
      const x = (index / 99) * width;
      const normalized = count / maxVal;
      const y = height - normalized * (height - 4);
      return { x, y };
    });

    if (points.length < 2) return "";

    // Generate smooth SVG curve using cubic bezier control points
    let d = `M ${points[0].x} ${height} L ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }

    d += ` L ${width} ${height} Z`;
    return d;
  }, [telemetryBins]);

  if (!pathD) return null;

  return (
    <div
      className={`absolute inset-x-0 bottom-full h-6 pointer-events-none opacity-40 hover:opacity-80 transition-opacity ${className}`}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1000 24"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="heatmapGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={pathD} fill="url(#heatmapGradient)" />
      </svg>
    </div>
  );
};
