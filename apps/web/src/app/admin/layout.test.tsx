import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import AdminLayout from "./layout";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}));

let currentPath = "/admin/analytics";
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => currentPath,
}));

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "admin.iam.superAdminOwner": "Super Administrator (Owner)",
    "admin.iam.superAdmin": "Super Admin",
    "admin.iam.staffMember": "Staff Member",
  };
  return {
    useTranslations: () => {
      const t = (key: string, _vars?: any, fallback?: string) =>
        dictionary[key] || fallback || key;
      t.isolate = (text: string) => text;
      return t;
    },
    useLocale: () => "en",
    useBidi: () => ({ dir: "ltr", isRTL: false }),
  };
});

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

const mockUseAdminAuth = vi.fn(() => ({
  profile: null as any,
  hasAnyPermission: () => true,
  hasPermission: () => true,
  isLoading: false,
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

let mockRole = "ADMIN";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@podacium.com", role: mockRole },
    isAuthenticated: true,
    loading: false,
    verifying: false,
  }),
  useOptionalAuth: () => ({
    user: { id: 1, email: "admin@podacium.com", role: mockRole },
    isAuthenticated: true,
    loading: false,
  }),
  hasOnboardingDoneCookie: () => true,
}));

describe("AdminLayout", () => {
  it("renders on subpage without missing key warning", () => {
    const consoleError = vi.spyOn(console, "error");
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining(
        'Each child in a list should have a unique "key" prop',
      ),
      expect.anything(),
      expect.anything(),
    );
  });

  it("renders localized clearance title for super admin owner", () => {
    mockUseAdminAuth.mockReturnValueOnce({
      profile: {
        id: 1,
        userId: 1,
        department: "SUPER_ADMIN",
        title: "Super Administrator (Owner)",
        clearanceLevel: 10,
        isActive: true,
        roles: ["super-admin"],
        permissions: ["*"],
      },
      hasAnyPermission: () => true,
      hasPermission: () => true,
      isLoading: false,
    } as any);

    const { getByText } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    // In the test mock, t(key, vars, fallback) returns fallback || key,
    // so admin.iam.superAdminOwner resolves with fallback "Super Administrator (Owner)"
    expect(getByText("Super Administrator (Owner)")).toBeDefined();
  });

  it("hides persistent sidebar and uses full width on /admin/mail", () => {
    currentPath = "/admin/mail";
    const { container, queryByTestId } = render(
      <AdminLayout>
        <div data-testid="mail-content">Mail Suite</div>
      </AdminLayout>,
    );

    // Desktop persistent rail is hidden for mail route
    expect(queryByTestId("workspace-sidebar")).toBeNull();

    // Container uses w-full instead of max-w-7xl
    const mailContent = container.querySelector('[data-testid="mail-content"]');
    expect(mailContent).toBeDefined();
    const parentContainer = mailContent?.parentElement;
    expect(parentContainer?.className).toContain("w-full");
    expect(parentContainer?.className).not.toContain("max-w-7xl");
  });

  it("does not link moderators to the admin root they cannot open", () => {
    currentPath = "/admin/content-review";
    mockRole = "MODERATOR";
    const { queryByRole } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    // "/admin" is ADMIN-only, so the breadcrumb must not be a link.
    expect(queryByRole("link", { name: "admin.title" })).toBeNull();
    mockRole = "ADMIN";
  });
});
