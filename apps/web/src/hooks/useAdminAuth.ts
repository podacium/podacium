// apps/web/src/hooks/useAdminAuth.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AdminSessionInfo {
  id: number;
  userId: number;
  department: string;
  title: string;
  clearanceLevel: number;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export function useAdminAuth() {
  const query = useQuery<AdminSessionInfo>({
    queryKey: ["admin", "session-profile"],
    queryFn: async () => {
      const res = await api.get<AdminSessionInfo>("/api/v1/admin/iam/me");
      return res;
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const hasPermission = (permission: string): boolean => {
    if (query.data) {
      if (
        query.data.roles.includes("super-admin") ||
        query.data.department === "SUPER_ADMIN" ||
        query.data.permissions.includes("*")
      ) {
        return true;
      }
      return query.data.permissions.includes(permission);
    }
    // FAIL-CLOSED: While query is loading, in error, or unauthenticated, deny permission
    return false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some((p) => hasPermission(p));
  };

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    hasPermission,
    hasAnyPermission,
  };
}
