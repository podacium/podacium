"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/useAuth";
import PodaciumSkeleton from "@/components/design-system/PodaciumSkeleton";
import { useTranslations } from "@/lib/i18n";

export default function ProfileMePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const t = useTranslations();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }

    apiClient
      .get<{ username?: string; id: number }>(ENDPOINTS.PROFILES.ME)
      .then((data) => {
        const slug = data.username || String(data.id);
        router.replace(`/profile/${slug}`);
      })
      .catch(() => {
        const slug = user?.id ? String(user.id) : "me";
        router.replace(`/profile/${slug}`);
      });
  }, [isAuthenticated, authLoading, router, user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-24 pb-16 px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
      <h1 className="sr-only">{t("common.profile")}</h1>
      <PodaciumSkeleton variant="rounded" height={220} className="w-full" />
      <div className="flex items-end gap-6 px-4 -mt-16">
        <PodaciumSkeleton
          variant="rounded"
          width={144}
          height={144}
          className="border-4 border-white dark:border-slate-800 shadow-xl"
        />
        <div className="space-y-2 flex-1 pb-2">
          <PodaciumSkeleton variant="text" width="40%" height={32} />
          <PodaciumSkeleton variant="text" width="60%" height={20} />
        </div>
      </div>
    </div>
  );
}
