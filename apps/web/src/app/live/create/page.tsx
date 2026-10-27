"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Video, Users, GraduationCap } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import {
  SessionForm,
  type SessionFormData,
} from "@/components/live/SessionForm";
import { FreelancerMeetingForm } from "./components/FreelancerMeetingForm";
import { BusinessMeetingForm } from "./components/BusinessMeetingForm";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi } from "@/lib/api/live-sessions";

export default function CreateSessionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!user) {
    router.push("/auth/login");
    return null;
  }

  const role = user.role;

  const handleCourseSubmit = async (form: SessionFormData) => {
    setSaving(true);
    try {
      const scheduledAt = new Date(
        `${form.scheduledAt}T${form.scheduledTime || "12:00"}`,
      ).toISOString();
      const session = await liveSessionsApi.createSession({
        sessionType: "COURSE",
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        thumbnailUrl: form.thumbnailUrl || undefined,
        category: form.category || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        scheduledAt,
        maxParticipants: form.maxParticipants || undefined,
        priceAmount: form.priceAmount ? parseInt(form.priceAmount) : undefined,
        currency: form.currency,
        visibility: form.visibility,
      });
      router.push(`/live/${session.id}`);
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleFreelancerSubmit = async (data: {
    title: string;
    description: string;
    scheduledAt: string;
    contractId: number;
  }) => {
    setSaving(true);
    try {
      const session = await liveSessionsApi.createSession({
        sessionType: "MEETING",
        contractId: data.contractId,
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        visibility: "PRIVATE",
      });
      router.push(`/live/${session.id}`);
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleBusinessSubmit = async (data: {
    title: string;
    description: string;
    scheduledAt: string;
    organizationId: number;
  }) => {
    setSaving(true);
    try {
      const session = await liveSessionsApi.createSession({
        sessionType: "MEETING",
        orgOnly: true,
        organizationId: data.organizationId,
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        visibility: "PRIVATE",
      });
      router.push(`/live/${session.id}`);
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

          {role === "FREELANCER" && (
            <>
              <div className="flex items-center gap-3 mt-6 mb-8">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Video className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {t("create.freelancer.title")}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {t("create.freelancer.subtitle")}
                  </p>
                </div>
              </div>
              <FreelancerMeetingForm
                onSubmit={handleFreelancerSubmit}
                isSubmitting={saving}
                submitLabel={t("create.freelancer.submit")}
                submittingLabel={t("create.freelancer.submitting")}
              />
            </>
          )}

          {role === "BUSINESS" && (
            <>
              <div className="flex items-center gap-3 mt-6 mb-8">
                <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {t("create.business.title")}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {t("create.business.subtitle")}
                  </p>
                </div>
              </div>
              <BusinessMeetingForm
                user={user}
                onSubmit={handleBusinessSubmit}
                isSubmitting={saving}
                submitLabel={t("create.business.submit")}
                submittingLabel={t("create.business.submitting")}
              />
            </>
          )}

          {(role === "INSTRUCTOR" || role === "ADMIN") && (
            <>
              <div className="flex items-center gap-3 mt-6 mb-8">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {t("create.title")}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {t("create.subtitle")}
                  </p>
                </div>
              </div>
              <SessionForm
                onSubmit={handleCourseSubmit}
                isSubmitting={saving}
                submitLabel={t("create.form.submit")}
                submittingLabel={t("create.form.submitting")}
              />
            </>
          )}

          {role === "STUDENT" && (
            <div className="mt-16 text-center">
              <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-2">
                {t("create.studentNotAllowed.title")}
              </h2>
              <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                {t("create.studentNotAllowed.description")}
              </p>
              <PodaciumButton
                variant="primary"
                onClick={() => router.push("/profile")}
              >
                {t("create.studentNotAllowed.upgradeButton")}
              </PodaciumButton>
            </div>
          )}
        </main>
      </PageLayout>
    </div>
  );
}
