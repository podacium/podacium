"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth";
import Head from "next/head";
import { useTranslations } from "@/lib/i18n";

// New Layout & Components
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button } from "@/components/auth/AuthComponents";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { t, i18n } = useTranslations("auth.verifyEmail");
  const isRTL = i18n.language === "ar";

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState(t("status.loadingMessage"));
  const verificationInitiated = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (verificationInitiated.current) return;
      if (!token) {
        setStatus("error");
        setMessage(t("status.invalidLink"));
        return;
      }

      verificationInitiated.current = true;

      try {
        await authService.verifyEmail(token);
        setStatus("success");
        setMessage(t("status.successMessage"));
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      } catch (error: any) {
        setStatus("error");
        setMessage(error.message || t("status.errorMessage"));
      }
    };

    verifyEmail();
  }, [token, router, t]);

  return (
    <div className="w-full text-center">
      {status === "loading" && (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-primary animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t("status.loadingTitle")}
            </h2>
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto">
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
          <div>
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">
              {t("status.successTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            <p className="text-sm text-muted-foreground">
              {t("status.redirecting")}
            </p>
          </div>
          <Button onClick={() => router.push("/auth/login")} className="w-full">
            {t("buttons.goToLogin")}
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-6">
          <div className="w-20 h-20 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-10 h-10 text-destructive"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-destructive mb-2">
              {t("status.errorTitle")}
            </h2>
            <p className="text-muted-foreground mb-4">{message}</p>
          </div>
          <div className="space-y-3">
            <Button href="/auth/resend-verification" className="w-full">
              {t("buttons.resendVerification")}
            </Button>
            <Button variant="outline" href="/auth/login" className="w-full">
              {t("buttons.backToLogin")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useTranslations("auth");

  const heroFeatures = [
    { text: t("verifyEmail.hero.features.secureVerification") },
    { text: t("verifyEmail.hero.features.instantAccess") },
    { text: t("verifyEmail.hero.features.support247") },
  ];

  return (
    <>
      <Head>
        <title>{t("common.meta.verifyEmail.title")}</title>
        <meta
          name="description"
          content={t("common.meta.verifyEmail.description")}
        />
      </Head>

      <AuthSplitLayout
        heroTitle={`${t("verifyEmail.hero.title")} ${t("verifyEmail.hero.highlight")}`}
        heroSubtitle={t("verifyEmail.hero.subtitle")}
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
          <VerifyEmailContent />
        </Suspense>
      </AuthSplitLayout>
    </>
  );
}
