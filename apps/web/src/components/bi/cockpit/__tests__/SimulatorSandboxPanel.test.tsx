import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimulatorSandboxPanel } from "../SimulatorSandboxPanel";

vi.mock("recharts", async () => {
  const original = await vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("SimulatorSandboxPanel (Tier 3: Actionable Simulator Sandbox)", () => {
  it("renders sensitivity sliders and reacts smoothly to slider changes", () => {
    render(
      <SimulatorSandboxPanel
        baselineRevenue={4000000}
        targetGoalThreshold={5000000}
      />,
    );

    expect(screen.getByText(/Executive Simulator Sandbox/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Monthly Marketing Spend"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Customer Retention Target"),
    ).toBeInTheDocument();

    const mktSlider = screen.getByLabelText("Monthly Marketing Spend");
    fireEvent.change(mktSlider, { target: { value: "800000" } });
    expect(mktSlider).toHaveValue("800000");
  });

  it("triggers decision memo callback with scenario state", () => {
    const handleMemo = vi.fn();
    render(
      <SimulatorSandboxPanel
        baselineRevenue={4000000}
        targetGoalThreshold={5000000}
        onOpenDecisionMemo={handleMemo}
      />,
    );

    const memoBtn = screen.getByText("Create Decision Memo");
    fireEvent.click(memoBtn);
    expect(handleMemo).toHaveBeenCalled();
  });
});
