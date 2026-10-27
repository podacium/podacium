import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomEvent } from "livekit-client";
import { AudioOnlyToggle } from "./AudioOnlyToggle";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockSetCameraEnabled = vi.fn();
const mockRemoteVideoPub1 = {
  kind: "video",
  setSubscribed: vi.fn(),
  setEnabled: vi.fn(),
};
const mockRemoteVideoPub2 = {
  kind: "video",
  setSubscribed: vi.fn(),
  setEnabled: vi.fn(),
};

const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
const mockRoom = {
  remoteParticipants: new Map([
    [
      "p1",
      {
        videoTrackPublications: new Map([["track-1", mockRemoteVideoPub1]]),
      },
    ],
    [
      "p2",
      {
        videoTrackPublications: new Map([["track-2", mockRemoteVideoPub2]]),
      },
    ],
  ]),
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = listeners.get(event) || [];
    list.push(cb);
    listeners.set(event, list);
  }),
  off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = listeners.get(event) || [];
    listeners.set(
      event,
      list.filter((fn) => fn !== cb),
    );
  }),
};

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: {
      setCameraEnabled: mockSetCameraEnabled,
    },
  }),
  useRoomContext: () => mockRoom,
}));

describe("AudioOnlyToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
  });

  it("unsubscribes remote video tracks at the SFU level when enabled", async () => {
    render(<AudioOnlyToggle />);

    const toggleBtn = screen.getByRole("button");
    expect(toggleBtn).toBeInTheDocument();

    // Toggle ON audio-only mode
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // 1. Local camera should be turned off to preserve uplink cellular bandwidth
    expect(mockSetCameraEnabled).toHaveBeenCalledWith(false);

    // 2. Downstream remote video subscriptions must be disabled (pub.setSubscribed(false))
    expect(mockRemoteVideoPub1.setSubscribed).toHaveBeenCalledWith(false);
    expect(mockRemoteVideoPub2.setSubscribed).toHaveBeenCalledWith(false);
    expect(mockRemoteVideoPub1.setEnabled).toHaveBeenCalledWith(false);
    expect(mockRemoteVideoPub2.setEnabled).toHaveBeenCalledWith(false);
  });

  it("subscribes back to remote video tracks when audio-only is toggled off", async () => {
    render(<AudioOnlyToggle />);

    const toggleBtn = screen.getByRole("button");

    // Toggle ON
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    vi.clearAllMocks();

    // Toggle OFF
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Local camera re-enabled
    expect(mockSetCameraEnabled).toHaveBeenCalledWith(true);

    // Remote video subscriptions restored
    expect(mockRemoteVideoPub1.setSubscribed).toHaveBeenCalledWith(true);
    expect(mockRemoteVideoPub2.setSubscribed).toHaveBeenCalledWith(true);
    expect(mockRemoteVideoPub1.setEnabled).toHaveBeenCalledWith(true);
    expect(mockRemoteVideoPub2.setEnabled).toHaveBeenCalledWith(true);
  });

  it("proactively unsubscribes new video tracks arriving while in audio-only mode", async () => {
    render(<AudioOnlyToggle />);

    const toggleBtn = screen.getByRole("button");

    // Toggle ON
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    // Check listeners registered for room events
    const publishedListeners = listeners.get(RoomEvent.TrackPublished) || [];
    const subscribedListeners = listeners.get(RoomEvent.TrackSubscribed) || [];

    expect(publishedListeners.length).toBeGreaterThan(0);
    expect(subscribedListeners.length).toBeGreaterThan(0);

    const newVideoPub = {
      kind: "video",
      setSubscribed: vi.fn(),
      setEnabled: vi.fn(),
    };

    // Simulate new track published
    await act(async () => {
      publishedListeners[0](newVideoPub);
    });
    expect(newVideoPub.setSubscribed).toHaveBeenCalledWith(false);

    const incomingTrackPub = {
      kind: "video",
      setSubscribed: vi.fn(),
      setEnabled: vi.fn(),
    };

    // Simulate new track subscribed
    await act(async () => {
      subscribedListeners[0]({}, incomingTrackPub);
    });
    expect(incomingTrackPub.setSubscribed).toHaveBeenCalledWith(false);
  });
});
