"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Head from "next/head";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService, type SignupData } from "@/services/auth";
import { api, AuthProvider } from "@/lib/api";

// Import New Layout and Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Button, Input, Card } from "@/components/auth/AuthComponents";
import { PodaciumCheckbox } from "@/components/design-system";

// =============================================================================
// CUSTOM HOOKS (Preserved)
// =============================================================================

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  newsletter: boolean;
}

const useSignupForm = () => {
  const { t } = useTranslations("signup.form");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    newsletter: true,
    honeypot: "",
    turnstileToken: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectParam = searchParams?.get("redirect");
      const sanitizedRedirect =
        redirectParam && /^\/[a-zA-Z0-9\-_\/]*$/.test(redirectParam)
          ? redirectParam
          : "/dashboard/";
      router.push(sanitizedRedirect);
    }
  }, [isAuthenticated, router, searchParams]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t("errors.fullNameRequired");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("errors.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("errors.emailInvalid");
    }

    if (!formData.password) {
      newErrors.password = t("errors.passwordRequired");
    } else if (formData.password.length < 8) {
      newErrors.password = t("errors.passwordLength");
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = t("errors.passwordUppercase");
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = t("errors.passwordLowercase");
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = t("errors.passwordDigit");
    } else if (
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(formData.password)
    ) {
      newErrors.password = t("errors.passwordSpecial");
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("errors.passwordsMismatch");
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = t("errors.acceptTerms");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const getLocaleFromCookie = (): string | undefined => {
        if (typeof document === "undefined") return undefined;
        const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
        return match ? match[1] : undefined;
      };

      const signupData: SignupData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        provider: "EMAIL",
        acceptedTerms: formData.acceptTerms,
        subscribeNewsletter: formData.newsletter,
        locale: getLocaleFromCookie(),
        honeypot: formData.honeypot,
        turnstileToken: formData.turnstileToken,
      };

      const result = await authService.signup(signupData);
      setSuccess(true);
      setVerificationSent(result.verification_sent);
    } catch (error: any) {
      console.error("Registration error:", error);
      const code = error?.code;
      let errorMessage = t("errors.registrationFailed");
      if (code === "EMAIL_ALREADY_REGISTERED") {
        errorMessage = t("errors.emailTaken");
        setErrors((prev) => ({ ...prev, email: t("errors.emailTaken") }));
      } else if (code === "PHONE_ALREADY_REGISTERED") {
        errorMessage = t("errors.phoneTaken");
      } else if (code === "PASSWORD_COMPLEXITY_ERROR") {
        errorMessage = error.message || t("errors.passwordLength");
        setErrors((prev) => ({ ...prev, password: errorMessage }));
      } else if (code === "FULL_NAME_REQUIRED") {
        errorMessage = t("errors.fullNameRequired");
        setErrors((prev) => ({
          ...prev,
          fullName: t("errors.fullNameRequired"),
        }));
      } else if (code === "TERMS_NOT_ACCEPTED") {
        errorMessage = t("errors.acceptTerms");
        setErrors((prev) => ({
          ...prev,
          acceptTerms: t("errors.acceptTerms"),
        }));
      } else if (code === "CAPTCHA_FAILED" || code === "REQUIRES_CAPTCHA") {
        errorMessage = t("errors.captchaFailed");
      } else if (error?.message) {
        errorMessage = error.message;
      }
      setErrors((prev) => ({ ...prev, submit: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: "" }));
    }
  };

  return {
    formData,
    errors,
    loading,
    success,
    verificationSent,
    handleChange,
    handleSubmit,
  };
};

const useSocialAuth = () => {
  const { t } = useTranslations("signup.social");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSocialSignup = async (
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

      // Get OAuth URL and redirect
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
      setError(t(`errors.${provider}Failed`));
      setLoading(null);
    }
  };

  return {
    loading,
    error,
    handleSocialSignup,
  };
};

