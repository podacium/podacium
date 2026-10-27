import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useNetworkQuality } from "./useNetworkQuality";

describe("useNetworkQuality", () => {
  beforeEach(() => {
    // Default fast connection mock
    Object.defineProperty(navigator, "connection", {
      value: {
        effectiveType: "4g",
        downlink: 15,
        rtt: 40,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("detects 4G connection and recommends 1080p resolution", () => {
    const { result } = renderHook(() => useNetworkQuality());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.effectiveType).toBe("4g");
    expect(result.current.isPoorConnection).toBe(false);
    expect(result.current.shouldDeferPrefetch).toBe(false);
    expect(result.current.recommendedResolution).toBe("1080p");
  });

  it("detects slow 2G connection and recommends 240p resolution", () => {
    Object.defineProperty(navigator, "connection", {
      value: {
        effectiveType: "slow-2g",
        downlink: 0.2,
        rtt: 1200,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkQuality());

    expect(result.current.effectiveType).toBe("slow-2g");
    expect(result.current.isPoorConnection).toBe(true);
    expect(result.current.shouldDeferPrefetch).toBe(true);
    expect(result.current.recommendedResolution).toBe("240p");
  });

  it("honors Data Saver mode even on 4G networks", () => {
    Object.defineProperty(navigator, "connection", {
      value: {
        effectiveType: "4g",
        downlink: 20,
        rtt: 30,
        saveData: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkQuality());

    expect(result.current.saveData).toBe(true);
    expect(result.current.shouldDeferPrefetch).toBe(true);
    expect(result.current.recommendedResolution).toBe("240p");
  });
});
