import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminBillingPage from "./page";
import { paymentsApi } from "@/lib/api/payments";

vi.mock("@/lib/i18n", () => {
  const translations: Record<string, string> = {
    "admin.billing.wallet_summary_source":
      "Live ledger · Active wallets: {{count}} · Pending payouts: {{pending}}",
    "admin.billing.wallet_summary_unavailable":
      "Balance data unavailable. No figures are shown rather than stale or invented ones.",
  };
  const t = (k?: string, fallback?: any) => {
    if (typeof fallback === "string") return fallback;
    if (k && translations[k]) {
      return translations[k].replace(/\{\{(\w+)\}\}/g, (_, name) =>
        String(fallback?.[name] ?? ""),
      );
    }
    return k || "";
  };
  (t as any).t = t;
  return {
    useTranslations: () => t,
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
    useLocale: () => "en",
  };
});

vi.mock("@/lib/api/payments", () => ({
  paymentsApi: { getAdminWalletSummary: vi.fn() },
}));

const summaryMock = paymentsApi.getAdminWalletSummary as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  summaryMock.mockReset();
  summaryMock.mockResolvedValue({
    currency: "PODAPOINT",
    wallet_count: 0,
    total_poda_points: 0,
    held_in_escrow_points: 0,
    pending_payouts_points: 0,
    pending_payout_count: 0,
    available_poda_points: 0,
  });
});

describe("AdminBillingPage", () => {
  it("renders the FinTech vault card and concierge verification queue", () => {
    render(<AdminBillingPage />);

    expect(screen.getByTestId("three-pillar-wallet-card")).toBeInTheDocument();
    expect(screen.getByTestId("admin-billing-page")).toBeInTheDocument();
    expect(screen.getByText("POD-BM-892147")).toBeInTheDocument();
    expect(screen.getByText("Amine Meziani")).toBeInTheDocument();
  });

  it("approves a pending postal slip in the concierge queue", () => {
    render(<AdminBillingPage />);

    const approveBtn = screen.getByTestId("approve-slip-REC-991");
    fireEvent.click(approveBtn);

    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("navigates to Maker-Checker queue and opens DualAuthModal", () => {
    render(<AdminBillingPage />);

    const makerCheckerTab = screen.getByTestId("tab-maker-checker");
    fireEvent.click(makerCheckerTab);

    expect(
      screen.getByText(
        "File de Double Autorisation (Instruction 06-2025 Tier 1)",
      ),
    ).toBeInTheDocument();

    const reviewBtn = screen.getByTestId("open-dual-auth-884");
    fireEvent.click(reviewBtn);

    expect(screen.getByTestId("dual-auth-modal")).toBeInTheDocument();
  });

  it("generates an Article 169 Tax Defense Pack with 26% IBS tax shield", () => {
    render(<AdminBillingPage />);

    const scfTaxTab = screen.getByTestId("tab-scf-tax");
    fireEvent.click(scfTaxTab);

    expect(
      screen.getByText("Pack Fiscal Article 169 CIDTA (IBS 26%)"),
    ).toBeInTheDocument();

    const generateBtn = screen.getByTestId("generate-tax-pack-btn");
    fireEvent.click(generateBtn);

    expect(screen.getByTestId("generated-tax-pack-result")).toBeInTheDocument();
    // 26% of 750,000 DZD = 195,000 DZD
    expect(screen.getByText(/195.*000.*DZD/)).toBeInTheDocument();
  });

  it("renders live wallet aggregates instead of fabricated treasury figures", async () => {
    summaryMock.mockResolvedValue({
      currency: "PODAPOINT",
      wallet_count: 12,
      total_poda_points: 250_000,
      held_in_escrow_points: 50_000,
      pending_payouts_points: 30_000,
      pending_payout_count: 2,
      available_poda_points: 170_000,
    });

    render(<AdminBillingPage />);

    expect(await screen.findByText(/Live ledger/)).toBeInTheDocument();
    // The wallet card must show the real available balance...
    expect(await screen.findByText(/170\D?000/)).toBeInTheDocument();
    // ...and never the previously hardcoded values.
    expect(screen.queryByText("18,450,000")).not.toBeInTheDocument();
    expect(screen.queryByText("4,250,000")).not.toBeInTheDocument();
    expect(screen.queryByText("70,000")).not.toBeInTheDocument();
  });

  it("shows no invented figures when the wallet summary cannot be loaded", async () => {
    summaryMock.mockRejectedValue(new Error("403 forbidden"));

    render(<AdminBillingPage />);

    expect(
      await screen.findByText(/Balance data unavailable/),
    ).toBeInTheDocument();
    expect(screen.queryByText("18,450,000")).not.toBeInTheDocument();
  });
});
