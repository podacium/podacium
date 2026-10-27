import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DualAuthModal } from "./DualAuthModal";

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

describe("DualAuthModal", () => {
  const defaultBeneficiary = {
    name: "Karim Brahimi",
    anaeNumber: "ANAE-2026-ALG-88912",
    nif: "001916012345678",
    bankName: "Banque Nationale d'Algérie (BNA)",
    accountNumber: "00100654321098765432",
    rip: "00100 65432 1098765432 18",
    isAnaeVerified: true,
  };

  const defaultAuditDiff = {
    requestedAmount: 120000,
    approvedAmount: 120000,
    platformFee: 6000,
    netDisbursement: 114000,
    currency: "DZD",
  };

  it("renders maker audit trail and beneficiary details", () => {
    render(
      <DualAuthModal
        isOpen={true}
        onClose={vi.fn()}
        payoutId={409}
        makerAdminName="Ahmed Co-Founder"
        makerAdminId={10}
        currentAdminId={25}
        makerReviewedAt="2026-10-15 14:30 UTC"
        makerNotes="Documents ANAE vérifiés manuellement."
        beneficiary={defaultBeneficiary}
        auditDiff={defaultAuditDiff}
        onConfirmApproval={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Dual Authorization — Four-Eyes Principle"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ahmed Co-Founder/)).toBeInTheDocument();
    expect(
      screen.getByText(/\u201cDocuments ANAE vérifiés manuellement.\u201d/),
    ).toBeInTheDocument();
    expect(screen.getByText("Karim Brahimi")).toBeInTheDocument();
    expect(screen.getByText("ANAE-2026-ALG-88912")).toBeInTheDocument();
    expect(screen.getByText("Carte ANAE Validée")).toBeInTheDocument();
  });

  it("blocks approval and displays alert when current admin is maker (Separation of Duties violation)", () => {
    const handleConfirm = vi.fn();

    render(
      <DualAuthModal
        isOpen={true}
        onClose={vi.fn()}
        payoutId={409}
        makerAdminName="Self Admin"
        makerAdminId={10}
        currentAdminId={10} // Same admin!
        makerReviewedAt="2026-10-15 14:30 UTC"
        beneficiary={defaultBeneficiary}
        auditDiff={defaultAuditDiff}
        onConfirmApproval={handleConfirm}
      />,
    );

    expect(
      screen.getByText("Conflit de Séparation des Fonctions (NIST AC-5)"),
    ).toBeInTheDocument();

    const approveBtn = screen.getByTestId("approve-disbursement-btn");
    expect(approveBtn).toBeDisabled();
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it("requires a 6-digit TOTP code before approving disbursement", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DualAuthModal
        isOpen={true}
        onClose={vi.fn()}
        payoutId={409}
        makerAdminName="Maker Admin"
        makerAdminId={10}
        currentAdminId={25}
        makerReviewedAt="2026-10-15 14:30 UTC"
        beneficiary={defaultBeneficiary}
        auditDiff={defaultAuditDiff}
        onConfirmApproval={handleConfirm}
      />,
    );

    const approveBtn = screen.getByTestId("approve-disbursement-btn");

    // Click without entering TOTP code
    fireEvent.click(approveBtn);
    expect(
      screen.getByText("Veuillez saisir un code TOTP valide à 6 chiffres."),
    ).toBeInTheDocument();
    expect(handleConfirm).not.toHaveBeenCalled();

    // Enter valid 6-digit TOTP code and checker notes
    const totpInput = screen.getByTestId("totp-input");
    fireEvent.change(totpInput, { target: { value: "876543" } });

    const notesInput = screen.getByTestId("checker-notes-input");
    fireEvent.change(notesInput, {
      target: { value: "SATIM confirmation match." },
    });

    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        "876543",
        "SATIM confirmation match.",
      );
    });
  });

  it("allows switching between TOTP and WebAuthn factor tabs", () => {
    render(
      <DualAuthModal
        isOpen={true}
        onClose={vi.fn()}
        payoutId={409}
        makerAdminName="Maker Admin"
        makerAdminId={10}
        currentAdminId={25}
        makerReviewedAt="2026-10-15 14:30 UTC"
        beneficiary={defaultBeneficiary}
        auditDiff={defaultAuditDiff}
        onConfirmApproval={vi.fn()}
      />,
    );

    expect(screen.getByTestId("totp-input")).toBeInTheDocument();

    const webAuthnTab = screen.getByText("WebAuthn");
    fireEvent.click(webAuthnTab);

    expect(
      screen.getByText("Clé matérielle FIDO2 / Passkey prête"),
    ).toBeInTheDocument();
  });
});
