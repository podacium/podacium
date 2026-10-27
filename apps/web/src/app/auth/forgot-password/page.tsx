"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Head from "next/head";
import { authService } from "@/services/auth";
import { useTranslations } from "@/lib/i18n";

// New Layout & Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button, Input, Card } from "@/components/auth/AuthComponents";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t, i18n } = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate email
    if (!email.trim()) {
      setError(t("forgotPassword.form.validation.emailRequired"));
      setLoading(false);
      return;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError(t("forgotPassword.form.validation.emailInvalid"));
      setLoading(false);
      return;
    }

    try {
      await authService.requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("forgotPassword.form.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  const heroFeatures = [
    { text: t("forgotPassword.hero.features.secureProcess") },
    { text: t("forgotPassword.hero.features.instantDelivery") },
    { text: t("forgotPassword.hero.features.support247") },
  ];

  if (success) {
    return (
      <AuthSplitLayout
        heroTitle={t("forgotPassword.hero.title")}
        heroSubtitle={t("forgotPassword.hero.subtitle")}
        heroFeatures={heroFeatures}
      >
        <Head>
          <title>{t("common.meta.forgotPassword.title")}</title>
          <meta
            name="description"
            content={t("common.meta.forgotPassword.description")}
          />
        </Head>
        <div className="text-center w-full">
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

          <h2
            className="text-2xl font-bold text-foreground mb-4"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("forgotPassword.success.title")}
          </h2>

          <p
            className="text-muted-foreground mb-8 leading-relaxed"
            dir={i18n.language === "ar" ? "rtl" : "ltr"}
          >
            {t("forgotPassword.success.message")}{" "}
            <strong className="text-primary">{email}</strong>.{" "}
            {t("forgotPassword.success.instructions")}
          </p>

          <div className="space-y-6 text-start">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200 text-sm font-medium mb-2">
                {t("forgotPassword.success.noEmailTitle")}
              </p>
              <ul className="text-primary text-sm space-y-1 ms-4 list-disc">
                <li>{t("forgotPassword.success.noEmailOptions.checkSpam")}</li>
                <li>
                  {t("forgotPassword.success.noEmailOptions.verifyEmail")}
                </li>
                <li>
                  {t("forgotPassword.success.noEmailOptions.waitAndRetry")}
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push("/auth/login")}
                className="w-full"
              >
                {t("forgotPassword.success.buttons.backToLogin")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSuccess(false)}
                className="w-full"
              >
                {t("forgotPassword.success.buttons.sendAnotherLink")}
              </Button>
            </div>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <>
      <Head>
        <title>{t("common.meta.forgotPassword.title")}</title>
        <meta
          name="description"
          content={t("common.meta.forgotPassword.description")}
        />
      </Head>

      <AuthSplitLayout
        heroTitle={t("forgotPassword.hero.title")}
        heroSubtitle={t("forgotPassword.hero.subtitle")}
        heroFeatures={heroFeatures}
        centerContent={true}
      >
        <div className="w-full">
          <div className="mb-10 text-center lg:text-start">
            <h2
              className="text-3xl font-bold text-foreground tracking-tight mb-3"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {t("forgotPassword.form.title")}
            </h2>
            <p
              className="text-muted-foreground"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {t("forgotPassword.form.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t("forgotPassword.form.fields.email.label")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.form.fields.email.placeholder")}
              required
              autoComplete="email"
              error={error ? " " : undefined}
            />

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {t("forgotPassword.form.buttons.sendResetLink")}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
              >
                <span className="rtl:rotate-180">←</span>{" "}
                {t("forgotPassword.form.buttons.backToLogin")}
              </Link>
            </div>
          </form>
        </div>
      </AuthSplitLayout>
    </>
  );
}
