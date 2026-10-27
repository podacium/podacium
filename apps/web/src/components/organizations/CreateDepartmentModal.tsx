"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Network, AlertCircle } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { apiClient } from "@/lib/api/client";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: number;
  onSuccess?: () => void;
}

export function CreateDepartmentModal({
  isOpen,
  onClose,
  orgId,
  onSuccess,
}: CreateDepartmentModalProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from department name unless manually modified
  const generatedSlug = useMemo(() => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }, [name]);

  useEffect(() => {
    if (!isSlugManuallyEdited) {
      setSlug(generatedSlug);
    }
  }, [generatedSlug, isSlugManuallyEdited]);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSlug("");
      setCode("");
      setDescription("");
      setIsSlugManuallyEdited(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      const msg = t("organizations.nameRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post(`/api/organizations/${orgId}/departments`, {
        name: trimmedName,
        slug: slug.trim() || undefined,
        code: code.trim() || undefined,
        description: description.trim() || undefined,
      });

      toast.success(t("organizations.departmentCreatedSuccess"));

      // Invalidate relevant TanStack queries
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["departments", orgId] });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      const errMsg =
        err?.detail ||
        err?.message ||
        t("organizations.departmentCreateFailed");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("organizations.createDepartment")}
      description={t("organizations.createDepartmentDesc")}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Department Name */}
        <PodaciumInput
          label={t("organizations.departmentName")}
          placeholder={t("organizations.departmentNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          leftIcon={<Network className="w-4 h-4 text-muted-foreground" />}
        />

        {/* 2. Slug / Identifier */}
        <PodaciumInput
          label={t("organizations.departmentSlug")}
          placeholder={t("organizations.departmentSlugPlaceholder")}
          value={slug}
          onChange={(e) => {
            setIsSlugManuallyEdited(true);
            setSlug(e.target.value);
          }}
          hint={slug ? `slug: ${slug}` : undefined}
          dir="ltr"
        />

        {/* 3. Cost Center Code */}
        <PodaciumInput
          label={t("organizations.costCenterCode")}
          placeholder={t("organizations.costCenterCodePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
        />

        {/* 4. Description */}
        <PodaciumTextarea
          label={t("organizations.departmentDescription")}
          placeholder={t("organizations.departmentDescPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {/* Action Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border">
          <PodaciumButton
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </PodaciumButton>
          <PodaciumButton
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            {t("organizations.createDepartment")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
}

export default CreateDepartmentModal;
