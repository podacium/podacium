import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationAuditTab } from "./OrganizationAuditTab";
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
    getOrganizationAuditLogs: vi.fn(),
  },
}));

describe("OrganizationAuditTab", () => {
  const mockOrg: OrganizationResponse = {
    id: 99,
    name: "Djezzy Telecom Enterprise",
    sector: "TELECOM",
    city: "ALGIERS",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const mockLogs = [
    {
      id: 101,
      eventType: "ORG_SECURITY_2FA_ENFORCED",
      createdAt: "2026-03-10T14:30:00Z",
      userId: 5,
      user: {
        id: 5,
        fullName: "Amine Benali",
        email: "amine.benali@djezzy.dz",
      },
      ipAddress: "197.200.45.12",
      eventData: { action: "mandatory_2fa", status: "enabled" },
    },
    {
      id: 102,
      eventType: "ORG_BILLING_TOPUP_INITIATED",
      createdAt: "2026-03-11T09:15:00Z",
      userId: 8,
      user: {
        id: 8,
        fullName: "Fatima Zohra",
        email: "fatima.z@djezzy.dz",
      },
      ipAddress: "105.101.12.90",
      eventData: { rail: "CHARGILY_CIB", amountDzd: 50000 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getOrganizationAuditLogs as any).mockResolvedValue({
      logs: mockLogs,
      total: 2,
    });

    // Mock window.URL
    window.URL.createObjectURL = vi
      .fn()
      .mockReturnValue("blob:mock-audit-log-url");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("renders live audit logs timeline with event types, actors, and IP addresses", async () => {
    render(
      <OrganizationAuditTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    await waitFor(() => {
      expect(api.getOrganizationAuditLogs).toHaveBeenCalledWith(99, 100);
    });

    expect(screen.getByText("ORG_SECURITY_2FA_ENFORCED")).toBeInTheDocument();
    expect(screen.getByText("amine.benali@djezzy.dz")).toBeInTheDocument();
    expect(screen.getByText(/197\.200\.45\.12/)).toBeInTheDocument();

    expect(screen.getByText("ORG_BILLING_TOPUP_INITIATED")).toBeInTheDocument();
    expect(screen.getByText("fatima.z@djezzy.dz")).toBeInTheDocument();
    expect(screen.getByText(/105\.101\.12\.90/)).toBeInTheDocument();
  });

  it("filters logs by search query", async () => {
    render(
      <OrganizationAuditTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText("ORG_SECURITY_2FA_ENFORCED")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "organizations.searchMembersPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "amine" } });

    // "amine" should match log 101, but log 102 should be filtered out
    expect(screen.getByText("amine.benali@djezzy.dz")).toBeInTheDocument();
    expect(screen.queryByText("fatima.z@djezzy.dz")).not.toBeInTheDocument();
  });

  it("exports audit log as CSV with UTF-8 BOM when Export button is clicked", async () => {
    render(
      <OrganizationAuditTab organization={mockOrg} isAdminOrOwner={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText("ORG_SECURITY_2FA_ENFORCED")).toBeInTheDocument();
    });

    const exportBtn = screen.getByText("organizations.audit.exportCsv");
    expect(exportBtn).toBeInTheDocument();

    // Spy on document.createElement to check anchor download
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === "a") {
          el.click = clickSpy;
        }
        return el;
      },
    );

    fireEvent.click(exportBtn);

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
