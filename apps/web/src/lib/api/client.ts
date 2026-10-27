/**
 * Core API client with request/response handling, auth, and error management.
 * All domain modules use this shared client instance.
 */

import {
  ApiError,
  NetworkError,
  AuthenticationError,
  ValidationError,
} from "./errors";
import { reportDevError } from "@/lib/dev-logger";
import { persistFingerprintCookie } from "@/lib/device-fingerprint";

// =============================================================================
// REQUEST CONFIGURATION
// =============================================================================

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  requireAuth?: boolean;
  skipErrorHandling?: boolean;
}

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 502, 503, 504];

// =============================================================================
// API CLIENT CLASS
// =============================================================================

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;
  private csrfPromise: Promise<void> | null = null;
  private fingerprintPromise: Promise<string> | null = null;

  constructor() {
    this.baseUrl = (
      process.env.NEXT_PUBLIC_API_URL || "https://backend-api.podacium.com"
    ).replace(/\/$/, "");
  }

  private getBaseUrl(): string {
    return this.baseUrl;
  }

  // ─── Core Request Method ───────────────────────────────────────────────────

  async request<T>(
    method: string,
    path: string,
    options: RequestOptions & { body?: any } = {},
  ): Promise<T> {
    const {
      timeout = DEFAULT_TIMEOUT,
      retries = 0,
      body,
      headers: customHeaders,
      ...fetchOptions
    } = options;
    let normalizedPath = path;
    if (
      normalizedPath.startsWith("/admin/") ||
      normalizedPath.startsWith("/auth/")
    ) {
      normalizedPath = `/api/v1${normalizedPath}`;
    } else if (
      normalizedPath.startsWith("/api/") &&
      !normalizedPath.startsWith("/api/v1/")
    ) {
      normalizedPath = `/api/v1${normalizedPath.slice(4)}`;
    }
    const url = `${this.getBaseUrl()}${normalizedPath}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((customHeaders as Record<string, string>) || {}),
    };

    // Only set Content-Type for JSON bodies (not FormData)
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    // Attach CSRF token for state-changing requests (Double-Submit Cookie pattern)
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      let csrfToken = this.getCsrfToken();
      if (!csrfToken) {
        await this.seedCsrfToken();
        csrfToken = this.getCsrfToken();
      }
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    // Attach preferred locale for localized backend responses
    const locale = this.getCurrentLocale();
    if (locale) {
      headers["X-Locale"] = locale;
      if (!headers["Accept-Language"]) {
        headers["Accept-Language"] = locale;
      }
    }

    // Attach device fingerprint for every request
    const fingerprint = await this.getFingerprint();
    if (fingerprint) {
      headers["X-Fingerprint"] = fingerprint;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body:
          body instanceof FormData
            ? body
            : body
              ? JSON.stringify(body)
              : undefined,
        credentials: "include", // Send cookies
        signal: controller.signal,
        ...fetchOptions,
      });

      clearTimeout(timeoutId);

      const responseCsrfToken =
        response.headers.get("x-csrf-token") ||
        response.headers.get("X-CSRF-Token");
      if (responseCsrfToken) {
        this.inMemoryCsrfToken = responseCsrfToken;
      }

      // Handle 401 — attempt token refresh
      if (response.status === 401 && !options.skipErrorHandling) {
        await this.handleTokenRefresh();
        // Retry the original request once
        return this.request<T>(method, path, {
          ...options,
          skipErrorHandling: true,
        });
      }

      // Handle CSRF token missing — fetch a fresh token and retry
      if (
        response.status === 403 &&
        retries < 1 &&
        !options.skipErrorHandling
      ) {
        const body = await response
          .clone()
          .json()
          .catch(() => ({}));
        if (
          body.detail?.includes?.("CSRF token") ||
          body.detail === "CSRF token missing" ||
          body.detail === "CSRF token invalid"
        ) {
          this.inMemoryCsrfToken = null;
          await this.seedCsrfToken();
          return this.request<T>(method, path, {
            ...options,
            retries: retries + 1,
          });
        }
      }

      // Retry on 429 rate limit and 5xx server errors with exponential backoff (idempotent methods only)
      const isIdempotent =
        ["GET", "HEAD", "OPTIONS", "PUT"].includes(method.toUpperCase()) ||
        Boolean(options.headers && (options.headers as any)["Idempotency-Key"]);
      if (
        RETRYABLE_STATUSES.includes(response.status) &&
        retries < MAX_RETRIES &&
        isIdempotent
      ) {
        const delay = Math.min(
          1000 * Math.pow(2, retries) + Math.random() * 1000,
          10000,
        );
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(method, path, {
          ...options,
          retries: retries + 1,
        });
      }

      if (!response.ok) {
        await this.handleErrorResponse(response, options);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (
        error instanceof ApiError ||
        error instanceof AuthenticationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new NetworkError(`Request timeout after ${timeout}ms`);
        }
        // Match various fetch failure messages across runtimes (browser, Node.js, edge)
        const isConnectionError =
          error.message.includes("Failed to fetch") ||
          error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("NetworkError") ||
          error.message.includes("network error") ||
          error.cause !== undefined;
        if (isConnectionError) {
          if (retries < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * (retries + 1)));
            return this.request<T>(method, path, {
              ...options,
              retries: retries + 1,
            });
          }
          throw new NetworkError(
            "Cannot connect to server. Please check your network connection.",
          );
        }
      }

      const netError = new NetworkError(
        `An unexpected network error occurred: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (process.env.NODE_ENV === "development") {
        reportDevError({
          type: "api_error",
          message: `Network error on ${method} ${path}: ${netError.message}`,
          error: netError,
          details: { method, path, url },
        });
      }
      throw netError;
    }
  }

  // ─── HTTP Method Shortcuts ─────────────────────────────────────────────────

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(
    path: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("POST", path, { ...options, body });
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, { ...options, body });
  }

  async patch<T>(
    path: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("PATCH", path, { ...options, body });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  async upload<T>(
    path: string,
    formData: FormData,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>("POST", path, { ...options, body: formData });
  }

  /**
   * Upload with real progress reporting via XMLHttpRequest.
   * fetch() exposes no upload-progress events, so large file uploads
   * (e.g. BI datasets up to 100 MB) can't report byte-level progress
   * through `request()`. XHR's `upload.onprogress` gives us that.
   *
   * Mirrors the headers/session behavior of `request()`: CSRF double-submit
   * cookie, device fingerprint, cookies, and the same error mapping.
   */
  uploadWithProgress<T>(
    path: string,
    formData: FormData,
    options: { onProgress?: (percent: number) => void; timeout?: number } = {},
  ): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const { onProgress, timeout = 60000 } = options;
      const url = `${this.getBaseUrl()}${path}`;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Accept", "application/json");

      const csrfToken = this.getCsrfToken();
      if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);

      const locale = this.getCurrentLocale();
      if (locale) {
        xhr.setRequestHeader("X-Locale", locale);
        xhr.setRequestHeader("Accept-Language", locale);
      }

      try {
        const fingerprint = await this.getFingerprint();
        if (fingerprint) xhr.setRequestHeader("X-Fingerprint", fingerprint);
      } catch {
        // fingerprint is best-effort
      }

      xhr.timeout = timeout;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.min(Math.round((e.loaded / e.total) * 100), 100));
        }
      };

      xhr.onload = () => {
        const raw = xhr.responseText;
        let body: any = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = { detail: raw };
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T);
          return;
        }

        const message =
          typeof body.detail === "string"
            ? body.detail
            : Array.isArray(body.detail)
              ? body.detail.map((e: any) => e.msg || e).join(", ")
              : body.detail?.message ||
                body.message ||
                `Request failed with status ${xhr.status}`;

        if (xhr.status === 401)
          reject(new AuthenticationError(message, body.code));
        else if (xhr.status === 422)
          reject(new ValidationError(message, body.detail));
        else reject(new ApiError(message, xhr.status, body.code, body));
      };

      xhr.onerror = () =>
        reject(
          new NetworkError(
            "Cannot connect to server. Please check your network connection.",
          ),
        );
      xhr.ontimeout = () =>
        reject(new NetworkError(`Request timeout after ${timeout}ms`));
      xhr.onabort = () => reject(new NetworkError("Upload aborted"));

      xhr.send(formData);
    });
  }

  // ─── Error Handling ────────────────────────────────────────────────────────

  private async handleErrorResponse(
    response: Response,
    options?: RequestOptions,
  ): Promise<never> {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
    }

    const detail = errorData.detail;
    const code =
      typeof detail === "object" && detail !== null
        ? detail.code || errorData.code
        : errorData.code;

    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((e: any) => e.msg || e).join(", ")
          : detail?.message ||
            errorData.message ||
            `Request failed with status ${response.status}`;

    if (process.env.NODE_ENV === "development" && !options?.skipErrorHandling) {
      reportDevError({
        type: "api_error",
        message: `HTTP ${response.status} on ${response.url || "API endpoint"} — ${message}`,
        details: {
          status: response.status,
          code,
          errorData,
        },
      });
    }

    if (response.status === 401) {
      throw new AuthenticationError(message, code);
    }

    if (response.status === 422) {
      throw new ValidationError(message, detail);
    }

    throw new ApiError(message, response.status, code, errorData);
  }

  // ─── Locale & Internationalization ─────────────────────────────────────────

  private getCurrentLocale(): string {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
      if (document.documentElement.lang) return document.documentElement.lang;
    }
    return "en";
  }

  // ─── CSRF Token ─────────────────────────────────────────────────────────────

  private inMemoryCsrfToken: string | null = null;

  private getCsrfToken(): string | null {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return this.inMemoryCsrfToken;
  }

  /**
   * Fetch a fresh CSRF token by making a lightweight GET request.
   * The server sets the csrf_token cookie and returns X-CSRF-Token in the response headers.
   * Deduplicates concurrent calls so only one GET is issued.
   */
  async ensureCsrfToken(): Promise<void> {
    if (this.getCsrfToken()) return;
    await this.seedCsrfToken();
  }

  private async seedCsrfToken(): Promise<void> {
    if (this.csrfPromise) return this.csrfPromise;
    this.csrfPromise = this.fetchCsrfToken();
    try {
      await this.csrfPromise;
    } finally {
      this.csrfPromise = null;
    }
  }

  private async fetchCsrfToken(): Promise<void> {
    try {
      this.inMemoryCsrfToken = null;
      const url = `${this.getBaseUrl()}/api/v1/auth/csrf`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      const token =
        data?.csrf_token ||
        res.headers.get("x-csrf-token") ||
        res.headers.get("X-CSRF-Token");
      if (token) {
        this.inMemoryCsrfToken = token;
      }
    } catch {
      // Silently fail — the CSRF cookie might already be set or the next
      // retry will attempt again.
    }
  }

  // ─── Device Fingerprint ─────────────────────────────────────────────────────

  /**
   * Get the device fingerprint (FingerprintJS visitorId).
   * Uses a module-level singleton from useFingerprint hook.
   * Deduplicates concurrent calls.
   */
  private async getFingerprint(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    if (this.fingerprintPromise) return this.fingerprintPromise;
    try {
      this.fingerprintPromise = this.loadFingerprint();
      return await this.fingerprintPromise;
    } catch {
      return null;
    }
  }

  private async loadFingerprint(): Promise<string> {
    const { getVisitorId } = await import("@/hooks/useFingerprint");
    const id = await getVisitorId();
    if (id) persistFingerprintCookie(id);
    return id || "";
  }

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  private async handleTokenRefresh(): Promise<void> {
    if (this.isRefreshing) {
      await this.refreshPromise;
      return;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<void> {
    try {
      await this.post(
        "/api/auth/refresh-token",
        {},
        { skipErrorHandling: true },
      );
    } catch {
      throw new AuthenticationError("Session expired. Please log in again.");
    }
  }
}

// Singleton instance
export const apiClient = new ApiClient();
