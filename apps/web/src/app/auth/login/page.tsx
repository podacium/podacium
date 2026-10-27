"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";
import { api, AuthProvider, ApiError } from "@/lib/api";
import { authApi } from "@/lib/api/auth";
import { AuthenticationError } from "@/lib/api/errors";
import { getWebAuthnAssertion } from "@/lib/webauthn";

// Import New Layout and Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Button, Input, Card } from "@/components/auth/AuthComponents";
import { PodaciumCheckbox } from "@/components/design-system";
import { PodaciumOTPInput } from "@/components/design-system/PodaciumOTPInput";

// =============================================================================
// CUSTOM HOOKS (Preserved Logic)
function sanitizeRelativeRedirect(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("://") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }
  return null;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginErrors {
  email?: string;
  password?: string;
  submit?: string;
}

const useLoginForm = () => {
  const { t } = useTranslations("login");
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState<LoginErrors>({});
  const [loading, setLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const { login, completeTwoFactor, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 2FA & Security CAPTCHA state
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorMethods, setTwoFactorMethods] = useState<
    { method: string; enabled: boolean; label: string }[]
  >([]);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState("totp");
  const [twoFactorError, setTwoFactorError] = useState("");

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // If user changed language during 2FA flow, session might exist from
      // a previous login — don't auto-redirect, let them log in again
      if (sessionStorage.getItem("podacium_2fa_pending")) {
        sessionStorage.removeItem("podacium_2fa_pending");
        return;
      }
      const redirectParam = searchParams.get("redirect");
      const sanitizedRedirect =
        sanitizeRelativeRedirect(redirectParam) || "/dashboard/";
      router.push(sanitizedRedirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const validateForm = (): boolean => {
    const newErrors: LoginErrors = {};

    if (!formData.email) {
      newErrors.email = t("form.validation.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("form.validation.emailInvalid");
    }

    if (!formData.password) {
      newErrors.password = t("form.validation.passwordRequired");
    } else if (formData.password.length < 8) {
      newErrors.password = t("form.validation.passwordLength");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationMessage("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await login(
        formData.email,
        formData.password,
        formData.rememberMe,
        turnstileToken,
      );

      if (result.requires_2fa) {
        setTempToken(result.temp_token);
        setTwoFactorMethods(result.methods);
        setTwoFactorMethod(result.methods[0]?.method || "totp");
        setTwoFactorRequired(true);
        sessionStorage.setItem("podacium_2fa_pending", "1");
        setLoading(false);
        return;
      }

      const user = result.user;

      // Explicitly tell browser to save credentials
      if (typeof window !== "undefined" && "PasswordCredential" in window) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: formData.email,
            password: formData.password,
            name: formData.email,
          });
          await navigator.credentials.store(cred);
        } catch (e) {
          console.error("Error storing credentials:", e);
        }
      }

      // Instant redirect: No setTimeout, check onboarding status immediately
      const redirectParam = searchParams.get("redirect");
      const sanitizedRedirect =
        sanitizeRelativeRedirect(redirectParam) ||
        (user?.onboardingCompleted ? "/dashboard/" : "/onboarding");

      router.push(sanitizedRedirect);
    } catch (error: any) {
      console.error("Login error:", error);

      const code = error?.code;
      if (code === "REQUIRES_CAPTCHA") {
        setShowCaptcha(true);
        setErrors({ submit: t("form.errors.requiresCaptcha") });
      } else if (code === "CAPTCHA_FAILED") {
        setShowCaptcha(true);
        setErrors({ submit: t("form.errors.captchaFailed") });
      } else if (code === "USER_NOT_FOUND") {
        setErrors({ submit: t("form.errors.noAccount") });
      } else if (
        code === "INVALID_PASSWORD" ||
        code === "INVALID_CREDENTIALS"
      ) {
        setErrors({ submit: t("form.errors.invalidCredentials") });
      } else if (code === "ACCOUNT_DELETED" || code === "ACCOUNT_DEACTIVATED") {
        setErrors({ submit: error?.message || t("form.errors.genericError") });
      } else if (code === "RATE_LIMITED" || code === "ACCOUNT_LOCKED") {
        setErrors({ submit: error?.message || t("form.errors.genericError") });
      } else if (
        error?.message?.includes("network") ||
        error?.message?.includes("connection") ||
        error?.name === "NetworkError"
      ) {
        setErrors({ submit: t("form.errors.networkError") });
      } else {
        setErrors({ submit: error?.message || t("form.errors.genericError") });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorCancel = () => {
    setTwoFactorRequired(false);
    setTwoFactorCode("");
    setTwoFactorError("");
    sessionStorage.removeItem("podacium_2fa_pending");
  };

  const handleChange = (
    field: keyof LoginFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors[field as keyof LoginErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: undefined }));
    }
    if (verificationMessage) {
      setVerificationMessage("");
    }
  };

  const handleTwoFactorVerify = async () => {
    if (twoFactorMethod !== "webauthn" && !twoFactorCode) {
      setTwoFactorError(t("form.errors.codeRequired"));
      return;
    }
    setTwoFactorError("");
    setLoading(true);
    try {
      let code: any = twoFactorCode;
      if (twoFactorMethod === "webauthn") {
        if (typeof window === "undefined" || !navigator.credentials?.get) {
          throw new Error("WebAuthn is not supported in this browser");
        }
        const beginRes = await authApi.webauthnLoginBegin(tempToken);
        if (!beginRes?.options) {
          throw new Error("Failed to initialize WebAuthn challenge");
        }
        const assertion = await getWebAuthnAssertion(beginRes.options);
        code = JSON.stringify(assertion);
      }
      const user = await completeTwoFactor(tempToken, code, twoFactorMethod);
      sessionStorage.removeItem("podacium_2fa_pending");

      const redirectParam = searchParams.get("redirect");
      const sanitizedRedirect =
        redirectParam && /^\/[a-zA-Z0-9\-_\/]*$/.test(redirectParam)
          ? redirectParam
          : user?.onboardingCompleted
            ? "/dashboard/"
            : "/onboarding";

      router.push(sanitizedRedirect);
    } catch (error: any) {
      if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
        setTwoFactorError(t("form.errors.webauthnCancelled"));
      } else if (error instanceof ApiError && error.status === 400) {
        setTwoFactorError(t("form.errors.invalidCode"));
      } else if (error instanceof AuthenticationError) {
        const msg = error.message?.toLowerCase() || "";
        if (
          msg.includes("expired") ||
          (msg.includes("invalid") && msg.includes("session"))
        ) {
          setTwoFactorError(t("form.errors.sessionExpired"));
        } else if (msg.includes("code")) {
          setTwoFactorError(t("form.errors.invalidCode"));
        } else {
          setTwoFactorError(t("form.errors.genericError"));
        }
      } else {
        setTwoFactorError(error?.message || t("form.errors.genericError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    errors,
    loading,
    verificationMessage,
    showCaptcha,
    setTurnstileToken,
    handleChange,
    handleSubmit,
    twoFactorRequired,
    twoFactorMethods,
    twoFactorMethod,
    twoFactorCode,
    twoFactorError,
    setTwoFactorCode,
    setTwoFactorMethod,
    handleTwoFactorVerify,
    handleTwoFactorCancel,
  };
};

const useSocialAuth = () => {
  const { t } = useTranslations("login");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSocialLogin = async (
    provider: "google" | "github" | "linkedin",
  ) => {
    setLoading(provider);
    setError(null);

    try {
      // Map provider string to AuthProvider enum
      const authProvider: AuthProvider = {
        google: AuthProvider.GOOGLE,
        github: AuthProvider.GITHUB,
        linkedin: AuthProvider.LINKEDIN,
      }[provider];

      const { url } = await api.startOAuthFlow(authProvider, {
        frontend_redirect_uri: window.location.href,
        use_html_redirect: false,
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error("Failed to get OAuth URL");
      }
    } catch (err: any) {
      setError(t(`form.social.errors.${provider}Failed`));
      setLoading(null);
    }
  };

  return {
    loading,
    error,
    handleSocialLogin,
  };
};

// =============================================================================
// LOGIN FORM CONTENT (Redesigned)
// =============================================================================

const LoginFormContent: React.FC = () => {
  const { t, i18n } = useTranslations("login");
  const {
    loading: socialLoading,
    error: socialError,
    handleSocialLogin,
  } = useSocialAuth();
  const {
    formData,
    errors,
    loading,
    verificationMessage,
    showCaptcha,
    setTurnstileToken,
    handleChange,
    handleSubmit,
    twoFactorRequired,
    twoFactorMethods,
    twoFactorMethod,
    twoFactorCode,
    twoFactorError,
    setTwoFactorCode,
    setTwoFactorMethod,
    handleTwoFactorVerify,
    handleTwoFactorCancel,
  } = useLoginForm();

  const heroFeatures = [
    { text: t("hero.features.secureLogin") },
    { text: t("hero.features.access247") },
    { text: t("hero.features.instantSupport") },
  ];

  const socialButtons = (loading: string | null) => (
    <>
      <button
        type="button"
        onClick={() => handleSocialLogin("google")}
        disabled={!!loading}
        className="group relative w-full flex items-center justify-center gap-3 px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:border-blue-300 dark:border-blue-700 transition-all shadow-sm hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] overflow-hidden"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-indigo-50/0 to-purple-50/0 dark:from-slate-900/0 dark:via-slate-900/0 dark:to-slate-900/0 group-hover:from-blue-50/60 group-hover:via-indigo-50/40 group-hover:to-purple-50/60 dark:group-hover:from-slate-800/60 dark:group-hover:via-slate-800/40 dark:group-hover:to-slate-800/60 transition-all duration-500" />
        <svg className="w-5 h-5 relative" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium relative">
          {loading === "google"
            ? t("form.social.connecting")
            : t("form.social.google")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleSocialLogin("linkedin")}
        disabled={!!loading}
        className="group relative w-full flex items-center justify-center gap-3 px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:border-blue-300 dark:border-blue-700 transition-all shadow-sm hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] overflow-hidden"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-indigo-50/0 to-purple-50/0 dark:from-slate-900/0 dark:via-slate-900/0 dark:to-slate-900/0 group-hover:from-blue-50/60 group-hover:via-indigo-50/40 group-hover:to-purple-50/60 dark:group-hover:from-slate-800/60 dark:group-hover:via-slate-800/40 dark:group-hover:to-slate-800/60 transition-all duration-500" />
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-400 relative"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium relative">
          {loading === "linkedin"
            ? t("form.social.connecting")
            : t("form.social.linkedin")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleSocialLogin("github")}
        disabled={!!loading}
        className="group relative w-full flex items-center justify-center gap-3 px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:border-blue-300 dark:border-blue-700 transition-all shadow-sm hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98] overflow-hidden"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-indigo-50/0 to-purple-50/0 dark:from-slate-900/0 dark:via-slate-900/0 dark:to-slate-900/0 group-hover:from-blue-50/60 group-hover:via-indigo-50/40 group-hover:to-purple-50/60 dark:group-hover:from-slate-800/60 dark:group-hover:via-slate-800/40 dark:group-hover:to-slate-800/60 transition-all duration-500" />
        <svg
          className="w-5 h-5 text-gray-900 dark:text-slate-100 relative"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium relative">
          {loading === "github"
            ? t("form.social.connecting")
            : t("form.social.github")}
        </span>
      </button>
    </>
  );

  return (
    <AuthSplitLayout
      heroTitle={`${t("hero.title")} Podacium`}
      heroSubtitle={t("hero.subtitle")}
      heroFeatures={heroFeatures}
    >
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mb-2"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("form.title")}
          </h1>
          <p
            className="text-gray-600 dark:text-slate-400 text-base"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("form.subtitle")}
          </p>
        </div>

        {/* Social Auth Error */}
        {socialError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg">
            <p
              className="text-red-600 dark:text-red-400 text-sm"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {socialError}
            </p>
          </div>
        )}

        {/* Email Verification Message */}
        {verificationMessage && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-600 mr-2 text-xl">⚠️</span>
              <div>
                <p
                  className="text-yellow-700 text-sm font-medium"
                  dir={i18n.language === "ar" ? "rtl" : "ltr"}
                >
                  {verificationMessage}
                </p>
                <Link
                  href="/auth/resend-verification"
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline mt-1 inline-block"
                >
                  {t("form.actions.resendVerification")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {twoFactorRequired ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                {t("twoFactor.title")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("twoFactor.subtitle")}
              </p>
            </div>

            {/* TOTP / Authenticator App */}
            {twoFactorMethod === "totp" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("twoFactor.authCodeLabel")}
                  </label>
                  <div className="flex justify-center">
                    <PodaciumOTPInput
                      value={twoFactorCode}
                      onChange={setTwoFactorCode}
                      invalid={Boolean(twoFactorError)}
                      aria-label={t("twoFactor.authCodeLabel")}
                      autoFocus
                    />
                  </div>
                </div>

                {twoFactorError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {twoFactorError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleTwoFactorVerify}
                    loading={loading}
                    disabled={loading || twoFactorCode.length < 6}
                    className="flex-1"
                  >
                    {t("twoFactor.verify")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleTwoFactorCancel}
                    className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition"
                  >
                    {t("twoFactor.cancel")}
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-slate-800 pt-3 space-y-2">
                  {twoFactorMethods.some((m) => m.method === "email") && (
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorMethod("email");
                        setTwoFactorCode("");
                      }}
                      className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                    >
                      {t("twoFactor.useEmail")}
                    </button>
                  )}
                  {twoFactorMethods.some((m) => m.method === "webauthn") && (
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorMethod("webauthn");
                        setTwoFactorCode("");
                      }}
                      className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                    >
                      {t("twoFactor.usePasskey")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod("backup");
                      setTwoFactorCode("");
                    }}
                    className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                  >
                    {t("twoFactor.useBackup")}
                  </button>
                </div>
              </div>
            )}

            {/* Email OTP */}
            {twoFactorMethod === "email" && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  {t("twoFactor.emailSent")}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("twoFactor.codeLabel")}
                  </label>
                  <div className="flex justify-center">
                    <PodaciumOTPInput
                      value={twoFactorCode}
                      onChange={setTwoFactorCode}
                      invalid={Boolean(twoFactorError)}
                      aria-label={t("twoFactor.codeLabel")}
                      autoFocus
                    />
                  </div>
                </div>

                {twoFactorError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {twoFactorError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleTwoFactorVerify}
                    loading={loading}
                    disabled={loading || twoFactorCode.length < 6}
                    className="flex-1"
                  >
                    {t("twoFactor.verify")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleTwoFactorCancel}
                    className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition"
                  >
                    {t("twoFactor.cancel")}
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod("totp");
                      setTwoFactorCode("");
                    }}
                    className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                  >
                    {t("twoFactor.useAuthApp")}
                  </button>
                </div>
              </div>
            )}

            {/* Backup Codes */}
            {twoFactorMethod === "backup" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("twoFactor.backupDesc")}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {t("twoFactor.backupLabel")}
                  </label>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) =>
                      setTwoFactorCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, "")
                          .slice(0, 9),
                      )
                    }
                    placeholder="XXXX-XXXX"
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-800 rounded-lg text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {twoFactorError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {twoFactorError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleTwoFactorVerify}
                    loading={loading}
                    disabled={loading || twoFactorCode.length < 9}
                    className="flex-1"
                  >
                    {t("twoFactor.verify")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleTwoFactorCancel}
                    className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition"
                  >
                    {t("twoFactor.cancel")}
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod("totp");
                      setTwoFactorCode("");
                    }}
                    className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                  >
                    {t("twoFactor.useAuthApp")}
                  </button>
                </div>
              </div>
            )}

            {/* Passkey / WebAuthn */}
            {twoFactorMethod === "webauthn" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("twoFactor.passkeyPrompt")}
                </p>
                <Button
                  onClick={handleTwoFactorVerify}
                  loading={loading}
                  disabled={loading}
                  className="w-full"
                >
                  {t("twoFactor.usePasskey")}
                </Button>

                {twoFactorError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {twoFactorError}
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMethod("totp");
                      setTwoFactorCode("");
                    }}
                    className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline underline-offset-2 transition"
                  >
                    {t("twoFactor.useAuthApp")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Social buttons — prominent, immediately visible */}
            <div className="space-y-3">
              {socialButtons(socialLoading)}

              <div className="text-center pt-4">
                <p
                  className="text-gray-600 dark:text-slate-400 text-sm"
                  dir={i18n.language === "ar" ? "rtl" : "ltr"}
                >
                  {t("form.signUp.prompt")}{" "}
                  <Link
                    href="/auth/signup"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold hover:underline"
                  >
                    {t("form.signUp.link")}
                  </Link>
                </p>
              </div>
            </div>

            {/* Divider */}
            <div
              className="relative"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-slate-900 px-4 text-gray-500 dark:text-slate-400">
                  {t("form.social.orEmail")}
                </span>
              </div>
            </div>

            {/* Email form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              method="post"
              action="#"
            >
              <Input
                id="email"
                label={t("form.fields.email.label")}
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                error={errors.email}
                placeholder={t("form.fields.email.placeholder")}
                required
                name="email"
                autoComplete="username"
              />

              <div className="space-y-1">
                <Input
                  id="password"
                  label={t("form.fields.password.label")}
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  error={errors.password}
                  placeholder={t("form.fields.password.placeholder")}
                  required
                  name="password"
                  autoComplete="current-password"
                  showPasswordToggle
                />
              </div>

              <div
                className={`flex items-center justify-between pt-2 ${i18n.language === "ar" ? "flex-row-reverse" : ""}`}
              >
                <PodaciumCheckbox
                  label={t("form.fields.rememberMe.label")}
                  checked={formData.rememberMe}
                  onCheckedChange={(val) => handleChange("rememberMe", val)}
                />
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  {t("form.actions.forgotPassword")}
                </Link>
              </div>

              {showCaptcha && (
                <TurnstileWidget
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken("")}
                />
              )}

              {errors.submit && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                  {errors.submit}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                disabled={loading}
                className="w-full mt-2"
                size="lg"
              >
                {t("form.actions.signIn")}
              </Button>

              <div className="pt-2">
                <Link
                  href="/auth/magic-link"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition"
                >
                  <svg
                    className="w-4 h-4 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span>{t("form.actions.magicLink")}</span>
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  );
};

const LoginPage: React.FC = () => {
  const { t } = useTranslations(["auth", "common"]);

  return (
    <>
      <Head>
        <title>{t("common.meta.login.title")}</title>
        <meta name="description" content={t("common.meta.login.description")} />
      </Head>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <LoginFormContent />
      </Suspense>
    </>
  );
};

export default LoginPage;
