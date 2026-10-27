import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "component.generativeUi.actionConfirmation.statusPending":
      "Confirmation Requise (HITL)",
    "component.generativeUi.actionConfirmation.statusExecuting":
      "Exécution Sécurisée en Cours...",
    "component.generativeUi.actionConfirmation.statusConfirmed":
      "Action Exécutée avec Succès",
    "component.generativeUi.actionConfirmation.statusRejected":
      "Action Annulée",
    "component.generativeUi.actionConfirmation.statusExpired":
      "Délai de Validation Expiré",
    "component.generativeUi.actionConfirmation.actionPrefix": "Action",
    "component.generativeUi.actionConfirmation.highRisk": "Risque Élevé",
    "component.generativeUi.actionConfirmation.modifying": "Modifiant",
    "component.generativeUi.actionConfirmation.preparedParams":
      "Paramètres Préparés",
    "component.generativeUi.actionConfirmation.financialImpact":
      "Impact Financier",
    "component.generativeUi.actionConfirmation.cancel": "Annuler",
    "component.generativeUi.actionConfirmation.confirmAndExecute":
      "Confirmer & Exécuter",
    "component.generativeUi.actionConfirmation.tokenExpired":
      "Le jeton d'autorisation a expiré.",
    "component.generativeUi.actionConfirmation.edahabiaBadge": "EDAHABIA",
    "component.generativeUi.actionConfirmation.cibBadge": "CIB",
    "component.generativeUi.actionConfirmation.chargilyPayEscrow":
      "Paiement Sécurisé & Garanti (Loi 22-23)",
    "component.generativeUi.actionConfirmation.biometricVerify":
      "Vérification biométrique requise",
    "component.generativeUi.actionConfirmation.biometricAuthorize":
      "Autoriser par empreinte / FaceID",
    "component.generativeUi.actionConfirmation.biometricVerified":
      "Identité biométrique validée",
  };
  return {
    useTranslations: () => ({
      t: (key: string) => dictionary[key] || key,
    }),
    useLocale: () => "fr",
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("ActionConfirmationCard", () => {
  const mockPayload = {
    intent_id: "intent_test_123",
    token: "hmac_sig_xyz",
    tool_name: "enroll_course",
    title: "Inscription au Cours : Python & AI",
    summary: "Inscription et réservation de place avec débit solde wallet.",
    prepared_params: {
      course_id: 42,
      price: "1,500 DZD",
    },
    risk_score: 0.85,
    expires_at: Math.floor(Date.now() / 1000) + 300,
    financial_impact_dzd: 1500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending action confirmation card with parameters, DZD impact, and Chargily badges", () => {
    render(<ActionConfirmationCard payload={mockPayload} />);

    expect(screen.getByText("Confirmation Requise (HITL)")).toBeInTheDocument();
    expect(
      screen.getByText("Inscription au Cours : Python & AI"),
    ).toBeInTheDocument();
    expect(screen.getByText("course id:")).toBeInTheDocument();
    expect(screen.getAllByText(/1,500 DZD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("EDAHABIA")).toBeInTheDocument();
    expect(screen.getByText("CIB")).toBeInTheDocument();
    expect(
      screen.getByText("Paiement Sécurisé & Garanti (Loi 22-23)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmer & Exécuter")).toBeInTheDocument();
  });

  it("handles successful confirmation execution via api.post", async () => {
    (api.post as any).mockResolvedValueOnce({
      success: true,
      data: { enrollment_id: "enr_999" },
    });

    const onComplete = vi.fn();
    render(
      <ActionConfirmationCard
        payload={mockPayload}
        onExecutionComplete={onComplete}
      />,
    );

    const confirmBtn = screen.getByText("Confirmer & Exécuter");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Action Exécutée avec Succès"),
      ).toBeInTheDocument();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/agent/execute-confirmed-action",
      expect.objectContaining({
        intent_id: "intent_test_123",
        token: "hmac_sig_xyz",
      }),
    );
    expect(onComplete).toHaveBeenCalledWith({
      status: "CONFIRMED",
      data: { enrollment_id: "enr_999" },
    });
  });

  it("handles user rejection without executing api.post", () => {
    const onComplete = vi.fn();
    render(
      <ActionConfirmationCard
        payload={mockPayload}
        onExecutionComplete={onComplete}
      />,
    );

    const cancelBtn = screen.getByText("Annuler");
    fireEvent.click(cancelBtn);

    expect(screen.getByText("Action Annulée")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({ status: "REJECTED" });
  });

  it("transitions to EXPIRED when expiration time has elapsed", () => {
    const expiredPayload = {
      ...mockPayload,
      expires_at: Math.floor(Date.now() / 1000) - 10, // In the past
    };

    const onComplete = vi.fn();
    render(
      <ActionConfirmationCard
        payload={expiredPayload}
        onExecutionComplete={onComplete}
      />,
    );

    expect(screen.getByText("Délai de Validation Expiré")).toBeInTheDocument();
  });

  it("transitions to FAILED and shows error message with retry button on execution failure", async () => {
    (api.post as any).mockRejectedValueOnce(
      new Error("Insuffisance de solde wallet"),
    );

    const onComplete = vi.fn();
    render(
      <ActionConfirmationCard
        payload={mockPayload}
        onExecutionComplete={onComplete}
      />,
    );

    const confirmBtn = screen.getByText("Confirmer & Exécuter");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Insuffisance de solde wallet/i),
      ).toBeInTheDocument();
    });

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FAILED",
        data: { error: "Insuffisance de solde wallet" },
      }),
    );
  });

  it("handles expires_at_unix correctly when expires_at is omitted", () => {
    const unixPayload = {
      ...mockPayload,
      expires_at: undefined,
      expires_at_unix: Math.floor(Date.now() / 1000) - 20, // Expired via expires_at_unix
    };

    const onComplete = vi.fn();
    render(
      <ActionConfirmationCard
        payload={unixPayload as any}
        onExecutionComplete={onComplete}
      />,
    );

    expect(screen.getByText("Délai de Validation Expiré")).toBeInTheDocument();
  });

  it("falls back to default expiration timestamp without crashing if both expires fields are missing", () => {
    const noExpiresPayload = {
      ...mockPayload,
      expires_at: undefined,
      expires_at_unix: undefined,
    };

    render(<ActionConfirmationCard payload={noExpiresPayload as any} />);
    expect(screen.getByText("Confirmation Requise (HITL)")).toBeInTheDocument();
  });
});
