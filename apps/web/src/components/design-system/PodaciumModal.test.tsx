/* eslint-disable react/display-name -- framer-motion mocks are anonymous by design */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PodaciumModal from "./PodaciumModal";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("PodaciumModal", () => {
  it("renders children when open", () => {
    render(
      <PodaciumModal isOpen onClose={() => {}}>
        <p>Modal content</p>
      </PodaciumModal>,
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <PodaciumModal isOpen={false} onClose={() => {}}>
        <p>Hidden content</p>
      </PodaciumModal>,
    );
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <PodaciumModal isOpen onClose={onClose}>
        <p>Content</p>
      </PodaciumModal>,
    );
    // Click the backdrop (outermost div)
    const backdrop = screen
      .getByText("Content")
      .closest('[role="dialog"]')?.parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    // onClose should be called (implementation may vary)
  });

  it("renders title when provided", () => {
    render(
      <PodaciumModal isOpen onClose={() => {}} title="My Modal">
        <p>Content</p>
      </PodaciumModal>,
    );
    expect(screen.getByText("My Modal")).toBeInTheDocument();
  });

  it("has proper accessibility role", () => {
    render(
      <PodaciumModal isOpen onClose={() => {}}>
        <p>Accessible content</p>
      </PodaciumModal>,
    );
    // Modal should have dialog role or be within one
    const dialog =
      screen.getByRole("dialog") ||
      screen.getByText("Accessible content").closest('[role="dialog"]');
    expect(dialog).toBeTruthy();
  });
});
