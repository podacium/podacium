"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import { SectionCard, LoadingState } from "@/components/SectionComponents";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi, type LiveSession } from "@/lib/api/live-sessions";

export default function CloneSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newVisibility, setNewVisibility] = useState("PUBLIC");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || authLoading) return;
    liveSessionsApi
      .getSession(sessionId)
      .then((sess) => {
        setSession(sess);
        if (sess.scheduledAt) {
          const d = new Date(sess.scheduledAt);
          setNewDate(d.toISOString().slice(0, 10));
          setNewTime(d.toTimeString().slice(0, 5));
        }
        setNewPrice(sess.priceAmount ? String(sess.priceAmount) : "");
        setNewVisibility(sess.visibility);
      })
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

  const handleClone = async () => {
    if (!newDate) return;
    setCloning(true);
    setError(null);
    try {
      const scheduledAt = new Date(
        `${newDate}T${newTime || "12:00"}`,
      ).toISOString();
      const cloned = await liveSessionsApi.createSession({
        sessionType: "COURSE",
        title: session.title,
        description: session.description || undefined,
        category: session.category || undefined,
        tags: session.tags.length > 0 ? session.tags : undefined,
        scheduledAt,
        maxParticipants: session.maxParticipants || undefined,
        priceAmount: newPrice ? parseInt(newPrice) : undefined,
        currency: session.currency || "DZD",
        visibility: newVisibility,
      });
      router.push(`/live/${cloned.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCloning(false);
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
            {t("manage.clone.cancel")}
          </PodaciumButton>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-6 mb-2">
            {t("manage.clone.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
            {t("manage.clone.description", { title: session.title })}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <SectionCard>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <PodaciumInput
                  label={t("manage.clone.newDate")}
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
                <PodaciumInput
                  label={t("manage.clone.newTime")}
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <PodaciumInput
                  label={t("manage.clone.newPrice")}
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={t("manage.clone.newPriceHint")}
                  min={0}
                />
                <PodaciumSelect
                  label={t("manage.clone.newVisibility")}
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value)}
                  options={[
                    { value: "PUBLIC", label: t("create.form.public") },
                    { value: "UNLISTED", label: t("create.form.unlisted") },
                    { value: "PRIVATE", label: t("create.form.private") },
                  ]}
                />
              </div>
            </div>
          </SectionCard>

          <PodaciumButton
            variant="primary"
            size="lg"
            fullWidth
            className="mt-6"
            disabled={cloning || !newDate}
            onClick={handleClone}
            icon={<Copy className="h-4 w-4" />}
          >
            {cloning
              ? t("manage.clone.creating")
              : t("manage.clone.createClone")}
          </PodaciumButton>
        </main>
      </PageLayout>
    </div>
  );
}
