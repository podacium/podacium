// src/hooks/useAuthGuard.ts
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useRouter, usePathname } from "next/navigation";

interface UseAuthGuardOptions {
  redirectTo?: string;
  showModal?: boolean;
  requireAuth?: boolean;
  loading?: boolean;
}

export const useAuthGuard = (options: UseAuthGuardOptions = {}) => {
  const {
    redirectTo = "/auth/login/",
    showModal = true,
    requireAuth = true,
  } = options;

  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!requireAuth) return;

    if (!loading && !isAuthenticated) {
      if (showModal) {
        // Show modal first instead of immediate redirect
        setShowAuthModal(true);

        // Auto-redirect after 8 seconds if user doesn't act
        const timer = setTimeout(() => {
          setShouldRedirect(true);
        }, 8000);

        return () => clearTimeout(timer);
      } else {
        // Immediate redirect if modal is disabled
        const baseRedirect = redirectTo.endsWith("/")
          ? redirectTo
          : `${redirectTo}/`;
        const redirectUrl = `${baseRedirect}?redirect=${encodeURIComponent(pathname)}`;
        router.push(redirectUrl);
      }
    }
  }, [
    isAuthenticated,
    loading,
    router,
    redirectTo,
    showModal,
    requireAuth,
    pathname,
  ]);

  // Handle the actual redirect
  useEffect(() => {
    if (shouldRedirect) {
      const baseRedirect = redirectTo.endsWith("/")
        ? redirectTo
        : `${redirectTo}/`;
      const redirectUrl = `${baseRedirect}?redirect=${encodeURIComponent(pathname)}`;
      router.push(redirectUrl);
    }
  }, [shouldRedirect, router, redirectTo, pathname]);

  const handleLogin = () => {
    setShowAuthModal(false);
    const redirectUrl = `/auth/login/?redirect=${encodeURIComponent(pathname)}`;
    router.push(redirectUrl);
  };

  const handleSignup = () => {
    setShowAuthModal(false);
    const redirectUrl = `/auth/signup/?redirect=${encodeURIComponent(pathname)}`;
    router.push(redirectUrl);
  };

  const handleClose = () => {
    setShowAuthModal(false);
    setShouldRedirect(true); // Start redirect when user closes modal
  };

  const handleContinueWithoutAuth = () => {
    setShowAuthModal(false);
    // Allow user to continue without authentication
  };

  return {
    isAuthenticated,
    loading,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
    handleContinueWithoutAuth,
  };
};

// Convenience hook for protected routes
export const useProtectedRoute = (redirectTo?: string) => {
  return useAuthGuard({ redirectTo, showModal: true, requireAuth: true });
};

// Convenience hook for optional auth routes
export const useOptionalAuthGuard = () => {
  return useAuthGuard({ showModal: false, requireAuth: false });
};
