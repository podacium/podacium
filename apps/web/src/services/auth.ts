// AuthService with enhanced error handling, TypeScript types, and better architecture

export interface SignupData {
  fullName: string;
  email: string;
  password: string;
  provider?: "EMAIL" | "GOOGLE" | "GITHUB" | "LINKEDIN" | "PHONE";
  acceptedTerms: boolean;
  subscribeNewsletter: boolean;
  phoneNumber?: string;
  role?: "STUDENT" | "BUSINESS" | "FREELANCER" | "ADMIN" | "INSTRUCTOR";
  locale?: string;
  turnstileToken?: string;
  honeypot?: string;
}

export interface LoginData {
  email?: string;
  phoneNumber?: string;
  password: string;
  rememberMe?: boolean;
  turnstileToken?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

export interface User {
  id: number;
  fullName: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
  role: string;
  profilePictureUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SignupResponse {
  message: string;
  user_id: number;
  verification_sent: boolean;
}

export interface EmailAvailabilityResponse {
  available: boolean;
}

// Custom error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public details?: any,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export interface UserProfile {
  id: number;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
  role: string;
  fullName: string;
  profilePictureUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  skills: string[];
  socialLinks: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  ownedOrganization: any | null;
  primaryOrganization: any | null;
  memberships: any[];
}

export interface UserUpdateData {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  bio?: string;
  country?: string;
  city?: string;
  profilePictureUrl?: string;
  skills?: string[];
  socialLinks?: Record<string, string>;
}

export class TokenExpiredError extends Error {
  constructor(message?: string) {
    super(message ?? ["Token", "has", "expired"].join(" "));
    this.name = "TokenExpiredError";
  }
}

// ========== Dev-Only Logger ==========
// All debug logging is stripped in production builds.
// In development, logs omit sensitive fields (passwords, tokens).
const isDev = process.env.NODE_ENV === "development";

function devLog(label: string, data?: Record<string, unknown>): void {
  if (!isDev) return;
  if (data) {
    // Strip any sensitive keys before logging
    const safe = { ...data };
    delete safe.password;
    delete safe.access_token;
    delete safe.refresh_token;
    delete safe.token;
    delete safe.credentials;
    delete safe.body;
  }
}

function devWarn(label: string, error?: unknown): void {
  if (!isDev) return;
  console.warn(
    `[Auth:${label}]`,
    error instanceof Error ? error.message : error,
  );
}

function devError(label: string, error?: unknown): void {
  if (!isDev) return;
  console.error(
    `[Auth:${label}]`,
    error instanceof Error ? error.message : error,
  );
}

// Constants
const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  TOKEN_EXPIRES_AT: "access_token_expires_at",
  USER_DATA: "user",
} as const;

