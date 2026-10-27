"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Sliders, CheckCircle2, RotateCcw, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { formatCockpitMetric } from "./utils/formatters";
import { SensitivityDriver, SimulatorProjectionPoint } from "./types";
import { biApi, SimulationResult } from "@/lib/api/bi";
import { useTranslations } from "@/lib/i18n";

export interface SimulatorSandboxPanelProps {
  baselineRevenue: number;
  targetGoalThreshold: number;
  projectionPeriods?: string[];
  initialDrivers?: SensitivityDriver[];
  onOpenDecisionMemo?: (scenarioState: {
    projectedEndingValue: number;
    deltaVsBaseline: number;
    driverValues: Record<string, number>;
  }) => void;
  isSnapshotMode?: boolean;
  className?: string;
}

const DEFAULT_DRIVERS: SensitivityDriver[] = [
  {
    id: "marketing_spend",
    label: "Monthly Marketing Spend",
    unit: "DZD",
    min: 50000,
    max: 1000000,
    step: 25000,
    defaultValue: 250000,
    currentValue: 250000,
    elasticityCoefficient: 0.85,
    description: "Paid acquisition budget across Meta, Google & TikTok ads",
  },
  {
    id: "retention_rate",
    label: "Customer Retention Target",
    unit: "%",
    min: 40,
    max: 95,
    step: 1,
    defaultValue: 72,
    currentValue: 72,
    elasticityCoefficient: 1.4,
    description: "30-day cohort retention for paid students and freelancers",
  },
  {
    id: "take_rate",
    label: "Freelance Platform Take-Rate",
    unit: "%",
    min: 5,
    max: 25,
    step: 0.5,
    defaultValue: 12,
    currentValue: 12,
    elasticityCoefficient: 1.1,
    description: "Podacium escrow commission on completed contracts",
  },
  {
    id: "pricing_factor",
    label: "Course Pricing / Discount Factor",
    unit: "%",
    min: -30,
    max: 30,
    step: 5,
    defaultValue: 0,
    currentValue: 0,
    elasticityCoefficient: 0.6,
    description: "Promotional charm pricing adjustments vs catalogue base",
  },
];

