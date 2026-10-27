"use client";

import React from "react";
import { Suspense, lazy } from "react";

const Footer = lazy(() => import("@/components/Footer"));

interface PageLayoutProps {
  children: React.ReactNode;
  /** Clean white background (default) or subtle gray */
  background?: "white" | "gray";
  /** @deprecated Navbar is mounted once at root chrome. Kept for backwards compatibility */
  showNavbar?: boolean;
  /** Show footer */
  showFooter?: boolean;
  /** Additional page class names */
  className?: string;
  /** Top padding for fixed navbar */
  navbarPadding?: boolean;
  /** Premium ambient aurora blobs behind content */
  ambient?: boolean;
}

/**
 * Unified page layout component for consistent styling across all pages.
 * Clean, minimal backgrounds with optional premium ambient accents.
 */
export function PageLayout({
  children,
  background = "white",
  showNavbar: _showNavbar = false,
  showFooter = true,
  className = "",
  navbarPadding = true,
  ambient = true,
}: PageLayoutProps) {
  const bgClass =
    background === "white"
      ? "bg-white dark:bg-slate-900"
      : "bg-gray-50 dark:bg-slate-900/60";
  const paddingClass = navbarPadding ? "pt-24" : "";

  return (
    <div
      className={`relative min-h-screen ${bgClass} ${paddingClass} ${className}`}
    >
      {ambient && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden -z-0"
        >
          <div className="aurora-blob w-[34rem] h-[34rem] -top-40 -left-40 bg-blue-100 dark:bg-blue-950/60 animate-aurora-slow" />
          <div className="aurora-blob w-[30rem] h-[30rem] top-1/3 -right-48 bg-indigo-100 dark:bg-indigo-950/60 animate-aurora" />
          <div className="aurora-blob w-[26rem] h-[26rem] bottom-0 left-1/4 bg-purple-100 dark:bg-purple-950/60 animate-aurora-slow" />
        </div>
      )}

      <main className="relative">{children}</main>

      {showFooter && (
        <Suspense fallback={<FooterSkeleton />}>
          <Footer />
        </Suspense>
      )}
    </div>
  );
}

/** Skeleton loader for Footer */
function FooterSkeleton() {
  return (
    <div className="bg-gray-950 print:hidden" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-10 gap-x-12">
          <div className="lg:col-span-5 space-y-6">
            <div className="w-[180px] h-9 bg-gray-800 rounded-lg animate-pulse" />
            <div className="w-64 h-4 bg-gray-800/60 rounded animate-pulse" />
            <div className="flex gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-xl bg-gray-800/40 animate-pulse"
                />
              ))}
            </div>
            <div className="p-4 rounded-2xl border border-gray-800/60 bg-gray-900/70 space-y-3">
              <div className="w-28 h-4 bg-gray-800/60 rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 rounded-xl bg-gray-800/40 animate-pulse" />
                <div className="w-28 h-10 rounded-xl bg-gray-800 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, ci) => (
                <div key={ci} className="space-y-3">
                  <div className="w-16 h-3 bg-gray-800/60 rounded animate-pulse" />
                  {Array.from({ length: 3 }).map((_, li) => (
                    <div
                      key={li}
                      className="w-20 h-3 bg-gray-800/30 rounded animate-pulse"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 pt-5 border-t border-gray-800/60">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-6 bg-gray-800/50 rounded animate-pulse" />
            </div>
            <div className="w-40 h-3 bg-gray-800/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageLayout;
