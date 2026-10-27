import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PodaciumCard from "./PodaciumCard";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe("PodaciumCard", () => {
  it("renders children content", () => {
    render(<PodaciumCard>Card content</PodaciumCard>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<PodaciumCard>Default</PodaciumCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-md");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-white dark:bg-slate-900");
  });

  it("applies elevated variant", () => {
    const { container } = render(
      <PodaciumCard variant="elevated">Elevated</PodaciumCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("shadow-md");
  });

  it("applies outline variant", () => {
    const { container } = render(
      <PodaciumCard variant="outline">Outline</PodaciumCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-2");
    expect(card.className).toContain("bg-transparent");
  });

  it("applies padding variants", () => {
    const { container: sm } = render(
      <PodaciumCard padding="sm">Small</PodaciumCard>,
    );
    expect((sm.firstChild as HTMLElement).className).toContain("p-4");

    const { container: md } = render(
      <PodaciumCard padding="md">Medium</PodaciumCard>,
    );
    expect((md.firstChild as HTMLElement).className).toContain("p-6");

    const { container: lg } = render(
      <PodaciumCard padding="lg">Large</PodaciumCard>,
    );
    expect((lg.firstChild as HTMLElement).className).toContain("p-8");

    const { container: none } = render(
      <PodaciumCard padding="none">None</PodaciumCard>,
    );
    expect((none.firstChild as HTMLElement).className).not.toContain("p-");
  });

  it("applies hover effect when hover=true", () => {
    const { container } = render(<PodaciumCard hover>Hoverable</PodaciumCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("hover:shadow-md");
  });

  it("does not apply hover effect by default", () => {
    const { container } = render(<PodaciumCard>No hover</PodaciumCard>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("hover:shadow-md");
  });

  it("accepts custom className", () => {
    const { container } = render(
      <PodaciumCard className="custom-class">Custom</PodaciumCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom-class");
  });

  it("applies premium variant with gradient hairline border", () => {
    const { container } = render(
      <PodaciumCard variant="premium">Premium</PodaciumCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("gradient-border");
    expect(card.className).toContain("border-transparent");
  });

  it("applies glass variant", () => {
    const { container } = render(
      <PodaciumCard variant="glass">Glass</PodaciumCard>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("backdrop-blur-xl");
  });

  it("renders complex children", () => {
    render(
      <PodaciumCard>
        <h2>Title</h2>
        <p>Description</p>
        <button>Action</button>
      </PodaciumCard>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});
