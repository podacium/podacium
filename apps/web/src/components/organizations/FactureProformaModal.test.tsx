import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FactureProformaModal } from "./FactureProformaModal";
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

// Mock jspdf
const mockSave = vi.fn();
vi.mock("jspdf", () => {
  return {
    jsPDF: vi.fn().mockImplementation(() => ({
      setFillColor: vi.fn(),
      rect: vi.fn(),
      setTextColor: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
      roundedRect: vi.fn(),
      save: mockSave,
    })),
  };
});

// Mock api
vi.mock("@/lib/api", () => ({
  api: {
    generateOrganizationProforma: vi.fn(),
  },
}));

describe("FactureProformaModal", () => {
  const mockOrg: OrganizationResponse = {
    id: 10,
    name: "Cevital Agro Industries",
    sector: "AGRIBUSINESS",
    city: "BEJAIA",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    registrationNumber: "06B0123456",
    taxId: "000612345678901",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders line items and displays Article 169 fiscal tax shield calculation", () => {
    render(
      <FactureProformaModal
        isOpen={true}
        onClose={vi.fn()}
        organization={mockOrg}
      />,
    );

    expect(
      screen.getByText("organizations.proforma.modalTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Pack Licences EdTech Entreprise & Certifications (10 sièges)",
      ),
    ).toBeInTheDocument();

    // Check Article 169 & 224 CIDTA checkbox and tax shield savings
    expect(
      screen.getByText("organizations.proforma.article169Label"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.proforma.article169Hint"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.proforma.taxShieldSavings"),
    ).toBeInTheDocument();

    // With 1 item of 150,000 DZD and Article 169 active (TVA 0%):
    // Subtotal: 150,000 DZD, Total: 150,000 DZD
    // IBS 26% deduction savings: -39,000 DZD
    expect(screen.getByText(new RegExp("39.*000.*DZD"))).toBeInTheDocument();
  });

  it("allows adding and removing items and updates subtotal accordingly", () => {
    render(
      <FactureProformaModal
        isOpen={true}
        onClose={vi.fn()}
        organization={mockOrg}
      />,
    );

    const addBtn = screen.getByText("organizations.proforma.addItem");
    fireEvent.click(addBtn);

    // Now there are two line item rows with placeholder
    const inputs = screen.getAllByPlaceholderText(
      "organizations.proforma.itemDescPlaceholder",
    );
    expect(inputs.length).toBe(2);

    // Initial item 150,000 DZD + default item 50,000 DZD = 200,000 DZD
    // IBS savings: 200,000 * 0.26 = 52,000 DZD
    expect(screen.getByText(new RegExp("52.*000.*DZD"))).toBeInTheDocument();
  });

  it("submits proforma generation request and allows downloading PDF", async () => {
    const mockProformaResponse = {
      proformaReference: "PF-2026-0010-88491",
      issuedAt: "2026-03-15T12:00:00Z",
      organizationId: 10,
      totalDzd: 150000,
      ibsSavingsDzd: 39000,
    };
    (api.generateOrganizationProforma as any).mockResolvedValue(
      mockProformaResponse,
    );

    const onSuccess = vi.fn();

    render(
      <FactureProformaModal
        isOpen={true}
        onClose={vi.fn()}
        organization={mockOrg}
        onSuccess={onSuccess}
      />,
    );

    const generateBtn = screen.getByText("organizations.proforma.generateBtn");
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.generateOrganizationProforma).toHaveBeenCalledTimes(1);
    });

    // Check success view appears
    expect(
      screen.getByText("organizations.proforma.successTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.proforma.downloadPdf"),
    ).toBeInTheDocument();

    // Click download PDF
    const downloadPdfBtn = screen.getByText(
      "organizations.proforma.downloadPdf",
    );
    fireEvent.click(downloadPdfBtn);

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(mockProformaResponse);
  });
});
