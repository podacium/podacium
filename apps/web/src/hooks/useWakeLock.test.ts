import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
  let releaseMock: ReturnType<typeof vi.fn>;
  let requestMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let mockSentinel: any;

  beforeEach(() => {
    releaseMock = vi.fn().mockResolvedValue(undefined);
    addEventListenerMock = vi.fn();
    mockSentinel = {
      released: false,
      type: "screen",
      release: releaseMock,
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
    };
    requestMock = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: requestMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("detects wake lock support in the browser", () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isActive).toBe(false);
  });

  it("requests screen wake lock and updates active state", async () => {
    const { result } = renderHook(() => useWakeLock());

    let success = false;
    await act(async () => {
      success = await result.current.request();
    });

    expect(success).toBe(true);
    expect(requestMock).toHaveBeenCalledWith("screen");
    expect(result.current.isActive).toBe(true);
  });

  it("releases wake lock and updates state", async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.request();
    });
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await result.current.release();
    });
    expect(releaseMock).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it("auto-acquires wake lock when autoAcquire is true", async () => {
    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() => useWakeLock(true));
    });

    expect(requestMock).toHaveBeenCalledWith("screen");
    expect(hookResult.result.current.isActive).toBe(true);
  });

  it("handles request failure gracefully", async () => {
    requestMock.mockRejectedValueOnce(new Error("Battery saver mode"));
    const { result } = renderHook(() => useWakeLock());

    let success = true;
    await act(async () => {
      success = await result.current.request();
    });

    expect(success).toBe(false);
    expect(result.current.isActive).toBe(false);
  });
});
