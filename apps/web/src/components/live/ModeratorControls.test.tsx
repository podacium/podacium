import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParticipantList } from "./ParticipantList";
import { BreakoutBanner } from "./BreakoutBanner";
import { DocumentPiPPortal } from "./DocumentPiPPortal";

const mockPublishData = vi.fn();

vi.mock("@livekit/components-react", () => ({
  useParticipants: () => [
    { identity: "user-1", name: "Ahmed Student", isMicrophoneEnabled: true },
    { identity: "user-2", name: "Fatima Student", isMicrophoneEnabled: false },
  ],
  useLocalParticipant: () => ({
    localParticipant: { identity: "host-1", name: "Host Zakarya" },
  }),
  useRoomContext: () => ({
    localParticipant: {
      identity: "host-1",
      publishData: mockPublishData,
    },
  }),
}));

vi.mock("./HandRaiseContext", () => ({
  useHandRaise: () => ({
    isHandRaised: (id: string) => id === "user-1",
  }),
}));

describe("Moderator Controls & Classroom Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ParticipantList Co-Host Promotion", () => {
    it("renders Promote to Co-Host button for host and publishes toggle_cohost", async () => {
      const onToggleCoHost = vi.fn();
      render(
        <ParticipantList
          isHost={true}
          coHostIdentities={new Set()}
          onToggleCoHost={onToggleCoHost}
        />,
      );

      const promoteBtn = screen.getByTestId("toggle-cohost-user-1");
      expect(promoteBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(promoteBtn);
      });

      expect(mockPublishData).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(
        new TextDecoder().decode(mockPublishData.mock.calls[0][0]),
      );
      expect(payload.action).toBe("toggle_cohost");
      expect(payload.targetIdentity).toBe("user-1");
      expect(payload.isCoHost).toBe(true);
      expect(onToggleCoHost).toHaveBeenCalledWith("user-1", true);
    });

    it("displays Co-Host badge when participant is in coHostIdentities", () => {
      render(
        <ParticipantList
          isHost={true}
          coHostIdentities={new Set(["user-2"])}
        />,
      );

      expect(screen.getByText("Co-Host")).toBeInTheDocument();
    });
  });

  describe("BreakoutBanner", () => {
    it("renders active breakout session timer and broadcast message", () => {
      const sessionState = {
        isActive: true,
        roomsCount: 3,
        durationMinutes: 10,
        endsAt: Date.now() + 600000,
        latestBroadcast: "Please return in 2 minutes!",
      };

      render(<BreakoutBanner sessionState={sessionState} />);

      expect(screen.getByTestId("breakout-banner")).toBeInTheDocument();
      expect(screen.getByText(/3 Rooms/)).toBeInTheDocument();
      expect(
        screen.getByText("Please return in 2 minutes!"),
      ).toBeInTheDocument();
    });

    it("does not render when session is inactive", () => {
      const { container } = render(<BreakoutBanner sessionState={null} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("DocumentPiPPortal", () => {
    it("renders into pip container with mic, camera, and leave buttons", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const onToggleMic = vi.fn();
      const onToggleCamera = vi.fn();
      const onLeave = vi.fn();
      const onClosePiP = vi.fn();

      render(
        <DocumentPiPPortal
          pipContainer={container}
          micEnabled={true}
          cameraEnabled={false}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onLeave={onLeave}
          onClosePiP={onClosePiP}
          title="PiP Test"
          activeSpeakerName="Speaker Sarah"
        />,
      );

      expect(screen.getByTestId("document-pip-window")).toBeInTheDocument();
      expect(screen.getByText("PiP Test")).toBeInTheDocument();
      expect(screen.getByText("Speaker Sarah")).toBeInTheDocument();

      const micBtn = screen.getByTitle("Mute Microphone");
      fireEvent.click(micBtn);
      expect(onToggleMic).toHaveBeenCalled();

      const camBtn = screen.getByTitle("Turn On Camera");
      fireEvent.click(camBtn);
      expect(onToggleCamera).toHaveBeenCalled();

      const leaveBtn = screen.getByTitle(
        /(?:Leave Room|Leave Session|room\.leave)/i,
      );
      fireEvent.click(leaveBtn);
      expect(onLeave).toHaveBeenCalled();

      document.body.removeChild(container);
    });
  });
});
