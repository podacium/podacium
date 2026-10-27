import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FiscalDefensePackButton } from "./FiscalDefensePackButton";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ t: (k: string) => k }),
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

describe("FiscalDefensePackButton", () => {
  it("renders button with 100% IBS deduction label", () => {
    render(
      <FiscalDefensePackButton
        invoiceId={42}
        invoiceNumber="INV-2026-001"
        totalDzd={100000}
      />,
    );
    expect(
      screen.getByText("robustness.fiscal.defensePackButton"),
    ).toBeInTheDocument();
  });
});
