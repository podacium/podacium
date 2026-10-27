import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PodaciumSpotlightCard from "./PodaciumSpotlightCard";

const motionSet = vi.hoisted(() => vi.fn());

// Mock framer-motion: keep the DOM shape, drop motion-only props.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      transition,
      whileInView,
      viewport,
      exit,
      layout,
      style,
      ...props
    }: any) => <div {...props}>{children}</div>,
  },
  useMotionValue: () => ({ set: motionSet, get: () => 0 }),
  useSpring: (value: unknown) => value,
  useTransform: () => 0,
  useReducedMotion: () => false,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useOptionalTheme: () => undefined,
}));

const rect = {
  width: 200,
  height: 100,
  top: 0,
  left: 0,
  right: 200,
  bottom: 100,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

describe("PodaciumSpotlightCard", () => {
  it("renders children inside the content wrapper", () => {
    render(<PodaciumSpotlightCard>Spotlight content</PodaciumSpotlightCard>);
    expect(screen.getByText("Spotlight content")).toBeInTheDocument();
  });

  it("exposes a stable data slot and tone", () => {
    const { container } = render(
      <PodaciumSpotlightCard tone="indigo">Tone</PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveAttribute("data-slot", "spotlight-card");
    expect(card).toHaveAttribute("data-tone", "indigo");
  });

  it("defaults to the blue→indigo brand gradient, never a flat fill", () => {
    const { container } = render(
      <PodaciumSpotlightCard>Blue</PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("from-blue-600");
    expect(card.className).toContain("to-indigo-600");
    expect(card.className).not.toContain("bg-brand ");
  });

  it("uses the tone variant gradient", () => {
    const { container } = render(
      <PodaciumSpotlightCard tone="brand">Brand</PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("via-indigo-600");
    expect(card.className).toContain("to-purple-600");
  });

  it("renders the grain overlay by default and omits it when disabled", () => {
    const { container: withGrain } = render(
      <PodaciumSpotlightCard>Grain</PodaciumSpotlightCard>,
    );
    expect(
      withGrain.querySelector('[data-slot="spotlight-card-grain"]'),
    ).not.toBeNull();

    const { container: noGrain } = render(
      <PodaciumSpotlightCard grain={false}>No grain</PodaciumSpotlightCard>,
    );
    expect(
      noGrain.querySelector('[data-slot="spotlight-card-grain"]'),
    ).toBeNull();
  });

  it("merges className and contentClassName", () => {
    const { container } = render(
      <PodaciumSpotlightCard
        className="custom-card"
        contentClassName="custom-content"
      >
        Merge
      </PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("custom-card");
    expect(card.className).toContain("rounded-3xl");
    expect(card.querySelector(".custom-content")?.className).toContain(
      "relative",
    );
  });

  it("tracks the pointer and relaxes back to rest on leave", () => {
    motionSet.mockClear();
    const { container } = render(
      <PodaciumSpotlightCard strength={10}>Pointer</PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    card.getBoundingClientRect = () => rect;

    // jsdom has no PointerEvent, so build one and supply pointerType by hand.
    const move = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 200,
      clientY: 100,
    });
    Object.defineProperty(move, "pointerType", { value: "mouse" });
    card.dispatchEvent(move);

    expect(motionSet).toHaveBeenCalledWith(10);
    expect(motionSet).toHaveBeenCalledTimes(2);

    motionSet.mockClear();
    // React synthesises onPointerLeave from `pointerout` + relatedTarget.
    fireEvent.pointerOut(card, { relatedTarget: document.body });
    expect(motionSet).toHaveBeenCalledWith(0);
  });

  it("forwards consumer pointer handlers", () => {
    const onPointerMove = vi.fn();
    const onPointerLeave = vi.fn();
    const { container } = render(
      <PodaciumSpotlightCard
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        Handlers
      </PodaciumSpotlightCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    card.getBoundingClientRect = () => rect;

    fireEvent.pointerMove(card, { clientX: 10, clientY: 10 });
    fireEvent.pointerOut(card, { relatedTarget: document.body });

    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
  });
});
