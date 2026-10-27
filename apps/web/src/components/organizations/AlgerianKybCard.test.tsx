import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AlgerianKybCard from "./AlgerianKybCard";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

describe("AlgerianKybCard", () => {
  it("renders statutory fiscal numbers correctly", () => {
    render(
      <AlgerianKybCard
        status="APPROVED"
        rcNumber="16B0012345"
        nifNumber="002016012345678"
        nisNumber="002016012345678"
        articleImposition="16012345678"
        legalStructure="SARL"
      />,
    );

    expect(screen.getByText("16B0012345")).toBeInTheDocument();
    expect(screen.getAllByText("002016012345678").length).toBeGreaterThan(0);
    expect(screen.getByText("16012345678")).toBeInTheDocument();
    expect(screen.getByText("SARL")).toBeInTheDocument();
  });

  it("renders pending verification status", () => {
    render(
      <AlgerianKybCard status="PENDING_VERIFICATION" rcNumber="31A0098765" />,
    );

    expect(screen.getByText("kyb.pending")).toBeInTheDocument();
    expect(screen.getByText("31A0098765")).toBeInTheDocument();
  });

  it("triggers onOpenKybModal callback when upload button is clicked", () => {
    const handleOpen = vi.fn();
    render(
      <AlgerianKybCard status="NOT_SUBMITTED" onOpenKybModal={handleOpen} />,
    );

    const button = screen.getByText("kyb.submitDossier");
    fireEvent.click(button);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });
});
