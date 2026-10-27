"use client";

import React, { useState, useEffect, Suspense, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { MessagingLayout } from "@/components/messaging";
import { MessageSquare, Loader2 } from "lucide-react";

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

function ConversationPageContent({ params }: ConversationPageProps) {
  const resolvedParams = use(params);
  const conversationId = resolvedParams.id;
  const t = useTranslations("messaging");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const initialUserParam = searchParams.get("user");
  const initialUserId = initialUserParam
    ? parseInt(initialUserParam, 10)
    : undefined;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Navbar />
        <div
          className="pt-20 flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 5rem)" }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {t("messages.loading")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Navbar />
        <div
          className="pt-24 flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 5rem)" }}
        >
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <MessageSquare className="w-16 h-16 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-300">
              {t("page.title")}
            </h2>
            <p className="text-gray-500 dark:text-slate-400">
              {t("errors.unauthorized")}
            </p>
          </div>
        </div>
        <AuthRequiredModal
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            router.push("/");
          }}
          onLogin={() => router.push("/auth/login")}
          onSignup={() => router.push("/auth/signup")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60">
      <Navbar />
      <main className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t("page.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t("page.description")}
            </p>
          </div>

          {/* Messaging Layout */}
          <MessagingLayout
            currentUserId={user.id}
            initialUserId={
              Number.isFinite(initialUserId) ? initialUserId : undefined
            }
            initialConversationId={conversationId}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ConversationPage({ params }: ConversationPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <ConversationPageContent params={params} />
    </Suspense>
  );
}
