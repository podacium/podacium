import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PaymentVerificationWidget } from "./PaymentVerificationWidget";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ t: (k: string) => k }),
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

describe("PaymentVerificationWidget", () => {
  it("renders sync button and Algérie Poste claim option", () => {
    render(
      <PaymentVerificationWidget
        transactionId="TX-998877"
        referenceCode="PODA-CTR1-MS1"
        amountDzd={25000}
      />,
    );
    expect(
      screen.getByText("robustness.reconciliation.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("robustness.reconciliation.verifyButton"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("robustness.reconciliation.disputeButton"),
    ).toBeInTheDocument();
  });
});
