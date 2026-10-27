"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { SectionCard } from "@/components/SectionComponents";
import type { UserProfileResponse } from "@/lib/api/auth";

interface Props {
  user: UserProfileResponse;
  onSubmit: (data: {
    title: string;
    description: string;
    scheduledAt: string;
    organizationId: number;
  }) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

export function BusinessMeetingForm({
  user,
  onSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: Props) {
  const t = useTranslations("live");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [organizationId, setOrganizationId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const memberships = (user as any).memberships ?? [];
  const orgs = memberships.map((m: any) => m.organization).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError(t("create.form.validation.titleRequired"));
      return;
    }
    if (!scheduledAt) {
      setError(t("create.form.validation.dateRequired"));
      return;
    }
    if (!organizationId) {
      setError(t("create.business.errors.orgRequired"));
      return;
    }

    const dateStr = new Date(
      `${scheduledAt}T${scheduledTime || "12:00"}`,
    ).toISOString();

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        scheduledAt: dateStr,
        organizationId: Number(organizationId),
      });
    } catch (err: any) {
      setError(err.message || t("create.form.validation.generic"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <SectionCard title={t("create.business.section.meetingDetails")}>
        <div className="space-y-6">
          <PodaciumInput
            label={t("create.form.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("create.business.form.titlePlaceholder")}
            maxLength={200}
            required
          />
          <PodaciumTextarea
            label={t("create.form.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("create.business.form.descriptionPlaceholder")}
            rows={3}
          />
          <PodaciumSelect
            label={t("create.business.form.organization")}
            value={String(organizationId)}
            onChange={(e) =>
              setOrganizationId(e.target.value ? Number(e.target.value) : "")
            }
            placeholder={t("create.business.form.orgPlaceholder")}
            options={orgs.map((o: any) => ({
              value: String(o.id),
              label: o.name || `Organization #${o.id}`,
            }))}
          />
          {orgs.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t("create.business.errors.noOrgs")}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t("create.section.schedule")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PodaciumInput
            label={t("create.form.date")}
            type="date"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
          <PodaciumInput
            label={t("create.form.time")}
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {t("create.business.form.orgOnlyHint")}
        </p>
      </SectionCard>

      <PodaciumButton
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isSubmitting}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </PodaciumButton>
    </form>
  );
}
