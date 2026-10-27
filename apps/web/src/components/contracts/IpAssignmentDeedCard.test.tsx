import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  IpAssignmentDeedCard,
  IpAssignmentDeedData,
} from "./IpAssignmentDeedCard";

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

describe("IpAssignmentDeedCard", () => {
  const sampleDeed: IpAssignmentDeedData = {
    deedNumber: "IP-2026-CTR42-MS03",
    contractId: 42,
    milestoneId: 3,
    milestoneTitle: "MicroVM Sandboxed Compiler Engine",
    amountDzd: 120000,
    freelancerName: "Yacine Meziani",
    freelancerAnae: "162400998811",
    clientName: "Fintech Algerie EURL",
    deliverableSha256:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    documentSha256:
      "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
    signatureEd25519:
      "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    signedAt: new Date().toISOString(),
    pdfUrl: "/static/deeds/IP-2026-CTR42-MS03.pdf",
  };

  const defaultProps = {
    deed: sampleDeed,
    onDownloadPdf: vi.fn(),
  };

  it("renders deed number, parties, and legal framework references", () => {
    renderWithFr(<IpAssignmentDeedCard {...defaultProps} />);
    expect(screen.getByText("IP-2026-CTR42-MS03")).toBeInTheDocument();
    expect(screen.getByText("Yacine Meziani")).toBeInTheDocument();
    expect(screen.getByText("Fintech Algerie EURL")).toBeInTheDocument();
    expect(screen.getByText(/162400998811/)).toBeInTheDocument();
    expect(screen.getByText(/Certifié ONDA & ANAE/i)).toBeInTheDocument();
  });

  it("displays deliverable SHA-256 and platform Ed25519 signature", () => {
    renderWithFr(<IpAssignmentDeedCard {...defaultProps} />);
    expect(
      screen.getByText(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
      ),
    ).toBeInTheDocument();
  });

  it("triggers PDF download callback when button is clicked", () => {
    renderWithFr(<IpAssignmentDeedCard {...defaultProps} />);
    const downloadBtn = screen.getByRole("button", {
      name: /Télécharger l'Acte/i,
    });
    fireEvent.click(downloadBtn);
    expect(defaultProps.onDownloadPdf).toHaveBeenCalled();
  });
});
