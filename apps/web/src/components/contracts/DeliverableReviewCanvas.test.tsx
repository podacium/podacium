import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeliverableReviewCanvas, ReviewPin } from "./DeliverableReviewCanvas";

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

describe("DeliverableReviewCanvas", () => {
  const samplePins: ReviewPin[] = [
    {
      id: "pin-1",
      x: 35.5,
      y: 42.0,
      authorName: "Directeur Technique",
      comment: "Fix responsive padding on hero card",
      timestamp: "14:30",
      isResolved: false,
    },
  ];

  const defaultProps = {
    milestoneId: 3,
    milestoneTitle: "Landing Hero and Analytics Component",
    initialPins: samplePins,
    currentUserName: "Hiring Manager",
    isClient: true,
    onSavePins: vi.fn(),
    onRequestRevisions: vi.fn(),
  };

  it("renders toolbar, initial pin count, and annotation item in sidebar", () => {
    renderWithFr(<DeliverableReviewCanvas {...defaultProps} />);
    expect(screen.getByText("Canevas de Revue Visuelle")).toBeInTheDocument();
    expect(screen.getByText("1 annotation")).toBeInTheDocument();
    expect(
      screen.getByText("Fix responsive padding on hero card"),
    ).toBeInTheDocument();
  });

  it("allows selecting a pin to view author and comment popover", () => {
    renderWithFr(<DeliverableReviewCanvas {...defaultProps} />);
    // Click on pin marker "1"
    const pinBadge = screen.getAllByText("1")[0];
    fireEvent.click(pinBadge);

    expect(
      screen.getByText(/Épingle #1 • Directeur Technique/i),
    ).toBeInTheDocument();
  });

  it("triggers onRequestRevisions when action button is clicked", () => {
    renderWithFr(<DeliverableReviewCanvas {...defaultProps} />);
    const revBtn = screen.getByText(/Demander Révisions/i);
    fireEvent.click(revBtn);
    expect(defaultProps.onRequestRevisions).toHaveBeenCalledWith(samplePins);
  });

  it("handles multi-page pagination and zoom reset", () => {
    renderWithFr(
      <DeliverableReviewCanvas
        {...defaultProps}
        deliverableFile={{
          name: "specifications.pdf",
          url: "https://storage.podacium.dz/deliverables/specifications.pdf",
          totalPages: 4,
        }}
      />,
    );

    // Verify pagination controls
    expect(screen.getByText(/Page 1 (sur|\/) 4/i)).toBeInTheDocument();
    const nextBtn = screen.getByTitle(/Page suivante/i);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Page 2 (sur|\/) 4/i)).toBeInTheDocument();

    // Verify zoom controls
    const zoomInBtn = screen.getByTitle(/Zoom avant/i);
    fireEvent.click(zoomInBtn);
    expect(screen.getByText("120%")).toBeInTheDocument();

    const resetZoomBtn = screen.getByTitle(/Réinitialiser zoom 100%/i);
    fireEvent.click(resetZoomBtn);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
