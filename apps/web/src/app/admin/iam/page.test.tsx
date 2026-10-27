/* eslint-disable react/display-name -- framer-motion mocks are anonymous by design */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminIamPage from "./page";
import { api } from "@/lib/api";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        {
          children,
          whileTap,
          initial,
          animate,
          exit,
          transition,
          layout,
          ...props
        }: any,
        ref: any,
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
    button: React.forwardRef(
      (
        {
          children,
          whileTap,
          initial,
          animate,
          exit,
          transition,
          layout,
          ...props
        }: any,
        ref: any,
      ) => (
        <button ref={ref} {...props}>
          {children}
        </button>
      ),
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/iam",
}));

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => {
    const t = (key: string, vars?: any) => {
      if (vars && vars.id !== undefined) return `ID: ${vars.id}`;
      if (vars && vars.level !== undefined) return `Level ${vars.level}/10`;
      if (vars && vars.name !== undefined) return `${vars.name}`;
      return key;
    };
    t.isolate = (text: string) => text;
    return t;
  },
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRTL: false }),
}));

// Mock admin auth
const mockHasPermission = vi.fn().mockReturnValue(true);
vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({
    hasPermission: mockHasPermission,
    user: { id: 1, email: "super@podacium.com", name: "Super Admin" },
  }),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSubAdmins = [
  {
    id: 1,
    userId: 101,
    fullName: "Karim Hadj-Ahmed",
    email: "karim@podacium.com",
    avatarUrl: null,
    department: "COMPLIANCE_AND_KYC",
    title: "KYC Compliance Officer",
    clearanceLevel: 8,
    isActive: true,
    roles: ["compliance-officer"],
    lastAdminLoginAt: "2026-09-20T10:00:00Z",
    createdAt: "2026-01-15T08:00:00Z",
  },
  {
    id: 2,
    userId: 102,
    fullName: "Yasmine Belkacem",
    email: "yasmine@podacium.com",
    avatarUrl: null,
    department: "CUSTOMER_SUPPORT",
    title: "Support Lead",
    clearanceLevel: 4,
    isActive: false,
    roles: ["support-lead"],
    lastAdminLoginAt: null,
    createdAt: "2026-02-10T12:00:00Z",
  },
];

const mockRoles = [
  {
    id: 1,
    slug: "super-admin",
    name: "Super Administrator",
    isSystem: true,
    hierarchyRank: 10,
    permissions: ["*"],
  },
  {
    id: 2,
    slug: "compliance-officer",
    name: "Compliance Officer",
    isSystem: true,
    hierarchyRank: 8,
    permissions: ["kyc:review", "audit:read"],
  },
];

