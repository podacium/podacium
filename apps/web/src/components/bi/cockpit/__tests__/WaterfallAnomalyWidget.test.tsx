import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaterfallAnomalyWidget } from "../WaterfallAnomalyWidget";
import { WaterfallDriver } from "../types";

vi.mock("recharts", async () => {
  const original = await vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("WaterfallAnomalyWidget (Tier 2: Decomposition & Outlier Detection)", () => {
  const mockDrivers: WaterfallDriver[] = [
    {
      id: "corp",
      name: "Corporate B2B Contracts",
      category: "driver",
      amount: 450000,
      zScore: 1.2,
      isOutlier: false,
    },
    {
      id: "spike",
      name: "Infra Spike Cost",
      category: "driver",
      amount: -280000,
      zScore: -2.8,
      isOutlier: true,
      outlierReason: "Container memory leak",
    },
  ];

  it("renders waterfall title and outlier indicator badge", () => {
    render(
      <WaterfallAnomalyWidget
        title="Revenue Variance Decomposition"
        baselineLabel="Prior Baseline"
        baselineValue={3000000}
        drivers={mockDrivers}
      />,
    );

    expect(
      screen.getByText("Revenue Variance Decomposition"),
    ).toBeInTheDocument();
    // Outlier badge for |Z| >= 2.5
    expect(screen.getByText(/1 Outlier \(\|Z\| ≥ 2.5\)/)).toBeInTheDocument();
  });

  it("renders accessible screen-reader table fallback", () => {
    render(
      <WaterfallAnomalyWidget
        title="Revenue Variance Decomposition"
        baselineLabel="Prior Baseline"
        baselineValue={3000000}
        drivers={mockDrivers}
      />,
    );

    expect(screen.getByRole("table", { hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Corporate B2B Contracts")).toBeInTheDocument();
    expect(screen.getByText("Infra Spike Cost")).toBeInTheDocument();
  });
});
