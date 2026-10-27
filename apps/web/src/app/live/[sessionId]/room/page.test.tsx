import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSearchParams = vi.hoisted(() => {
  const params = new URLSearchParams();
  return {
    params,
    setParams: (value: string | null) => {
      mockSearchParams.params =
        value === null ? new URLSearchParams() : new URLSearchParams(value);
    },
  };
});

// The room page must never trust a token coming from the URL: it fetches its
// token over the authenticated API. Simulate a URL that still carries a leaked
// token to prove it is ignored.
const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "sess-001" }),
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams.params,
}));

const mockLiveSessionsApi = vi.hoisted(() => ({
  getJoinToken: vi.fn(),
  getReplay: vi.fn(),
  getSession: vi.fn(),
  leaveSession: vi.fn(),
  refreshToken: vi.fn(),
}));

vi.mock("@/lib/api/live-sessions", () => ({
  liveSessionsApi: mockLiveSessionsApi,
}));

// LiveKit children are heavyweight (livekit-client, WebRTC). Replace them with
// stubs that surface the props we want to assert on.
vi.mock("@/components/live/PreJoinForm", () => ({
  PreJoinForm: ({
    onJoin,
  }: {
    onJoin: (d: { audioDeviceId: string; videoDeviceId: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onJoin({ audioDeviceId: "audio-1", videoDeviceId: "video-1" })
      }
    >
      Join
    </button>
  ),
}));

vi.mock("@/components/live/LiveKitRoom", () => ({
  LiveKitRoom: ({
    token,
    onConnected,
    onDisconnected,
    onTokenRefresh,
    children,
  }: {
    token: string;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onTokenRefresh?: () => unknown;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="room-token">{token}</div>
      <button
        type="button"
        data-testid="simulate-connect"
        onClick={onConnected}
      >
        Simulate connect
      </button>
      {onDisconnected ? (
        <button
          type="button"
          data-testid="simulate-disconnect"
          onClick={onDisconnected}
        >
          Simulate disconnect
        </button>
      ) : null}
      <div data-testid="has-token-refresh">
        {typeof onTokenRefresh === "function" ? "yes" : "no"}
      </div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/live/LiveRoom", () => ({
  LiveRoom: () => <div data-testid="live-room">live room</div>,
}));

import LiveRoomPage from "./page";

describe("Live room page — token never leaks into the URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.setParams(null);
    mockLiveSessionsApi.getJoinToken.mockResolvedValue({
      token: "FETCHED_SECRET_TOKEN",
      roomName: "room-sess-001",
      serverUrl: "wss://live.example.com",
    });
    mockLiveSessionsApi.getSession.mockResolvedValue({
      id: "sess-001",
      ownerId: 7,
    });
    mockLiveSessionsApi.leaveSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the join token over the API instead of reading it from the URL", async () => {
    mockSearchParams.setParams(
      "token=LEAKED_TOKEN_FROM_URL&room=evil-room&server=wss://evil.example.com",
    );

    render(<LiveRoomPage />);

    await waitFor(() => {
      expect(mockLiveSessionsApi.getJoinToken).toHaveBeenCalledWith("sess-001");
    });

    // Enter the room and assert the token LiveKit receives is the fetched one.
    fireEvent.click(await screen.findByRole("button", { name: "Join" }));
    await waitFor(() => {
      expect(screen.getByTestId("room-token").textContent).toBe(
        "FETCHED_SECRET_TOKEN",
      );
    });

    // The leaked token from the URL must never be used or surfaced.
    expect(screen.getByTestId("room-token").textContent).not.toContain(
      "LEAKED_TOKEN_FROM_URL",
    );
    // And the address bar / history holds no token query string.
    expect(window.location.href).not.toContain("token=");

    // Silent renewal is wired up: the room receives a token-refresh callback.
    expect(screen.getByTestId("has-token-refresh").textContent).toBe("yes");
  });

  it("uses the replay token endpoint when opened in replay mode", async () => {
    mockSearchParams.setParams("mode=replay");
    mockLiveSessionsApi.getReplay.mockResolvedValue({
      token: "REPLAY_TOKEN",
      roomName: "room-sess-001",
      serverUrl: "wss://live.example.com",
    });

    render(<LiveRoomPage />);

    await waitFor(() => {
      expect(mockLiveSessionsApi.getReplay).toHaveBeenCalledWith("sess-001");
    });
    expect(mockLiveSessionsApi.getJoinToken).not.toHaveBeenCalled();
  });

  it("shows the error state when the token fetch is rejected", async () => {
    mockLiveSessionsApi.getJoinToken.mockRejectedValue(
      new Error("unauthorized"),
    );

    render(<LiveRoomPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/(?:Leave Room|room\.leave)/i),
      ).toBeInTheDocument();
    });
    expect(window.location.href).not.toContain("token=");
  });

  it("reports the participant as left when the LiveKit connection drops", async () => {
    render(<LiveRoomPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    fireEvent.click(screen.getByTestId("simulate-disconnect"));

    await waitFor(() => {
      expect(mockLiveSessionsApi.leaveSession).toHaveBeenCalledWith("sess-001");
    });
    expect(mockRouter.push).toHaveBeenCalledWith("/live/sess-001");
  });

  it("records attendance on page unload via leaveSession", async () => {
    render(<LiveRoomPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => {
      expect(screen.getByTestId("room-token").textContent).toBe(
        "FETCHED_SECRET_TOKEN",
      );
    });
    fireEvent.click(screen.getByTestId("simulate-connect"));

    window.dispatchEvent(new Event("beforeunload"));

    expect(mockLiveSessionsApi.leaveSession).toHaveBeenCalledWith("sess-001");
  });
});
