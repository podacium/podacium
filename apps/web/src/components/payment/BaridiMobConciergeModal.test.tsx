import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BaridiMobConciergeModal } from "./BaridiMobConciergeModal";

vi.mock("@/lib/i18n", () => {
  const t = (k?: string, fallback?: any) => {
    if (typeof fallback === "string") return fallback;
    return k || "";
  };
  (t as any).t = t;
  return {
    useTranslations: () => t,
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
    useLocale: () => "en",
  };
});

describe("BaridiMobConciergeModal", () => {
  it("renders order reference, corporate RIP, and formatted postal slip details", () => {
    render(
      <BaridiMobConciergeModal
        isOpen={true}
        onClose={vi.fn()}
        orderCode="POD-BM-892147"
        amountDzd={45000}
        corporateRip="00799999000123456787"
        corporateName="SARL PODACIUM BI & TECH"
      />,
    );

    expect(screen.getAllByText("POD-BM-892147")).toHaveLength(2);
    expect(screen.getByText("007 99999 0001234567 87")).toBeInTheDocument();
    expect(screen.getByText("SARL PODACIUM BI & TECH")).toBeInTheDocument();
    expect(screen.getAllByText(/45.*000.*DZD/)).toHaveLength(2);
  });

  it("handles copy to clipboard for order code and corporate RIP", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    render(
      <BaridiMobConciergeModal
        isOpen={true}
        onClose={vi.fn()}
        orderCode="POD-BM-892147"
        amountDzd={45000}
      />,
    );

    const copyOrderBtn = screen.getByTestId("copy-order-code-btn");
    fireEvent.click(copyOrderBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("POD-BM-892147");

    const copyRipBtn = screen.getByTestId("copy-rip-btn");
    fireEvent.click(copyRipBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "00799999000123456787",
    );
  });

  it("validates receipt file upload and submits successfully", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <BaridiMobConciergeModal
        isOpen={true}
        onClose={vi.fn()}
        orderCode="POD-BM-892147"
        amountDzd={45000}
        onSubmitReceipt={handleSubmit}
      />,
    );

    const file = new File(
      ["dummy receipt image content"],
      "baridimob_slip.jpg",
      {
        type: "image/jpeg",
      },
    );

    const fileInput = screen.getByTestId("receipt-file-input");
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText("baridimob_slip.jpg")).toBeInTheDocument();

    const submitBtn = screen.getByTestId("submit-receipt-btn");
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(file, "POD-BM-892147");
    });
  });
});
