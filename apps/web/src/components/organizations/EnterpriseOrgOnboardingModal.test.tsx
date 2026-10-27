import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EnterpriseOrgOnboardingModal from "./EnterpriseOrgOnboardingModal";
import { api } from "@/lib/api";

const mockRefreshUser = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, fullName: "Redha Founder" },
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
    createOrganization: vi.fn().mockResolvedValue({
      id: 99,
      name: "Podacium Cloud SPA",
      slug: "podacium-cloud-spa",
      city: "ALGIERS",
      sector: "TECHNOLOGY_AND_SOFTWARE",
      country: "ALGERIA",
    }),
  },
}));

describe("EnterpriseOrgOnboardingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 3 required fields in stage-0 onboarding", () => {
    render(<EnterpriseOrgOnboardingModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByPlaceholderText("organizations.namePlaceholder"),
    ).toBeInTheDocument();
    expect(screen.getByText("organizations.sector")).toBeInTheDocument();
    expect(screen.getByText("organizations.wilaya")).toBeInTheDocument();
  });

  it("updates live slug preview as user types organization name", () => {
    render(<EnterpriseOrgOnboardingModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText("organizations.namePlaceholder");
    fireEvent.change(input, { target: { value: "Algiers Fintech SARL" } });

    expect(screen.getByText("algiers-fintech-sarl")).toBeInTheDocument();
  });

  it("submits valid organization and triggers router navigation", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <EnterpriseOrgOnboardingModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    const input = screen.getByPlaceholderText("organizations.namePlaceholder");
    fireEvent.change(input, { target: { value: "Podacium Cloud SPA" } });

    const submitBtn = screen.getByText("organizations.createWorkspaceAction");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createOrganization).toHaveBeenCalledWith({
        name: "Podacium Cloud SPA",
        country: "ALGERIA",
        city: "ALGIERS",
        sector: "TECHNOLOGY_AND_SOFTWARE",
        description: "",
      });
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/organizations/99");
    });
  });
});
