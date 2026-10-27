// components/Providers.tsx
"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { useState, Suspense, useEffect } from "react";
import OAuthHandler from "@/components/OAuthHandler";
import DeletionPendingOverlay from "@/components/DeletionPendingOverlay";
import { NotificationSyncProvider } from "@/components/NotificationSyncProvider";
import { DevErrorMonitor } from "@/components/DevErrorMonitor";
import { reportDevError } from "@/lib/dev-logger";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache:
          process.env.NODE_ENV === "development"
            ? new QueryCache({
                onError: (error, query) => {
                  reportDevError({
                    type: "query_error",
                    message: `Query failed: [${query.queryKey.join(", ")}] — ${error.message}`,
                    error,
                    details: {
                      queryKey: query.queryKey,
                      queryHash: query.queryHash,
                    },
                  });
                },
              })
            : undefined,
        mutationCache:
          process.env.NODE_ENV === "development"
            ? new MutationCache({
                onError: (error, _variables, _context, mutation) => {
                  reportDevError({
                    type: "query_error",
                    message: `Mutation failed: [${mutation.options.mutationKey?.join(", ") || "anonymous"}] — ${error.message}`,
                    error,
                    details: {
                      mutationKey: mutation.options.mutationKey,
                    },
                  });
                },
              })
            : undefined,
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 24 * 60 * 60_000, // Retain query cache in memory for 24 hours for offline navigation
            retry: 2,
            networkMode: "offlineFirst", // Prioritize cached data immediately without blocking offline users
            refetchOnWindowFocus: false,
            refetchOnReconnect: "always", // Auto-refresh data when network connectivity resumes
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  // Warm device fingerprint cache so first API call doesn't block.
  // getVisitorId() also publishes the `x-fingerprint` cookie, which the Edge
  // middleware needs to verify the session's `fpt` claim on navigation.
  useEffect(() => {
    import("@/hooks/useFingerprint").then(({ getVisitorId }) => {
      getVisitorId().catch(() => {});
    });
  }, []);

  // Report Core Web Vitals to Sentry RUM
  useEffect(() => {
    import("@/lib/web-vitals").then(({ reportWebVitals }) => {
      reportWebVitals();
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DevErrorMonitor />
      <ThemeProvider>
        <AuthProvider>
          <UserProvider>
            {/* Bridges WebSocket notification events → TanStack Query cache */}
            <NotificationSyncProvider>
              <Suspense fallback={null}>
                <OAuthHandler />
              </Suspense>
              {children}
              <DeletionPendingOverlay />
            </NotificationSyncProvider>
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
