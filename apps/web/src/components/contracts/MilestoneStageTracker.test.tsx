import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MilestoneStageTracker } from "./MilestoneStageTracker";

import fs from "fs";
import path from "path";
import { IntlProvider } from "@/lib/i18n";

const frHub = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../locales/fr/hub.json"),
    "utf-8",
  ),
);

function renderWithFr(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="fr" messages={frHub}>
      {ui}
    </IntlProvider>,
  );
}

describe("MilestoneStageTracker", () => {
  const defaultProps = {
    milestoneId: 1,
    milestoneTitle: "MicroVM Smart Contract Execution",
    amountDzd: 80000,
    status: "DELIVERED" as const,
    deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isClient: true,
    onApprove: vi.fn(),
    onRequestRevisions: vi.fn(),
    onDispute: vi.fn(),
  };

  it("renders milestone title, amount and stage pipeline", () => {
    renderWithFr(<MilestoneStageTracker {...defaultProps} />);
    expect(
      screen.getByText("MicroVM Smart Contract Execution"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/80,000 DZD/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Séquestré (Escrow)")).toBeInTheDocument();
    expect(screen.getByText("Inspection (14 Jours)")).toBeInTheDocument();
  });

  it("displays prominent Silence = Acceptance countdown banner for delivered milestones", () => {
    renderWithFr(<MilestoneStageTracker {...defaultProps} />);
    expect(screen.getByText(/Règle d'Acceptation Tacite/i)).toBeInTheDocument();
    expect(
      screen.getByText(/En l'absence d'action de votre part/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Valider & Libérer l'Escrow/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Demander des Révisions Ciblées/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ouvrir un Litige/i)).toBeInTheDocument();
  });

  it("triggers approve and revision callbacks on user click", () => {
    renderWithFr(<MilestoneStageTracker {...defaultProps} />);
    const approveBtn = screen.getByText(/Valider & Libérer l'Escrow/i);
    fireEvent.click(approveBtn);
    expect(defaultProps.onApprove).toHaveBeenCalled();

    const revisionBtn = screen.getByText(/Demander des Révisions Ciblées/i);
    fireEvent.click(revisionBtn);
    expect(defaultProps.onRequestRevisions).toHaveBeenCalled();
  });

  it("renders protected state and disables dispute when milestone is already approved", () => {
    renderWithFr(
      <MilestoneStageTracker
        {...defaultProps}
        status="APPROVED"
        approvedAt={new Date().toISOString()}
      />,
    );
    expect(
      screen.getByText(/Protection anti-litige post-libération active/i),
    ).toBeInTheDocument();
    // Dispute button should not be present
    expect(screen.queryByText(/Ouvrir un Litige/i)).not.toBeInTheDocument();
  });
});
