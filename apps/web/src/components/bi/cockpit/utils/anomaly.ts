/**
 * Anomaly detection and variance decomposition utilities.
 */

import { WaterfallDriver } from "../types";

/**
 * Calculates mean and standard deviation for Z-score anomaly detection.
 */
export function computeZScores(values: number[]): number[] {
  if (values.length === 0) return [];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return values.map(() => 0);
  }

  return values.map((v) => Number(((v - mean) / stdDev).toFixed(2)));
}

/**
 * Decomposes variance into waterfall coordinates:
 * Base (transparent stack anchor), Bar Value (magnitude), and running total.
 */
export interface WaterfallBarCoordinate {
  id: string;
  name: string;
  category: "baseline" | "driver" | "total";
  amount: number;
  base: number; // lower edge of the bar
  barHeight: number; // visual height
  runningTotal: number;
  isPositive: boolean;
  isOutlier: boolean;
  zScore: number;
  outlierReason?: string;
}

export function computeWaterfallCoordinates(
  baselineLabel: string,
  baselineValue: number,
  drivers: WaterfallDriver[],
  netLabel?: string,
): WaterfallBarCoordinate[] {
  const resolvedNetLabel = netLabel ?? ["Current", "Value"].join(" ");
  const result: WaterfallBarCoordinate[] = [];

  // 1. Starting Baseline Pillar
  result.push({
    id: "baseline_start",
    name: baselineLabel,
    category: "baseline",
    amount: baselineValue,
    base: 0,
    barHeight: Math.abs(baselineValue),
    runningTotal: baselineValue,
    isPositive: baselineValue >= 0,
    isOutlier: false,
    zScore: 0,
  });

  let runningTotal = baselineValue;

  // 2. Intermediate Contributing Drivers
  for (const driver of drivers) {
    const priorTotal = runningTotal;
    runningTotal += driver.amount;

    const base = Math.min(priorTotal, runningTotal);
    const barHeight = Math.abs(driver.amount);

    result.push({
      id: driver.id,
      name: driver.name,
      category: "driver",
      amount: driver.amount,
      base: base,
      barHeight: barHeight,
      runningTotal: runningTotal,
      isPositive: driver.amount >= 0,
      isOutlier: Math.abs(driver.zScore) >= 2.5,
      zScore: driver.zScore,
      outlierReason: driver.outlierReason,
    });
  }

  // 3. Ending Net Pillar
  result.push({
    id: "net_end",
    name: resolvedNetLabel,
    category: "total",
    amount: runningTotal,
    base: 0,
    barHeight: Math.abs(runningTotal),
    runningTotal: runningTotal,
    isPositive: runningTotal >= 0,
    isOutlier: false,
    zScore: 0,
  });

  return result;
}
