import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDocumentPiP } from "./useDocumentPiP";

describe("useDocumentPiP", () => {
  let originalDocPiP: unknown;

  beforeEach(() => {
    originalDocPiP = (
      window as unknown as { documentPictureInPicture?: unknown }
    ).documentPictureInPicture;
  });

  afterEach(() => {
    if (originalDocPiP !== undefined) {
      (
        window as unknown as { documentPictureInPicture?: unknown }
      ).documentPictureInPicture = originalDocPiP;
    } else {
      delete (window as unknown as { documentPictureInPicture?: unknown })
        .documentPictureInPicture;
    }
  });

  it("reports isSupported=false when documentPictureInPicture is not on window", () => {
    delete (window as unknown as { documentPictureInPicture?: unknown })
      .documentPictureInPicture;
    const { result } = renderHook(() => useDocumentPiP());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.isPiPActive).toBe(false);
  });

  it("reports isSupported=true when documentPictureInPicture is present", () => {
    (
      window as unknown as { documentPictureInPicture: unknown }
    ).documentPictureInPicture = {
      requestWindow: vi.fn(),
    };
    const { result } = renderHook(() => useDocumentPiP());
    expect(result.current.isSupported).toBe(true);
  });

  it("opens PiP window and handles close correctly", async () => {
    const mockClose = vi.fn();
    const mockFocus = vi.fn();
    const eventListeners: Record<string, () => void> = {};

    const mockPipWindow = {
      closed: false,
      close: mockClose,
      focus: mockFocus,
      document: {
        title: "",
        head: { appendChild: vi.fn() },
        body: {
          className: "",
          appendChild: vi.fn(),
        },
        createElement: vi.fn(() => ({ id: "", className: "" })),
      },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        eventListeners[event] = handler;
      }),
    };

    const requestWindowMock = vi.fn().mockResolvedValue(mockPipWindow);

    (
      window as unknown as { documentPictureInPicture: unknown }
    ).documentPictureInPicture = {
      requestWindow: requestWindowMock,
    };

    const { result } = renderHook(() => useDocumentPiP());

    await act(async () => {
      await result.current.openPiP({
        title: "Custom Title",
        width: 600,
        height: 400,
      });
    });

    expect(requestWindowMock).toHaveBeenCalledWith({ width: 600, height: 400 });
    expect(result.current.isPiPActive).toBe(true);
    expect(result.current.pipWindow).toBe(mockPipWindow);

    // Close PiP
    act(() => {
      result.current.closePiP();
    });

    expect(mockClose).toHaveBeenCalled();
    expect(result.current.isPiPActive).toBe(false);
    expect(result.current.pipWindow).toBeNull();
  });
});
