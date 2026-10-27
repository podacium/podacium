"use client";

import { useState, useEffect } from "react";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import { PodaciumTabs } from "@/components/design-system/PodaciumTabs";
import { PodaciumInput } from "@/components/design-system/PodaciumInput";
import { PodaciumSelect } from "@/components/design-system/PodaciumSelect";
import { PodaciumTextarea } from "@/components/design-system/PodaciumTextarea";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PhoneInput } from "./PhoneInput";
import { RoleSelector } from "./RoleSelector";
import { SkillsEditor } from "./SkillsEditor";
import { SocialLinksEditor } from "./SocialLinksEditor";
import {
  COUNTRIES,
  COUNTRY_CITIES,
  type CountryKey,
} from "@/lib/constants/geo";
import { findWilayaByCodeOrName } from "@/lib/constants/algeria-wilayas";
import { useTranslations, useBidi } from "@/lib/i18n";
import { User, MapPin, Sparkles, Share2, Save, X } from "lucide-react";
import type { ProfileData } from "./ProfilePageClient";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileData;
  initialEditData: Partial<ProfileData>;
  saving: boolean;
  onSave: (data: Partial<ProfileData>) => Promise<void>;
  onAddSkill: (skill: string) => Promise<void>;
  onRemoveSkill: (skill: string) => Promise<void>;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  profile,
  initialEditData,
  saving,
  onSave,
  onAddSkill,
  onRemoveSkill,
}: ProfileEditModalProps) {
  const t = useTranslations("profile");
  const { dir, textAlign } = useBidi();
  const [activeEditTab, setActiveEditTab] = useState("general");
  const [editData, setEditData] =
    useState<Partial<ProfileData>>(initialEditData);

  useEffect(() => {
    if (isOpen) {
      setEditData(initialEditData);
    }
  }, [isOpen, initialEditData]);

  const handleSave = async () => {
    await onSave(editData);
  };

  const editTabs = [
    {
      id: "general",
      label: t("sections.profileInfo"),
      icon: <User className="w-4 h-4" />,
    },
    {
      id: "contact",
      label: t("fields.country"),
      icon: <MapPin className="w-4 h-4" />,
    },
    {
      id: "skills",
      label: t("sections.skillsOverview"),
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "social",
      label: t("tabs.social"),
      icon: <Share2 className="w-4 h-4" />,
    },
  ];

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("buttons.editProfile")}
      description={t("fields.headlinePlaceholder")}
      size="xl"
    >
      <div dir={dir} className="space-y-6">
        <PodaciumTabs
          tabs={editTabs}
          defaultTab={activeEditTab}
          onChange={setActiveEditTab}
          variant="pills"
          className="mb-4"
        >
          {(tabId) => (
            <div className="pt-4 space-y-5">
              {tabId === "general" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PodaciumInput
                      label={t("fields.fullName")}
                      value={editData.full_name || ""}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          full_name: e.target.value,
                        }))
                      }
                    />
                    <PodaciumInput
                      label={t("sections.pronouns")}
                      value={editData.pronouns || ""}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, pronouns: e.target.value }))
                      }
                      placeholder={t("fields.pronounsPlaceholder")}
                    />
                  </div>
                  <PodaciumInput
                    label={t("fields.headlinePlaceholder")}
                    value={editData.headline || ""}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, headline: e.target.value }))
                    }
                    placeholder={t("fields.headlinePlaceholder")}
                  />
                  <PodaciumInput
                    label={t("fields.taglinePlaceholder")}
                    value={editData.tagline || ""}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, tagline: e.target.value }))
                    }
                    placeholder={t("fields.taglinePlaceholder")}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                        style={{ textAlign: textAlign("left") }}
                      >
                        {t("fields.professionalRole")}
                      </label>
                      <RoleSelector
                        value={editData.role || profile.role}
                        onChange={(v) =>
                          setEditData((p) => ({ ...p, role: v }))
                        }
                      />
                    </div>
                    <PodaciumInput
                      label={t("sections.availability")}
                      value={editData.availability || ""}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          availability: e.target.value,
                        }))
                      }
                      placeholder={t("fields.availabilityPlaceholder")}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                      style={{ textAlign: textAlign("left") }}
                    >
                      {t("fields.professionalBio")}
                    </label>
                    <PodaciumTextarea
                      rows={4}
                      value={editData.bio || ""}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, bio: e.target.value }))
                      }
                      placeholder={t("fields.bioPlaceholder")}
                    />
                  </div>
                </div>
              )}

              {tabId === "contact" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PodaciumInput
                      label={t("fields.email")}
                      type="email"
                      value={editData.email || ""}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                        style={{ textAlign: textAlign("left") }}
                      >
                        {t("fields.phone")}
                      </label>
                      <PhoneInput
                        value={editData.phone || ""}
                        onChange={(v) =>
                          setEditData((p) => ({ ...p, phone: v }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                        style={{ textAlign: textAlign("left") }}
                      >
                        {t("fields.country")}
                      </label>
                      <PodaciumSelect
                        value={editData.country || ""}
                        onChange={(e) => {
                          const nc = e.target.value;
                          const cities = nc
                            ? COUNTRY_CITIES[nc as CountryKey] || []
                            : [];
                          const cc =
                            editData.city && !cities.includes(editData.city)
                              ? ""
                              : editData.city;
                          setEditData((p) => ({ ...p, country: nc, city: cc }));
                        }}
                        options={[
                          { value: "", label: t("geo.selectCountry") },
                          ...COUNTRIES.map((k) => {
                            const translated = t(`geo.countries.${k}`);
                            return {
                              value: k,
                              label:
                                translated &&
                                translated !== `geo.countries.${k}` &&
                                translated !== `profile.geo.countries.${k}`
                                  ? translated
                                  : k.charAt(0) + k.slice(1).toLowerCase(),
                            };
                          }),
                        ]}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                        style={{ textAlign: textAlign("left") }}
                      >
                        {t("fields.city")}
                      </label>
                      <PodaciumSelect
                        value={editData.city || ""}
                        onChange={(e) =>
                          setEditData((p) => ({ ...p, city: e.target.value }))
                        }
                        disabled={!editData.country}
                        options={[
                          {
                            value: "",
                            label: editData.country
                              ? t("geo.selectCity")
                              : t("geo.selectCountryFirst"),
                          },
                          ...(editData.country
                            ? (
                                COUNTRY_CITIES[
                                  editData.country as CountryKey
                                ] || []
                              ).map((k) => {
                                const translated = t(`geo.cities.${k}`);
                                const cityLabel =
                                  translated &&
                                  translated !== `geo.cities.${k}` &&
                                  translated !== `profile.geo.cities.${k}`
                                    ? translated
                                    : k.charAt(0) +
                                      k.slice(1).toLowerCase().replace(/_/g, " ");
                                const wilaya =
                                  editData.country === "ALGERIA"
                                    ? findWilayaByCodeOrName(k)
                                    : undefined;
                                return {
                                  value: k,
                                  label: wilaya
                                    ? `${wilaya.code} - ${cityLabel}`
                                    : cityLabel,
                                };
                              })
                            : []),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {tabId === "skills" && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t("sections.skillsOverview")}
                  </label>
                  <SkillsEditor
                    skills={editData.skills || []}
                    onAdd={onAddSkill}
                    onRemove={onRemoveSkill}
                    isEditing={true}
                  />
                </div>
              )}

              {tabId === "social" && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    {t("tabs.social")}
                  </label>
                  <SocialLinksEditor
                    socialLinks={editData.social_links || {}}
                    onChange={(links) =>
                      setEditData((p) => ({ ...p, social_links: links }))
                    }
                    isEditing={true}
                  />
                </div>
              )}
            </div>
          )}
        </PodaciumTabs>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
          >
            {t("buttons.cancel")}
          </PodaciumButton>
          <PodaciumButton
            size="sm"
            onClick={handleSave}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            {t("buttons.saveProfile")}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
}
