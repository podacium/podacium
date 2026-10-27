import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MilestoneSettlementModal } from "./MilestoneSettlementModal";

vi.mock("@/lib/i18n", () => {
  const t = (k: string) => k;
  return {
    useTranslations: () => Object.assign(t, { t }),
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("MilestoneSettlementModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    contractId: 101,
    milestoneId: 2,
    milestoneTitle: "Backend API Integration",
    amountDzd: 75000,
    freelancerName: "Amine Belkacem",
    freelancerRip: "00799999001122334455",
  };

  it("renders milestone title and amount in DZD", () => {
    render(<MilestoneSettlementModal {...defaultProps} />);
    expect(screen.getByText(/Backend API Integration/i)).toBeInTheDocument();
    expect(screen.getAllByText(/75,000/i).length).toBeGreaterThanOrEqual(1);
  });

  it("displays reference code and RIP", () => {
    render(<MilestoneSettlementModal {...defaultProps} />);
    expect(screen.getByText("PODA-CTR101-MS2")).toBeInTheDocument();
    expect(screen.getByText("00799999001122334455")).toBeInTheDocument();
  });

  it("renders decrypted deliverable download when settled", () => {
    render(
      <MilestoneSettlementModal
        {...defaultProps}
        isSettled={true}
        deliverableSha256="abc123sha256checksum"
      />,
    );
    // Switch to Vault tab
    const vaultTab = screen.getByRole("tab", {
      name: "robustness.settlement.tabVault",
    });
    fireEvent.click(vaultTab);
    expect(screen.getByText(/abc123sha256checksum/i)).toBeInTheDocument();
  });
});
