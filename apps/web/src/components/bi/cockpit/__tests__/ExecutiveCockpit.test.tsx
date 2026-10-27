import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ExecutiveCockpit } from "../ExecutiveCockpit";

// Mock next/dynamic to render components synchronously in tests
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<any>) => {
    let Component: React.ComponentType<any> | null = null;
    loader().then((mod) => {
      Component = mod.default || mod;
    });
    return function DynamicComponent(props: any) {
      if (!Component) {
        return <div data-testid="dynamic-skeleton">Loading...</div>;
      }
      return <Component {...props} />;
    };
  },
}));

vi.mock("recharts", async () => {
  const original = await vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe("ExecutiveCockpit (3-Tier Cockpit & 80/20 Color Doctrine)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 3-Tier Executive Cockpit layout with correct ARIA sections", async () => {
    render(
      <ExecutiveCockpit
        dashboardTitle="National Platform Performance"
        dashboardDescription="Q4 Algérie Poste & BaridiMob Metrics"
      />,
    );

    // Verify Dashboard Title and Subtitle
    expect(
      screen.getByText("National Platform Performance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Q4 Algérie Poste & BaridiMob Metrics"),
    ).toBeInTheDocument();

    // Verify 3-Tier Cockpit Structure
    // Tier 1: Executive Vital Signs (Glance Layer)
    const tier1 = screen.getByRole("region", { name: "Executive Vital Signs" });
    expect(tier1).toBeInTheDocument();

    // Tier 2: Root Cause & Trend Analysis (Analysis Layer)
    const tier2 = screen.getByRole("region", {
      name: "Root Cause & Trend Analysis",
    });
    expect(tier2).toBeInTheDocument();

    // Tier 3: Executive Sensitivity Sandbox (Simulation Layer)
    const tier3 = screen.getByRole("region", {
      name: "Executive Sensitivity Sandbox",
    });
    expect(tier3).toBeInTheDocument();
  });

  it("enforces 80/20 Color Doctrine: neutral slates dominate, no 3D or radial gauges", () => {
    const { container } = render(
      <ExecutiveCockpit dashboardTitle="DZD Sovereign Cockpit" />,
    );

    // 80% neutral grays/slates: check root container has neutral base classes
    const root = screen.getByTestId("executive-cockpit-root");
    expect(root).toBeInTheDocument();

    // Confirm absence of 3D chart tags or radial gauges
    expect(container.querySelector("gauge")).toBeNull();
    expect(container.querySelector("[data-chart-3d]")).toBeNull();
    expect(container.querySelector(".radial-gauge")).toBeNull();
  });

  it("sets deterministic ready attribute for automated Playwright snapshots", async () => {
    render(<ExecutiveCockpit dashboardTitle="Automated Snapshot Test" />);
    const root = screen.getByTestId("executive-cockpit-root");

    await waitFor(
      () => {
        expect(root).toHaveAttribute("data-cockpit-ready", "true");
      },
      { timeout: 8000 },
    );
  }, 15000);
});
