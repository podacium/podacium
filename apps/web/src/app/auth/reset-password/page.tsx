"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Head from "next/head";
import { authService } from "@/services/auth";
import { useTranslations } from "@/lib/i18n";

// New Layout & Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button, Input, Card } from "@/components/auth/AuthComponents";

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

const useResetRequestForm = () => {
  const { t } = useTranslations("auth.resetPassword");
  const [formData, setFormData] = useState({ email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) {
      newErrors.email = t("validation.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("validation.emailInvalid");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validateForm()) return;
    setLoading(true);
    try {
      await authService.requestPasswordReset(
        formData.email.toLowerCase().trim(),
      );
      setSuccess(true);
    } catch (error: any) {
      setApiError(error.message || t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    if (apiError) setApiError(null);
  };

  return {
    formData,
    errors,
    loading,
    success,
    apiError,
    handleChange,
    handleSubmit,
  };
};

const useResetConfirmForm = (token: string | null) => {
  const { t } = useTranslations("auth.resetPassword");
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenChecking(false);
      return;
    }
    // Simple mock validation or calling API if available
    setTokenValid(true);
    setTokenChecking(false);
  }, [token]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.password) {
      newErrors.password = t("validation.passwordRequired");
    } else if (formData.password.length < 8) {
      newErrors.password = t("validation.passwordLength");
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("validation.passwordsMismatch");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validateForm()) return;
    setLoading(true);
    try {
      await authService.resetPassword(token!, formData.password);
      setSuccess(true);
    } catch (error: any) {
      const msg = error.message || t("errors.generic");
      setApiError(msg);
      if (
        msg.includes("token") ||
        msg.includes("expired") ||
        msg.includes("invalid")
      ) {
        setTokenValid(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    if (apiError) setApiError(null);
  };

  return {
    formData,
    errors,
    loading,
    success,
    apiError,
    tokenValid,
    tokenChecking,
    handleChange,
    handleSubmit,
  };
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// Local PasswordStrengthIndicator removed in favor of shared component in AuthComponents

const ResetRequestForm: React.FC = () => {
  const { t, i18n } = useTranslations("resetPassword");
  const {
    formData,
    errors,
    loading,
    success,
    apiError,
    handleChange,
    handleSubmit,
  } = useResetRequestForm();

  if (success) {
    return (
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
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("request.success.title")}
        </h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {t("request.success.message")}{" "}
          <strong className="text-primary">{formData.email}</strong>.
          {t("request.success.instructions")}
        </p>

        <div className="space-y-6">
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-left">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium mb-1">
              {t("request.success.noEmail.title")}
            </p>
            <ul className="text-primary text-sm space-y-1 list-disc ml-4">
              <li>{t("request.success.noEmail.options.checkSpam")}</li>
              <li>{t("request.success.noEmail.options.verifyEmail")}</li>
              <li>{t("request.success.noEmail.options.waitAndRetry")}</li>
            </ul>
          </div>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              {t("buttons.tryAnotherEmail")}
            </Button>
            <Button href="/auth/login" variant="ghost" className="w-full">
              {t("buttons.backToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h2
          className="text-3xl font-bold text-foreground tracking-tight mb-2"
          dir={i18n.language === "ar" ? "rtl" : "ltr"}
        >
          {t("request.title")}
        </h2>
        <p
          className="text-muted-foreground"
          dir={i18n.language === "ar" ? "rtl" : "ltr"}
        >
          {t("request.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label={t("auth.forgotPassword.form.fields.email.label")}
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          error={errors.email}
          placeholder={t("auth.forgotPassword.form.fields.email.placeholder")}
          required
          autoComplete="email"
        />
        {apiError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
            {apiError}
          </div>
        )}
        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {t("buttons.sendResetLink")}
        </Button>
        <div className="text-center pt-2">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("buttons.backToLogin")}
          </Link>
        </div>
      </form>
    </div>
  );
};

const ResetConfirmForm: React.FC<{ token: string }> = ({ token }) => {
  const { t, i18n } = useTranslations("resetPassword");
  const {
    formData,
    errors,
    loading,
    success,
    apiError,
    tokenValid,
    tokenChecking,
    handleChange,
    handleSubmit,
  } = useResetConfirmForm(token);

  if (tokenChecking) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">
          {t("confirm.validating.message")}
        </p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
          {t("confirm.invalidToken.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {apiError || t("confirm.invalidToken.message")}
        </p>
        <div className="space-y-3">
          <Button
            href="/auth/reset-password"
            variant="primary"
            className="w-full"
          >
            {t("buttons.requestNewLink")}
          </Button>
          <Button href="/auth/login" variant="ghost" className="w-full">
            {t("buttons.backToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
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
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("confirm.success.title")}
        </h2>
        <p className="text-muted-foreground mb-8">
          {t("confirm.success.message")}
        </p>
        <Button href="/auth/login" className="w-full">
          {t("buttons.continueToLogin")}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-start">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t("confirm.title")}
        </h2>
        <p className="text-muted-foreground">{t("confirm.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Input
            label={t("confirm.fields.password.label")}
            type="password"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            error={errors.password}
            placeholder={t("confirm.fields.password.placeholder")}
            required
            autoComplete="new-password"
            showPasswordToggle
            showStrengthIndicator={true}
            passwordValue={formData.password}
          />
        </div>

        <Input
          label={t("confirm.fields.confirmPassword.label")}
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          error={errors.confirmPassword}
          placeholder={t("confirm.fields.confirmPassword.placeholder")}
          required
          autoComplete="new-password"
          showPasswordToggle
          showMatchIndicator={true}
          comparisonValue={formData.password}
        />

        {apiError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
            {apiError}
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          disabled={loading}
          className="w-full py-3"
        >
          {t("buttons.resetPassword")}
        </Button>

        <div className="text-center pt-2">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("buttons.backToLogin")}
          </Link>
        </div>
      </form>
    </div>
  );
};

function ResetProcessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  return token ? <ResetConfirmForm token={token} /> : <ResetRequestForm />;
}

export default function ResetPasswordPage() {
  const { t } = useTranslations("auth");

  const heroFeatures = [
    { text: t("resetPassword.hero.features.secureProcess") },
    { text: t("resetPassword.hero.features.encryptedTransmission") },
    { text: t("resetPassword.hero.features.instantSupport") },
  ];

  return (
    <>
      <Head>
        <title>{t("common.meta.resetPassword.title")}</title>
        <meta
          name="description"
          content={t("common.meta.resetPassword.description")}
        />
      </Head>

      <AuthSplitLayout
        heroTitle={`${t("resetPassword.hero.title")} ${t("resetPassword.hero.highlight")}`}
        heroSubtitle={t("resetPassword.hero.subtitle")}
        heroFeatures={heroFeatures}
        centerContent={true}
      >
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          }
        >
          <ResetProcessContent />
        </Suspense>
      </AuthSplitLayout>
    </>
  );
}
