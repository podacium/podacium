"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Sparkles, AlertCircle } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api, OrganizationResponse } from "@/lib/api";
import { SECTORS, getEnumLabel } from "@/lib/constants/organizations";
import { ALGERIAN_69_WILAYAS } from "@/lib/constants/algeria-wilayas";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface EnterpriseOrgOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (org: OrganizationResponse) => void;
}

export function EnterpriseOrgOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
}: EnterpriseOrgOnboardingModalProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [sector, setSector] = useState("TECHNOLOGY_AND_SOFTWARE");
  const [city, setCity] = useState("ALGIERS");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectorOptions = useMemo(
    () =>
      SECTORS.map((s) => ({
        value: s,
        label: getEnumLabel("sector", s, t),
      })),
    [t],
  );

  const wilayaOptions = useMemo(
    () =>
      ALGERIAN_69_WILAYAS.map((w) => {
        const translatedCity = t(`profile.geo.cities.${w.cityEnum}`);
        const cityName =
          translatedCity &&
          translatedCity !== `profile.geo.cities.${w.cityEnum}`
            ? translatedCity
            : isRTL
              ? w.nameAr
              : w.nameFr;
        return {
          value: w.cityEnum,
          label: `${w.code} - ${cityName}`,
        };
      }),
    [t, isRTL],
  );

  const previewSlug = useMemo(() => {
    if (!name.trim()) return "votre-entreprise";
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 35);
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError(t("organizations.nameMinLength"));
      return;
    }

    try {
      setIsSubmitting(true);
      const newOrg = await api.createOrganization({
        name: name.trim(),
        country: "ALGERIA",
        city: city as any,
        sector: sector as any,
        description: "",
      });

      try {
        await refreshUser();
      } catch (refreshErr) {
        console.warn("Non-fatal user profile refresh warning:", refreshErr);
      }
      if (onSuccess) {
        onSuccess(newOrg);
      }
      onClose();
      router.push(`/organizations/${newOrg.id}`);
    } catch (err: any) {
      console.error("Failed to create organization:", err);
      const rawDetail = err?.response?.data?.detail;
      const detailMessage = Array.isArray(rawDetail)
        ? rawDetail.map((d: any) => d?.msg || JSON.stringify(d)).join(", ")
        : typeof rawDetail === "string"
          ? rawDetail
          : rawDetail?.detail || rawDetail?.message;
      setError(
        detailMessage ||
          err?.message ||
          t("bi.organizations.errors.createFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={t("organizations.createWorkspace")}
      description={t("organizations.createWorkspaceDesc")}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Organization Name */}
        <div>
          <PodaciumInput
            label={t("organizations.name")}
            placeholder={t("organizations.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            leftIcon={<Building2 className="w-4 h-4 text-muted-foreground" />}
          />
          {/* Live Slug Preview */}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground ps-1">
            <Globe className="w-3.5 h-3.5" />
            <span className="font-mono">
              podacium.com/org/
              <span className="text-primary font-semibold">{previewSlug}</span>
            </span>
          </div>
        </div>

        {/* 2. Economic Sector */}
        <PodaciumSelect
          label={t("organizations.sector")}
          options={sectorOptions}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        />

        {/* 3. Headquarters Wilaya */}
        <PodaciumSelect
          label={t("organizations.wilaya")}
          options={wilayaOptions}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          hint={t("organizations.wilayaHint")}
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
            variant="gradient"
            loading={isSubmitting}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {t("organizations.createWorkspaceAction")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
}

export default EnterpriseOrgOnboardingModal;
