import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DLGUploadPreview } from "./DLGUploadPreview";

vi.mock("@/lib/i18n", () => {
  const t = (k: string) => {
    if (k === "bi.datasets.upload.semicolon") return "Point-virgule (;)";
    return k;
  };
  return {
    useTranslations: () => ({ t }),
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("DLGUploadPreview", () => {
  it("renders encoding and SCF journal breakdown", () => {
    render(
      <DLGUploadPreview
        encoding="windows-1256"
        delimiter=";"
        totalEntries={150}
        totalDebitDzd={500000}
        totalCreditDzd={500000}
        isBalanced={true}
        negativeCashDetected={false}
        sampleEntries={[
          {
            account_code: "700000",
            account_label: "Chiffre d'affaires",
            scf_category: "REVENUE",
            badge_color: "emerald",
            debit_dzd: 0,
            credit_dzd: 100000,
            libelle: "Prestation Numérique",
          },
        ]}
      />,
    );
    expect(screen.getByText("WINDOWS-1256")).toBeInTheDocument();
    expect(screen.getByText("Point-virgule (;)")).toBeInTheDocument();
    expect(screen.getByText("700000")).toBeInTheDocument();
    expect(
      screen.getAllByText("robustness.dlg.balanced").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
