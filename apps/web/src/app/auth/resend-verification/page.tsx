"use client";

import { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { authService } from "@/services/auth";
import { useTranslations } from "@/lib/i18n";

// New Layout & Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button, Input } from "@/components/auth/AuthComponents";

export default function ResendVerificationPage() {
  const { t, i18n } = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    setError("");

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError(t("forgotPassword.form.validation.emailInvalid"));
      setStatus("idle");
      return;
    }

    try {
      await authService.resendVerification(email);
      setStatus("success");
      setMessage(t("resendVerification.status.success"));
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || t("resendVerification.status.error"));
    }
  };

  return (
    <>
      <Head>
        <title>{t("common.meta.resendVerification.title")}</title>
        <meta
          name="description"
          content={t("common.meta.resendVerification.description")}
        />
      </Head>

      <AuthSplitLayout
        heroTitle={t("resendVerification.title")}
        heroSubtitle={t("resendVerification.subtitle")}
        heroFeatures={[]}
        centerContent={true}
      >
        <div className="w-full">
          <div className="text-center lg:text-start mb-8">
            <h2
              className="text-2xl lg:text-3xl font-bold text-foreground"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {t("resendVerification.title")}
            </h2>
            <p
              className="text-muted-foreground mt-2"
              dir={i18n.language === "ar" ? "rtl" : "ltr"}
            >
              {t("resendVerification.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t("resendVerification.fields.email.label")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("resendVerification.fields.email.placeholder")}
              required
              autoComplete="email"
              error={error}
            />

            {(message || (status === "error" && message)) && (
              <div
                className={`p-4 rounded-xl border flex items-start ${
                  status === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5 me-3">
                  {status === "success" ? (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            <Button
              type="submit"
              loading={status === "loading"}
              disabled={status === "loading"}
              className="w-full"
            >
              {t("resendVerification.buttons.resendEmail")}
            </Button>

            <div className="text-center pt-4">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("resendVerification.buttons.backToLogin")}
              </Link>
            </div>
          </form>
        </div>
      </AuthSplitLayout>
    </>
  );
}
