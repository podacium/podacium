"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  ChevronDown,
  Shield,
  Eye,
  Search,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface VisibilitySettings {
  [key: string]: string;
}

const SECTIONS = [
  "bio",
  "headline",
  "tagline",
  "pronouns",
  "cover_image",
  "location",
  "social_links",
  "availability",
  "timezone",
  "profile_views",
  "last_active",
  "followers",
  "following",
  "badges",
  "skills",
  "activity_feed",
  "username_history",
];

const VISIBILITY_OPTIONS = ["public", "followers", "connections", "private"];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function SectionVisibilityRow({
  section,
  value,
  onChange,
}: {
  section: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslations("user");
  const { dir } = useBidi();
  const label = t(`settings.privacy.sections.${section}`);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/60 dark:border-slate-800/80">
      <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
        {label}
      </span>
      <div className="relative">
        <select
          dir={dir}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="appearance-none ps-3 pe-8 py-1.5 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer rtl:text-right ltr:text-left"
        >
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(`settings.privacy.options.${o}`)}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function PrivacySettingsPage() {
  const { t } = useTranslations("user");
  const { dir, isRTL } = useBidi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [visibility, setVisibility] = useState<VisibilitySettings>({});
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [searchVisible, setSearchVisible] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const [sections, privacy] = await Promise.all([
        api.get<any>("/api/v1/profiles/me/privacy/sections"),
        api.get<any>("/api/v1/settings/privacy").catch(() => ({})),
      ]);
      const v: VisibilitySettings = {};
      for (const s of SECTIONS) v[s] = sections[`${s}_visibility`] || "public";
      setVisibility(v);
      setProfileVisibility(privacy.profile_visibility || "public");
      setSearchVisible(privacy.search_visibility !== false);
      setShowActivity(privacy.show_activity_status !== false);
    } catch {
      /* use defaults */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const sections: Record<string, string> = {};
      for (const s of SECTIONS)
        sections[`${s}_visibility`] = visibility[s] || "public";
      await api.patch("/api/v1/profiles/me/privacy/sections", sections);
      await api
        .put("/api/v1/settings/privacy", {
          profile_visibility: profileVisibility,
          search_visibility: searchVisible,
          show_activity_status: showActivity,
        })
        .catch(() => {});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || t("settings.privacy.sections.saveError"));
    }
    setSaving(false);
  };

  const updateSection = (section: string, value: string) =>
    setVisibility((v) => ({ ...v, [section]: value }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("settings.privacy.sections.loading")}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      dir={dir}
    >
      <motion.div variants={itemVariants}>
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-4">
          <Link
            href="/dashboard"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <Link
            href="/settings"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t("settings.title")}
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("settings.tabs.privacy")}
          </span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
          {t("settings.privacy.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
          {t("settings.privacy.subtitle")}
        </p>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <button
            type="button"
            aria-label={t("settings.privacy.sections.title")}
            onClick={() => setError(null)}
            className="ms-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            {t("settings.success.privacyUpdated")}
          </span>
        </motion.div>
      )}

      {/* Global Profile Visibility */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 sm:p-8 space-y-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>{t("settings.privacy.globalScope")}</span>
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {t("settings.privacy.profileVisibility")}
            </span>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {t("settings.privacy.profileVisibilityDesc")}
            </p>
          </div>
          <div className="relative">
            <select
              dir={dir}
              value={profileVisibility}
              onChange={(e) => setProfileVisibility(e.target.value)}
              aria-label={t("settings.privacy.profileVisibility")}
              className="appearance-none ps-3.5 pe-9 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer rtl:text-right ltr:text-left"
            >
              <option value="public">
                {t("settings.privacy.options.public")}
              </option>
              <option value="connections">
                {t("settings.privacy.options.connections")}
              </option>
              <option value="private">
                {t("settings.privacy.options.private")}
              </option>
            </select>
            <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </motion.div>

      {/* Per Section Visibility */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 sm:p-8 space-y-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>{t("settings.privacy.granularField")}</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
          {t("settings.privacy.granularFieldDesc")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SECTIONS.map((s) => (
            <SectionVisibilityRow
              key={s}
              section={s}
              value={visibility[s] || "public"}
              onChange={(v) => updateSection(s, v)}
            />
          ))}
        </div>
      </motion.div>

      {/* Search & Activity Status */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 sm:p-8 space-y-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Search className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>{t("settings.privacy.discoverabilityPresence")}</span>
        </h2>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {t("settings.privacy.searchIndexing")}
            </span>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {t("settings.privacy.searchIndexingDesc")}
            </p>
          </div>
          <button
            dir="ltr"
            type="button"
            role="switch"
            aria-checked={searchVisible}
            aria-label={t("settings.privacy.searchIndexing")}
            onClick={() => setSearchVisible(!searchVisible)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
              searchVisible ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-800/90"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-200 ${
                searchVisible ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {t("settings.privacy.liveActivity")}
            </span>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {t("settings.privacy.activityStatusDesc")}
            </p>
          </div>
          <button
            dir="ltr"
            type="button"
            role="switch"
            aria-checked={showActivity}
            aria-label={t("settings.privacy.liveActivity")}
            onClick={() => setShowActivity(!showActivity)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
              showActivity ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-800/90"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-200 ${
                showActivity ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </motion.div>

      <div className="flex justify-end">
        <PodaciumButton onClick={handleSave} disabled={saving} glow>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              <span>{t("settings.privacy.sections.saving")}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 me-2" />
              <span>{t("settings.buttons.saveChanges")}</span>
            </>
          )}
        </PodaciumButton>
      </div>
    </motion.div>
  );
}
