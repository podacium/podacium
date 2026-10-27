import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReputationScoreCard } from "./ReputationScoreCard";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ t: (k: string) => k }),
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

describe("ReputationScoreCard", () => {
  it("renders freelancer trust tier, rating, and ANAE card verification", () => {
    render(
      <ReputationScoreCard
        freelancerName="Karim Mansouri"
        tier="TIER_3_ANAE"
        weightedRating={4.9}
        totalReviews={28}
        clientDiversityScore={92}
        onTimeDeliveryRate={98}
        completedContractsCount={35}
        anaeCardVerified={true}
      />,
    );
    expect(screen.getByText("robustness.reputation.title")).toBeInTheDocument();
    expect(screen.getByText("robustness.reputation.tier3")).toBeInTheDocument();
    expect(screen.getByText("4.9")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(
      screen.getByText("robustness.reputation.anaeVerified"),
    ).toBeInTheDocument();
  });
});
