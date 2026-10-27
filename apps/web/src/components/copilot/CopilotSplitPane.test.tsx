import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CopilotSplitPane } from "./CopilotSplitPane";

let mockIsRTL = false;
vi.mock("@/lib/i18n", () => ({
  useBidi: () => ({ isRTL: mockIsRTL }),
  useTranslations: () => ({ t: (k: string) => k }),
}));

describe("CopilotSplitPane Component", () => {
  beforeEach(() => {
    mockIsRTL = false;
  });

  it("renders both chat and canvas slots in desktop view", () => {
    render(
      <CopilotSplitPane
        chatSlot={<div data-testid="chat-slot">Chat Slot Content</div>}
        canvasSlot={<div data-testid="canvas-slot">Canvas Slot Content</div>}
      />,
    );

    expect(screen.getAllByTestId("chat-slot").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("canvas-slot").length).toBeGreaterThan(0);
  });

  it("renders the resizable separator with proper ARIA attributes", () => {
    render(
      <CopilotSplitPane
        chatSlot={<div>Chat</div>}
        canvasSlot={<div>Canvas</div>}
        defaultRatio={40}
        minRatio={20}
        maxRatio={80}
      />,
    );

    const separator = screen.getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "40");
    expect(separator).toHaveAttribute("aria-valuemin", "20");
    expect(separator).toHaveAttribute("aria-valuemax", "80");
  });

  it("adjusts ratio on ArrowLeft and ArrowRight keyboard navigation in LTR", () => {
    render(
      <CopilotSplitPane
        chatSlot={<div>Chat</div>}
        canvasSlot={<div>Canvas</div>}
        defaultRatio={40}
        minRatio={20}
        maxRatio={80}
      />,
    );

    const separator = screen.getByRole("separator");

    // In LTR, ArrowRight increases chat ratio
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "42");

    // In LTR, ArrowLeft decreases chat ratio
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "40");
  });

  it("inverts ArrowLeft and ArrowRight behavior in RTL direction", () => {
    mockIsRTL = true;
    render(
      <CopilotSplitPane
        chatSlot={<div>Chat</div>}
        canvasSlot={<div>Canvas</div>}
        defaultRatio={40}
        minRatio={20}
        maxRatio={80}
      />,
    );

    const separator = screen.getByRole("separator");

    // In RTL, ArrowLeft increases chat ratio (from right to left)
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "42");

    // In RTL, ArrowRight decreases chat ratio
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "40");
  });

  it("sets ratio to min on Home and max on End key", () => {
    render(
      <CopilotSplitPane
        chatSlot={<div>Chat</div>}
        canvasSlot={<div>Canvas</div>}
        defaultRatio={40}
        minRatio={25}
        maxRatio={75}
      />,
    );

    const separator = screen.getByRole("separator");

    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator).toHaveAttribute("aria-valuenow", "25");

    fireEvent.keyDown(separator, { key: "End" });
    expect(separator).toHaveAttribute("aria-valuenow", "75");

    fireEvent.keyDown(separator, { key: "Enter" });
    expect(separator).toHaveAttribute("aria-valuenow", "40");
  });

  it("resets ratio on double click", () => {
    render(
      <CopilotSplitPane
        chatSlot={<div>Chat</div>}
        canvasSlot={<div>Canvas</div>}
        defaultRatio={38}
        minRatio={20}
        maxRatio={80}
      />,
    );

    const separator = screen.getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "40");

    fireEvent.doubleClick(separator);
    expect(separator).toHaveAttribute("aria-valuenow", "38");
  });

  it("applies transition-none and throttles drag via requestAnimationFrame during active pointer drag", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 1;
      });

    render(
      <CopilotSplitPane
        chatSlot={<div data-testid="chat-content">Chat</div>}
        canvasSlot={<div data-testid="canvas-content">Canvas</div>}
        defaultRatio={40}
      />,
    );

    const separator = screen.getByRole("separator");
    const chatPanel = screen.getByTestId("chat-panel");

    expect(chatPanel).not.toHaveClass("transition-none");

    // Start drag
    act(() => {
      fireEvent.mouseDown(separator);
    });

    expect(chatPanel).toHaveClass("transition-none");

    // Simulate mouse move
    act(() => {
      fireEvent.mouseMove(window, { clientX: 500 });
    });

    expect(rafSpy).toHaveBeenCalled();

    // End drag
    act(() => {
      fireEvent.mouseUp(window);
    });
    expect(chatPanel).not.toHaveClass("transition-none");

    rafSpy.mockRestore();
  });
});
