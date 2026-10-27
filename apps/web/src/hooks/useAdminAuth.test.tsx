import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminAuth } from "./useAdminAuth";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

describe("useAdminAuth", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("fetches admin profile and returns permission check functions for super admin", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      id: 1,
      userId: 10,
      department: "SUPER_ADMIN",
      title: "Chief Executive Officer",
      clearanceLevel: 5,
      isActive: true,
      roles: ["super-admin"],
      permissions: ["*"],
    });

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile?.department).toBe("SUPER_ADMIN");
    expect(result.current.hasPermission("users.ban")).toBe(true);
    expect(result.current.hasPermission("security.audit_read")).toBe(true);
    expect(
      result.current.hasAnyPermission(["payments.refund", "some.nonexistent"]),
    ).toBe(true);
  });

  it("evaluates granular permissions correctly for standard sub-admin", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      id: 2,
      userId: 20,
      department: "COMPLIANCE_LEGAL",
      title: "AML Officer",
      clearanceLevel: 3,
      isActive: true,
      roles: ["compliance-officer"],
      permissions: [
        "users.kyc_verify",
        "users.kyc_reject",
        "security.audit_read",
      ],
    });

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile?.roles).toContain("compliance-officer");
    expect(result.current.hasPermission("users.kyc_verify")).toBe(true);
    expect(result.current.hasPermission("settings.edit")).toBe(false);
    expect(
      result.current.hasAnyPermission(["settings.edit", "users.kyc_verify"]),
    ).toBe(true);
    expect(
      result.current.hasAnyPermission(["settings.edit", "payouts.approve"]),
    ).toBe(false);
  });
});
