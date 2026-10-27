import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

const mockApi = vi.hoisted(() => ({
  getLiveContext: vi.fn(),
}));

vi.mock("@/lib/api/live-sessions", () => ({
  liveSessionsApi: mockApi,
}));

vi.mock("@/components/design-system/PodaciumProgressRing", () => ({
  default: ({ progress, variant }: { progress: number; variant?: string }) => (
    <div
      data-testid="ecosystem-gauge"
      data-progress={progress}
      data-variant={variant}
    />
  ),
}));

import { EcosystemPanel } from "./EcosystemPanel";

const contextFixture = {
  sessionId: "sess-001",
  userId: 2,
  profile: {
    fullName: "Amina B.",
    username: "amina",
    headline: "Data Analyst",
    avatarUrl: null,
    isHost: false,
  },
  health: {
    available: true,
    score: 82,
    color: "green",
    status: "Excellent",
    label: "Excellent",
    trend: [],
  },
  skillPassport: {
    verified: true,
    skills: [
      { name: "SQL", endorsements: 3, verified: true },
      { name: "Excel", endorsements: 1, verified: true },
      { name: "Python", endorsements: 0, verified: false },
    ],
  },
};

describe("EcosystemPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getLiveContext.mockResolvedValue(contextFixture);
  });

  it("prompts the host to select a participant when none is chosen", () => {
    render(<EcosystemPanel sessionId="sess-001" userId={null} />);
    expect(
      screen.getByText("room.ecosystem.selectParticipant"),
    ).toBeInTheDocument();
    expect(mockApi.getLiveContext).not.toHaveBeenCalled();
  });

  it("renders the health-score gauge and skill passport for the selected participant", async () => {
    render(<EcosystemPanel sessionId="sess-001" userId={2} />);

    await waitFor(() => {
      expect(mockApi.getLiveContext).toHaveBeenCalledWith("sess-001", 2, "en");
      expect(screen.getByText("Amina B.")).toBeInTheDocument();
      expect(screen.getByTestId("ecosystem-gauge")).toHaveAttribute(
        "data-progress",
        "82",
      );
      expect(screen.getByTestId("ecosystem-health")).toBeInTheDocument();
      expect(screen.getByText("SQL")).toBeInTheDocument();
      expect(screen.getByText("Python")).toBeInTheDocument();
    });
  });

  it("shows the no-data fallback when the participant has no health score", async () => {
    mockApi.getLiveContext.mockResolvedValue({
      ...contextFixture,
      health: {
        available: false,
        score: 0,
        color: "gray",
        status: "no_data",
        label: "N/A",
        trend: [],
      },
    });

    render(<EcosystemPanel sessionId="sess-001" userId={2} />);

    await waitFor(() => {
      expect(
        screen.getByText("room.ecosystem.noHealthData"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("ecosystem-gauge")).not.toBeInTheDocument();
  });

  it("renders the error state when the API call fails", async () => {
    mockApi.getLiveContext.mockRejectedValue(new Error("network"));

    render(<EcosystemPanel sessionId="sess-001" userId={2} />);

    await waitFor(() => {
      expect(screen.getByTestId("ecosystem-error")).toBeInTheDocument();
    });
  });
});
