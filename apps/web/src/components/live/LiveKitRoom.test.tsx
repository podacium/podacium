import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockComponentsReact = vi.hoisted(() => ({
  LiveKitRoom: vi.fn(
    ({ token, children }: { token: string; children: React.ReactNode }) => (
      <div data-testid="lk-token">
        {token}
        {children}
      </div>
    ),
  ),
  RoomAudioRenderer: () => <div />,
  useConnectionState: () => "connected",
}));

vi.mock("@livekit/components-react", () => mockComponentsReact);

import { LiveKitRoom } from "./LiveKitRoom";

const b64url = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function makeToken(expSec: number) {
  return `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify({ exp: expSec }))}.signature`;
}

describe("LiveKitRoom token refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComponentsReact.LiveKitRoom.mockClear();
  });

  it("arms a timer ~2 min before expiry and swaps in the refreshed token", async () => {
    const expSec = Math.floor(Date.now() / 1000) + 300;
    const onTokenRefresh = vi.fn().mockResolvedValue({
      token: "REFRESHED_TOKEN",
      roomName: "room-sess-001",
      serverUrl: "wss://live.example.com",
    });

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    render(
      <LiveKitRoom
        token={makeToken(expSec)}
        serverUrl="wss://live.example.com"
        onTokenRefresh={onTokenRefresh}
      >
        <div />
      </LiveKitRoom>,
    );

    // A refresh timer must be armed ~2 min before expiry (not at the expiry
    // moment), so the room never drops mid-session.
    const refreshCall = setTimeoutSpy.mock.calls.find(
      ([, delay]) =>
        typeof delay === "number" && delay >= 120_000 && delay <= 300_000,
    );
    expect(refreshCall).toBeDefined();

    await act(async () => {
      await (refreshCall![0] as () => void)();
    });

    await waitFor(() => {
      expect(onTokenRefresh).toHaveBeenCalled();
    });
    expect(screen.getByTestId("lk-token").textContent).toContain(
      "REFRESHED_TOKEN",
    );

    setTimeoutSpy.mockRestore();
  });

  it("does not schedule a refresh when no callback is provided", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    render(
      <LiveKitRoom
        token="plain-string-token"
        serverUrl="wss://live.example.com"
      >
        <div />
      </LiveKitRoom>,
    );

    const refreshCall = setTimeoutSpy.mock.calls.find(
      ([, delay]) =>
        typeof delay === "number" && delay >= 120_000 && delay <= 300_000,
    );
    expect(refreshCall).toBeUndefined();

    setTimeoutSpy.mockRestore();
  });
});

describe("LiveKitRoom error handling", () => {
  it("downgrades video to false and avoids disconnect on NotReadableError", async () => {
    const onDisconnected = vi.fn();
    render(
      <LiveKitRoom
        token="test-token"
        serverUrl="wss://live.example.com"
        video={true}
        onDisconnected={onDisconnected}
      >
        <div />
      </LiveKitRoom>,
    );

    const lastProps = mockComponentsReact.LiveKitRoom.mock.lastCall?.[0];
    expect(lastProps.video).toBe(true);

    // Simulate camera acquisition failure
    const cameraError = new Error("Could not start video source");
    cameraError.name = "NotReadableError";

    await act(async () => {
      lastProps.onError(cameraError);
    });

    const updatedProps = mockComponentsReact.LiveKitRoom.mock.lastCall?.[0];
    expect(updatedProps.video).toBe(false);
    expect(updatedProps.connect).toBe(true);
    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it("guards onDisconnected during an internal reconnect cycle", async () => {
    const onDisconnected = vi.fn();
    render(
      <LiveKitRoom
        token="test-token"
        serverUrl="wss://live.example.com"
        onDisconnected={onDisconnected}
      >
        <div />
      </LiveKitRoom>,
    );

    const lastProps = mockComponentsReact.LiveKitRoom.mock.lastCall?.[0];

    // Trigger network / transport error
    await act(async () => {
      lastProps.onError(new Error("WebSocket connection lost"));
    });

    // Simulate LKLiveKitRoom firing onDisconnected during the reconnect cycle
    const reconnectedProps = mockComponentsReact.LiveKitRoom.mock.lastCall?.[0];
    await act(async () => {
      reconnectedProps.onDisconnected();
    });

    // Caller onDisconnected should NOT have been invoked
    expect(onDisconnected).not.toHaveBeenCalled();
  });
});

describe("LiveKitRoom simulcast and bandwidth optimization", () => {
  it("configures explicit publishDefaults with adaptive simulcast layers tuned for Algerian cellular", () => {
    render(
      <LiveKitRoom token="test-token" serverUrl="wss://live.example.com">
        <div>Content</div>
      </LiveKitRoom>,
    );

    const lastProps = mockComponentsReact.LiveKitRoom.mock.lastCall?.[0];
    expect(lastProps.options).toBeDefined();
    expect(lastProps.options.adaptiveStream).toBe(true);
    expect(lastProps.options.dynacast).toBe(true);

    const publishDefaults = lastProps.options.publishDefaults;
    expect(publishDefaults).toBeDefined();
    expect(publishDefaults.simulcast).toBe(true);

    // Primary 1080p layer encoding
    expect(publishDefaults.videoEncoding).toEqual({
      maxBitrate: 1_500_000,
      maxFramerate: 30,
    });

    // Simulcast layers (360p, 720p, 1080p)
    expect(publishDefaults.videoSimulcastLayers).toBeDefined();
    expect(publishDefaults.videoSimulcastLayers.length).toBe(3);

    const [layer360, layer720, layer1080] =
      publishDefaults.videoSimulcastLayers;
    expect(layer360.width).toBe(640);
    expect(layer360.height).toBe(360);
    expect(layer360.encoding.maxBitrate).toBe(200_000);
    expect(layer360.encoding.maxFramerate).toBe(20);

    expect(layer720.width).toBe(1280);
    expect(layer720.height).toBe(720);
    expect(layer720.encoding.maxBitrate).toBe(650_000);
    expect(layer720.encoding.maxFramerate).toBe(25);

    expect(layer1080.width).toBe(1920);
    expect(layer1080.height).toBe(1080);
    expect(layer1080.encoding.maxBitrate).toBe(1_500_000);
    expect(layer1080.encoding.maxFramerate).toBe(30);
  });
});
