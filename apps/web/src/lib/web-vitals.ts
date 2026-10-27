import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import * as Sentry from "@sentry/nextjs";

export type MetricName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

// Performance budget thresholds aligned with Google 2026 Core Web Vitals standards
// INP < 50ms, LCP < 1.2s (1200ms), CLS = 0.00
export const metricThresholds: Record<
  MetricName,
  { good: number; poor: number }
> = {
  CLS: { good: 0.0, poor: 0.1 },
  FCP: { good: 1800, poor: 3000 },
  INP: { good: 50, poor: 200 },
  LCP: { good: 1200, poor: 2500 },
  TTFB: { good: 800, poor: 1800 },
};

export const perfBudget = {
  LCP: 1200,
  INP: 50,
  CLS: 0.0,
  FCP: 1800,
  TTFB: 800,
};

export function isWithin2026Budget(name: MetricName, value: number): boolean {
  return value <= metricThresholds[name].good;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const metrics = (Sentry as any).metrics;

function sendToAnalytics(metric: {
  name: string;
  value: number;
  rating?: string;
}) {
  const name = metric.name as MetricName;
  const thresholds = metricThresholds[name];
  if (!thresholds) return;

  const rating =
    metric.value <= thresholds.good
      ? "good"
      : metric.value <= thresholds.poor
        ? "needs-improvement"
        : "poor";

  try {
    metrics?.increment?.(`web_vital_${name}`, 1, { tags: { rating } });
    metrics?.distribution?.(`web_vital_${name}_value`, metric.value, {
      tags: { rating },
    });
  } catch {}

  if (typeof window !== "undefined" && "performance" in window) {
    try {
      const entries = performance.getEntriesByType("navigation");
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        if (
          nav &&
          typeof nav.startTime === "number" &&
          typeof nav.loadEventEnd === "number"
        ) {
          metrics?.distribution?.(
            "page_load_ms",
            nav.loadEventEnd - nav.startTime,
          );
        }
      }
    } catch {}
  }
}

export function reportWebVitals() {
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

export function getPerfBudget() {
  return perfBudget;
}
