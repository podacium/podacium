"use client";

import { useState } from "react";
import { api, OrganizationResponse } from "@/lib/api";
import PodaciumDangerModal from "@/components/design-system/PodaciumDangerModal";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization?: OrganizationResponse | null;
  count?: number;
  onBulkConfirm?: () => Promise<void>;
  t: (key: string) => string;
}

export function DeleteModal({
  isOpen,
  onClose,
  onSuccess,
  organization,
  count = 1,
  onBulkConfirm,
  t,
}: DeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBulk = count > 1;
  const expectedText = isBulk
    ? t("bi.organizations.delete.confirm")
    : organization?.name || t("bi.organizations.delete.confirm");

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (isBulk && onBulkConfirm) {
        await onBulkConfirm();
      } else if (organization) {
        await api.deleteOrganization(organization.id);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t("bi.organizations.delete.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const title = isBulk
    ? t("bi.organizations.list.bulkDelete.confirmTitle").replace(
        "{count}",
        String(count),
      )
    : t("bi.organizations.delete.title");

  const description = isBulk
    ? t("bi.organizations.list.bulkDelete.confirmMessage").replace(
        "{count}",
        String(count),
      )
    : t("bi.organizations.delete.message").replace(
        "{name}",
        organization?.name || "",
      );

  const actionLabel = isBulk
    ? t("bi.organizations.list.bulkDelete.button").replace(
        "{count}",
        String(count),
      )
    : t("bi.organizations.delete.confirm");

  return (
    <PodaciumDangerModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title={title}
      description={error ? `${description} — ${error}` : description}
      confirmTextExpected={expectedText}
      actionLabel={actionLabel}
      isPending={submitting}
    />
  );
}
