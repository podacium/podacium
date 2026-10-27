"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import { formatCockpitMetric } from "./utils/formatters";
import { CockpitMetric } from "./types";

export interface MetricStripCardProps {
  metric: CockpitMetric;
  isSelected?: boolean;
  onSelect?: (metricId: string) => void;
  onDrillThrough?: (metricId: string) => void;
  isSnapshotMode?: boolean;
  className?: string;
}

export const MetricStripCard: React.FC<MetricStripCardProps> = ({
  metric,
  isSelected = false,
  onSelect,
  onDrillThrough,
  isSnapshotMode = false,
  className,
}) => {
  const t = useTranslations();
  const isPositiveChange = metric.changePercentage > 0;
  // If trendInverse is true (e.g. CAC, churn), lower is better
  const isGoodOutcome = metric.trendInverse
    ? !isPositiveChange
    : isPositiveChange;
  const isNeutral = metric.changePercentage === 0;

  const sparklineData = useMemo(() => {
    if (metric.sparklineData && metric.sparklineData.length > 0) {
      return metric.sparklineData;
    }
    // Fallback baseline trend
    return [
      { date: "1", value: metric.baselineValue },
      { date: "2", value: metric.value },
    ];
  }, [metric.sparklineData, metric.baselineValue, metric.value]);

  const strokeColor = isNeutral
    ? "#94a3b8"
    : isGoodOutcome
      ? "#10b981"
      : "#ef4444";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(metric.id)}
      onDoubleClick={() => onDrillThrough?.(metric.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(metric.id);
        }
      }}
      className={cn(
        "relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 select-none cursor-pointer text-start",
        "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs hover:shadow-md",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md bg-white dark:bg-slate-900"
          : "border-border hover:border-border/80",
        className,
      )}
      data-testid={`metric-strip-card-${metric.id}`}
    >
      {/* Top Header: Title and Baseline Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {metric.title}
        </span>

        {/* Functional Color-Coded Badge */}
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0",
            isNeutral &&
              "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
            !isNeutral &&
              isGoodOutcome &&
              "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
            !isNeutral &&
              !isGoodOutcome &&
              "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
          )}
        >
          {isNeutral ? (
            <Minus className="w-3 h-3" />
          ) : isPositiveChange ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          <span>
            {isPositiveChange ? "+" : ""}
            {metric.changePercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Headline Giant Number */}
      <div className="my-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
          {formatCockpitMetric(metric.value, metric.currency !== false)}
        </div>
      </div>

      {/* Micro-Sparkline Underneath */}
      <div className="h-8 w-full my-1 overflow-hidden" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={sparklineData}
            margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient
                id={`grad-${metric.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#grad-${metric.id})`}
              isAnimationActive={!isSnapshotMode}
              animationDuration={isSnapshotMode ? 0 : 500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Subtext: Relative Baseline Anchor */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
        <span className="truncate">
          {metric.baselineLabel}{" "}
          <span className="font-mono text-foreground/80 font-medium">
            (
            {formatCockpitMetric(
              metric.baselineValue,
              metric.currency !== false,
              true,
            )}
            )
          </span>
        </span>

        {metric.status === "critical" && (
          <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium shrink-0 ms-1">
            <AlertTriangle className="w-3 h-3" />
            <span>{t("bi.cockpit.alert")}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricStripCard;
