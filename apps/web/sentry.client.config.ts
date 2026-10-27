import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
    ],
    // Don't send PII
    sendDefaultPii: false,
    // Ignore common non-actionable errors
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "AbortError",
      "Network request failed",
    ],
  });
}
