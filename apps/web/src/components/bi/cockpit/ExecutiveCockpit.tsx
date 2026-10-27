"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "@/lib/i18n";
import type { MetricStripCardProps } from "./MetricStripCard";
import type { WaterfallAnomalyWidgetProps } from "./WaterfallAnomalyWidget";
import type { CoreTrendChartProps } from "./CoreTrendChart";
import type { SimulatorSandboxPanelProps } from "./SimulatorSandboxPanel";
import type { DrillThroughDrawerProps } from "./DrillThroughDrawer";

function CockpitChartSkeleton({ height = 360 }: { height?: number | string }) {
  const t = useTranslations("bi.dashboards");
  return (
    <div
      className="w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800"
      style={{ height }}
      role="status"
      aria-label={t("loadingChart")}
    >
      <div className="flex h-full items-end justify-around px-6 pb-6 pt-10 gap-2">
        {[0.6, 0.9, 0.4, 0.75, 0.55, 0.85, 0.5].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-lg bg-gray-200 dark:bg-slate-800/90"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  const t = useTranslations("bi.dashboards");
  return (
    <div
      className="w-full h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800/60 p-4 border border-border"
      role="status"
      aria-label={t("loadingChart")}
    >
      <div className="flex h-full items-end justify-around px-2 pb-2 pt-4 gap-1.5">
        {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-200 dark:bg-slate-700"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const MetricStripCard = dynamic<MetricStripCardProps>(
  () =>
    import("./MetricStripCard").then((m) => ({ default: m.MetricStripCard })),
  {
    ssr: false,
    loading: () => <MetricCardSkeleton />,
  },
);

const WaterfallAnomalyWidget = dynamic<WaterfallAnomalyWidgetProps>(
  () =>
    import("./WaterfallAnomalyWidget").then((m) => ({
      default: m.WaterfallAnomalyWidget,
    })),
  {
    ssr: false,
    loading: () => <CockpitChartSkeleton height={360} />,
  },
);

const CoreTrendChart = dynamic<CoreTrendChartProps>(
  () => import("./CoreTrendChart").then((m) => ({ default: m.CoreTrendChart })),
  {
    ssr: false,
    loading: () => <CockpitChartSkeleton height={360} />,
  },
);

const SimulatorSandboxPanel = dynamic<SimulatorSandboxPanelProps>(
  () =>
    import("./SimulatorSandboxPanel").then((m) => ({
      default: m.SimulatorSandboxPanel,
    })),
  {
    ssr: false,
    loading: () => <CockpitChartSkeleton height={420} />,
  },
);

const DrillThroughDrawer = dynamic<DrillThroughDrawerProps>(
  () =>
    import("./DrillThroughDrawer").then((m) => ({
      default: m.DrillThroughDrawer,
    })),
  {
    ssr: false,
  },
);
import {
  CockpitMetric,
  WaterfallDriver,
  TrendDataPoint,
  DrillThroughRecord,
  ExecutiveDecisionMemo,
} from "./types";
import { cn } from "@/lib/utils";

export interface ExecutiveCockpitProps {
  metrics?: CockpitMetric[];
  initialActiveMetricId?: string;
  isSnapshotMode?: boolean;
  onDecisionMemoCreated?: (memo: ExecutiveDecisionMemo) => void;
  className?: string;
  dashboardTitle?: string;
  dashboardDescription?: string;
  widgets?: unknown[];
}

const DEFAULT_METRICS: CockpitMetric[] = [
  {
    id: "net_revenue",
    title: "Net Platform Revenue",
    value: 4500000,
    currency: true,
    baselineValue: 3950000,
    baselineLabel: "vs. Prior Month",
    changePercentage: 13.9,
    trendInverse: false,
    status: "normal",
    sparklineData: [
      { date: "Day 1", value: 3950000 },
      { date: "Day 5", value: 4020000 },
      { date: "Day 10", value: 4150000 },
      { date: "Day 15", value: 4280000 },
      { date: "Day 20", value: 4320000 },
      { date: "Day 25", value: 4410000 },
      { date: "Day 30", value: 4500000 },
    ],
  },
  {
    id: "active_freelance_gmv",
    title: "Escrow Contract GMV",
    value: 12800000,
    currency: true,
    baselineValue: 11400000,
    baselineLabel: "vs. Target Budget",
    changePercentage: 12.3,
    trendInverse: false,
    status: "normal",
    sparklineData: [
      { date: "Day 1", value: 11400000 },
      { date: "Day 10", value: 11800000 },
      { date: "Day 20", value: 12200000 },
      { date: "Day 30", value: 12800000 },
    ],
  },
  {
    id: "cloud_infra_cost",
    title: "Cloud & Infrastructure Cost",
    value: 840000,
    currency: true,
    baselineValue: 620000,
    baselineLabel: "vs. Budget Baseline",
    changePercentage: 35.5,
    trendInverse: true, // Higher cost is critical
    status: "critical",
    sparklineData: [
      { date: "Day 1", value: 620000 },
      { date: "Day 10", value: 660000 },
      { date: "Day 18", value: 710000 },
      { date: "Day 25", value: 810000 },
      { date: "Day 30", value: 840000 },
    ],
  },
  {
    id: "student_retention",
    title: "Course Completion Rate",
    value: 78.4,
    currency: false,
    baselineValue: 82.0,
    baselineLabel: "vs. Prior Cohort",
    changePercentage: -4.4,
    trendInverse: false,
    unit: "%",
    status: "warning",
    sparklineData: [
      { date: "Day 1", value: 82.0 },
      { date: "Day 10", value: 81.2 },
      { date: "Day 20", value: 79.5 },
      { date: "Day 30", value: 78.4 },
    ],
  },
];

const DEFAULT_DRIVERS: WaterfallDriver[] = [
  {
    id: "b2b_corporate",
    name: "Corporate DAF Subscriptions",
    category: "driver",
    amount: 520000,
    zScore: 1.4,
    isOutlier: false,
    details: "New annual accounts in Algiers & Oran",
  },
  {
    id: "freelance_commission",
    name: "Freelance Escrow Take",
    category: "driver",
    amount: 340000,
    zScore: 0.9,
    isOutlier: false,
    details: "12% fee on completed milestones",
  },
  {
    id: "infra_spike",
    name: "Cloud MicroVM Spikes",
    category: "driver",
    amount: -220000,
    zScore: -2.8,
    isOutlier: true,
    outlierReason:
      "Statistical spike in GPU sandbox training clusters (|Z| = 2.8 ≥ 2.5)",
    details: "Container concurrency saturation",
  },
  {
    id: "sms_gateway",
    name: "SMS OTP Gateway Overages",
    category: "driver",
    amount: -90000,
    zScore: -1.2,
    isOutlier: false,
    details: "Mobilis/Djezzy bulk route price adjustments",
  },
];

const DEFAULT_TREND_DATA: TrendDataPoint[] = [
  { date: "Jan", actual: 3200000, budget: 3000000 },
  { date: "Feb", actual: 3450000, budget: 3200000 },
  { date: "Mar", actual: 3700000, budget: 3500000 },
  { date: "Apr", actual: 3600000, budget: 3700000 },
  { date: "May", actual: 3950000, budget: 3900000 },
  { date: "Jun", actual: 4500000, budget: 4100000 },
];

const DEFAULT_DRILLTHROUGH_RECORDS: DrillThroughRecord[] = [
  {
    id: 1,
    date: "2026-10-12",
    entity: "Sonatrach IT Directorate",
    category: "Corporate DAF Training",
    amount: 350000,
    variance: 65000,
    status: "approved",
  },
  {
    id: 2,
    date: "2026-10-14",
    entity: "Djezzy Telecom Operations",
    category: "Enterprise BI Seat",
    amount: 170000,
    variance: 25000,
    status: "completed",
  },
  {
    id: 3,
    date: "2026-10-15",
    entity: "GPU MicroVM Cluster Algiers",
    category: "Cloud Infra Overage",
    amount: -220000,
    variance: -120000,
    status: "critical",
  },
  {
    id: 4,
    date: "2026-10-16",
    entity: "Mobilis Bulk OTP Route",
    category: "SMS Gateway",
    amount: -90000,
    variance: -30000,
    status: "flagged",
  },
];

export const ExecutiveCockpit: React.FC<ExecutiveCockpitProps> = ({
  metrics = DEFAULT_METRICS,
  initialActiveMetricId = "net_revenue",
  isSnapshotMode = false,
  onDecisionMemoCreated,
  className,
  dashboardTitle,
  dashboardDescription,
}) => {
  const t = useTranslations();
  const [activeMetricId, setActiveMetricId] = useState<string>(
    initialActiveMetricId,
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState(
    "Platform Revenue Drill-Through",
  );
  const [drawerSubtitle, setDrawerSubtitle] = useState(
    "Root-cause transaction records",
  );
  const [isReady, setIsReady] = useState(false);

  // Signal deterministic readiness for automated Playwright snapshots
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      if (typeof window !== "undefined") {
        (
          window as unknown as { __PODACIUM_CHARTS_READY__?: boolean }
        ).__PODACIUM_CHARTS_READY__ = true;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const activeMetric = useMemo(() => {
    return metrics.find((m) => m.id === activeMetricId) || metrics[0];
  }, [metrics, activeMetricId]);

  const handleSelectMetric = useCallback((id: string) => {
    setActiveMetricId(id);
    setSelectedDriverId(null);
  }, []);

  const handleDrillThrough = useCallback(
    (metricId: string) => {
      const m = metrics.find((item) => item.id === metricId);
      if (m) {
        setDrawerTitle(`${m.title} Inspection`);
        setDrawerSubtitle(
          `Granular variance decomposition for ${m.baselineLabel}`,
        );
        setIsDrawerOpen(true);
      }
    },
    [metrics],
  );

  const handleDrillAnomaly = useCallback((driver: WaterfallDriver) => {
    setDrawerTitle(`Anomaly Root Cause: ${driver.name}`);
    setDrawerSubtitle(
      driver.outlierReason || "Statistical variance investigation (|Z| ≥ 2.5)",
    );
    setIsDrawerOpen(true);
  }, []);

  return (
    <div
      className={cn("w-full space-y-6 text-start", className)}
      data-testid="executive-cockpit-root"
      data-cockpit-ready={isReady ? "true" : "false"}
    >
      {dashboardTitle && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/80 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-800/80 border border-border shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary text-primary-foreground">
                {t("bi.cockpit.executive.badge3Tier")}
              </span>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {dashboardTitle}
              </h2>
            </div>
            {dashboardDescription && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {dashboardDescription}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("bi.cockpit.executive.badgeInvertedPyramid")}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border">
              {t("bi.cockpit.executive.badgeDzdStandard")}
            </span>
          </div>
        </div>
      )}

      {/* TIER 1: The Status Cards (Glance Layer) */}
      <section
        aria-label={t("bi.cockpit.executive.ariaVitalSigns")}
        className="w-full"
      >
        {/* Responsive Mobile Layout: Swipeable Carousel with CSS scroll-snap on < 1024px */}
        <div className="lg:hidden flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 pb-2 pt-1 -mx-4 px-4">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="min-w-[280px] max-w-[320px] snap-center shrink-0"
            >
              <MetricStripCard
                metric={metric}
                isSelected={metric.id === activeMetricId}
                onSelect={handleSelectMetric}
                onDrillThrough={handleDrillThrough}
                isSnapshotMode={isSnapshotMode}
              />
            </div>
          ))}
        </div>

        {/* Desktop Layout: 4-Column Metric Grid on >= 1024px */}
        <div className="hidden lg:grid grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <MetricStripCard
              key={metric.id}
              metric={metric}
              isSelected={metric.id === activeMetricId}
              onSelect={handleSelectMetric}
              onDrillThrough={handleDrillThrough}
              isSnapshotMode={isSnapshotMode}
            />
          ))}
        </div>
      </section>

      {/* TIER 2: The Anomaly & Driver Detection Engine (Analysis Layer) */}
      <section
        aria-label={t("bi.cockpit.executive.ariaRootCause")}
        className="w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Horizontal Waterfall Variance Decomposition */}
          <div className="lg:col-span-6">
            <WaterfallAnomalyWidget
              title={t("bi.cockpit.executive.varianceDriversTitle", {
                metric: activeMetric.title,
              })}
              subtitle={t("bi.cockpit.executive.varianceDriversSubtitle", {
                baseline: activeMetric.baselineLabel,
              })}
              baselineLabel="Prior Baseline"
              baselineValue={activeMetric.baselineValue}
              currentValueLabel="Current Net"
              drivers={DEFAULT_DRIVERS}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              onDrillAnomaly={handleDrillAnomaly}
              isSnapshotMode={isSnapshotMode}
            />
          </div>

          {/* Right: Core Trend Focus Chart */}
          <div className="lg:col-span-6">
            <CoreTrendChart
              title={t("bi.cockpit.executive.revenueTrendTitle")}
              subtitle={t("bi.cockpit.executive.revenueTrendSubtitle")}
              data={DEFAULT_TREND_DATA}
              targetGoal={5000000} // 5.0M DZD Target
              selectedDriverId={selectedDriverId}
              isSnapshotMode={isSnapshotMode}
            />
          </div>
        </div>
      </section>

      {/* TIER 3: The Actionable Simulator Sandbox (Simulation Layer) */}
      <section
        aria-label={t("bi.cockpit.executive.ariaSensitivitySandbox")}
        className="w-full"
      >
        <SimulatorSandboxPanel
          baselineRevenue={activeMetric.value}
          targetGoalThreshold={5000000}
          onOpenDecisionMemo={(scenario) => {
            setDrawerTitle("Simulator Scenario Memo");
            setDrawerSubtitle(
              `Projected Net: ${scenario.projectedEndingValue.toLocaleString()} DZD (Delta: ${scenario.deltaVsBaseline > 0 ? "+" : ""}${scenario.deltaVsBaseline.toLocaleString()} DZD)`,
            );
            setIsDrawerOpen(true);
          }}
          isSnapshotMode={isSnapshotMode}
        />
      </section>

      {/* Slide-out Drill-Through Drawer */}
      <DrillThroughDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        records={DEFAULT_DRILLTHROUGH_RECORDS}
        onCreateDecisionMemo={onDecisionMemoCreated}
      />
    </div>
  );
};

export default ExecutiveCockpit;
