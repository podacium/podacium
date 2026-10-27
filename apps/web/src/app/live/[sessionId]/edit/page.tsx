"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import { LoadingState } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import {
  SessionForm,
  type SessionFormData,
} from "@/components/live/SessionForm";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi, type LiveSession } from "@/lib/api/live-sessions";

export default function EditSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionId || authLoading) return;
    liveSessionsApi
      .getSession(sessionId)
      .then(setSession)
      .catch(() => router.push("/live"))
      .finally(() => setLoading(false));
  }, [sessionId, authLoading]);

  if (authLoading || loading) {
    return (
      <div dir={dir}>
        <PageLayout background="gray">
          <LoadingState text={t("common.loading")} />
        </PageLayout>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  if (!session) return null;

  const scheduledDate = session.scheduledAt
    ? new Date(session.scheduledAt).toISOString().slice(0, 10)
    : "";
  const scheduledTime = session.scheduledAt
    ? new Date(session.scheduledAt).toTimeString().slice(0, 5)
    : "";

  const initialData: Partial<SessionFormData> = {
    title: session.title,
    description: session.description || "",
    category: session.category || "",
    tags: session.tags || [],
    visibility: session.visibility as any,
    scheduledAt: scheduledDate,
    scheduledTime,
    maxParticipants: session.maxParticipants || 100,
    priceAmount: session.priceAmount ? String(session.priceAmount) : "",
    currency: session.currency || "DZD",
    thumbnailUrl: session.thumbnailUrl || "",
  };

  const handleSubmit = async (form: SessionFormData) => {
    setSaving(true);
    try {
      await liveSessionsApi.updateSession(sessionId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        category: form.category || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        maxParticipants: form.maxParticipants || undefined,
        priceAmount: form.priceAmount ? parseInt(form.priceAmount) : undefined,
        currency: form.currency,
        visibility: form.visibility,
      });
      router.push(`/live/${sessionId}`);
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-2xl mx-auto px-4 py-8">
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            {t("create.backButton")}
          </PodaciumButton>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-6 mb-8">
            {t("create.editTitle")}
          </h1>

          <SessionForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isSubmitting={saving}
            submitLabel={t("create.form.saveChanges")}
            submittingLabel={t("create.form.saving")}
          />
        </main>
      </PageLayout>
    </div>
  );
}
