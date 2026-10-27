// components/course/AccessControl.tsx
"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export enum AccessState {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  AUTHENTICATED_NOT_ENROLLED = "AUTHENTICATED_NOT_ENROLLED",
  ENROLLED = "ENROLLED",
}

interface AccessControlProps {
  children: React.ReactNode;
  allowedStates: AccessState[];
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  requireEnrollment?: boolean;
  requireAuthentication?: boolean;
  courseEnrollment?: any;
}

/**
 * Enterprise-grade Access Control Component
 *
 * This component controls access to course content based on authentication
 * and enrollment status. It supports multiple access states and provides
 * appropriate fallbacks.
 */
const AccessControl: React.FC<AccessControlProps> = ({
  children,
  allowedStates,
  fallback = null,
  loadingFallback = (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  ),
  requireEnrollment = false,
  requireAuthentication = false,
  courseEnrollment,
}) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslations("component");

  // Determine current access state
  const getCurrentAccessState = (): AccessState => {
    if (!isAuthenticated || !user) {
      return AccessState.UNAUTHENTICATED;
    }

    if (requireEnrollment) {
      const isEnrolled =
        courseEnrollment !== null && courseEnrollment !== undefined;
      if (!isEnrolled) {
        return AccessState.AUTHENTICATED_NOT_ENROLLED;
      }
      return AccessState.ENROLLED;
    }

    // If enrollment is not required but authentication is
    if (requireAuthentication && isAuthenticated) {
      return AccessState.ENROLLED; // Treat authenticated as "enrolled" for non-enrollment required content
    }

    // Default fallback
    return isAuthenticated ? AccessState.ENROLLED : AccessState.UNAUTHENTICATED;
  };

  // Show loading state while authentication is being checked
  if (authLoading) {
    return <>{loadingFallback}</>;
  }

  const currentState = getCurrentAccessState();
  const hasAccess = allowedStates.includes(currentState);

  // Render children if access is granted
  if (hasAccess) {
    return <>{children}</>;
  }

  // Render fallback if no access
  return <>{fallback}</>;
};

/**
 * Higher-order component for protecting course content
 */
export const withAccessControl = <P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AccessControlProps, "children">,
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <AccessControl {...options}>
        <Component {...props} />
      </AccessControl>
    );
  };

  WrappedComponent.displayName = `WithAccessControl(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

/**
 * Utility hook for checking access permissions
 */
export const useAccessControl = (
  enrollment?: any,
  requireEnrollment: boolean = false,
) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const getAccessState = (): AccessState => {
    if (!isAuthenticated || !user) {
      return AccessState.UNAUTHENTICATED;
    }

    if (requireEnrollment) {
      const isEnrolled = enrollment !== null && enrollment !== undefined;
      if (!isEnrolled) {
        return AccessState.AUTHENTICATED_NOT_ENROLLED;
      }
      return AccessState.ENROLLED;
    }

    return isAuthenticated ? AccessState.ENROLLED : AccessState.UNAUTHENTICATED;
  };

  const hasAccess = (allowedStates: AccessState[]): boolean => {
    if (authLoading) return false;
    return allowedStates.includes(getAccessState());
  };

  const getPermissions = () => {
    const state = getAccessState();

    const basePermissions = {
      UNAUTHENTICATED: {
        canViewLesson: false,
        canTakeQuiz: false,
        canDownloadResources: false,
        canGenerateCertificate: false,
        canAccessAnalytics: false,
        canSaveProgress: false,
        canRequestSupport: false,
      },
      AUTHENTICATED_NOT_ENROLLED: {
        canViewLesson: false,
        canTakeQuiz: false,
        canDownloadResources: false,
        canGenerateCertificate: false,
        canAccessAnalytics: false,
        canSaveProgress: false,
        canRequestSupport: true,
      },
      ENROLLED: {
        canViewLesson: true,
        canTakeQuiz: true,
        canDownloadResources: true,
        canGenerateCertificate: true,
        canAccessAnalytics: true,
        canSaveProgress: true,
        canRequestSupport: true,
      },
    };

    return basePermissions[state];
  };

  return {
    accessState: getAccessState(),
    hasAccess,
    getPermissions,
    isAuthenticated,
    isLoading: authLoading,
    user,
  };
};

/**
 * Simple wrapper for rendering content based on enrollment
 */
export const IfEnrolled: React.FC<{
  children: React.ReactNode;
  enrollment: any;
  fallback?: React.ReactNode;
}> = ({ children, enrollment, fallback = null }) => {
  if (enrollment) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

/**
 * Simple wrapper for rendering content based on authentication
 */
export const IfAuthenticated: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback = null }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

/**
 * Component for showing locked content message
 */
export const LockedContent: React.FC<{
  title?: string;
  message?: string;
  action?: React.ReactNode;
}> = ({ title, message, action }) => {
  const { t } = useTranslations("component");

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
        {title || t("compcourse.accessControl.contentLocked")}
      </h3>
      <p className="text-gray-600 dark:text-slate-400 mb-6">
        {message || t("compcourse.accessControl.lockedMessage")}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default AccessControl;
