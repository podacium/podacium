/**
 * Formatting utilities for Algerian DZD and compact metrics.
 */

import { formatDZD, formatNumberDZ, formatPercentageDZ } from "@/lib/formatDZD";

/**
 * Formats a number with Algerian currency (DZD) or compact units (K, M).
 */
export function formatCockpitMetric(
  val: number,
  isCurrency: boolean = true,
  compact: boolean = false,
): string {
  if (isCurrency) {
    return formatDZD(val, { compact });
  }
  if (compact) {
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (abs >= 1_000_000_000)
      return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(".", ",")}Md`;
    if (abs >= 1_000_000)
      return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (abs >= 1_000)
      return `${sign}${(abs / 1_000).toFixed(1).replace(".", ",")}K`;
    return `${sign}${abs.toFixed(0)}`;
  }
  return formatNumberDZ(val);
}

export function formatVarianceDelta(
  delta: number,
  isPercent: boolean = true,
): string {
  const sign = delta > 0 ? "+" : "";
  if (isPercent) {
    return `${sign}${formatPercentageDZ(delta)}`;
  }
  return `${sign}${formatDZD(delta, { compact: true })}`;
}
