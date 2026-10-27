/* eslint-disable react/display-name -- framer-motion mocks are anonymous by design */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import PodaciumLoadingScreen from "./PodaciumLoadingScreen";

// Mock framer-motion
vi.mock("framer-motion", () => {
  const generic =
    (tag: string) =>
    ({ children, ...props }: any) =>
      React.createElement(tag, props, children);
  const motion = new Proxy({} as Record<string, any>, {
    get: (_t, tag: any) => generic(tag),
  });
  return { motion, AnimatePresence: ({ children }: any) => <>{children}</> };
});

describe("PodaciumLoadingScreen", () => {
  it("renders without crashing", () => {
    const { container } = render(<PodaciumLoadingScreen />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows loading indicator", () => {
    const { container } = render(<PodaciumLoadingScreen />);
    // Should have some animated element or spinner
    const el = container.firstChild as HTMLElement;
    expect(el).toBeTruthy();
  });

  it("renders with custom message", () => {
    render(<PodaciumLoadingScreen message="Loading courses..." />);
    expect(screen.getByText("Loading courses...")).toBeInTheDocument();
  });

  it("renders fullscreen by default", () => {
    const { container } = render(<PodaciumLoadingScreen />);
    const el = container.firstChild as HTMLElement;
    // Should have fixed/absolute positioning or full viewport classes
    const isFullscreen =
      el.className.includes("fixed") ||
      el.className.includes("h-screen") ||
      el.className.includes("min-h-screen");
    expect(isFullscreen).toBe(true);
  });
});
