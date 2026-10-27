/**
 * Authentication API module.
 * Handles login, register, logout, token refresh, OAuth, password reset, email verification.
 */

import { apiClient } from "./client";
import { AuthProvider, UserRole } from "./types";

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface UserLogin {
  email?: string;
  phoneNumber?: string;
  password: string;
  rememberMe?: boolean;
  turnstileToken?: string;
}

export interface UserRegister {
  fullName: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  provider: AuthProvider;
  role: UserRole;
  acceptedTerms: boolean;
  subscribeNewsletter: boolean;
  turnstileToken?: string;
  honeypot?: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: number;
  fullName: string;
  email?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  role: UserRole;
  profilePictureUrl?: string;
  headline?: string;
  bio?: string;
  country?: string;
  city?: string;
  skills: string[];
  socialLinks?: Record<string, string>;
  primaryOrganizationId?: number;
  provider?: AuthProvider;
  lastLoginAt?: string;
  loginCount?: number;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted?: boolean;
  hasPassword?: boolean;
}

export interface UserProfileResponse extends UserResponse {
  ownedOrganization?: any;
  primaryOrganization?: any;
  memberships: any[];
  certificates: any[];
  enrollments: any[];
  lessonProgresses: any[];
  instructedModules: any[];
}

export interface RegisterResponse {
  message: string;
  user_id: number;
  verification_sent: boolean;
}

export interface OAuthAuthorizeResponse {
  authorization_url: string;
  provider: string;
}

// =============================================================================
// AUTH API METHODS
// =============================================================================

export const authApi = {
  login(data: UserLogin) {
    // skipErrorHandling: true prevents 401 from triggering token refresh
    // — on login, a 401 means invalid credentials, not an expired session.
    return apiClient.post<{
      user: any;
      access_token?: string;
      requires_2fa?: boolean;
      temp_token?: string;
      methods?: { method: string; enabled: boolean; label: string }[];
    }>("/api/auth/login", data, { skipErrorHandling: true });
  },

  register(data: UserRegister) {
    return apiClient.post<RegisterResponse>("/api/auth/register", data);
  },

  logout() {
    return apiClient.post<void>("/api/auth/logout");
  },

  refreshToken() {
    return apiClient.post<Token>("/api/auth/refresh-token");
  },

  getCurrentUserProfile() {
    return apiClient.get<UserProfileResponse>("/api/me");
  },

  getCurrentUserLight() {
    return apiClient.get<UserResponse>("/api/auth/me-light");
  },

  verifyEmail(token: string) {
    return apiClient.post<{ message: string }>("/api/auth/verify-email", {
      token,
    });
  },

  resendVerification(email: string) {
    return apiClient.post<{ message: string }>(
      "/api/auth/resend-verification",
      { email },
    );
  },

  forgotPassword(email: string) {
    return apiClient.post<{ message: string }>("/api/auth/forgot-password", {
      email,
    });
  },

  resetPassword(token: string, newPassword: string) {
    return apiClient.post<{ message: string }>("/api/auth/reset-password", {
      token,
      new_password: newPassword,
    });
  },

  checkEmail(email: string) {
    return apiClient.post<{ available: boolean }>("/api/auth/check-email", {
      email,
    });
  },

  oauthAuthorize(provider: string) {
    return apiClient.get<OAuthAuthorizeResponse>(
      `/api/auth/oauth/${provider}/authorize`,
    );
  },

  oauthCallback(provider: string, code: string, state?: string) {
    return apiClient.post<{ user: UserResponse; tokens: Token }>(
      `/api/auth/oauth/${provider}/callback`,
      { code, state },
    );
  },

  complete2fa(tempToken: string, code: string | any, method = "totp") {
    const totpCode = typeof code === "string" ? code : undefined;
    let assertionResponse = typeof code === "object" ? code : undefined;
    if (method === "webauthn" && typeof code === "string") {
      try {
        assertionResponse = JSON.parse(code);
      } catch {
        // keep as totpCode
      }
    }
    return apiClient.post<{
      user: any;
      message: string;
      access_token?: string;
    }>(
      "/api/auth/complete-2fa-login",
      {
        temp_token: tempToken,
        totp_code: totpCode,
        assertion_response: assertionResponse,
        method,
      },
      { skipErrorHandling: true },
    );
  },

  // ─── MFA / 2FA Management ────────────────────────────────────────────────

  getMfaStatus() {
    return apiClient.get<{
      enabled: boolean;
      methods: { method: string; enabled: boolean; label: string }[];
    }>("/api/mfa/status");
  },

  setupTotp() {
    return apiClient.post<{ secret: string; provisioning_uri: string }>(
      "/api/mfa/totp/setup",
    );
  },

  verifyTotp(code: string, secret: string) {
    return apiClient.post<{ success: boolean; backup_codes: string[] }>(
      "/api/mfa/totp/verify",
      { code, secret },
    );
  },

  disableTotp(password: string) {
    return apiClient.post<{ success: boolean }>("/api/mfa/totp/disable", {
      password,
    });
  },

  sendEmailOtp() {
    return apiClient.post<{ success: boolean; expires_in: number }>(
      "/api/mfa/email/send",
    );
  },

  verifyEmailOtp(code: string) {
    return apiClient.post<{ success: boolean; backup_codes: string[] }>(
      "/api/mfa/email/verify",
      { code },
    );
  },

  webauthnRegisterBegin() {
    return apiClient.post<{ options: any }>("/api/mfa/webauthn/register/begin");
  },

  webauthnRegisterComplete(response: any) {
    return apiClient.post<{ success: boolean; credential_id: string }>(
      "/api/mfa/webauthn/register/complete",
      { response },
    );
  },

  webauthnAuthBegin() {
    return apiClient.post<{ options: any }>("/api/mfa/webauthn/auth/begin");
  },

  webauthnAuthComplete(response: any) {
    return apiClient.post<{
      success: boolean;
      credential_id: string;
      step_up_token?: string;
    }>("/api/mfa/webauthn/auth/complete", { response });
  },

  webauthnLoginBegin(tempToken?: string, email?: string) {
    return apiClient.post<{ options: any; user_id?: number }>(
      "/api/auth/webauthn/login/begin",
      { temp_token: tempToken, email },
      {
        skipErrorHandling: true,
        headers: tempToken ? { "X-Temp-Token": tempToken } : undefined,
      },
    );
  },

  webauthnLoginComplete(tempToken: string, response: any) {
    return apiClient.post<{
      user: any;
      message: string;
      access_token?: string;
      refresh_token?: string;
    }>(
      "/api/auth/webauthn/login/complete",
      { temp_token: tempToken, response },
      { skipErrorHandling: true },
    );
  },

  getBackupCodes() {
    return apiClient.get<{ remaining: number }>("/api/mfa/backup-codes");
  },

  regenerateBackupCodes() {
    return apiClient.post<{ codes: string[] }>(
      "/api/mfa/backup-codes/regenerate",
    );
  },

  disableMfa(password: string) {
    return apiClient.post<{ success: boolean }>("/api/mfa/disable", {
      password,
    });
  },
};
