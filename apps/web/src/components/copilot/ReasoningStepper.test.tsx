import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReasoningStepper } from "./ReasoningStepper";

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "component.copilot.reasoning.title": "Processus de Réflexion & Exécution",
    "component.copilot.reasoning.statusThinking": "Réflexion en cours...",
    "component.copilot.reasoning.statusCompleted": "Réflexion terminée",
    "component.copilot.reasoning.statusFailed": "Échec de l'exécution",
    "component.copilot.reasoning.stepIntentAnalysis":
      "Analyse de la requête et intention",
    "component.copilot.reasoning.stepToolExecution": "Exécution de l'outil",
    "component.copilot.reasoning.stepSynthesis": "Synthèse de la réponse",
    "component.copilot.reasoning.toolInput": "Paramètres d'entrée",
    "component.copilot.reasoning.toolOutput": "Résultat",
    "component.copilot.reasoning.elapsed": "Durée",
    "component.copilot.reasoning.copyParams": "Copier les paramètres",
    "component.copilot.reasoning.copied": "Copié !",
    "component.copilot.reasoning.hideLogs": "Masquer les détails",
    "component.copilot.reasoning.showLogs": "Afficher les détails",
    "component.copilot.reasoning.running": "En cours",
    "component.copilot.reasoning.done": "Terminé",
    "component.copilot.reasoning.failed": "Échoué",
    "component.copilot.reasoning.logsCount": "Logs ({count})",
  };
  return {
    useTranslations: () => ({
      t: (key: string, vars?: any) => {
        if (
          key === "component.copilot.reasoning.logsCount" &&
          vars?.count !== undefined
        ) {
          return `Logs (${vars.count})`;
        }
        return dictionary[key] || key;
      },
    }),
    useLocale: () => "fr",
  };
});

describe("ReasoningStepper Component", () => {
  it("renders collapsed header with duration and thinking status", () => {
    render(
      <ReasoningStepper
        isStreaming={true}
        durationSeconds={3.4}
        defaultExpanded={false}
      />,
    );

    expect(
      screen.getByText("Processus de Réflexion & Exécution"),
    ).toBeInTheDocument();
    expect(screen.getByText("• Réflexion en cours...")).toBeInTheDocument();
    expect(screen.getByText("3.4s")).toBeInTheDocument();
  });

  it("expands drawer and displays steps and tools upon clicking toggle", () => {
    const mockTools = [
      {
        name: "execute_fiscal_query",
        status: "completed" as const,
        arguments: { wilaya: "16-Alger", year: 2025 },
        result: { status: "success", count: 120 },
      },
    ];

    render(
      <ReasoningStepper
        isStreaming={false}
        durationSeconds={1.8}
        toolCalls={mockTools}
        defaultExpanded={true}
      />,
    );

    expect(
      screen.getByText("Analyse de la requête et intention"),
    ).toBeInTheDocument();
    expect(screen.getByText(/execute_fiscal_query/)).toBeInTheDocument();
    expect(screen.getByText("Synthèse de la réponse")).toBeInTheDocument();

    // Click Logs tab
    const logsTab = screen.getByText("Logs (1)");
    fireEvent.click(logsTab);

    expect(screen.getByText("execute_fiscal_query")).toBeInTheDocument();
    expect(screen.getByText("Paramètres d'entrée:")).toBeInTheDocument();
    expect(screen.getByText(/16-Alger/)).toBeInTheDocument();
  });

  it("indicates active tool during streaming execution", () => {
    render(
      <ReasoningStepper
        isStreaming={true}
        activeTool="fetch_dzd_exchange_rates"
        defaultExpanded={true}
      />,
    );

    expect(
      screen.getByText("Exécution de l'outil: fetch_dzd_exchange_rates"),
    ).toBeInTheDocument();
  });
});
