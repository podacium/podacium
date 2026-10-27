import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationTreasuryTab } from "./OrganizationTreasuryTab";
import { api, OrganizationResponse } from "@/lib/api";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock api
vi.mock("@/lib/api", () => ({
  api: {
    getOrganizationTreasury: vi.fn(),
    getOrganizationInvoices: vi.fn(),
    generateOrganizationProforma: vi.fn(),
  },
}));

describe("OrganizationTreasuryTab", () => {
  const mockOrg: OrganizationResponse = {
    id: 42,
    name: "Sonatrach Tech Ventures",
    sector: "ENERGY_BI",
    city: "ALGIERS",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    registrationNumber: "16B0998877",
    taxId: "002016099887711",
  };

  const mockTreasuryData = {
    availableBalanceDzd: 350000,
    inEscrowDzd: 85000,
    pendingClearanceDzd: 25000,
    timbreFiscalExempt: true,
  };

  const mockInvoicesData = {
    invoices: [
      {
        id: "42",
        invoiceNumber: "INV-2026-0042",
        createdAt: "2026-03-01T10:00:00Z",
        issuedAt: "2026-03-01T10:00:00Z",
        amount: 180000,
        status: "PAID",
        description: "Pack Entreprise BI & EdTech Seats",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getOrganizationTreasury as any).mockResolvedValue(mockTreasuryData);
    (api.getOrganizationInvoices as any).mockResolvedValue(mockInvoicesData);
  });

  it("renders treasury cards with corporate balance and Timbre Fiscal exemption indicator", async () => {
    render(
      <OrganizationTreasuryTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    // Wait for data load
    await waitFor(() => {
      expect(api.getOrganizationTreasury).toHaveBeenCalledWith(42);
    });

    // Check balances rendered
    expect(screen.getByText(new RegExp("350.*000"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp("85.*000"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp("25.*000"))).toBeInTheDocument();

    // Check Timbre Fiscal exemption banner
    expect(
      screen.getAllByText("organizations.treasury.timbreExemptBadge").length,
    ).toBeGreaterThan(0);
  });

  it("renders action buttons for top-up and proforma and opens modals when clicked", async () => {
    render(
      <OrganizationTreasuryTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText(new RegExp("350.*000"))).toBeInTheDocument();
    });

    const topUpBtn = screen.getByTestId("top-up-deposit-btn");
    expect(topUpBtn).toBeInTheDocument();
    fireEvent.click(topUpBtn);

    // Modal title should appear
    expect(
      screen.getByText("organizations.topUp.modalTitle"),
    ).toBeInTheDocument();

    // Open Proforma modal
    const proformaBtn = screen.getByTestId("request-proforma-btn");
    expect(proformaBtn).toBeInTheDocument();
    fireEvent.click(proformaBtn);

    expect(
      screen.getByText("organizations.proforma.modalTitle"),
    ).toBeInTheDocument();
  });

  it("renders invoice history table with triple document kit trigger", async () => {
    render(
      <OrganizationTreasuryTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText("INV-2026-0042")).toBeInTheDocument();
    });

    expect(screen.getByText(new RegExp("180.*000.*DZD"))).toBeInTheDocument();
    expect(
      screen.getByText("Pack Entreprise BI & EdTech Seats"),
    ).toBeInTheDocument();

    // Click on Triple Document Kit button
    const kitBtns = screen.getAllByText("organizations.treasury.tripleKit");
    expect(kitBtns.length).toBeGreaterThan(0);
    fireEvent.click(kitBtns[0]);

    // Modal for Triple Document Kit should open
    expect(
      screen.getByText("organizations.treasury.anaeInvoice"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.treasury.pvReception"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.treasury.commissionInvoice"),
    ).toBeInTheDocument();
  });
});
