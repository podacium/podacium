import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PodaciumMotionGrid,
  PodaciumMotionGridCells,
  type Frames,
} from "./PodaciumMotionGrid";

const twoFrames = [[[0, 0]], [[1, 1]]] as Frames;

const activeCells = (container: HTMLElement) =>
  container.querySelectorAll('[data-active="true"]');

describe("PodaciumMotionGrid", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one cell per grid coordinate", () => {
    const { container } = render(
      <PodaciumMotionGrid frames={twoFrames} gridSize={[2, 2]}>
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    expect(container.querySelectorAll("[data-motion-grid-cell]")).toHaveLength(
      4,
    );
    expect(activeCells(container)).toHaveLength(1);
  });

  it("advances to the next frame after the interval", () => {
    const { container } = render(
      <PodaciumMotionGrid frames={twoFrames} gridSize={[2, 2]} interval={100}>
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    expect(activeCells(container)).toHaveLength(1);
    expect(activeCells(container)[0]).toHaveAttribute("data-active", "true");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(activeCells(container)).toHaveLength(1);
  });

  it("does not advance when paused", () => {
    const { container } = render(
      <PodaciumMotionGrid
        frames={twoFrames}
        gridSize={[2, 2]}
        interval={100}
        paused
      >
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    const before = activeCells(container)[0];
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(activeCells(container)[0]).toBe(before);
  });

  it("stops at the final frame when loop is disabled", () => {
    const frames = [[[0, 0]], [[1, 1]], [[1, 0]]] as Frames;
    const { container } = render(
      <PodaciumMotionGrid
        frames={frames}
        gridSize={[2, 2]}
        interval={50}
        loop={false}
      >
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(activeCells(container)).toHaveLength(1);
    expect(activeCells(container)[0]).toHaveAttribute("data-active", "true");
  });

  it("renders a resting frame when static", () => {
    const frames = [[[0, 0]], [[1, 1]]] as Frames;
    const { container } = render(
      <PodaciumMotionGrid frames={frames} gridSize={[2, 2]} static>
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    // Resting frame is the last non-empty frame → [1, 1], the fourth cell.
    const cells = container.querySelectorAll("[data-motion-grid-cell]");
    expect(cells).toHaveLength(4);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });

  it("supports a function cell renderer", () => {
    const { container } = render(
      <PodaciumMotionGrid frames={twoFrames} gridSize={[2, 2]}>
        {({ active, index }) => (
          <span data-testid={`cell-${index}`} data-active={active} />
        )}
      </PodaciumMotionGrid>,
    );

    expect(container.querySelectorAll("[data-testid^='cell-']")).toHaveLength(
      4,
    );
  });

  it("exposes an accessible label when provided", () => {
    const { getByRole } = render(
      <PodaciumMotionGrid
        frames={twoFrames}
        gridSize={[2, 2]}
        label="Syncing files"
      >
        <PodaciumMotionGridCells />
      </PodaciumMotionGrid>,
    );

    expect(getByRole("img", { name: "Syncing files" })).toBeInTheDocument();
  });
});
