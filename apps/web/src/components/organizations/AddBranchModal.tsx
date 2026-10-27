"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, AlertCircle, Building } from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import { apiClient } from "@/lib/api/client";
import { ALGERIAN_WILAYAS_58 } from "@/lib/constants/wilayas";
import { COUNTRY_CITIES } from "@/lib/constants/geo";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumSwitch from "@/components/design-system/PodaciumSwitch";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: number;
  onSuccess?: () => void;
}

export function AddBranchModal({
  isOpen,
  onClose,
  orgId,
  onSuccess,
}: AddBranchModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const isArabic = locale === "ar";

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [wilayaCode, setWilayaCode] = useState<number>(16); // Default 16 - Alger
  const [city, setCity] = useState("ALGIERS");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isHeadquarters, setIsHeadquarters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 69 Wilaya select options
  const wilayaOptions = useMemo(() => {
    return ALGERIAN_WILAYAS_58.map((w) => ({
      value: String(w.code),
      label: `${w.codeStr} - ${
        isArabic
          ? w.nameAr
          : locale === "kab"
            ? w.nameKab
            : locale === "en"
              ? w.nameEn
              : w.nameFr
      }`,
    }));
  }, [isArabic, locale]);

  // Valid Algerian City enum options from schema
  const cityOptions = useMemo(() => {
    return COUNTRY_CITIES.ALGERIA.map((c) => {
      const translated = t(`profile.geo.cities.${c}`);
      const label =
        translated && translated !== `profile.geo.cities.${c}`
          ? translated
          : c
              .split("_")
              .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
              .join(" ");
      return {
        value: c,
        label,
      };
    });
  }, [t]);

  // Update default city when wilaya changes
  const handleWilayaChange = (selectedWilayaCodeStr: string) => {
    const codeNum = parseInt(selectedWilayaCodeStr, 10);
    setWilayaCode(codeNum);

    const wilaya = ALGERIAN_WILAYAS_58.find((w) => w.code === codeNum);
    if (wilaya && wilaya.defaultCity) {
      setCity(wilaya.defaultCity);
    }
  };

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setCode("");
      setWilayaCode(16);
      setCity("ALGIERS");
      setAddress("");
      setPhoneNumber("");
      setIsHeadquarters(false);
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

    if (!wilayaCode || wilayaCode < 1 || wilayaCode > 69) {
      const msg = t("organizations.wilayaRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!city) {
      const msg = t("organizations.cityRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.post(`/api/organizations/${orgId}/branches`, {
        name: trimmedName,
        code: code.trim() || undefined,
        wilayaCode: Number(wilayaCode),
        city: city as any,
        address: address.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        isHeadquarters,
      });

      toast.success(t("organizations.branchCreatedSuccess"));

      // Invalidate relevant TanStack queries
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["branches", orgId] });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      const errMsg =
        err?.detail || err?.message || t("organizations.branchCreateFailed");
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
      title={t("organizations.addBranch")}
      description={t("organizations.addBranchDesc")}
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

        {/* 1. Branch Name */}
        <PodaciumInput
          label={t("organizations.branchName")}
          placeholder={t("organizations.branchNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          leftIcon={<Building className="w-4 h-4 text-muted-foreground" />}
        />

        {/* 2. Wilaya 01-58 Selection */}
        <PodaciumSelect
          label={t("organizations.branchWilaya")}
          options={wilayaOptions}
          value={String(wilayaCode)}
          onChange={(e) => handleWilayaChange(e.target.value)}
        />

        {/* 3. City Selection */}
        <PodaciumSelect
          label={t("organizations.branchCity")}
          options={cityOptions}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        {/* 4. Branch Code (e.g. ORN-01) */}
        <PodaciumInput
          label={t("organizations.branchCode")}
          placeholder={t("organizations.branchCodePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
        />

        {/* 5. Physical Address */}
        <PodaciumInput
          label={t("organizations.branchAddress")}
          placeholder={t("organizations.branchAddressPlaceholder")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          leftIcon={<MapPin className="w-4 h-4 text-muted-foreground" />}
        />

        {/* 6. Phone Number */}
        <PodaciumInput
          label={t("organizations.branchPhone")}
          placeholder={t("organizations.branchPhonePlaceholder")}
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          type="tel"
          dir="ltr"
        />

        {/* 7. Headquarters Toggle */}
        <div className="pt-1 pb-1">
          <PodaciumSwitch
            checked={isHeadquarters}
            onChange={(checked) => setIsHeadquarters(checked)}
            label={t("organizations.isHeadquarters")}
            description={t("organizations.isHeadquartersHint")}
          />
        </div>

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
            {t("organizations.addBranch")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
}

export default AddBranchModal;
