"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

export default function ProfileRedirect() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      router.replace("/profile/me");
    } else {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <h1 className="sr-only">{t("common.profile")}</h1>
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
    </div>
  );
}