const DEFAULT_TIMEOUT = 10000;
const REFRESH_TIMEOUT = 15000;

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = this.getBaseUrl();
  }

  // ========== URL Helpers ==========
  private getBaseUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    // Remove trailing slash if present
    return baseUrl.replace(/\/$/, "");
  }

  private getApiUrl(path: string): string {
    // Ensure path starts with /api
    const normalizedPath = path.startsWith("/api") ? path : `/api${path}`;
    const fullUrl = `${this.baseUrl}${normalizedPath}`;

    return fullUrl;
  }

  // ========== CSRF Token ==========
  private inMemoryCsrfToken: string | null = null;

  private getCsrfToken(): string | null {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return this.inMemoryCsrfToken;
  }

  // ========== Enhanced Fetch Wrapper ==========
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Attach CSRF token for state-changing requests (Double-Submit Cookie pattern)
    const csrfHeaders: Record<string, string> = {};
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        csrfHeaders["X-CSRF-Token"] = csrfToken;
      }
    }

    const localeCookie =
      typeof document !== "undefined"
        ? document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)?.[1]
        : undefined;
    const langHeaders: Record<string, string> = localeCookie
      ? { "Accept-Language": localeCookie }
      : {};

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...langHeaders,
          ...csrfHeaders,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      const token =
        response.headers.get("x-csrf-token") ||
        response.headers.get("X-CSRF-Token");
      if (token) {
        this.inMemoryCsrfToken = token;
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new NetworkError(`Request timeout after ${timeout}ms`);
        }
        if (error.message.includes("Failed to fetch")) {
          throw new NetworkError(
            "Cannot connect to server. Please check your network connection.",
          );
        }
      }

      throw error;
    }
  }

  // ========== Error Handling ==========
  private async handleErrorResponse(
    response: Response,
    context: string,
  ): Promise<never> {
    let errorText = `HTTP ${response.status}: ${response.statusText}`;
    let errorData: any;

    try {
      const responseText = await response.text();
      errorText = responseText;
      errorData = JSON.parse(responseText);
    } catch {
      errorData = {
        detail: errorText,
        status: response.status,
      };
    }

    // Extract error message and code
    let errorMessage = `${context} failed`;
    let errorCode: string | undefined;

    if (typeof errorData.detail === "string") {
      errorMessage = errorData.detail;
    } else if (errorData.detail && typeof errorData.detail === "object") {
      errorMessage =
        errorData.detail.message || errorData.detail.detail || errorMessage;
      errorCode = errorData.detail.code;
    } else if (Array.isArray(errorData.detail)) {
      errorMessage = errorData.detail
        .map((err: any) => `${err.loc?.join(".")}: ${err.msg}`)
        .join(", ");
    } else if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.error) {
      errorMessage = errorData.error;
    }

    throw new AuthError(
      errorMessage,
      errorCode || errorData.code,
      response.status,
      errorData,
    );
  }

  private handleNetworkError(error: unknown, context: string): never {
    if (error instanceof AuthError || error instanceof NetworkError) {
      throw error;
    }

    if (error instanceof TypeError) {
      if (error.message.includes("Failed to fetch")) {
        throw new NetworkError(
          `Network error: Cannot connect to server. Please check:\n• Backend server is running\n• CORS is configured\n• Network connectivity`,
        );
      }
      if (error.message.includes("aborted")) {
        throw new NetworkError(
          "Request timeout: Server took too long to respond. Please try again.",
        );
      }
    }

    if (error instanceof Error) {
      if (
        error.message.includes("CORS") ||
        error.message.includes("cross-origin")
      ) {
        throw new NetworkError(
          "CORS error: Backend is not configured to accept requests from this origin.",
        );
      }
      throw new AuthError(`${context}: ${error.message}`);
    }

    throw new AuthError(
      `An unexpected error occurred during ${context.toLowerCase()}`,
    );
  }

  // ========== Token & Storage Utilities ==========
  // SECURITY (P0): Bearer tokens must NEVER be persisted in JS-readable
  // storage (localStorage/sessionStorage) — that is an XSS session-takeover
  // vector. The active production authentication flow (AuthContext + HTTP-only
  // cookies + refresh rotation) is the only token mechanism used by the app;
  // this legacy service is retained only for flows that do not issue tokens
  // (signup, resend verification, forgot/reset password). setTokens is a no-op
  // so nothing can silently regress into client-side token persistence.
  private setTokens(_authData: AuthResponse, _remember: boolean = true): void {
    return;
  }

  private clearTokens(): void {
    if (!this.isBrowser()) return;

    const keys = Object.values(STORAGE_KEYS);

    keys.forEach((key) => {
      if (key !== STORAGE_KEYS.USER_DATA) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    });
  }

  private setUserData(user: User, remember: boolean = true): void {
    if (!this.isBrowser()) return;

    const storage = remember ? localStorage : sessionStorage;

    try {
      storage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch (error) {
      devWarn("UserDataPersistence", error);
    }
  }

  private clearUserData(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    sessionStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  public getAccessToken(): string | null {
    // SECURITY (P0): tokens are HTTP-only cookies handled by AuthContext.
    // Nothing may read a bearer token from JS-readable persistent storage.
    return null;
  }

  public getRefreshToken(): string | null {
    // SECURITY (P0): refresh tokens are HTTP-only cookies — never exposed to JS.
    return null;
  }

  public isTokenExpired(): boolean {
    if (!this.isBrowser()) return true;

    const expiresAt =
      localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT) ||
      sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!expiresAt) return true;

    return Date.now() > parseInt(expiresAt, 10) - 5 * 60 * 1000;
  }

  private getStorageType(): "local" | "session" {
    if (!this.isBrowser()) return "session";
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
      ? "local"
      : "session";
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined" && !!window.localStorage;
  }

  // ========== Public API ==========
  public getStoredUser(): User | null {
    if (!this.isBrowser()) return null;

    try {
      const userData =
        localStorage.getItem(STORAGE_KEYS.USER_DATA) ||
        sessionStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  public isAuthenticated(): boolean {
    return !!this.getAccessToken() && !this.isTokenExpired();
  }

  public async refreshToken(): Promise<AuthResponse> {
    return this.refreshTokenInternal();
  }

  // ========== Signup ==========
  async signup(data: SignupData): Promise<SignupResponse> {
    const url = this.getApiUrl("/auth/register");
    const payload: Record<string, any> = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      provider: data.provider || "EMAIL",
      acceptedTerms: data.acceptedTerms,
      subscribeNewsletter: data.subscribeNewsletter,
      phoneNumber: data.phoneNumber,
      role: data.role || "STUDENT",
    };

    if (data.locale) {
      payload.locale = data.locale;
    }
    if (data.turnstileToken) {
      payload.turnstileToken = data.turnstileToken;
    }
    if (data.honeypot) {
      payload.honeypot = data.honeypot;
    }

    devLog("SignupRequest", { url, timestamp: new Date().toISOString() });

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        15000,
      );

      devLog("SignupResponse", { status: response.status, ok: response.ok });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Registration");
      }

      const result: SignupResponse = await response.json();
      devLog("SignupSuccess", {
        userId: result?.user_id,
        verificationSent: result?.verification_sent,
      });
      return result;
    } catch (error) {
      devError("Signup", error);
      this.handleNetworkError(error, "Registration");
    }
  }

  // ========== Login ==========
  async login(credentials: LoginData): Promise<AuthResponse> {
    const url = this.getApiUrl("/auth/login");

    devLog("LoginRequest", { url, timestamp: new Date().toISOString() });

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify(credentials),
      });

      devLog("LoginResponse", { status: response.status, ok: response.ok });

      if (!response.ok) {
        let errorData: any;
        try {
          const responseText = await response.text();
          errorData = responseText ? JSON.parse(responseText) : {};
        } catch {
          errorData = {
            detail: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        let errorMessage = "Login failed. Please try again.";
        let errorCode = "AUTH_FAILED";

        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (errorData.detail && typeof errorData.detail === "object") {
          errorMessage = errorData.detail.message || errorMessage;
          errorCode = errorData.detail.code || errorCode;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        throw new AuthError(
          errorMessage,
          errorCode,
          response.status,
          errorData,
        );
      }

      const authData: AuthResponse = await response.json();
      devLog("LoginSuccess", {
        token_type: authData.token_type,
        expires_in: authData.expires_in,
      });

      this.setTokens(authData, credentials.rememberMe ?? true);
      return authData;
    } catch (error) {
      devError("Login", error);

      if (error instanceof AuthError) {
        throw error;
      }

      this.handleNetworkError(error, "Login");
    }
  }

  // ========== Logout ==========
  async logout(): Promise<void> {
    if (!this.isBrowser()) return;

    try {
      const token = this.getAccessToken();
      if (token) {
        try {
          await this.fetchWithTimeout(
            this.getApiUrl("/auth/logout"),
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
            5000,
          );
        } catch (error) {
          devWarn("LogoutEndpoint", error);
        }
      }
    } catch (error) {
      devWarn("Logout", error);
    } finally {
      this.clearTokens();
      this.clearUserData();
    }
  }

  // ========== Current User ==========
  async getCurrentUser(): Promise<User> {
    const token = this.getAccessToken();
    const url = this.getApiUrl("/auth/me");

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Fetch user data");
      }

      const userData: User = await response.json();

      const isLocal = this.getStorageType() === "local";
      this.setUserData(userData, isLocal);

      return userData;
    } catch (error) {
      devError("GetCurrentUser", error);

      if (error instanceof AuthError && error.status === 401) {
        this.clearTokens();
      }

      throw error;
    }
  }

  // ========== Token Refresh ==========
  private async refreshTokenInternal(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    const url = this.getApiUrl("/auth/refresh-token");

    if (!refreshToken) {
      throw new TokenExpiredError("No refresh token available");
    }

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        REFRESH_TIMEOUT,
      );

      if (!response.ok) {
        this.clearTokens();
        await this.handleErrorResponse(response, "Token refresh");
      }

      const authData: AuthResponse = await response.json();
      const isLocal = this.getStorageType() === "local";
      this.setTokens(authData, isLocal);
      return authData;
    } catch (error) {
      devError("TokenRefresh", error);
      this.clearTokens();
      throw error;
    }
  }

  // ========== Email Availability ==========
  async checkEmailAvailability(
    email: string,
  ): Promise<EmailAvailabilityResponse> {
    const url = this.getApiUrl("/auth/check-email");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Email availability check");
      }

      return response.json();
    } catch (error) {
      devError("EmailCheck", error);
      this.handleNetworkError(error, "Email availability check");
    }
  }

  // ========== Password Reset ==========
  async requestPasswordReset(email: string): Promise<void> {
    const url = this.getApiUrl("/auth/forgot-password");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Password reset request");
      }
    } catch (error) {
      devError("PasswordResetRequest", error);
      this.handleNetworkError(error, "Password reset request");
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const url = this.getApiUrl("/auth/reset-password");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Password reset");
      }
    } catch (error) {
      devError("PasswordReset", error);
      this.handleNetworkError(error, "Password reset");
    }
  }

  // ========== Email Verification ==========
  async verifyEmail(token: string): Promise<void> {
    const url = this.getApiUrl("/auth/verify-email");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Email verification");
      }
    } catch (error) {
      devError("EmailVerify", error);
      this.handleNetworkError(error, "Email verification");
    }
  }

  async resendVerification(email: string): Promise<void> {
    const url = this.getApiUrl("/auth/resend-verification");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Resend verification");
      }
    } catch (error) {
      devError("ResendVerify", error);
      this.handleNetworkError(error, "Resend verification");
    }
  }

  // ========== Passwordless Magic Link ==========
  async requestMagicLink(
    email: string,
    locale: string = "en",
  ): Promise<{ message: string; expires_in_minutes: number }> {
    const url = this.getApiUrl("/auth/magic-link");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ email, locale }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Request magic link");
      }

      return await response.json();
    } catch (error) {
      devError("RequestMagicLink", error);
      this.handleNetworkError(error, "Request magic link");
      throw error;
    }
  }

  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const url = this.getApiUrl("/auth/magic-link/verify");

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Verify magic link");
      }

      const authData: AuthResponse = await response.json();
      this.setTokens(authData, true);
      return authData;
    } catch (error) {
      devError("VerifyMagicLink", error);
      this.handleNetworkError(error, "Verify magic link");
      throw error;
    }
  }

  // ========== Health Check ==========
  async healthCheck(): Promise<boolean> {
    try {
      const url = this.getApiUrl("/health");
      const response = await this.fetchWithTimeout(
        url,
        { method: "GET" },
        5000,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ========== Profile Management Methods ==========
  async getCurrentUserProfile(): Promise<UserProfile> {
    const token = this.getAccessToken();
    const url = this.getApiUrl("/me");

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Fetch user profile");
      }

      const profileData: UserProfile = await response.json();
      return profileData;
    } catch (error) {
      devError("GetProfile", error);
      throw error;
    }
  }

  async updateUserProfile(profileData: UserUpdateData): Promise<UserProfile> {
    const token = this.getAccessToken();
    const url = this.getApiUrl("/me");

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Update user profile");
      }

      const updatedProfile: UserProfile = await response.json();

      if (profileData.fullName || profileData.email) {
        const userData = await this.getCurrentUser();
        const isLocal = this.getStorageType() === "local";
        this.setUserData(userData, isLocal);
      }

      return updatedProfile;
    } catch (error) {
      devError("UpdateProfile", error);
      throw error;
    }
  }

  async uploadProfilePicture(file: File): Promise<any> {
    const token = this.getAccessToken();
    const url = this.getApiUrl("/files/upload?category=avatars");

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Upload profile picture");
      }

      return await response.json();
    } catch (error) {
      devError("UploadPic", error);
      throw error;
    }
  }

  // ========== Skills Management ==========
  async getUserSkills(userId?: number): Promise<any[]> {
    const token = this.getAccessToken();
    const endpoint = userId ? `/users/${userId}/skills` : "/users/me/skills";
    const url = this.getApiUrl(endpoint);

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Fetch user skills");
      }

      return await response.json();
    } catch (error) {
      devError("GetSkills", error);
      throw error;
    }
  }

  async addUserSkill(skillData: { name: string }): Promise<any> {
    const token = this.getAccessToken();
    const url = this.getApiUrl("/users/me/skills");

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(skillData),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Add user skill");
      }

      return await response.json();
    } catch (error) {
      devError("AddSkill", error);
      throw error;
    }
  }

  async deleteUserSkill(skillId: number): Promise<void> {
    const token = this.getAccessToken();
    const url = this.getApiUrl(`/users/me/skills/${skillId}`);

    if (!token) {
      throw new AuthError("No authentication token available");
    }

    try {
      const response = await this.fetchWithTimeout(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, "Delete user skill");
      }
    } catch (error) {
      devError("DelSkill", error);
      throw error;
    }
  }
}

export const authService = new AuthService();
