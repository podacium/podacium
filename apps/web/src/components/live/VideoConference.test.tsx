import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ dir: "ltr" }),
  useLocale: () => "en",
}));

const mockLiveKitHooks = vi.hoisted(() => ({
  useLocalParticipant: vi.fn(),
  useRemoteParticipants: vi.fn(),
  useSpeakingParticipants: vi.fn(),
  useTracks: vi.fn(() => []),
}));

vi.mock("@livekit/components-react", () => mockLiveKitHooks);

vi.mock("./ParticipantTile", () => ({
  ParticipantTile: ({
    participant,
    large,
  }: {
    participant: { identity: string; name?: string };
    large?: boolean;
  }) => (
    <div
      data-testid={`tile-${participant.identity}`}
      data-large={large ? "true" : "false"}
    >
      {participant.identity}
    </div>
  ),
}));

import { VideoConference } from "./VideoConference";

function makeParticipant(identity: string, local = false) {
  return {
    identity,
    name: identity,
    isLocal: local,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
    getTrackPublication: () => undefined,
  };
}

describe("VideoConference spotlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLiveKitHooks.useLocalParticipant.mockReturnValue({
      localParticipant: makeParticipant("local", true),
    });
    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([]);
  });

  it("spotlights the active speaker and follows when the speaker changes", () => {
    const remote = [
      makeParticipant("speaker-a"),
      makeParticipant("speaker-b"),
      makeParticipant("viewer"),
    ];
    mockLiveKitHooks.useRemoteParticipants.mockReturnValue(remote);

    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([remote[0]]);
    const { rerender } = render(<VideoConference />);

    expect(screen.getByTestId("tile-speaker-a")).toHaveAttribute(
      "data-large",
      "true",
    );
    expect(screen.getByTestId("tile-speaker-b")).not.toHaveAttribute(
      "data-large",
      "true",
    );

    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([remote[1]]);
    rerender(<VideoConference />);

    expect(screen.getByTestId("tile-speaker-b")).toHaveAttribute(
      "data-large",
      "true",
    );
    expect(screen.getByTestId("tile-speaker-a")).not.toHaveAttribute(
      "data-large",
      "true",
    );
  });

  it("falls back to the host when nobody is speaking", () => {
    const remote = [
      makeParticipant("other"),
      makeParticipant("2"),
      makeParticipant("viewer"),
    ];
    mockLiveKitHooks.useRemoteParticipants.mockReturnValue(remote);
    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([]);

    render(<VideoConference ownerId={2} />);

    // Host identity is the owner id string; it must be spotlighted when idle.
    expect(screen.getByTestId("tile-2")).toHaveAttribute("data-large", "true");
  });

  it("shows a grid when no speaker and no host identity is known", () => {
    const remote = [makeParticipant("a"), makeParticipant("b")];
    mockLiveKitHooks.useRemoteParticipants.mockReturnValue(remote);

    render(<VideoConference />);

    for (const p of remote) {
      expect(screen.getByTestId(`tile-${p.identity}`)).not.toHaveAttribute(
        "data-large",
        "true",
      );
    }
    expect(screen.getByTestId("tile-local")).not.toHaveAttribute(
      "data-large",
      "true",
    );
  });

  it("notifies the host when a participant tile is clicked (Ecosystem prefill)", () => {
    const remote = [
      makeParticipant("11"),
      makeParticipant("22"),
      makeParticipant("33"),
    ];
    mockLiveKitHooks.useRemoteParticipants.mockReturnValue(remote);
    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([]);

    const onSelect = vi.fn();
    render(<VideoConference ownerId={11} onSelectParticipant={onSelect} />);

    fireEvent.click(screen.getByTestId("spotlight-wrap-11"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].identity).toBe("11");
  });

  it("does not fire selection for non-numeric identities", () => {
    const remote = [
      makeParticipant("guest"),
      makeParticipant("22"),
      makeParticipant("33"),
    ];
    mockLiveKitHooks.useRemoteParticipants.mockReturnValue(remote);
    mockLiveKitHooks.useSpeakingParticipants.mockReturnValue([]);

    const onSelect = vi.fn();
    render(<VideoConference ownerId={22} onSelectParticipant={onSelect} />);

    fireEvent.click(screen.getByTestId("spotlight-wrap-22"));
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("tile-wrap-guest"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
