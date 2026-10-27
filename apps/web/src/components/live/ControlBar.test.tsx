import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPublishData = vi.fn();

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: {
      identity: "host-1",
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
      setMicrophoneEnabled: vi.fn(),
      setCameraEnabled: vi.fn(),
    },
  }),
  useIsRecording: () => false,
  useRoomContext: () => ({
    localParticipant: {
      identity: "host-1",
      publishData: mockPublishData,
    },
  }),
  useMediaDeviceSelect: () => ({
    devices: [],
    activeDeviceId: "",
    setActiveMediaDevice: vi.fn(),
  }),
}));

vi.mock("./AudioOnlyToggle", () => ({
  AudioOnlyToggle: () => <div data-testid="audio-toggle" />,
}));
vi.mock("./EmojiReactions", () => ({
  EmojiReactions: () => <div data-testid="emoji-reactions" />,
}));
vi.mock("./HandRaise", () => ({
  HandRaise: () => <div data-testid="hand-raise" />,
}));

let sheetOpen = false;
vi.mock("./BottomSheet", () => ({
  BottomSheet: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => {
    sheetOpen = open;
    return open ? (
      <div data-testid="bottom-sheet" onClick={onClose}>
        {children}
      </div>
    ) : null;
  },
}));

vi.mock("@/lib/api/live-sessions", () => ({
  liveSessionsApi: { startRecording: vi.fn(), stopRecording: vi.fn() },
}));

import { ControlBar } from "./ControlBar";

function renderBar(
  overrides: {
    isHost?: boolean;
    onStartBreakout?: (rooms: number, dur: number) => void;
  } = {},
) {
  return render(
    <ControlBar
      isHost={overrides.isHost ?? false}
      sessionId="sess-001"
      onLeave={() => {}}
      onEndSession={() => {}}
      onToggleScreenShare={() => {}}
      screenSharing={false}
      onStartBreakout={overrides.onStartBreakout}
    />,
  );
}

describe("ControlBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sheetOpen = false;
  });

  it("renders a solid red leave pill in the desktop dock", () => {
    renderBar();
    const leave = screen.getAllByTitle(/(?:Leave Room|room\.leave)/i)[0];
    expect(leave).toHaveClass("bg-red-500");
  });

  it("collapses into a More bottom sheet on mobile", () => {
    renderBar();
    expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("more-controls"));
    expect(sheetOpen).toBe(true);
    expect(screen.getByTestId("bottom-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("bottom-sheet"));
    expect(sheetOpen).toBe(false);
  });

  it("exposes host-only controls (end session) when the host opens the sheet", () => {
    renderBar({ isHost: true });
    fireEvent.click(screen.getByTestId("more-controls"));
    expect(
      screen.getAllByText(/(?:End Session|room\.hostControls\.endSession)/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("broadcasts mute_all and disable_cameras_all when host clicks buttons", async () => {
    renderBar({ isHost: true });

    const muteAllBtn = screen.getByTestId("mute-all-btn");
    await act(async () => {
      fireEvent.click(muteAllBtn);
    });

    expect(mockPublishData).toHaveBeenCalledTimes(1);
    const mutePayload = JSON.parse(
      new TextDecoder().decode(mockPublishData.mock.calls[0][0]),
    );
    expect(mutePayload.action).toBe("mute_all");

    const disableCamerasBtn = screen.getByTestId("disable-cameras-all-btn");
    await act(async () => {
      fireEvent.click(disableCamerasBtn);
    });

    expect(mockPublishData).toHaveBeenCalledTimes(2);
    const cameraPayload = JSON.parse(
      new TextDecoder().decode(mockPublishData.mock.calls[1][0]),
    );
    expect(cameraPayload.action).toBe("disable_cameras_all");
  });

  it("opens Breakout Rooms modal and triggers onStartBreakout", async () => {
    const onStartBreakoutMock = vi.fn();
    renderBar({ isHost: true, onStartBreakout: onStartBreakoutMock });

    const breakoutBtn = screen.getByTestId("breakout-rooms-btn");
    fireEvent.click(breakoutBtn);

    expect(
      screen.getByText(/(?:Start Breakout|room\.breakout\.startRooms)/i),
    ).toBeInTheDocument();

    const startBtn = screen.getByText(
      /(?:Start Breakout|room\.breakout\.startRooms)/i,
    );
    fireEvent.click(startBtn);

    expect(onStartBreakoutMock).toHaveBeenCalledWith(2, 10);
  });
});