describe("AdminIamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url.startsWith("/admin/iam/subadmins/")) {
        return Promise.resolve({
          ...mockSubAdmins[0],
          mfaEnforced: true,
          roleAssignments: [
            {
              roleSlug: "compliance-officer",
              roleName: "Compliance Officer",
              hierarchyRank: 8,
              assignedAt: "2026-01-15T08:00:00Z",
            },
          ],
          effectivePermissions: ["kyc:review", "audit:read"],
        });
      }
      if (url.includes("/admin/iam/subadmins")) {
        return Promise.resolve({
          subadmins: mockSubAdmins,
          total: 2,
        });
      }
      if (url.includes("/admin/iam/roles")) {
        return Promise.resolve(mockRoles);
      }
      return Promise.resolve({});
    });
  });

  it("renders page header and staff list", async () => {
    render(<AdminIamPage />);

    expect(screen.getByText("admin.iam.title")).toBeInTheDocument();
    expect(screen.getByText("admin.iam.subtitle")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
      expect(screen.getByText("Yasmine Belkacem")).toBeInTheDocument();
      expect(screen.getByText("KYC Compliance Officer")).toBeInTheDocument();
    });
  });

  it("opens and submits provision sub-admin wizard modal", async () => {
    (api.post as any).mockResolvedValueOnce({
      success: true,
      userId: 103,
      adminProfileId: 3,
      email: "new.staff@podacium.com",
      fullName: "Nadir Amrani",
      department: "CUSTOMER_SUPPORT",
      roleSlug: "compliance-officer",
      clearanceLevel: 8,
      deliveryMethod: "TEMPORARY_CREDENTIAL",
      tempPassword: "Poda-A1B2-C3D4-E5F6-7890!",
      message: "Provisioned",
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    // Click Provision Sub-Admin button
    const provisionBtn = screen.getByText("admin.iam.provisionButton");
    fireEvent.click(provisionBtn);

    expect(
      screen.getByText("admin.iam.provisionModalTitle"),
    ).toBeInTheDocument();

    // Fill form
    fireEvent.change(
      screen.getByPlaceholderText("admin.iam.fullNamePlaceholder"),
      {
        target: { value: "Nadir Amrani" },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText("admin.iam.emailPlaceholder"),
      {
        target: { value: "new.staff@podacium.com" },
      },
    );

    // Select Temporary Credential radio
    const tempRadio = screen.getByDisplayValue("TEMPORARY_CREDENTIAL");
    fireEvent.click(tempRadio);

    // Select Role
    const roleSelects = screen.getAllByRole("combobox");
    // Find role select inside modal
    const modalRoleSelect = roleSelects.find((s) =>
      s.innerHTML.includes("admin.iam.selectRole"),
    );
    if (modalRoleSelect) {
      fireEvent.change(modalRoleSelect, {
        target: { value: "compliance-officer" },
      });
    }

    // Submit form
    const submitBtn = screen.getByText("admin.iam.confirmProvision");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/admin/iam/subadmins/provision",
        expect.objectContaining({
          fullName: "Nadir Amrani",
          email: "new.staff@podacium.com",
          deliveryMethod: "TEMPORARY_CREDENTIAL",
        }),
      );
    });

    // One-time credential modal should appear with generated temporary password
    await waitFor(() => {
      expect(
        screen.getByText("admin.iam.credentialModalTitle"),
      ).toBeInTheDocument();
      expect(screen.getByText("Poda-A1B2-C3D4-E5F6-7890!")).toBeInTheDocument();
    });
  });

  it("opens and submits edit profile modal", async () => {
    (api.put as any).mockResolvedValueOnce({
      success: true,
      message: "Updated",
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    // Click edit button for Karim
    const editBtns = screen.getAllByTitle("admin.iam.editStaff");
    fireEvent.click(editBtns[0]);

    expect(screen.getByText("admin.iam.editProfileTitle")).toBeInTheDocument();

    // Change title
    const positionInput = screen.getByPlaceholderText(
      "admin.iam.positionPlaceholder",
    );
    fireEvent.change(positionInput, {
      target: { value: "Senior KYC Officer" },
    });

    // Submit edit
    const saveBtn = screen.getByText("admin.iam.saveChanges");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/admin/iam/subadmins/101/profile",
        expect.objectContaining({
          fullName: "Karim Hadj-Ahmed",
          title: "Senior KYC Officer",
        }),
      );
    });
  });

  it("handles staff de-provisioning confirmation", async () => {
    (api.delete as any).mockResolvedValueOnce({
      success: true,
      message: "Deprovisioned",
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    const deprovisionBtns = screen.getAllByTitle("admin.iam.deprovision");
    fireEvent.click(deprovisionBtns[0]);

    // Dialog opens with type-to-confirm "DEPROVISION"
    const confirmInput = screen.getByPlaceholderText("DEPROVISION");
    fireEvent.change(confirmInput, { target: { value: "DEPROVISION" } });

    const confirmBtn = screen.getByText("admin.iam.confirmDeprovisionBtn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/admin/iam/subadmins/101");
    });
  });

  it("handles status toggle between active and suspended", async () => {
    (api.put as any).mockResolvedValueOnce({
      success: true,
      isActive: false,
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    const deactivateBtn = screen.getByTitle("admin.iam.deactivateStaff");
    fireEvent.click(deactivateBtn);

    const confirmBtns = screen.getAllByText("admin.iam.deactivateStaff");
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/admin/iam/subadmins/101/status", {
        isActive: false,
      });
    });
  });

  it("opens details modal and displays effective permissions matrix", async () => {
    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    const inspectBtns = screen.getAllByTitle("admin.iam.inspectLineage");
    fireEvent.click(inspectBtns[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText("Karim Hadj-Ahmed").length,
      ).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("kyc:review")).toBeInTheDocument();
      expect(screen.getByText("audit:read")).toBeInTheDocument();
    });
  });

  it("handles re-issuing setup invite link and modal display", async () => {
    (api.post as any).mockResolvedValueOnce({
      success: true,
      email: "karim@podacium.com",
      inviteUrl: "/auth/setup-admin?token=reissued123",
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    const inviteBtns = screen.getAllByTitle("admin.iam.reissueInvite");
    fireEvent.click(inviteBtns[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/admin/iam/subadmins/101/invite",
        {},
      );
      expect(
        screen.getByText("admin.iam.credentialModalTitle"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/auth\/setup-admin\?token=reissued123/),
      ).toBeInTheDocument();
    });
  });

  it("handles generating temporary password and modal clipboard copy", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    (api.post as any).mockResolvedValueOnce({
      success: true,
      email: "karim@podacium.com",
      tempPassword: "Poda-9988-7766-5544-3322!",
    });

    render(<AdminIamPage />);

    await waitFor(() => {
      expect(screen.getByText("Karim Hadj-Ahmed")).toBeInTheDocument();
    });

    const tempBtns = screen.getAllByTitle("admin.iam.generateTempPassword");
    fireEvent.click(tempBtns[0]);

    const confirmBtn = screen.getByText("admin.iam.confirmGeneratePasswordBtn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/admin/iam/subadmins/101/temp-password",
        {},
      );
      expect(screen.getByText("Poda-9988-7766-5544-3322!")).toBeInTheDocument();
    });

    // Test copy button
    const copyBtn = screen.getByText("admin.iam.copyCredential");
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("Poda-9988-7766-5544-3322!");
    });
  });

  it("handles live user lookup in assign role modal", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/admin/iam/users/105/lookup") {
        return Promise.resolve({
          id: 105,
          fullName: "Samir Brahimi",
          email: "samir@podacium.com",
          username: "samirb",
          phoneNumber: "+213555123456",
          avatarUrl: null,
          role: "STUDENT",
          isActive: true,
          createdAt: "2026-03-01T00:00:00Z",
          hasAdminProfile: false,
          department: null,
          title: null,
          clearanceLevel: null,
          roles: [],
        });
      }
      if (url.includes("/admin/iam/subadmins")) {
        return Promise.resolve({
          subadmins: mockSubAdmins,
          total: 2,
        });
      }
      if (url.includes("/admin/iam/roles")) {
        return Promise.resolve(mockRoles);
      }
      return Promise.resolve({});
    });

    render(<AdminIamPage />);

    const assignBtn = screen.getByText("admin.iam.assignButton");
    fireEvent.click(assignBtn);

    const input = screen.getByPlaceholderText(
      "admin.iam.targetUserIdPlaceholder",
    );
    fireEvent.change(input, { target: { value: "105" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/admin/iam/users/105/lookup");
      expect(screen.getByText("Samir Brahimi")).toBeInTheDocument();
      expect(
        screen.getByText("samir@podacium.com • +213555123456"),
      ).toBeInTheDocument();
    });
  });
});
