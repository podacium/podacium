"use client";

import { useEffect, useState, useCallback } from "react";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import { PodaciumSelect } from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTranslations, useBidi } from "@/lib/i18n";

interface SectionVisibility {
  section: string;
  visibility: "public" | "followers" | "connections" | "private";
}

const SECTIONS = [
  { key: "bio", visibilityKey: "bio" },
  { key: "headline", visibilityKey: "headline" },
  { key: "tagline", visibilityKey: "tagline" },
  { key: "pronouns", visibilityKey: "pronouns" },
  { key: "coverImage", visibilityKey: "coverImage" },
  { key: "location", visibilityKey: "location" },
  { key: "socialLinks", visibilityKey: "socialLinks" },
  { key: "availability", visibilityKey: "availability" },
  { key: "timezone", visibilityKey: "timezone" },
  { key: "profileViews", visibilityKey: "profileViews" },
  { key: "lastActive", visibilityKey: "lastActive" },
  { key: "followers", visibilityKey: "followers" },
  { key: "following", visibilityKey: "following" },
  { key: "badges", visibilityKey: "badges" },
  { key: "skills", visibilityKey: "skills" },
  { key: "activityFeed", visibilityKey: "activityFeed" },
];

const VISIBILITY_OPTIONS = [
  { value: "inherit", labelKey: "common:visibility.inherit" },
  { value: "public", labelKey: "common:visibility.public" },
  { value: "followers", labelKey: "common:visibility.followers" },
  { value: "private", labelKey: "common:visibility.private" },
];

interface SectionVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SectionVisibilityModal({
  isOpen,
  onClose,
}: SectionVisibilityModalProps) {
  const t = useTranslations("user");
  const { dir } = useBidi();
  const [visibilities, setVisibilities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    apiClient
      .get<Record<string, string>>("/api/profiles/me/privacy/sections")
      .then((data) => setVisibilities(data))
      .catch(() => setError(t("privacy.sections.loadError")))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleChange = useCallback((section: string, value: string) => {
    setVisibilities((prev) => ({ ...prev, [section]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch("/api/profiles/me/privacy/sections", visibilities);
      onClose();
    } catch {
      setError(t("privacy.sections.saveError"));
    } finally {
      setSaving(false);
    }
  }, [visibilities, onClose]);

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("privacy.sections.title")}
      description={t("privacy.sections.description")}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="space-y-4" dir={dir}>
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800">
            <div className="col-span-6">{t("privacy.sections.section")}</div>
            <div className="col-span-6">{t("privacy.sections.visibility")}</div>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {SECTIONS.map(({ key, visibilityKey }) => (
              <div
                key={key}
                className="grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="col-span-6">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {t(`privacy.sections.${visibilityKey}`)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t(`privacy.sections.${visibilityKey}Desc`)}
                  </p>
                </div>
                <div className="col-span-6">
                  <PodaciumSelect
                    value={visibilities[key] || "inherit"}
                    onChange={(e) => handleChange(key, e.target.value)}
                    options={VISIBILITY_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(o.labelKey),
                    }))}
                    selectSize="sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("privacy.sections.footerNote")}
            </p>
            <div className="flex gap-2">
              <PodaciumButton variant="outline" size="sm" onClick={onClose}>
                {t("privacy.buttons.cancel")}
              </PodaciumButton>
              <PodaciumButton size="sm" onClick={handleSave} disabled={saving}>
                {saving
                  ? t("privacy.sections.saving")
                  : t("privacy.buttons.saveChanges")}
              </PodaciumButton>
            </div>
          </div>
        </div>
      )}
    </PodaciumModal>
  );
}
