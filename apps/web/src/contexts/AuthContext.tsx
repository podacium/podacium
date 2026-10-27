/**
 * AuthContext — Session management only.
 * Handles: login, logout, session verification, authentication state.
 *
 * Profile/skills/settings are in UserContext and SettingsContext.
 */
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  api,
  UserProfileResponse,
  AuthenticationError,
  handleApiError,
} from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

// =============================================================================
// COOKIE UTILITIES
// =============================================================================

const AUTH_HINT_COOKIE = "podacium_auth_hint";
const ONBOARDING_DONE_COOKIE = "podacium_onboarding_done";

function setAuthHintCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_HINT_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearAuthHintCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_HINT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function hasAuthHintCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => {
    const trimmed = c.trim();
    return (
      trimmed.startsWith(`${AUTH_HINT_COOKIE}=`) ||
      trimmed.startsWith("access_token=") ||
      trimmed.startsWith("__Host-access_token=")
    );
  });
}

export function setOnboardingDoneCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDING_DONE_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearOnboardingDoneCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDING_DONE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasOnboardingDoneCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${ONBOARDING_DONE_COOKIE}=`));
}

// =============================================================================
// CONTEXT TYPE
// =============================================================================

export type LoginResult =
  | { requires_2fa: false; user: UserProfileResponse }
  | {
      requires_2fa: true;
      temp_token: string;
      methods: { method: string; enabled: boolean; label: string }[];
    };

export interface AuthContextType {
  user: UserProfileResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  verifying: boolean;
  error: string | null;
  deletionPending: boolean;

  login: (
    email: string,
    password: string,
    remember?: boolean,
    turnstileToken?: string,
  ) => Promise<LoginResult>;
  completeTwoFactor: (
    tempToken: string,
    code: string,
    method?: string,
  ) => Promise<UserProfileResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  updateOnboardingStatus: (completed: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

const DELETION_PENDING_COOKIE = "deletion_pending";

function setDeletionPendingCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${DELETION_PENDING_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearDeletionPendingCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${DELETION_PENDING_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function broadcastAuthEvent(event: {
  type: "LOGIN" | "LOGOUT";
  timestamp: number;
}) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel("podacium_auth_bus");
    channel.postMessage(event);
    channel.close();
  } catch {
    // BroadcastChannel unsupported or blocked
  }
  try {
    localStorage.setItem("podacium_auth_event", JSON.stringify(event));
  } catch {
    // LocalStorage quota or blocked
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  // Initialized to false to avoid SSR/CSR hydration mismatches; updated on client mount
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletionPending, setDeletionPending] = useState(false);
  const t = useTranslations("auth");

  const clearError = useCallback(() => setError(null), []);

  // Check deletion request status and sync the deletion_pending cookie
  const syncDeletionStatus = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (!hasAuthHintCookie() && !isAuthenticated) return;
    if (!isAuthenticated) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/users/me/delete-request`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.has_pending_request) {
          setDeletionPending(true);
          setDeletionPendingCookie();
        } else {
          setDeletionPending(false);
          clearDeletionPendingCookie();
        }
        return;
      }
      if (res.status === 401) {
        clearAuthHintCookie();
        clearDeletionPendingCookie();
        setDeletionPending(false);
        setIsAuthenticated(false);
        return;
      }
      // Non-OK response (e.g. 404, 500) — preserve cookie if backend is temporarily down
      if (res.status !== 404) {
        return;
      }
    } catch {
      console.warn(
        "[Auth] syncDeletionStatus network error — preserving cookie",
      );
    }
  }, [isAuthenticated]);

  // Purge legacy localStorage tokens on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sensitiveKeys = [
      "access_token",
      "refresh_token",
      "user",
      "user_profile",
      "user_stats",
      "user_skills",
      "auth_initialized",
    ];
    sensitiveKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }, []);

  // Initialize session from HTTP-only cookie (uses lightweight endpoint)
  const initializeAuth = useCallback(async () => {
    if (typeof document !== "undefined" && !hasAuthHintCookie()) {
      setLoading(false);
      setVerifying(false);
      return;
    }

    setLoading(true);
    setVerifying(true);

    try {
      const userData = await api.getCurrentUserLight();
      const partialUser: UserProfileResponse = {
        id: userData.id,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role as any,
        onboardingCompleted: userData.onboardingCompleted ?? false,
        emailVerified: userData.emailVerified,
        phoneVerified: userData.phoneVerified,
        profilePictureUrl: userData.profilePictureUrl,
        phoneNumber: undefined,
        bio: undefined,
        country: undefined,
        city: undefined,
        skills: [],
        socialLinks: undefined,
        primaryOrganizationId: undefined,
        provider: undefined,
        lastLoginAt: undefined,
        loginCount: 0,
        createdAt: "",
        updatedAt: "",
        hasPassword: false,
        memberships: [],
        certificates: [],
        enrollments: [],
        lessonProgresses: [],
        instructedModules: [],
      };
      setUser(partialUser);
      setIsAuthenticated(true);
      setAuthHintCookie();
      if (partialUser.onboardingCompleted) {
        setOnboardingDoneCookie();
      } else {
        clearOnboardingDoneCookie();
      }

      // Check deletion status in background (non-blocking)
      syncDeletionStatus();

      // Fetch full profile in background (non-blocking)
      try {
        api
          .getCurrentUserProfile?.()
          ?.then((fullProfile: any) => {
            if (fullProfile) setUser(fullProfile);
          })
          ?.catch(() => {
            console.warn("[Auth] failed to fetch full profile during mount");
          });
      } catch {
        // ignore background fetch failure
      }
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 401) {
        console.warn("[Auth] session init failed — user not authenticated");
        setIsAuthenticated(false);
        setUser(null);
        clearAuthHintCookie();
        clearOnboardingDoneCookie();
        clearDeletionPendingCookie();
      } else {
        console.warn(
          `[Auth] session init transient failure (status ${status}) — preserving session state`,
        );
      }
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  }, [syncDeletionStatus]);

  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multi-tab session synchronization via BroadcastChannel and StorageEvent
  useEffect(() => {
    if (typeof window === "undefined") return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("podacium_auth_bus");
      channel.onmessage = (event) => {
        if (event.data?.type === "LOGOUT") {
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
        } else if (event.data?.type === "LOGIN") {
          initializeAuth();
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "podacium_auth_event" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.type === "LOGOUT") {
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
          } else if (parsed.type === "LOGIN") {
            initializeAuth();
          }
        } catch {
          // JSON parse error
        }
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [initializeAuth]);

  // Login
  const login = async (
    email: string,
    password: string,
    remember = true,
    turnstileToken?: string,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const loginResponse = await api.login({
        email,
        password,
        rememberMe: remember,
        turnstileToken,
      });

      // Check if 2FA is required
      if (loginResponse.requires_2fa) {
        return {
          requires_2fa: true as const,
          temp_token: loginResponse.temp_token as string,
          methods: loginResponse.methods as {
            method: string;
            enabled: boolean;
            label: string;
          }[],
        };
      }

      const userData = loginResponse.user;

      // Build a minimal profile from the login response
      const partialUser: UserProfileResponse = {
        id: userData.id,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        onboardingCompleted: userData.onboardingCompleted ?? false,
        emailVerified: false,
        phoneVerified: false,
        phoneNumber: undefined,
        profilePictureUrl: undefined,
        bio: undefined,
        country: undefined,
        city: undefined,
        skills: [],
        socialLinks: undefined,
        primaryOrganizationId: undefined,
        provider: undefined,
        lastLoginAt: undefined,
        loginCount: 0,
        createdAt: "",
        updatedAt: "",
        hasPassword: false,
        memberships: [],
        certificates: [],
        enrollments: [],
        lessonProgresses: [],
        instructedModules: [],
      };

      setUser(partialUser);
      setIsAuthenticated(true);
      setAuthHintCookie();
      broadcastAuthEvent({ type: "LOGIN", timestamp: Date.now() });
      if (partialUser.onboardingCompleted) {
        setOnboardingDoneCookie();
      } else {
        clearOnboardingDoneCookie();
      }

      // Check deletion status
      syncDeletionStatus();

      // Fetch full profile in the background (non-blocking)
      try {
        api
          .getCurrentUserProfile?.()
          ?.then((fullProfile: any) => {
            if (fullProfile) setUser(fullProfile);
          })
          ?.catch(() => {
            console.warn("[Auth] failed to fetch full profile after login");
          });
      } catch {
        // ignore background fetch failure
      }

      return { requires_2fa: false as const, user: partialUser };
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Complete 2FA login
  const completeTwoFactor = async (
    tempToken: string,
    code: string,
    method: string = "totp",
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.complete2fa(tempToken, code, method);
      const userData = response.user;

      const partialUser: UserProfileResponse = {
        id: userData.id,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        onboardingCompleted: userData.onboardingCompleted ?? false,
        emailVerified: false,
        phoneVerified: false,
        phoneNumber: undefined,
        profilePictureUrl: undefined,
        bio: undefined,
        country: undefined,
        city: undefined,
        skills: [],
        socialLinks: undefined,
        primaryOrganizationId: undefined,
        provider: undefined,
        lastLoginAt: undefined,
        loginCount: 0,
        createdAt: "",
        updatedAt: "",
        hasPassword: false,
        memberships: [],
        certificates: [],
        enrollments: [],
        lessonProgresses: [],
        instructedModules: [],
      };

      setUser(partialUser);
      setIsAuthenticated(true);
      setAuthHintCookie();
      broadcastAuthEvent({ type: "LOGIN", timestamp: Date.now() });
      if (partialUser.onboardingCompleted) {
        setOnboardingDoneCookie();
      } else {
        clearOnboardingDoneCookie();
      }

      syncDeletionStatus();

      api
        .getCurrentUserProfile()
        .then((fullProfile) => {
          setUser(fullProfile);
        })
        .catch(() => {
          console.warn("[Auth] failed to fetch full profile after 2FA");
        });

      return partialUser;
    } catch (error) {
      const errorMessage = handleApiError(error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.logout();
    } catch {
      console.warn(
        "[Auth] logout API call failed — clearing local session anyway",
      );
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setDeletionPending(false);
      clearAuthHintCookie();
      clearOnboardingDoneCookie();
      clearDeletionPendingCookie();
      broadcastAuthEvent({ type: "LOGOUT", timestamp: Date.now() });
      setLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = useCallback(async () => {
    setError(null);
    try {
      const userProfileData = await api.getCurrentUserProfile();
      setUser(userProfileData);
      setIsAuthenticated(true);
      setAuthHintCookie();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        setUser(null);
        setIsAuthenticated(false);
        clearAuthHintCookie();
        setError(t("sessionExpired"));
      } else {
        setError(handleApiError(error));
        throw error;
      }
    }
  }, []);

  // Update onboarding status
  const updateOnboardingStatus = useCallback((completed: boolean) => {
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, onboardingCompleted: completed };
    });
    if (completed) {
      setOnboardingDoneCookie();
    } else {
      clearOnboardingDoneCookie();
    }
  }, []);

  // Auto-refresh session every 15 minutes
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(
      () => {
        refreshUser().catch(() => logout());
      },
      15 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAuthenticated,
      verifying,
      error,
      deletionPending,
      login,
      completeTwoFactor,
      logout,
      refreshUser,
      clearError,
      updateOnboardingStatus,
    }),
    [
      user,
      loading,
      isAuthenticated,
      verifying,
      error,
      deletionPending,
      login,
      completeTwoFactor,
      logout,
      refreshUser,
      clearError,
      updateOnboardingStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// =============================================================================
// HOOKS
// =============================================================================

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useOptionalAuth = (): AuthContextType | undefined => {
  return useContext(AuthContext);
};
