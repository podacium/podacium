"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { usersApi, handleApiError } from "@/lib/api";
import type {
  DashboardResponse,
  DashboardState,
  ViewConfig,
} from "@/lib/api/users";

interface RefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  error: string | null;
}

export function useDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("user");

  const [state, setState] = useState<DashboardState | null>(null);
  const [viewConfig, setViewConfig] = useState<ViewConfig | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<RefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    error: null,
  });

  const fetchData = useCallback(async (forceRefresh = false) => {
    setError(null);
    setRefreshState((prev) => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await usersApi.getDashboard(forceRefresh);
      setState(response.state);
      setViewConfig(response.view_config);
      setRole(response.role);
      setRefreshState({
        isRefreshing: false,
        lastRefresh: new Date(),
        error: null,
      });
    } catch (err) {
      const msg = handleApiError(err);
      setError(msg);
      setRefreshState((prev) => ({ ...prev, isRefreshing: false, error: msg }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, fetchData]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login/?redirect=/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return {
    state,
    viewConfig,
    role,
    user,
    loading,
    error,
    refreshState,
    refresh,
  };
}
