"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authService } from "@/services/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useLocale } from "@/lib/i18n";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import { Button, Input, Card } from "@/components/auth/AuthComponents";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function MagicLinkContent() {
  const { t } = useTranslations("auth.magicLink");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, refreshUser } = useAuth();

  const tokenParam = searchParams.get("token");

  // Request form state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Verification state (when ?token=... is present)
  const [isVerifying, setIsVerifying] = useState(Boolean(tokenParam));
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "success" | "error"
  >(tokenParam ? "idle" : "idle");
  const [verifyMessage, setVerifyMessage] = useState("");

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle Token Verification Flow
  const handleVerify = useCallback(
    async (token: string) => {
      setIsVerifying(true);
      try {
        await authService.verifyMagicLink(token);
        setVerifyStatus("success");
        setVerifyMessage(t("status.success"));
        await refreshUser();
        setTimeout(() => {
          router.push("/dashboard/");
        }, 1500);
      } catch (err: any) {
        setVerifyStatus("error");
        const msg =
          err?.status === 400
            ? t("status.expired")
            : err?.message || t("status.error");
        setVerifyMessage(msg);
      } finally {
        setIsVerifying(false);
      }
    },
    [router, t, refreshUser],
  );

  useEffect(() => {
    if (tokenParam) {
      handleVerify(tokenParam);
    }
  }, [tokenParam, handleVerify]);

  // If already authenticated and not verifying token, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && !tokenParam && !isVerifying) {
      router.push("/dashboard/");
    }
  }, [isAuthenticated, tokenParam, isVerifying, router]);

  // Request Magic Link Form Handler
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setEmailError(t("form.emailLabel"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setEmailError(t("status.invalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.requestMagicLink(trimmed, locale);
      setSentSuccess(true);
      setCooldown(60);
    } catch {
      // Anti-enumeration: even on error, show sent confirmation
      setSentSuccess(true);
      setCooldown(60);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Verification In-Progress View ──────────────────────────────────────────
  if (tokenParam) {
    return (
      <AuthSplitLayout
        heroTitle={t("hero.title")}
        heroSubtitle={t("hero.subtitle")}
        heroFeatures={[
          { text: t("hero.features.secure") },
          { text: t("hero.features.fast") },
          { text: t("hero.features.safe") },
        ]}
      >
        <Card>
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              {isVerifying ? (
                <svg
                  className="h-8 w-8 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : verifyStatus === "success" ? (
                <svg
                  className="h-8 w-8 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-8 w-8 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>

            <h1 className="text-2xl font-bold text-foreground">
              {isVerifying
                ? t("card.verifyingTitle")
                : verifyStatus === "success"
                  ? t("card.successTitle")
                  : t("status.error")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isVerifying ? t("card.verifyingSubtitle") : verifyMessage}
            </p>

            {verifyStatus === "error" && (
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  variant="primary"
                  onClick={() => {
                    router.push("/auth/magic-link");
                  }}
                >
                  {t("form.submitButton")}
                </Button>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("form.backToLogin")}
                </Link>
              </div>
            )}
          </div>
        </Card>
      </AuthSplitLayout>
    );
  }

  // ── Request Link Sent View ────────────────────────────────────────────────
  if (sentSuccess) {
    return (
      <AuthSplitLayout
        heroTitle={t("hero.title")}
        heroSubtitle={t("hero.subtitle")}
        heroFeatures={[
          { text: t("hero.features.secure") },
          { text: t("hero.features.fast") },
          { text: t("hero.features.safe") },
        ]}
      >
        <Card>
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-foreground">
              {t("card.successTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("card.successSubtitle", { email })}
            </p>
            <p className="mt-3 text-xs text-muted-foreground/80 bg-muted/50 p-2.5 rounded-lg border border-border">
              {t("card.notice")}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                variant="outline"
                disabled={cooldown > 0 || isSubmitting}
                onClick={handleSendLink}
              >
                {cooldown > 0
                  ? t("form.resendIn", { seconds: cooldown })
                  : t("form.resend")}
              </Button>

              <Link
                href="/auth/login"
                className="text-sm font-medium text-primary hover:underline mt-2"
              >
                {t("form.backToLogin")}
              </Link>
            </div>
          </div>
        </Card>
      </AuthSplitLayout>
    );
  }

  // ── Request Link Form View ────────────────────────────────────────────────
  return (
    <AuthSplitLayout
      heroTitle={t("hero.title")}
      heroSubtitle={t("hero.subtitle")}
      heroFeatures={[
        { text: t("hero.features.secure") },
        { text: t("hero.features.fast") },
        { text: t("hero.features.safe") },
      ]}
    >
      <Card>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {t("card.title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("card.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSendLink} className="space-y-4">
          <Input
            id="magic-email"
            type="email"
            autoComplete="email"
            required
            label={t("form.emailLabel")}
            placeholder={t("form.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            disabled={isSubmitting}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("form.sending") : t("form.submitButton")}
          </Button>

          <div className="text-center pt-3 border-t border-border">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("form.backToLogin")}
            </Link>
          </div>
        </form>
      </Card>
    </AuthSplitLayout>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
