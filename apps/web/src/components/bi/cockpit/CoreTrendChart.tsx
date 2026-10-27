"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { formatCockpitMetric } from "./utils/formatters";
import { TrendDataPoint } from "./types";

export interface CoreTrendChartProps {
  title: string;
  subtitle?: string;
  data: TrendDataPoint[];
  targetGoal?: number;
  selectedDriverId?: string | null;
  onPointClick?: (point: TrendDataPoint) => void;
  isSnapshotMode?: boolean;
  className?: string;
}

export const CoreTrendChart: React.FC<CoreTrendChartProps> = ({
  title,
  subtitle,
  data,
  targetGoal,
  selectedDriverId,
  onPointClick,
  isSnapshotMode = false,
  className,
}) => {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "flex flex-col p-5 rounded-2xl border border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs",
        className,
      )}
      data-testid="core-trend-chart"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
          {selectedDriverId && (
            <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {t("bi.cockpit.trend.driverFilter", { driver: selectedDriverId })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-primary" />
            <span>{t("bi.cockpit.trend.actualNet")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400" />
            <span>{t("bi.cockpit.trend.budgetBaseline")}</span>
          </span>
          {targetGoal !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2.5 h-0.5 border-t-2 border-dashed border-emerald-500" />
              <span>{t("bi.cockpit.trend.targetGoal")}</span>
            </span>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        className="w-full h-[280px]"
        aria-label={t("bi.cockpit.trend.chartAriaLabel")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            onClick={(e) => {
              const state = e as {
                activePayload?: Array<{ payload: TrendDataPoint }>;
              } | null;
              if (state?.activePayload?.length) {
                onPointClick?.(state.activePayload[0].payload);
              }
            }}
          >
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2463eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2463eb" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="date"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              fontFamily="var(--font-mono)"
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => formatCockpitMetric(v, true, true)}
              fontFamily="var(--font-mono)"
              width={65}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as TrendDataPoint;
                return (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-lg text-xs space-y-1.5 text-start">
                    <div className="font-bold text-foreground font-mono">
                      {label}
                    </div>
                    <div className="flex items-center justify-between gap-4 text-primary font-semibold">
                      <span>{t("common.uiLabels.actualPrefix")}</span>
                      <span className="font-mono">
                        {formatCockpitMetric(point.actual, true)}
                      </span>
                    </div>
                    {point.budget !== undefined && (
                      <div className="flex items-center justify-between gap-4 text-muted-foreground">
                        <span>{t("common.uiLabels.budgetPrefix")}</span>
                        <span className="font-mono">
                          {formatCockpitMetric(point.budget, true)}
                        </span>
                      </div>
                    )}
                    {targetGoal !== undefined && (
                      <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                        <span>{t("common.uiLabels.goalPrefix")}</span>
                        <span className="font-mono">
                          {formatCockpitMetric(targetGoal, true)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {targetGoal !== undefined && (
              <ReferenceLine
                y={targetGoal}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Goal: ${formatCockpitMetric(targetGoal, true, true)}`,
                  position: "top",
                  fill: "#10b981",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Budget dashed curve */}
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={!isSnapshotMode}
            />

            {/* Actual primary area curve */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#2463eb"
              strokeWidth={2.5}
              fill="url(#actualGradient)"
              dot={{ r: 3, fill: "#2463eb", strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: "#2463eb",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              isAnimationActive={!isSnapshotMode}
              animationDuration={isSnapshotMode ? 0 : 500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CoreTrendChart;