// =============================================================================
// SUCCESS MESSAGE COMPONENT
// =============================================================================

interface SuccessMessageProps {
  email: string;
  verificationSent: boolean;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({
  email,
  verificationSent,
}) => {
  const { t } = useTranslations("signup.success");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResendVerification = async () => {
    setResending(true);
    setResendError(null);
    try {
      await authService.resendVerification(email);
      setResendSuccess(true);
    } catch (error) {
      setResendError(t("errors.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthSplitLayout
      heroTitle={`${t("welcome")} Podacium`}
      heroSubtitle={t("subtitle")}
    >
      <div className="w-full text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("accountCreated")}
        </h2>

        {verificationSent ? (
          <div className="space-y-6">
            <div className="text-muted-foreground leading-relaxed">
              <p className="mb-2">
                {t("verificationSent")}{" "}
                <strong className="text-primary">{email}</strong>.
              </p>
              <p>{t("checkInbox")}</p>
            </div>

            {resendSuccess && (
              <div className="bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800/80 rounded-lg p-3 text-green-800 text-sm">
                {t("resendSuccess")}
              </div>
            )}

            {resendError && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg p-3 text-red-800 dark:text-red-200 text-sm">
                {resendError}
              </div>
            )}

            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-left">
              <p className="text-primary text-sm">
                <strong>{t("noEmail.title")}</strong> {t("noEmail.checkSpam")}{" "}
                <button
                  onClick={handleResendVerification}
                  disabled={resending || resendSuccess}
                  className="text-primary hover:text-primary underline font-medium"
                >
                  {resending
                    ? t("noEmail.sending")
                    : resendSuccess
                      ? t("noEmail.sent")
                      : t("noEmail.resend")}
                </button>
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <Button
                onClick={() => (window.location.href = "/auth/login")}
                className="w-full"
              >
                {t("buttons.goToLogin")}
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
                className="w-full"
              >
                {t("buttons.exploreFeatures")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">{t("readyToStart")}</p>
            <Button
              onClick={() => (window.location.href = "/auth/login")}
              className="w-full"
            >
              {t("buttons.continueToLogin")}
            </Button>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  );
};

// =============================================================================
// SIGNUP FORM PAGE
// =============================================================================

const SignupFormContent: React.FC = () => {
  const { t, i18n } = useTranslations("signup");
  const {
    loading: socialLoading,
    error: socialError,
    handleSocialSignup,
  } = useSocialAuth();
  const {
    formData,
    errors,
    loading,
    success,
    verificationSent,
    handleChange,
    handleSubmit,
  } = useSignupForm();

  if (success) {
    return (
      <SuccessMessage
        email={formData.email}
        verificationSent={verificationSent}
      />
    );
  }

  const heroFeatures = [
    { text: t("hero.features.freeTrial") },
    { text: t("hero.features.noCreditCard") },
    { text: t("hero.features.cancelAnytime") },
  ];

  const socialButtons = (loading: string | null) => (
    <>
      <button
        type="button"
        onClick={() => handleSocialSignup("google")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-3 px-5 py-3 border-2 border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
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
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
          {loading === "google" ? t("social.loading") : t("social.google")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleSocialSignup("linkedin")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-3 px-5 py-3 border-2 border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
      >
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
          {loading === "linkedin" ? t("social.loading") : t("social.linkedin")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleSocialSignup("github")}
        disabled={!!loading}
        className="w-full flex items-center justify-center gap-3 px-5 py-3 border-2 border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
      >
        <svg
          className="w-5 h-5 text-gray-900 dark:text-slate-100"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
          {loading === "github" ? t("social.loading") : t("social.github")}
        </span>
      </button>
    </>
  );

  return (
    <AuthSplitLayout
      heroTitle={`${t("hero.title")} ${t("hero.highlight")}`}
      heroSubtitle={t("hero.subtitle")}
      heroFeatures={heroFeatures}
    >
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-3xl font-bold text-foreground tracking-tight mb-2"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("form.title")}
          </h1>
          <p
            className="text-muted-foreground text-base"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("form.subtitle")}
          </p>
        </div>

        {/* Social Auth Error */}
        {socialError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">
              {socialError}
            </p>
          </div>
        )}

        <Card padding="none" className="bg-transparent shadow-none">
          {/* Social buttons — prominent, immediately visible */}
          <div className="space-y-3">{socialButtons(socialLoading)}</div>

          {/* Divider */}
          <div
            className="relative my-6"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-slate-900 px-4 text-gray-500 dark:text-slate-400">
                {t("social.orContinueWithEmail")}
              </span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("form.fields.fullName.label")}
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              error={errors.fullName}
              placeholder={t("form.fields.fullName.placeholder")}
              required
            />

            <Input
              label={t("form.fields.email.label")}
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              error={errors.email}
              placeholder={t("form.fields.email.placeholder")}
              required
            />

            <div className="space-y-1">
              <Input
                label={t("form.fields.password.label")}
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                error={errors.password}
                placeholder={t("form.fields.password.placeholder")}
                required
                tooltip={t("form.fields.password.tooltip")}
                showStrengthIndicator={true}
                passwordValue={formData.password}
                showPasswordToggle
              />
            </div>

            <Input
              label={t("form.fields.confirmPassword.label")}
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              error={errors.confirmPassword}
              placeholder={t("form.fields.confirmPassword.placeholder")}
              required
              showMatchIndicator={true}
              comparisonValue={formData.password}
              showPasswordToggle
            />

            <div className="space-y-3 pt-2">
              <PodaciumCheckbox
                label={
                  <span className="text-sm text-muted-foreground">
                    {t("form.terms.prefix")}{" "}
                    <Link
                      href="/terms"
                      className="text-primary hover:underline"
                    >
                      {t("form.terms.termsLink")}
                    </Link>{" "}
                    {t("form.terms.and")}{" "}
                    <Link
                      href="/privacy"
                      className="text-primary hover:underline"
                    >
                      {t("form.terms.privacyLink")}
                    </Link>
                  </span>
                }
                checked={formData.acceptTerms}
                onCheckedChange={(val) => handleChange("acceptTerms", val)}
                error={errors.acceptTerms}
                required
              />

              <PodaciumCheckbox
                label={t("form.newsletter.label")}
                checked={formData.newsletter}
                onCheckedChange={(val) => handleChange("newsletter", val)}
              />
            </div>

            {/* Honeypot field (hidden from human users, traps automated scrapers) */}
            <div style={{ display: "none" }} aria-hidden="true">
              <input
                type="text"
                name="honeypot_website"
                tabIndex={-1}
                autoComplete="off"
                value={formData.honeypot}
                onChange={(e) => handleChange("honeypot", e.target.value)}
              />
            </div>

            {/* Turnstile Bot Defense */}
            <TurnstileWidget
              onSuccess={(token) => handleChange("turnstileToken", token)}
              onExpire={() => handleChange("turnstileToken", "")}
            />

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
              {t("form.buttons.createAccount")}
            </Button>
          </form>

          <div className="text-center pt-8">
            <p
              className="text-muted-foreground text-sm"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {t("form.alreadyHaveAccount")}{" "}
              <Link
                href="/auth/login"
                className="text-primary hover:text-primary/90 font-semibold hover:underline"
              >
                {t("form.signInLink")}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </AuthSplitLayout>
  );
};

const SignupPage: React.FC = () => {
  const { t } = useTranslations(["auth", "common"]);

  return (
    <>
      <Head>
        <title>{t("common.meta.signup.title")}</title>
        <meta
          name="description"
          content={t("common.meta.signup.description")}
        />
      </Head>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <SignupFormContent />
      </Suspense>
    </>
  );
};

export default SignupPage;