export const SimulatorSandboxPanel: React.FC<SimulatorSandboxPanelProps> = ({
  baselineRevenue,
  targetGoalThreshold,
  projectionPeriods = [
    "Month 1",
    "Month 2",
    "Month 3",
    "Month 4",
    "Month 5",
    "Month 6",
  ],
  initialDrivers = DEFAULT_DRIVERS,
  onOpenDecisionMemo,
  isSnapshotMode = false,
  className,
}) => {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  // Local state for interactive slider values (recalculated in <50ms)
  const [driverValues, setDriverValues] = useState<Record<string, number>>(
    () => {
      const initial: Record<string, number> = {};
      for (const d of initialDrivers) {
        initial[d.id] = d.defaultValue;
      }
      return initial;
    },
  );

  const handleSliderChange = useCallback((id: string, value: number) => {
    setDriverValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  const handleReset = useCallback(() => {
    const reset: Record<string, number> = {};
    for (const d of initialDrivers) {
      reset[d.id] = d.defaultValue;
    }
    setDriverValues(reset);
  }, [initialDrivers]);

  const [backendSimulation, setBackendSimulation] =
    useState<SimulationResult | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSnapshotMode) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await biApi.evaluateSimulation({
          base_monthly_revenue: baselineRevenue,
          target_revenue_goal: targetGoalThreshold,
          ad_budget_dzd: driverValues.marketing_spend ?? 250000,
          retention_rate_target: driverValues.retention_rate ?? 72,
          freelance_commission_rate: driverValues.take_rate ?? 12,
          pricing_discount: driverValues.pricing_factor ?? 0,
          horizon_months: projectionPeriods.length,
        });
        if (res && res.projections) {
          setBackendSimulation(res);
        }
      } catch {
        // Resilient fallback to local calculation
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    driverValues,
    baselineRevenue,
    targetGoalThreshold,
    projectionPeriods.length,
    isSnapshotMode,
  ]);

  // Compute real-time dual-curve trajectory in <5ms
  const { projectionData, projectedRunRate, deltaVsBaseline, isGoalReached } =
    useMemo(() => {
      // Relative impact multipliers
      const mktDelta =
        ((driverValues.marketing_spend ?? 250000) - 250000) / 250000;
      const retDelta = ((driverValues.retention_rate ?? 72) - 72) / 100;
      const takeDelta = ((driverValues.take_rate ?? 12) - 12) / 100;
      const priceDelta = (driverValues.pricing_factor ?? 0) / 100;

      // Composite monthly growth factor
      const simGrowthFactor =
        1 +
        (mktDelta * 0.12 +
          retDelta * 0.25 +
          takeDelta * 0.18 +
          priceDelta * 0.08);
      const baselineMonthlyGrowth = 1.025; // 2.5% natural organic growth

      const points: SimulatorProjectionPoint[] = [];
      let currentBase = baselineRevenue;
      let currentSim = baselineRevenue;

      projectionPeriods.forEach((period, idx) => {
        currentBase = Math.round(currentBase * baselineMonthlyGrowth);
        currentSim = Math.round(currentSim * simGrowthFactor);

        const backendPoint = backendSimulation?.projections?.[idx];

        points.push({
          period,
          baseline: currentBase,
          projected: currentSim,
          targetThreshold: targetGoalThreshold,
          lower_95: backendPoint
            ? Math.round(backendPoint.lower_95_dzd)
            : undefined,
          upper_95: backendPoint
            ? Math.round(backendPoint.upper_95_dzd)
            : undefined,
        });
      });

      const endingProjected =
        points[points.length - 1]?.projected ?? baselineRevenue;
      const endingBaseline =
        points[points.length - 1]?.baseline ?? baselineRevenue;
      const delta = endingProjected - endingBaseline;
      const reached = endingProjected >= targetGoalThreshold;

      return {
        projectionData: points,
        projectedRunRate: endingProjected,
        deltaVsBaseline: delta,
        isGoalReached: reached,
      };
    }, [
      driverValues,
      baselineRevenue,
      targetGoalThreshold,
      projectionPeriods,
      backendSimulation,
    ]);

  return (
    <div
      className={cn(
        "flex flex-col p-5 rounded-2xl border border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs",
        className,
      )}
      data-testid="simulator-sandbox-panel"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {t("bi.cockpit.simulator.title")}
            </h3>
            {isGoalReached ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {t("bi.cockpit.simulator.targetReached", {
                  amount: formatCockpitMetric(projectedRunRate, true, true),
                })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                {tCommon("uiLabels.gapPrefix")}{" "}
                {formatCockpitMetric(
                  targetGoalThreshold - projectedRunRate,
                  true,
                  true,
                )}
              </span>
            )}
            {backendSimulation && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-border">
                <Zap className="w-3 h-3 text-amber-500" />
                {t("bi.cockpit.simulator.monteCarlo", {
                  ms: backendSimulation.execution_time_ms,
                })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("bi.cockpit.simulator.description")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 me-1.5" />
            {t("bi.cockpit.simulator.reset")}
          </PodaciumButton>

          <PodaciumButton
            variant="gradient"
            size="sm"
            onClick={() =>
              onOpenDecisionMemo?.({
                projectedEndingValue: projectedRunRate,
                deltaVsBaseline,
                driverValues,
              })
            }
            className="text-xs h-8"
          >
            <FileText className="w-3.5 h-3.5 me-1.5" />
            {t("bi.cockpit.simulator.createMemo")}
          </PodaciumButton>
        </div>
      </div>

      {/* 2-Column Split: Sliders Panel (Left) & Real-time Projection Canvas (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Sliders Panel */}
        <div className="lg:col-span-5 space-y-4">
          {initialDrivers.map((driver) => {
            const current = driverValues[driver.id] ?? driver.defaultValue;
            return (
              <div
                key={driver.id}
                className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-border/50 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={`slider-${driver.id}`}
                    className="font-medium text-foreground cursor-pointer"
                  >
                    {driver.label}
                  </label>
                  <span className="font-mono font-bold text-primary">
                    {driver.unit === "DZD"
                      ? formatCockpitMetric(current, true, true)
                      : `${current > 0 && driver.unit === "%" && driver.id === "pricing_factor" ? "+" : ""}${current}${driver.unit}`}
                  </span>
                </div>

                <input
                  id={`slider-${driver.id}`}
                  type="range"
                  min={driver.min}
                  max={driver.max}
                  step={driver.step}
                  value={current}
                  onChange={(e) =>
                    handleSliderChange(driver.id, parseFloat(e.target.value))
                  }
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  aria-label={driver.label}
                />

                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>
                    {driver.unit === "DZD"
                      ? formatCockpitMetric(driver.min, true, true)
                      : `${driver.min}${driver.unit}`}
                  </span>
                  <span>
                    {driver.unit === "DZD"
                      ? formatCockpitMetric(driver.max, true, true)
                      : `${driver.max}${driver.unit}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Projection Chart Canvas */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-foreground">
              {t("bi.cockpit.simulator.projectedTrajectory")}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t-2 border-dashed border-slate-400" />
                <span>{t("bi.cockpit.simulator.baselineCurve")}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-primary" />
                <span>{t("bi.cockpit.simulator.simulatedProjection")}</span>
              </span>
              {backendSimulation && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-blue-500 font-medium">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-blue-400" />
                  <span>{t("bi.cockpit.simulator.ci95")}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/20 border border-emerald-500" />
                <span>{t("bi.cockpit.simulator.targetGoalZone")}</span>
              </span>
            </div>
          </div>

          <div
            className="w-full h-[260px]"
            aria-label={t("bi.cockpit.simulator.chartAriaLabel")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={projectionData}
                margin={{ top: 12, right: 15, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="simGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="period"
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
                    const point = payload[0]
                      .payload as SimulatorProjectionPoint;
                    return (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-lg text-xs space-y-1.5 text-start">
                        <div className="font-bold text-foreground font-mono">
                          {label}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-primary font-bold">
                          <span>{tCommon("uiLabels.simulatedPrefix")}</span>
                          <span className="font-mono">
                            {formatCockpitMetric(point.projected, true)}
                          </span>
                        </div>
                        {point.upper_95 !== undefined &&
                          point.lower_95 !== undefined && (
                            <div className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400 text-[11px]">
                              <span>{t("bi.cockpit.simulator.ciRange")}</span>
                              <span className="font-mono">
                                {formatCockpitMetric(point.lower_95, true)} -{" "}
                                {formatCockpitMetric(point.upper_95, true)}
                              </span>
                            </div>
                          )}
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>{tCommon("uiLabels.baselinePrefix")}</span>
                          <span className="font-mono">
                            {formatCockpitMetric(point.baseline, true)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                          <span>{t("bi.cockpit.simulator.targetGoal")}</span>
                          <span className="font-mono">
                            {formatCockpitMetric(point.targetThreshold, true)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Shaded Target Goal Zone Area */}
                <ReferenceArea
                  y1={targetGoalThreshold}
                  fill="#10b981"
                  fillOpacity={0.08}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                />

                {/* Target line threshold */}
                <ReferenceLine
                  y={targetGoalThreshold}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />

                {/* Status Quo Baseline Line (dashed slate-400) */}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={!isSnapshotMode}
                />

                {/* 95% Confidence Interval Band (if backend simulation loaded) */}
                {backendSimulation && (
                  <Area
                    type="monotone"
                    dataKey="upper_95"
                    stroke="#93c5fd"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                    fill="#2463eb"
                    fillOpacity={0.05}
                    dot={false}
                    isAnimationActive={!isSnapshotMode}
                  />
                )}
                {backendSimulation && (
                  <Area
                    type="monotone"
                    dataKey="lower_95"
                    stroke="#93c5fd"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                    fill="none"
                    dot={false}
                    isAnimationActive={!isSnapshotMode}
                  />
                )}

                {/* Real-time Simulated Projected Area (Cobalt blue) */}
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="#2463eb"
                  strokeWidth={2.5}
                  fill="url(#simGradient)"
                  dot={{ r: 3, fill: "#2463eb", strokeWidth: 0 }}
                  activeDot={{
                    r: 5,
                    fill: "#2463eb",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={!isSnapshotMode}
                  animationDuration={isSnapshotMode ? 0 : 300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatorSandboxPanel;
