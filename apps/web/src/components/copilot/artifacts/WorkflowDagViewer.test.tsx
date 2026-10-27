import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkflowDagViewer } from "./WorkflowDagViewer";
import type { WorkflowDagArtifact } from "@/types/copilot";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    t: (k: string, opts?: any, def?: string) => {
      if (typeof def === "string") return def;
      if (typeof opts === "string") return opts;
      if (k === "component.copilot.dag.completed") return "Terminé";
      if (k === "component.copilot.dag.running") return "En cours";
      if (k === "component.copilot.dag.failed") return "Échoué";
      if (k === "component.copilot.dag.pending") return "En attente";
      if (k === "component.copilot.dag.askExplanation")
        return "Expliquer cette étape";
      return k;
    },
  }),
}));

describe("WorkflowDagViewer Component", () => {
  const mockDagArtifact: WorkflowDagArtifact = {
    id: "dag_test_1",
    title: "Orchestration Pipeline Test",
    type: "workflow_dag",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "step_1",
        label: "Extraction des Bilans SCF",
        status: "completed",
        stepNumber: 1,
        toolName: "extract_financial_records",
        durationMs: 140,
        details: "Extraction terminée avec 24 bilans validés.",
      },
      {
        id: "step_2",
        label: "Calcul Bouclier Fiscal Art. 169",
        status: "running",
        stepNumber: 2,
        toolName: "apply_fiscal_shield",
        durationMs: 320,
        details: "Optimisation en cours...",
      },
      {
        id: "step_3",
        label: "Génération Facture Déductible",
        status: "pending",
        stepNumber: 3,
        toolName: "generate_invoice_pdf",
      },
    ],
    edges: [
      { from: "step_1", to: "step_2", animated: true },
      { from: "step_2", to: "step_3", animated: false },
    ],
    currentStepId: "step_2",
  };

  it("renders all workflow steps with their labels and status indicators", () => {
    render(<WorkflowDagViewer artifact={mockDagArtifact} />);

    expect(screen.getByText("Orchestration Pipeline Test")).toBeInTheDocument();
    expect(screen.getByText("Extraction des Bilans SCF")).toBeInTheDocument();
    expect(
      screen.getAllByText("Calcul Bouclier Fiscal Art. 169").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Génération Facture Déductible"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Terminé").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("En cours").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
  });

  it("displays node details in inspector when a node is clicked", () => {
    const handleNodeSelect = vi.fn();
    render(
      <WorkflowDagViewer
        artifact={mockDagArtifact}
        onNodeSelect={handleNodeSelect}
      />,
    );

    const firstStepCard = screen.getByText("Extraction des Bilans SCF");
    fireEvent.click(firstStepCard);

    expect(handleNodeSelect).toHaveBeenCalledWith("step_1");
    expect(
      screen.getAllByText("extract_financial_records").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Extraction terminée avec 24 bilans validés."),
    ).toBeInTheDocument();
  });

  it("emits explanation prompt into chat context when button is clicked", () => {
    const emitPromptMock = vi.fn();
    render(
      <WorkflowDagViewer
        artifact={mockDagArtifact}
        onEmitPrompt={emitPromptMock}
      />,
    );

    const askBtn = screen.getByText("Expliquer cette étape");
    fireEvent.click(askBtn);

    expect(emitPromptMock).toHaveBeenCalled();
    expect(emitPromptMock.mock.calls[0][0]).toContain(
      "Calcul Bouclier Fiscal Art. 169",
    );
  });
});
