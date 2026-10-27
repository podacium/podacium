"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Home, RotateCcw } from "lucide-react";
import { useTranslations, useLocale, useTextDirection } from "@/lib/i18n";
import { captureException } from "@sentry/nextjs";
import { reportDevError } from "@/lib/dev-logger";

export interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset?: () => void;
  /** Translation namespace under `errorFallback` in common.json. Default: "generic" */
  ns?: string;
  /** If true, hides the "go home" link. */
  hideHomeLink?: boolean;
  /** Route to go back to. Default: "/" */
  homeRoute?: string;
}

export function ErrorFallback({
  error,
  reset,
  ns = "generic",
  hideHomeLink = false,
  homeRoute = "/",
}: ErrorFallbackProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dir = useTextDirection();

  useEffect(() => {
    captureException(error, {
      tags: {
        errorDigest: error.digest,
        page: window.location.pathname,
        section: ns,
      },
    });
    reportDevError({
      type: "react_error",
      message: error.message || "React component crashed inside ErrorBoundary",
      error,
      details: {
        digest: error.digest,
        section: ns,
        pathname: window.location.pathname,
      },
    });
  }, [error, ns]);

  const heading =
    t(`errorFallback.${ns}.heading`) || t("errorFallback.generic.heading");
  const message =
    t(`errorFallback.${ns}.message`) || t("errorFallback.generic.message");
  const tryAgainLabel = t("errorFallback.generic.tryAgain");
  const goBackLabel = t("errorFallback.generic.goBack");
  const goHomeLabel = t("errorFallback.generic.goHome");

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden flex items-center justify-center p-6"
      dir={dir}
    >
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-100/60 to-cyan-100/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] bg-gradient-to-tr from-purple-100/40 to-pink-100/30 rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80">
            <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
          </div>

          {/* Heading */}
          <h1 className="mb-3 text-xl font-semibold text-gray-900 dark:text-slate-100">
            {heading}
          </h1>

          {/* Message */}
          <p className="mb-8 text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            {message}
          </p>

          {/* Error digest (dev only) */}
          {process.env.NODE_ENV === "development" && error.digest && (
            <p className="mb-4 text-xs text-center text-gray-400 font-mono">
              {t("errorFallback.generic.digest", { digest: error.digest })}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {reset && (
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" />
                {tryAgainLabel}
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.history.back()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {goBackLabel}
              </button>

              {!hideHomeLink && (
                <Link
                  href={homeRoute}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                  <Home className="h-4 w-4" />
                  {goHomeLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
