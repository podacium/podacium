import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StructuredRevisionModal } from "./StructuredRevisionModal";

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

describe("StructuredRevisionModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    milestoneId: 2,
    milestoneTitle: "Frontend Dashboard Integration",
    associatedPinCount: 3,
    onSubmitRevision: vi.fn().mockResolvedValue(undefined),
  };

  it("renders revision criteria checklist and pin count", () => {
    renderWithFr(<StructuredRevisionModal {...defaultProps} />);
    expect(screen.getByText(/Demande de Révision Ciblée/i)).toBeInTheDocument();
    expect(
      screen.getByText(/3 annotation\(s\) visuelle\(s\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Qualité & Architecture du Code"),
    ).toBeInTheDocument();
    expect(screen.getByText("Conformité Design & UI/UX")).toBeInTheDocument();
  });

  it("expands note input when criterion is selected and enforces detail validation", async () => {
    renderWithFr(<StructuredRevisionModal {...defaultProps} />);
    const designOption = screen.getByText("Conformité Design & UI/UX");
    fireEvent.click(designOption);

    // Note field should appear
    const noteInput = screen.getByPlaceholderText(/Le bouton de validation/i);
    expect(noteInput).toBeInTheDocument();

    // Fill note with detailed feedback
    fireEvent.change(noteInput, {
      target: {
        value: "The responsive layout overflows on viewports below 375px.",
      },
    });

    const submitBtn = screen.getByRole("button", {
      name: /Transmettre la Demande/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSubmitRevision).toHaveBeenCalledWith({
        selectedCriteria: ["DESIGN_CONFORMITY"],
        detailedNotes: {
          DESIGN_CONFORMITY:
            "The responsive layout overflows on viewports below 375px.",
        },
        generalComment: "",
      });
    });
  });
});
