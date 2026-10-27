import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThreePillarWalletCard } from "./ThreePillarWalletCard";

vi.mock("@/lib/i18n", () => {
  const t = (k?: string, fallback?: any) => {
    if (typeof fallback === "string") return fallback;
    return k || "";
  };
  (t as any).t = t;
  return {
    useTranslations: () => t,
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
    useLocale: () => "en",
  };
});

describe("ThreePillarWalletCard", () => {
  const defaultBalances = {
    spendableDzd: 150000,
    inEscrowDzd: 45000,
    pendingClearanceDzd: 12000,
    currency: "DZD",
  };

  it("renders all three financial pillars correctly", () => {
    render(<ThreePillarWalletCard balances={defaultBalances} />);

    expect(screen.getByTestId("pillar-spendable")).toBeInTheDocument();
    expect(screen.getByTestId("pillar-escrow")).toBeInTheDocument();
    expect(screen.getByTestId("pillar-clearance")).toBeInTheDocument();

    expect(screen.getByText("Solde Disponible")).toBeInTheDocument();
    expect(screen.getByText("En Séquestre (Escrow)")).toBeInTheDocument();
    expect(screen.getByText("En Cours de Compensation")).toBeInTheDocument();
  });

  it("displays Bank of Algeria Tier 1 compliance and balance formula", () => {
    render(<ThreePillarWalletCard balances={defaultBalances} />);

    expect(
      screen.getByText("Bank of Algeria 06-2025 Tier 1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Available Balance = Posted Balance − Pending Outbound Holds",
      ),
    ).toBeInTheDocument();
  });

  it("triggers onTopUp and onWithdraw callbacks on button click", () => {
    const handleTopUp = vi.fn();
    const handleWithdraw = vi.fn();

    render(
      <ThreePillarWalletCard
        balances={defaultBalances}
        onTopUp={handleTopUp}
        onWithdraw={handleWithdraw}
      />,
    );

    const topUpBtn = screen.getByTestId("top-up-btn");
    const withdrawBtn = screen.getByTestId("withdraw-btn");

    fireEvent.click(topUpBtn);
    expect(handleTopUp).toHaveBeenCalledTimes(1);

    fireEvent.click(withdrawBtn);
    expect(handleWithdraw).toHaveBeenCalledTimes(1);
  });

  it("triggers onReviewPending when pending clearance balance is present", () => {
    const handleReviewPending = vi.fn();

    render(
      <ThreePillarWalletCard
        balances={defaultBalances}
        onReviewPending={handleReviewPending}
      />,
    );

    const detailsBtn = screen.getByText("Détails");
    fireEvent.click(detailsBtn);
    expect(handleReviewPending).toHaveBeenCalledTimes(1);
  });
});
