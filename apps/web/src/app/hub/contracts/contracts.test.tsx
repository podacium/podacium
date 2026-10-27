import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  MilestoneStageTracker,
  DeliverableReviewCanvas,
  StructuredRevisionModal,
  IpAssignmentDeedCard,
} from "@/components/contracts";

import fs from "fs";
import path from "path";
import { IntlProvider } from "@/lib/i18n";

const frHub = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../../locales/fr/hub.json"),
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

describe("Hub Contract Workspace - Layer 9 Integration", () => {
  it("renders visual stage progress tracker with Silence = Acceptance clock", () => {
    renderWithFr(
      <MilestoneStageTracker
        milestoneId={42}
        milestoneTitle="MicroVM Runtime Delivery"
        amountDzd={150000}
        status="DELIVERED"
        deliveredAt={new Date().toISOString()}
        isClient={true}
      />,
    );
    expect(screen.getByText("MicroVM Runtime Delivery")).toBeInTheDocument();
    expect(screen.getByText(/Règle d'Acceptation Tacite/i)).toBeInTheDocument();
  });

  it("renders interactive deliverable review canvas", () => {
    renderWithFr(
      <DeliverableReviewCanvas
        milestoneId={42}
        milestoneTitle="MicroVM Runtime Delivery"
        initialPins={[]}
        isClient={true}
      />,
    );
    expect(screen.getByText("Canevas de Revue Visuelle")).toBeInTheDocument();
  });

  it("renders structured revision modal", () => {
    renderWithFr(
      <StructuredRevisionModal
        isOpen={true}
        onClose={vi.fn()}
        milestoneId={42}
        milestoneTitle="MicroVM Runtime Delivery"
        onSubmitRevision={vi.fn()}
      />,
    );
    expect(screen.getByText(/Demande de Révision Ciblée/i)).toBeInTheDocument();
  });

  it("renders bilateral IP assignment deed card with Ordonnance 03-05 compliance", () => {
    renderWithFr(
      <IpAssignmentDeedCard
        deed={{
          deedNumber: "IP-2026-CTR42-MS01",
          contractId: 42,
          milestoneId: 1,
          milestoneTitle: "MicroVM Runtime Delivery",
          amountDzd: 150000,
          freelancerName: "Amine Belkacem",
          freelancerAnae: "162400998811",
          clientName: "Algerie Telecom",
          deliverableSha256:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          documentSha256:
            "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          signatureEd25519:
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          signedAt: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText("IP-2026-CTR42-MS01")).toBeInTheDocument();
    expect(screen.getByText(/Certifié ONDA & ANAE/i)).toBeInTheDocument();
  });
});
