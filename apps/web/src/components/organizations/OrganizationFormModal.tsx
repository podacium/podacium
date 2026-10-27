"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { api, OrganizationResponse } from "@/lib/api";
import {
  COUNTRY_CITY_MAP,
  SECTORS,
  getEnumLabel,
} from "@/lib/constants/organizations";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface OrganizationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization?: OrganizationResponse;
  t: (key: string) => string;
}

export function OrganizationFormModal({
  isOpen,
  onClose,
  onSuccess,
  organization,
  t,
}: OrganizationFormModalProps) {
  const [formData, setFormData] = useState({
    name: organization?.name || "",
    description: organization?.description || "",
    country: organization?.country || "",
    city: organization?.city || "",
    sector: organization?.sector || "",
    website: organization?.website || "",
  });

  const [availableCities, setAvailableCities] = useState<string[]>(
    organization?.country ? COUNTRY_CITY_MAP[organization.country] || [] : [],
  );

  const handleCountryChange = (country: string) => {
    setFormData((prev) => ({ ...prev, country, city: "" }));
    setAvailableCities(COUNTRY_CITY_MAP[country] || []);
  };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        description: organization.description || "",
        country: organization.country || "",
        city: organization.city || "",
        sector: organization.sector || "",
        website: organization.website || "",
      });
      if (organization.country) {
        setAvailableCities(COUNTRY_CITY_MAP[organization.country] || []);
      }
    }
  }, [organization]);

  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || submitting) return;

    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      if (organization) {
        await api.updateOrganization(organization.id, formData as any);
      } else {
        await api.createOrganization(formData as any);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t("bi.organizations.form.error.generic"));
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const countryOptions = Object.keys(COUNTRY_CITY_MAP).map((country) => ({
    value: country,
    label: getEnumLabel("country", country, t),
  }));

  const cityOptions = availableCities.map((city) => ({
    value: city,
    label: getEnumLabel("city", city, t),
  }));

  const sectorOptions = SECTORS.map((sector) => ({
    value: sector,
    label: getEnumLabel("sector", sector, t),
  }));

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        organization
          ? t("bi.organizations.form.title.edit")
          : t("bi.organizations.form.title.create")
      }
    >
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PodaciumInput
          label={t("bi.organizations.form.name.label")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t("bi.organizations.form.name.placeholder")}
          required
        />

        <PodaciumTextarea
          label={t("bi.organizations.form.description.label")}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder={t("bi.organizations.form.description.placeholder")}
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PodaciumSelect
            id="country"
            label={t("bi.organizations.form.geography.label")}
            placeholder={t("bi.organizations.form.geography.placeholder")}
            options={countryOptions}
            value={formData.country}
            onChange={(e) => handleCountryChange(e.target.value)}
            required
          />

          <PodaciumSelect
            id="city"
            label={t("bi.organizations.enums.city_label")}
            placeholder={t("bi.organizations.enums.select_city")}
            options={cityOptions}
            value={formData.city}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, city: e.target.value }))
            }
            disabled={!formData.country}
            required
          />
        </div>

        <PodaciumSelect
          id="sector"
          label={t("bi.organizations.form.sector.label")}
          placeholder={t("bi.organizations.form.sector.placeholder")}
          options={sectorOptions}
          value={formData.sector}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, sector: e.target.value }))
          }
          required
        />

        <PodaciumInput
          type="url"
          label={t("bi.organizations.form.website.label")}
          value={formData.website}
          onChange={(e) =>
            setFormData({ ...formData, website: e.target.value })
          }
          placeholder={t("bi.organizations.form.website.placeholder")}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <PodaciumButton
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {t("bi.organizations.form.cancel")}
          </PodaciumButton>
          <PodaciumButton
            type="submit"
            variant="gradient"
            loading={submitting}
            icon={<CheckCircle className="w-4 h-4" />}
          >
            {organization
              ? t("bi.organizations.form.submit.update")
              : t("bi.organizations.form.submit.create")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
}
