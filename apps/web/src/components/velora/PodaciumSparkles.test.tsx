import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PodaciumSparkles } from "./PodaciumSparkles";

const sparkleLayer = () =>
  document.querySelector('[data-slot="sparkle-layer"]');

describe("PodaciumSparkles", () => {
  it("keeps the label as real, queryable text", () => {
    render(<PodaciumSparkles>Magic moments</PodaciumSparkles>);

    expect(screen.getByText("Magic moments")).toBeInTheDocument();
  });

  it("hides the sparkle layer from assistive tech", () => {
    render(<PodaciumSparkles>Magic moments</PodaciumSparkles>);

    expect(sparkleLayer()).toHaveAttribute("aria-hidden", "true");
    expect(sparkleLayer()).toHaveClass("pointer-events-none");
  });

  it("draws the requested number of sparkles", () => {
    render(<PodaciumSparkles count={2}>Magic moments</PodaciumSparkles>);

    expect(sparkleLayer()?.querySelectorAll("svg")).toHaveLength(2);
  });

  it("clamps the count to the curated layout", () => {
    const { unmount } = render(
      <PodaciumSparkles count={99}>Magic moments</PodaciumSparkles>,
    );

    expect(sparkleLayer()?.querySelectorAll("svg")).toHaveLength(8);
    unmount();

    render(<PodaciumSparkles count={-4}>Magic moments</PodaciumSparkles>);

    expect(sparkleLayer()?.querySelectorAll("svg")).toHaveLength(0);
  });

  it("applies the burst delay on top of each sparkle's stagger", () => {
    render(
      <PodaciumSparkles count={1} delay={200}>
        Magic moments
      </PodaciumSparkles>,
    );

    const sparkle = sparkleLayer()?.querySelector("svg");

    expect(sparkle?.getAttribute("style")).toContain("--sparkle-delay: 200ms");
  });

  it("is one-shot unless `loop` is requested", () => {
    const { unmount } = render(
      <PodaciumSparkles count={2}>Magic moments</PodaciumSparkles>,
    );

    expect(
      sparkleLayer()?.querySelector('svg[data-loop="true"]'),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <PodaciumSparkles count={2} loop>
        Magic moments
      </PodaciumSparkles>,
    );

    expect(
      sparkleLayer()?.querySelectorAll('svg[data-loop="true"]'),
    ).toHaveLength(2);
  });

  it("spreads loop phases across the cycle instead of firing together", () => {
    render(
      <PodaciumSparkles count={4} loop>
        Magic moments
      </PodaciumSparkles>,
    );

    const delays = Array.from(
      sparkleLayer()?.querySelectorAll("svg") ?? [],
    ).map((svg) => svg.getAttribute("style") ?? "");

    expect(delays[0]).toContain("--sparkle-delay: 0ms");
    expect(delays[1]).toContain("--sparkle-delay: 1000ms");
    expect(delays[2]).toContain("--sparkle-delay: 2000ms");
    expect(delays[3]).toContain("--sparkle-delay: 3000ms");
  });

  it("merges a caller className with the wrapper defaults", () => {
    const { container } = render(
      <PodaciumSparkles className="inline-flex text-brand">
        Magic moments
      </PodaciumSparkles>,
    );

    const wrapper = container.querySelector('[data-slot="sparkles-text"]');

    expect(wrapper).toHaveClass("relative", "inline-flex", "text-brand");
  });
});
