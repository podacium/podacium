import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetricStripCard } from "../MetricStripCard";
import { CockpitMetric } from "../types";

// Mock recharts responsive container for jsdom
vi.mock("recharts", async () => {
  const original = await vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe("MetricStripCard (Tier 1: Glance Layer)", () => {
  const mockMetric: CockpitMetric = {
    id: "test_rev",
    title: "Net Revenue",
    value: 450000,
    currency: true,
    baselineValue: 400000,
    baselineLabel: "vs. Prior Month",
    changePercentage: 12.5,
    sparklineData: [
      { date: "1", value: 400000 },
      { date: "2", value: 450000 },
    ],
  };

  it("renders giant number with Algerian DZD currency units", () => {
    render(<MetricStripCard metric={mockMetric} />);
    expect(screen.getByText("Net Revenue")).toBeInTheDocument();
    // Check formatted number
    expect(screen.getByText(/450\s*000/)).toBeInTheDocument();
  });

  it("renders functional color-coded badge with trend percentage", () => {
    render(<MetricStripCard metric={mockMetric} />);
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
  });

  it("explicitly states relative baseline anchor", () => {
    render(<MetricStripCard metric={mockMetric} />);
    expect(screen.getByText(/vs\. Prior Month/)).toBeInTheDocument();
    expect(screen.getByText(/400K/)).toBeInTheDocument();
  });

  it("triggers onSelect callback when clicked", () => {
    const handleSelect = vi.fn();
    render(<MetricStripCard metric={mockMetric} onSelect={handleSelect} />);
    const card = screen.getByTestId("metric-strip-card-test_rev");
    fireEvent.click(card);
    expect(handleSelect).toHaveBeenCalledWith("test_rev");
  });
});
