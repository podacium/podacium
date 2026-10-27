import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CopilotCanvasViewer } from "./CopilotCanvasViewer";
import type {
  CanvasArtifact,
  BiVisualizationArtifact,
  SqlArtifact,
  WorkflowDagArtifact,
  DocumentArtifact,
} from "@/types/copilot";

vi.mock("@/lib/i18n", () => ({
  useBidi: () => ({ isRTL: false }),
  useTranslations: () => ({
    t: (k: string, opts?: any, def?: string) => {
      if (typeof def === "string") return def;
      if (typeof opts === "string") return opts;
      if (k === "component.copilot.records" && opts?.count)
        return `${opts.count} Enregistrements`;
      if (k === "component.copilot.canvas.actions.apply19Tva")
        return "Appliquer TVA 19%";
      if (k === "component.copilot.canvas.actions.convertToDzd")
        return "Convertir en DZD";
      if (k === "component.copilot.canvas.actions.filterTop5")
        return "Filtrer Top 5";
      if (k === "component.copilot.canvas.scanTooltip")
        return "Scanner un reçu (OCR)";
      if (k === "component.copilot.cameraOcr.title")
        return "Scanner de Reçu Fiscal & CCP";
      return k;
    },
  }),
}));

describe("CopilotCanvasViewer Component", () => {
  it("renders empty state placeholder when no artifacts are present", () => {
    render(
      <CopilotCanvasViewer
        artifacts={[]}
        activeArtifactId=""
        onSelectArtifact={() => {}}
      />,
    );

    expect(
      screen.getByText("component.copilot.canvasReady"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("component.copilot.canvasReadyDescription"),
    ).toBeInTheDocument();
  });

  it("renders bi_visualization table artifact with category and metric columns", () => {
    const tableArtifact: BiVisualizationArtifact = {
      id: "art_table_1",
      title: "Analyse des Ventes Régionales",
      type: "bi_visualization",
      chartType: "table",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryKey: "wilaya",
      metrics: [
        { col: "revenue_dzd", alias: "revenue_dzd", func: "sum" },
        { col: "transactions", alias: "transactions", func: "count" },
      ],
      data: [
        { wilaya: "Alger", revenue_dzd: "1,500,000 DZD", transactions: 140 },
        { wilaya: "Oran", revenue_dzd: "980,000 DZD", transactions: 92 },
      ],
    };

    render(
      <CopilotCanvasViewer
        artifacts={[tableArtifact]}
        activeArtifactId="art_table_1"
        onSelectArtifact={() => {}}
      />,
    );

    expect(
      screen.getAllByText("Analyse des Ventes Régionales").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("wilaya")).toBeInTheDocument();
    expect(screen.getByText("revenue_dzd")).toBeInTheDocument();
    expect(screen.getByText("transactions")).toBeInTheDocument();
    expect(screen.getByText("Alger")).toBeInTheDocument();
    expect(screen.getByText("Oran")).toBeInTheDocument();
    expect(screen.getByText("1,500,000 DZD")).toBeInTheDocument();
  });

  it("shows floating actions on BI table cell click and emits targeted prompt", () => {
    const emitPromptMock = vi.fn();
    const tableArtifact: BiVisualizationArtifact = {
      id: "art_table_1",
      title: "Chiffre d'Affaires Wilayas",
      type: "bi_visualization",
      chartType: "table",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryKey: "wilaya",
      metrics: [{ col: "total_dzd", alias: "total_dzd", func: "sum" }],
      data: [{ wilaya: "Oran", total_dzd: "5,000,000 DZD" }],
    };

    render(
      <CopilotCanvasViewer
        artifacts={[tableArtifact]}
        activeArtifactId="art_table_1"
        onSelectArtifact={() => {}}
        onEmitPrompt={emitPromptMock}
      />,
    );

    const cell = screen.getByText("5,000,000 DZD");
    fireEvent.click(cell);

    expect(screen.getByTestId("bi-table-floating-actions")).toBeInTheDocument();
    expect(screen.getByText("Appliquer TVA 19%")).toBeInTheDocument();
    expect(screen.getByText("Convertir en DZD")).toBeInTheDocument();
    expect(screen.getByText("Filtrer Top 5")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Appliquer TVA 19%"));
    expect(emitPromptMock).toHaveBeenCalledWith(
      expect.stringContaining("Appliquer TVA 19%"),
    );
  });

  it("renders workflow_dag artifact with execution steps", () => {
    const dagArtifact: WorkflowDagArtifact = {
      id: "art_dag_1",
      title: "DAG Déploiement Agent",
      type: "workflow_dag",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: "step_1",
          label: "Audit Fiscalité Locale",
          status: "completed",
          stepNumber: 1,
        },
      ],
      edges: [],
    };

    render(
      <CopilotCanvasViewer
        artifacts={[dagArtifact]}
        activeArtifactId="art_dag_1"
        onSelectArtifact={() => {}}
      />,
    );

    expect(
      screen.getAllByText("Audit Fiscalité Locale").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("copies active artifact content to clipboard when copy button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const sqlArtifact: SqlArtifact = {
      id: "art_sql_1",
      title: "Requête Comptable",
      type: "code_sql",
      language: "sql",
      code: "SELECT * FROM fiscal_ledger LIMIT 10;",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    render(
      <CopilotCanvasViewer
        artifacts={[sqlArtifact]}
        activeArtifactId="art_sql_1"
        onSelectArtifact={() => {}}
      />,
    );

    const copyBtn = screen.getByTitle("component.copilot.canvas.copyTooltip");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      "SELECT * FROM fiscal_ledger LIMIT 10;",
    );
  });

  it("renders camera_ocr artifact scanner view and triggers scanner button", () => {
    const onOpenScannerMock = vi.fn();
    const cameraArtifact = {
      id: "art_camera_1",
      title: "Scanner Reçu Fiscal",
      type: "camera_ocr" as const,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "capturing" as const,
    };

    render(
      <CopilotCanvasViewer
        artifacts={[cameraArtifact]}
        activeArtifactId="art_camera_1"
        onSelectArtifact={() => {}}
        onOpenScanner={onOpenScannerMock}
      />,
    );

    expect(
      screen.getByText(
        /Scanner de Reçu Fiscal & CCP|component\.copilot\.cameraOcr\.title/,
      ),
    ).toBeInTheDocument();

    const scanBtn = screen.getByTitle(
      /Scanner un reçu \(OCR\)|component\.copilot\.canvas\.scanTooltip/,
    );
    fireEvent.click(scanBtn);
    expect(onOpenScannerMock).toHaveBeenCalled();
  });
});
