import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { PodaciumMotionStatus } from "./PodaciumMotionStatus";

describe("PodaciumMotionStatus", () => {
  it("renders a labelled live region", () => {
    render(<PodaciumMotionStatus state="searching" label="Searching" />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Searching");
  });

  it("falls back to the translated/fallback label", () => {
    render(<PodaciumMotionStatus state="success" />);
    expect(screen.getByRole("status")).toHaveTextContent("Done");
  });

  it("exposes the label as aria-label when the text is hidden", () => {
    render(
      <PodaciumMotionStatus state="busy" label="Working" showLabel={false} />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Working");
    expect(status).not.toHaveTextContent("Working");
  });

  it("updates when the controlled state changes", () => {
    const { rerender } = render(
      <PodaciumMotionStatus
        state="thinking"
        label="Thinking"
        animatedLabel={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");

    rerender(
      <PodaciumMotionStatus
        state="saving"
        label="Saving"
        animatedLabel={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
  });

  it("applies the requested variant and size", () => {
    render(
      <PodaciumMotionStatus
        state="idle"
        label="Ready"
        variant="glass"
        size="lg"
      />,
    );

    const status = screen.getByRole("status");
    expect(status.className).toContain("backdrop-blur-xl");
    expect(status.className).toContain("h-12");
  });

  it("renders an inline layout without a surface", () => {
    render(
      <PodaciumMotionStatus
        state="idle"
        label="Ready"
        variant="brand"
        layout="inline"
      />,
    );

    const status = screen.getByRole("status");
    expect(status.className).toContain("bg-transparent");
    expect(status.className).toContain("border-0");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <PodaciumMotionStatus state="syncing" label="Syncing files" paused />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
