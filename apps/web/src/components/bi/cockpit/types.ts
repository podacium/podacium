/**
 * Types and interfaces for the High-Performance Executive Cockpit.
 */

export type CurrencyUnit = "DZD" | "USD" | "EUR";

export interface MetricSparklinePoint {
  date: string;
  value: number;
}

export interface CockpitMetric {
  id: string;
  title: string;
  value: number;
  currency?: boolean;
  baselineValue: number;
  baselineLabel: string; // e.g. "vs. Prior Month", "vs. Target Budget"
  changePercentage: number; // e.g. +14.2 or -3.8
  trendInverse?: boolean; // true if lower is better (e.g. CAC, churn, latency)
  sparklineData: MetricSparklinePoint[];
  status?: "normal" | "warning" | "critical";
  unit?: string;
}

export interface WaterfallDriver {
  id: string;
  name: string;
  category: "baseline" | "driver" | "total";
  amount: number; // positive = growth, negative = drag
  zScore: number; // statistical anomaly score
  isOutlier: boolean; // |zScore| >= 2.5
  outlierReason?: string;
  details?: string;
  contributionPercent?: number;
  direction?: "positive" | "negative";
}

export interface TrendDataPoint {
  date: string;
  actual: number;
  budget?: number;
  forecast?: number;
  highlightDriverId?: string;
}

export interface SensitivityDriver {
  id: string;
  label: string;
  unit: "%" | "DZD" | "x" | "users";
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  currentValue: number;
  elasticityCoefficient: number; // weight multiplier on projected trajectory
  description: string;
}

export interface SimulatorProjectionPoint {
  period: string;
  baseline: number;
  projected: number;
  targetThreshold: number;
  lower_95?: number;
  upper_95?: number;
}

export interface DrillThroughRecord {
  id: string | number;
  date: string;
  entity: string;
  category: string;
  amount: number;
  variance: number;
  status: string;
  [key: string]: unknown;
}

export interface ExecutiveDecisionMemo {
  id: string;
  title: string;
  metricKey: string;
  observedAnomaly: string;
  financialImpactDZD: number;
  proposedAction: string;
  assignedOwner: string;
  urgency: "critical" | "high" | "medium";
  loggedAt: string;
}
