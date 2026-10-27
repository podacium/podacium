import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatAutoScroll } from "./useChatAutoScroll";

describe("useChatAutoScroll", () => {
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockContainer = document.createElement("div");
    Object.defineProperty(mockContainer, "scrollHeight", {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(mockContainer, "clientHeight", {
      value: 400,
      writable: true,
    });
    mockContainer.scrollTop = 600; // Exact bottom: 1000 - (600 + 400) = 0
  });

  it("initializes with isPinned=true and unreadCount=0", () => {
    const { result } = renderHook(() => useChatAutoScroll());
    expect(result.current.isPinned).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("unpins when container is scrolled up past threshold (>80px)", () => {
    const { result } = renderHook(() =>
      useChatAutoScroll({ unpinThreshold: 80 }),
    );
    (result.current.containerRef as any).current = mockContainer;

    // Simulate user scrolling up to scrollTop 500 (distance = 1000 - (500 + 400) = 100px > 80px)
    mockContainer.scrollTop = 500;
    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.isPinned).toBe(false);
  });

  it("increments unreadCount on notifyNewToken only when unpinned", () => {
    const { result } = renderHook(() =>
      useChatAutoScroll({ unpinThreshold: 80 }),
    );
    (result.current.containerRef as any).current = mockContainer;

    mockContainer.scrollTop = 500; // unpinned
    act(() => {
      result.current.handleScroll();
    });

    act(() => {
      result.current.notifyNewToken();
      result.current.notifyNewToken();
    });

    expect(result.current.unreadCount).toBe(2);

    // Re-pinning resets unread count
    act(() => {
      result.current.scrollToBottom();
    });
    expect(result.current.isPinned).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });
});
