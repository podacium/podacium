"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCockpitMetric, formatVarianceDelta } from "./utils/formatters";
import {
  computeWaterfallCoordinates,
  WaterfallBarCoordinate,
} from "./utils/anomaly";
import { WaterfallDriver } from "./types";
import { useTranslations } from "@/lib/i18n";

export interface WaterfallAnomalyWidgetProps {
  title: string;
  subtitle?: string;
  baselineLabel: string;
  baselineValue: number;
  currentValueLabel?: string;
  drivers: WaterfallDriver[];
  selectedDriverId?: string | null;
  onSelectDriver?: (driverId: string | null) => void;
  onDrillAnomaly?: (driver: WaterfallDriver) => void;
  isSnapshotMode?: boolean;
  className?: string;
}

export const WaterfallAnomalyWidget: React.FC<WaterfallAnomalyWidgetProps> = ({
  title,
  subtitle,
  baselineLabel,
  baselineValue,
  currentValueLabel = "Ending Actual",
  drivers,
  selectedDriverId,
  onSelectDriver,
  onDrillAnomaly,
  isSnapshotMode = false,
  className,
}) => {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const waterfallData: WaterfallBarCoordinate[] = useMemo(() => {
    return computeWaterfallCoordinates(
      baselineLabel,
      baselineValue,
      drivers,
      currentValueLabel,
    );
  }, [baselineLabel, baselineValue, drivers, currentValueLabel]);

  const outlierCount = useMemo(() => {
    return drivers.filter((d) => Math.abs(d.zScore) >= 2.5).length;
  }, [drivers]);

  return (
    <div
      className={cn(
        "flex flex-col p-5 rounded-2xl border border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs",
        className,
      )}
      data-testid="waterfall-anomaly-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {title}
            </h3>
            {outlierCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {outlierCount}{" "}
                {outlierCount === 1
                  ? t("bi.cockpit.waterfall.outlierSingle")
                  : t("bi.cockpit.waterfall.outlierPlural")}{" "}
                (|Z| ≥ 2.5)
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-500" />
            <span>{t("bi.cockpit.waterfall.baseline")}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            <span>{t("bi.cockpit.waterfall.gain")}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
            <span>{t("bi.cockpit.waterfall.drag")}</span>
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        className="w-full h-[280px]"
        aria-label={t("bi.cockpit.waterfall.ariaLabel")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={waterfallData}
            margin={{ top: 8, right: 30, left: 20, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              stroke="var(--color-border)"
              strokeOpacity={0.6}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => formatCockpitMetric(v, true, true)}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              fontFamily="var(--font-mono)"
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={110}
              tick={{ fill: "currentColor" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0].payload as WaterfallBarCoordinate;
                return (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-lg text-xs space-y-1">
                    <div className="font-bold text-foreground flex items-center justify-between gap-4">
                      <span>{item.name}</span>
                      {item.isOutlier && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Z = {item.zScore}σ
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {tCommon("uiLabels.impactPrefix")}{" "}
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          item.category === "baseline" ||
                            item.category === "total"
                            ? "text-foreground"
                            : item.isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {formatVarianceDelta(item.amount, false)}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {t("bi.cockpit.waterfall.runningTotal")}{" "}
                      <span className="font-mono font-medium text-foreground">
                        {formatCockpitMetric(item.runningTotal, true)}
                      </span>
                    </div>
                    {item.outlierReason && (
                      <div className="mt-1 pt-1 border-t border-border/40 text-[11px] text-rose-600 dark:text-rose-400">
                        {item.outlierReason}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {/* Stack 1: Invisible base bar to elevate floating deltas */}
            <Bar
              dataKey="base"
              stackId="waterfall"
              fill="transparent"
              isAnimationActive={false}
            />
            {/* Stack 2: Visual delta bars */}
            <Bar
              dataKey="barHeight"
              stackId="waterfall"
              radius={[3, 3, 3, 3]}
              isAnimationActive={!isSnapshotMode}
              animationDuration={isSnapshotMode ? 0 : 500}
              onClick={(entry) => {
                const item = entry as unknown as WaterfallBarCoordinate;
                onSelectDriver?.(item.id);
                if (item.isOutlier) {
                  const matching = drivers.find((d) => d.id === item.id);
                  if (matching) onDrillAnomaly?.(matching);
                }
              }}
            >
              {waterfallData.map((entry) => {
                let fill = "#64748b"; // Neutral slate for baseline & total
                if (entry.category === "driver") {
                  fill = entry.isPositive ? "#10b981" : "#ef4444";
                }
                const isSelected = selectedDriverId === entry.id;
                return (
                  <Cell
                    key={entry.id}
                    fill={fill}
                    fillOpacity={selectedDriverId && !isSelected ? 0.35 : 1.0}
                    stroke={
                      isSelected
                        ? "#2463eb"
                        : entry.isOutlier
                          ? "#ef4444"
                          : undefined
                    }
                    strokeWidth={isSelected ? 2 : entry.isOutlier ? 1.5 : 0}
                    cursor="pointer"
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen Reader Accessible Table Fallback */}
      <table className="sr-only">
        <caption>
          {title} {tCommon("uiLabels.varianceDecomposition")}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("bi.cockpit.waterfall.thDriver")}</th>
            <th scope="col">{t("bi.cockpit.waterfall.thAmount")}</th>
            <th scope="col">{t("bi.cockpit.waterfall.thRunningTotal")}</th>
            <th scope="col">{t("bi.cockpit.waterfall.thOutlierStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {waterfallData.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.amount}</td>
              <td>{row.runningTotal}</td>
              <td>
                {row.isOutlier
                  ? t("bi.cockpit.waterfall.outlierLabel", {
                      zScore: row.zScore,
                    })
                  : t("bi.cockpit.waterfall.normalStatus")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WaterfallAnomalyWidget;
