import { describe, it, expect, vi } from "vitest";
import {
  metricThresholds,
  perfBudget,
  getPerfBudget,
  isWithin2026Budget,
  reportWebVitals,
} from "./web-vitals";

vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  metrics: {
    increment: vi.fn(),
    distribution: vi.fn(),
  },
}));

describe("2026 Core Web Vitals Performance Budgets", () => {
  it("enforces INP < 50ms, LCP < 1.2s, and CLS = 0.00 standards", () => {
    expect(perfBudget.INP).toBe(50);
    expect(perfBudget.LCP).toBe(1200);
    expect(perfBudget.CLS).toBe(0.0);
    expect(perfBudget.FCP).toBe(1800);
    expect(perfBudget.TTFB).toBe(800);

    const budget = getPerfBudget();
    expect(budget).toEqual(perfBudget);
  });

  it("validates metric thresholds correctly with isWithin2026Budget", () => {
    // INP: good <= 50ms
    expect(isWithin2026Budget("INP", 45)).toBe(true);
    expect(isWithin2026Budget("INP", 50)).toBe(true);
    expect(isWithin2026Budget("INP", 65)).toBe(false);

    // LCP: good <= 1200ms
    expect(isWithin2026Budget("LCP", 1100)).toBe(true);
    expect(isWithin2026Budget("LCP", 1200)).toBe(true);
    expect(isWithin2026Budget("LCP", 1300)).toBe(false);

    // CLS: good <= 0.00
    expect(isWithin2026Budget("CLS", 0.0)).toBe(true);
    expect(isWithin2026Budget("CLS", 0.05)).toBe(false);

    // FCP & TTFB
    expect(isWithin2026Budget("FCP", 1800)).toBe(true);
    expect(isWithin2026Budget("FCP", 2000)).toBe(false);
    expect(isWithin2026Budget("TTFB", 800)).toBe(true);
    expect(isWithin2026Budget("TTFB", 900)).toBe(false);
  });

  it("subscribes to web-vitals reporters when reportWebVitals is invoked", async () => {
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
    reportWebVitals();
    expect(onCLS).toHaveBeenCalled();
    expect(onFCP).toHaveBeenCalled();
    expect(onINP).toHaveBeenCalled();
    expect(onLCP).toHaveBeenCalled();
    expect(onTTFB).toHaveBeenCalled();
  });
});
