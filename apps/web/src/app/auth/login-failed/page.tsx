"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import { useTranslations } from "@/lib/i18n";

import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button } from "@/components/auth/AuthComponents";

function LoginFailedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const provider = searchParams.get("provider");
  const { t } = useTranslations("auth");

  const providerName = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : "";

  return (
    <div className="w-full text-center">
      <div className="space-y-6">
        {/* Error Icon */}
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-red-600 dark:text-red-400"
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

        {/* Error Details */}
        <div>
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">
            {t("loginFailed.status.title")}
          </h2>
          <p className="text-muted-foreground mb-2">
            {providerName
              ? t("loginFailed.status.messageWithProvider", {
                  provider: providerName,
                })
              : t("loginFailed.status.message")}
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Troubleshooting Tips */}
        <div className="text-start bg-secondary rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            {t("loginFailed.tips.title")}
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>{t("loginFailed.tips.checkAccount")}</li>
            <li>{t("loginFailed.tips.tryAgain")}</li>
            <li>{t("loginFailed.tips.useEmail")}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button href="/auth/login" className="w-full">
            {t("loginFailed.buttons.tryAgain")}
          </Button>
          <Button variant="outline" href="/auth/signup" className="w-full">
            {t("loginFailed.buttons.createAccount")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoginFailedPage() {
  const { t } = useTranslations("auth");

  const heroFeatures = [
    { text: t("loginFailed.hero.features.secureAuth") },
    { text: t("loginFailed.hero.features.multipleProviders") },
    { text: t("loginFailed.hero.features.support247") },
  ];

  return (
    <>
      <Head>
        <title>{t("loginFailed.meta.title")}</title>
        <meta name="description" content={t("loginFailed.meta.description")} />
      </Head>

      <AuthSplitLayout
        heroTitle={`${t("loginFailed.hero.title")} ${t("loginFailed.hero.highlight")}`}
        heroSubtitle={t("loginFailed.hero.subtitle")}
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
          <LoginFailedContent />
        </Suspense>
      </AuthSplitLayout>
    </>
  );
}
