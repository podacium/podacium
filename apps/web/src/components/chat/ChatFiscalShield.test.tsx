import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatFiscalShield } from "./ChatFiscalShield";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ t: (k: string) => k }),
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

describe("ChatFiscalShield", () => {
  it("renders client tax warning with estimated IBS loss", () => {
    render(<ChatFiscalShield userRole="CLIENT" contractAmountDzd={100000} />);
    expect(
      screen.getByText("robustness.chat_shield.activeBanner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("robustness.chat_shield.clientWarning"),
    ).toBeInTheDocument();
  });

  it("renders freelancer CASNOS/visa warning", () => {
    render(<ChatFiscalShield userRole="FREELANCER" />);
    expect(
      screen.getByText("robustness.chat_shield.activeBanner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("robustness.chat_shield.freelancerWarning"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("robustness.chat_shield.learnMore"),
    ).toBeInTheDocument();
  });
});
