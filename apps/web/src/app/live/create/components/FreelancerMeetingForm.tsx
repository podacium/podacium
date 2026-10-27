"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "@/lib/i18n";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { SectionCard } from "@/components/SectionComponents";
import { freelancingApi } from "@/lib/api/freelancing";
import type { ContractResponse } from "@/lib/api/freelancing";

interface Props {
  onSubmit: (data: {
    title: string;
    description: string;
    scheduledAt: string;
    contractId: number;
  }) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

export function FreelancerMeetingForm({
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
  const [contractId, setContractId] = useState<number | "">("");
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    freelancingApi
      .getContracts()
      .then((res) => {
        const active =
          (res as any).filter?.(
            (c: any) => c.status === "IN_PROGRESS" || c.status === "ACTIVE",
          ) ?? [];
        setContracts(active as ContractResponse[]);
      })
      .catch(() => {
        // fallback: try the raw list endpoint
        setContracts([]);
      })
      .finally(() => setLoadingContracts(false));
  }, []);

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
    if (!contractId) {
      setError(t("create.freelancer.errors.contractRequired"));
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
        contractId: Number(contractId),
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

      <SectionCard title={t("create.freelancer.section.meetingDetails")}>
        <div className="space-y-6">
          <PodaciumInput
            label={t("create.form.title")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("create.freelancer.form.titlePlaceholder")}
            maxLength={200}
            required
          />
          <PodaciumTextarea
            label={t("create.form.description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("create.freelancer.form.descriptionPlaceholder")}
            rows={3}
          />
          <PodaciumSelect
            label={t("create.freelancer.form.contract")}
            value={String(contractId)}
            onChange={(e) =>
              setContractId(e.target.value ? Number(e.target.value) : "")
            }
            placeholder={
              loadingContracts
                ? t("create.freelancer.form.loadingContracts")
                : t("create.freelancer.form.contractPlaceholder")
            }
            options={contracts.map((c) => ({
              value: String(c.id),
              label: `${c.project?.title || `Contract #${c.id}`} — ${c.client?.fullName || ""}`,
            }))}
            disabled={loadingContracts}
          />
          {!loadingContracts && contracts.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t("create.freelancer.errors.noActiveContracts")}
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
