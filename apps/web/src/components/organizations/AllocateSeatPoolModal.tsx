"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Mail, AlertCircle, Building2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { apiClient } from "@/lib/api/client";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export interface LicensePoolItem {
  id: number;
  moduleId?: string | null;
  pathId?: string | null;
  totalSeats: number;
  allocatedSeats: number;
  expiresAt?: string | null;
}

export interface DepartmentItem {
  id: number;
  name: string;
  code?: string | null;
}

export interface AllocateSeatPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: number;
  pools?: LicensePoolItem[];
  departments?: DepartmentItem[];
  preselectedPoolId?: number | null;
  onSuccess?: () => void;
}

export function AllocateSeatPoolModal({
  isOpen,
  onClose,
  orgId,
  pools = [],
  departments = [],
  preselectedPoolId = null,
  onSuccess,
}: AllocateSeatPoolModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [selectedPoolId, setSelectedPoolId] = useState<string>(() => {
    if (preselectedPoolId) return String(preselectedPoolId);
    if (pools.length > 0) {
      const activePool = pools.find(
        (p) => p.totalSeats > (p.allocatedSeats || 0),
      );
      return activePool ? String(activePool.id) : String(pools[0].id);
    }
    return "";
  });
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected pool
  useEffect(() => {
    if (preselectedPoolId) {
      setSelectedPoolId(String(preselectedPoolId));
    } else if (pools.length > 0) {
      const activePool = pools.find(
        (p) => p.totalSeats > (p.allocatedSeats || 0),
      );
      setSelectedPoolId(
        activePool ? String(activePool.id) : String(pools[0].id),
      );
    }
  }, [preselectedPoolId, pools, isOpen]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setDepartmentId("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const currentPool = useMemo(() => {
    return pools.find((p) => String(p.id) === selectedPoolId);
  }, [pools, selectedPoolId]);

  const remainingSeats = useMemo(() => {
    if (!currentPool) return 0;
    return Math.max(
      0,
      currentPool.totalSeats - (currentPool.allocatedSeats || 0),
    );
  }, [currentPool]);

  // Options for pool select
  const poolOptions = useMemo(() => {
    return pools.map((p) => {
      const remaining = Math.max(0, p.totalSeats - (p.allocatedSeats || 0));
      const descriptor = p.moduleId || p.pathId || `Pool #${p.id}`;
      return {
        value: String(p.id),
        label: `${descriptor} (${remaining}/${p.totalSeats} seats)`,
      };
    });
  }, [pools]);

  // Options for department select
  const departmentOptions = useMemo(() => {
    const list = departments.map((d) => ({
      value: String(d.id),
      label: d.code ? `${d.name} (${d.code})` : d.name,
    }));
    return [
      { value: "", label: t("organizations.targetDepartmentPlaceholder") },
      ...list,
    ];
  }, [departments, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const poolIdNum = parseInt(selectedPoolId, 10);
    if (!poolIdNum || isNaN(poolIdNum)) {
      const msg = t("organizations.poolRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      const msg = t("organizations.emailRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (currentPool && remainingSeats <= 0) {
      const msg = t("organizations.noSeatsAvailable");
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post(
        `/api/organizations/${orgId}/edtech/pools/${poolIdNum}/allocate`,
        {
          email: trimmedEmail,
        },
      );

      toast.success(
        t("organizations.seatAllocatedSuccess").replace(
          "{email}",
          trimmedEmail,
        ),
      );

      // Invalidate relevant TanStack queries
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["edtech-pools", orgId] });
      queryClient.invalidateQueries({ queryKey: ["pools", orgId] });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      const errMsg =
        err?.detail || err?.message || t("organizations.seatAllocateFailed");
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
      title={t("organizations.allocateSeat")}
      description={t("organizations.allocateSeatDesc")}
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. License Pool / Course / Module */}
        {poolOptions.length > 0 ? (
          <div>
            <PodaciumSelect
              label={t("organizations.selectPool")}
              options={poolOptions}
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              hint={
                currentPool
                  ? t("organizations.availableSeats")
                      .replace("{available}", String(remainingSeats))
                      .replace("{total}", String(currentPool.totalSeats))
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span>{t("organizations.noPools")}</span>
          </div>
        )}

        {/* 2. Employee Email */}
        <PodaciumInput
          label={t("organizations.employeeEmail")}
          placeholder={t("organizations.employeeEmailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          autoFocus
          leftIcon={<Mail className="w-4 h-4 text-muted-foreground" />}
          dir="ltr"
        />

        {/* 3. Target Department (Optional assignment) */}
        {departments.length > 0 && (
          <PodaciumSelect
            label={t("organizations.targetDepartment")}
            options={departmentOptions}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          />
        )}

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
            disabled={poolOptions.length === 0 || remainingSeats <= 0}
          >
            {t("organizations.allocateSeat")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
}

export default AllocateSeatPoolModal;
