import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { api } from "@/lib/api";

const mockRefreshUser = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      fullName: "Zakarya Tester",
      primaryOrganizationId: 10,
      primaryOrganization: {
        id: 10,
        name: "Acme Algeria SARL",
        userRole: "OWNER",
        slug: "acme-algeria",
      },
    },
    isAuthenticated: true,
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getOrganizations: vi.fn().mockResolvedValue([
      {
        id: 10,
        name: "Acme Algeria SARL",
        userRole: "OWNER",
        slug: "acme-algeria",
      },
      {
        id: 20,
        name: "Oran Data Labs EURL",
        userRole: "ADMIN",
        slug: "oran-data-labs",
      },
    ]),
    switchOrganization: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active workspace name and role badge", async () => {
    render(<WorkspaceSwitcher />);

    await waitFor(() => {
      expect(screen.getByText("Acme Algeria SARL")).toBeInTheDocument();
      expect(screen.getByText("OWNER")).toBeInTheDocument();
    });
  });

  it("opens dropdown and lists organizations on click", async () => {
    render(<WorkspaceSwitcher />);

    const trigger = await screen.findByRole("button", { expanded: false });
    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox.className).toContain("bg-white/95");
    expect(listbox.className).toContain("backdrop-blur-2xl");
    expect(screen.getByText("Oran Data Labs EURL")).toBeInTheDocument();
  });

  it("switches workspace on organization item click", async () => {
    render(<WorkspaceSwitcher />);

    const trigger = await screen.findByRole("button", { expanded: false });
    fireEvent.click(trigger);

    const secondOrg = screen.getByText("Oran Data Labs EURL");
    fireEvent.click(secondOrg);

    await waitFor(() => {
      expect(api.switchOrganization).toHaveBeenCalledWith(20);
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });
});
