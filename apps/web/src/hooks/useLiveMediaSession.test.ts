import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useLiveMediaSession } from "./useLiveMediaSession";

describe("useLiveMediaSession", () => {
  let setActionHandlerMock: ReturnType<typeof vi.fn>;
  let mockMediaSession: any;

  beforeEach(() => {
    setActionHandlerMock = vi.fn();
    mockMediaSession = {
      metadata: null,
      playbackState: "none",
      setActionHandler: setActionHandlerMock,
    };

    Object.defineProperty(navigator, "mediaSession", {
      value: mockMediaSession,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("configures media metadata and sets playback state to playing", () => {
    renderHook(() =>
      useLiveMediaSession({
        roomName: "Test Room Session",
        isHost: true,
        isActive: true,
      }),
    );

    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata.title).toBe("Test Room Session");
    expect(mockMediaSession.playbackState).toBe("playing");
  });

  it("registers media session action handlers for hangup and mic toggle", () => {
    const onLeave = vi.fn();
    const onToggleMic = vi.fn();

    renderHook(() =>
      useLiveMediaSession({
        roomName: "Test Room",
        onLeave,
        onToggleMic,
        isActive: true,
      }),
    );

    expect(setActionHandlerMock).toHaveBeenCalledWith(
      "hangup",
      expect.any(Function),
    );
    expect(setActionHandlerMock).toHaveBeenCalledWith(
      "togglemicrophone",
      expect.any(Function),
    );
  });
});
