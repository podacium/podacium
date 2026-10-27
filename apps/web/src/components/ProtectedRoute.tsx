"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, hasOnboardingDoneCookie } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
  requiredRole?: string | string[];
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = "/auth/login/",
  fallback,
  requiredRole,
}: ProtectedRouteProps): JSX.Element | null {
  const t = useTranslations("auth");
  const { isAuthenticated, loading, verifying, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  const hasRequiredRole = useCallback(() => {
    if (!requiredRole) return true;
    if (!user?.role) return false;
    const roles = (
      Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    ).map((r) => r.toUpperCase());
    const userRole = user.role.toUpperCase();
    if (
      roles.includes("ADMIN") &&
      (userRole === "SUPERADMIN" || userRole === "SUPER_ADMIN")
    ) {
      return true;
    }
    return roles.includes(userRole);
  }, [requiredRole, user]);

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !isAuthenticated) {
        router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!requireAuth && isAuthenticated) {
        router.push("/");
        return;
      }

      if (requireAuth && isAuthenticated && !hasRequiredRole()) {
        router.push("/unauthorized");
        return;
      }

      // Onboarding guard: redirect to onboarding if not completed (or undefined for legacy cached sessions)
      // Skip if the cookie hint confirms onboarding is done (avoids flash during stale cache)
      if (
        requireAuth &&
        isAuthenticated &&
        user &&
        (user.onboardingCompleted === false ||
          user.onboardingCompleted === undefined) &&
        !hasOnboardingDoneCookie() &&
        !pathname.startsWith("/onboarding") &&
        pathname !== "/auth/complete-profile"
      ) {
        router.push("/onboarding");
        return;
      }

      // Reverse Onboarding guard: don't allow already completed users to stay on onboarding page
      if (
        requireAuth &&
        isAuthenticated &&
        user?.onboardingCompleted === true &&
        pathname.startsWith("/onboarding")
      ) {
        router.push("/dashboard");
        return;
      }

      setIsAuthorized(true);
    }
  }, [
    isAuthenticated,
    loading,
    requireAuth,
    redirectTo,
    router,
    pathname,
    hasRequiredRole,
    user,
  ]);

  if (loading) return null;

  if (verifying) {
    return (
      (fallback as JSX.Element) || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900/60">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 dark:text-slate-400 text-sm">
              {t("protectedRoute.verifying")}
            </p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthorized) return (fallback as JSX.Element) || null;

  if (requireAuth && isAuthenticated && !hasRequiredRole()) {
    return (
      (fallback as JSX.Element) || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900/60">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 text-6xl mb-4">
              ⛔
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("protectedRoute.accessDenied")}
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
              {t("protectedRoute.noPermission")}
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

// Convenience wrappers
export const AuthRequired = ({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string | string[];
}): JSX.Element => (
  <ProtectedRoute requireAuth={true} requiredRole={role}>
    {children}
  </ProtectedRoute>
);

export const GuestOnly = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element => (
  <ProtectedRoute requireAuth={false}>{children}</ProtectedRoute>
);

export default ProtectedRoute;
