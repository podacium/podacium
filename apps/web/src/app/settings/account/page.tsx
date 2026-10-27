"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  ChevronDown,
  User,
  Mail,
  Phone,
  Globe,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Camera,
  ShieldCheck,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface AccountSettings {
  email: string;
  phone: string;
  language: string;
  timezone: string;
  date_format: string;
  full_name: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AccountSettingsPage() {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { user, refreshUser } = useAuth();
  const { dir, isRTL } = useBidi();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<AccountSettings>({
    email: "",
    phone: "",
    language: "en",
    timezone: "UTC",
    date_format: "YYYY-MM-DD",
    full_name: "",
    avatar_url: "",
    headline: "",
    bio: "",
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res: any = await api.get("/api/v1/settings/account");
      setSettings({
        email: res.email || user?.email || "",
        phone: res.phone_number || res.phone || "",
        language: res.language || "en",
        timezone: res.timezone || "UTC",
        date_format: res.date_format || "YYYY-MM-DD",
        full_name: res.full_name || user?.fullName || "",
        avatar_url:
          res.avatar_url ||
          res.profile_picture_url ||
          user?.profilePictureUrl ||
          "",
        headline: res.headline || "",
        bio: res.bio || "",
      });
    } catch {
      setSettings((s) => ({
        ...s,
        email: user?.email || "",
        full_name: user?.fullName || "",
        avatar_url: user?.profilePictureUrl || "",
      }));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/v1/settings/account", settings);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.message || tUser("settings.account.saveError"));
    }
    setSaving(false);
  };

  const handleDetectTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) update("timezone", tz);
    } catch {}
  };

  const handleRemoveAvatar = async () => {
    update("avatar_url", "");
    try {
      await api.put("/api/v1/settings/account", {
        ...settings,
        avatar_url: "",
      });
      await refreshUser();
    } catch {}
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res: any = await api.upload(
        "/api/v1/files/upload?category=avatars",
        formData,
      );
      const uploadedUrl = res?.url || res?.file_url;
      if (uploadedUrl) {
        update("avatar_url", uploadedUrl);
        await api.put("/api/v1/settings/account", {
          ...settings,
          avatar_url: uploadedUrl,
        });
        await refreshUser();
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err?.message || tUser("settings.account.avatarUploadError"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const update = (k: keyof AccountSettings, v: string) =>
    setSettings((s) => ({ ...s, [k]: v }));

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400 mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {tCommon("loading")}
        </p>
      </div>
    );

  const initials = settings.full_name
    ? settings.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

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
            {tUser("settings.title")}
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {tUser("settings.tabs.account")}
          </span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {tUser("settings.tabs.account")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
              {tUser("settings.account.subtitle")}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{tUser("settings.account.verifiedStatus")}</span>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/40 backdrop-blur-md border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300 text-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 dark:text-red-400" />
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ms-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          variants={itemVariants}
          className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-300 text-sm"
        >
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">
            {tUser("settings.account.saveSuccess")}
          </span>
        </motion.div>
      )}

      {/* Avatar Header Card */}
      <motion.div
        variants={itemVariants}
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] flex flex-col sm:flex-row items-center gap-6"
      >
        <div className="relative group">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          {settings.avatar_url ? (
            <img
              src={settings.avatar_url}
              alt={settings.full_name}
              className="w-24 h-24 rounded-2xl object-cover ring-4 ring-blue-500/20 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-500/20">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-2 -end-2 w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-md flex items-center justify-center text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-105 transition-all"
          >
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="space-y-1 text-center sm:text-start flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {settings.full_name ||
              user?.fullName ||
              tUser("settings.account.defaultUser")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {settings.email || user?.email}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-100 dark:border-blue-800">
              {settings.language.toUpperCase()}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-100 dark:border-purple-800">
              {settings.timezone}
            </span>
            {settings.avatar_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-100 dark:border-red-800 hover:bg-red-100 transition-colors"
              >
                {tUser("settings.account.removePhoto")}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Account Form */}
      <motion.div
        variants={itemVariants}
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 sm:p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.fullName")}</span>
            </label>
            <input
              type="text"
              value={settings.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder={tUser("settings.account.fullNamePlaceholder")}
              className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.email")}</span>
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={tUser("settings.account.emailPlaceholder")}
              className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.phone")}</span>
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder={tUser("settings.account.phonePlaceholder")}
              className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.language")}</span>
            </label>
            <div className="relative">
              <select
                dir={dir}
                value={settings.language}
                onChange={(e) => update("language", e.target.value)}
                className="w-full appearance-none ps-4 pe-10 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none cursor-pointer rtl:text-right ltr:text-left"
              >
                <option
                  value="en"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.languages.en")}
                </option>
                <option
                  value="fr"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.languages.fr")}
                </option>
                <option
                  value="ar"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.languages.ar")}
                </option>
                <option
                  value="kab"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.languages.kab")}
                </option>
              </select>
              <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200 justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {tUser("settings.account.timezone")}
              </span>
              <button
                type="button"
                onClick={handleDetectTimezone}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-normal"
              >
                {tUser("settings.account.detectTimezone")}
              </button>
            </label>
            <div className="relative">
              <select
                dir={dir}
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                className="w-full appearance-none ps-4 pe-10 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none cursor-pointer rtl:text-right ltr:text-left"
              >
                <option
                  value="UTC"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.timezones.utc")}
                </option>
                <option
                  value="Africa/Algiers"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.timezones.algiers")}
                </option>
                <option
                  value="Europe/Paris"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.timezones.paris")}
                </option>
                <option
                  value="America/New_York"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.timezones.newYork")}
                </option>
                <option
                  value="Asia/Dubai"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.timezones.dubai")}
                </option>
              </select>
              <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.headline")}</span>
            </label>
            <input
              type="text"
              value={settings.headline || ""}
              onChange={(e) => update("headline", e.target.value)}
              placeholder={tUser("settings.account.headlinePlaceholder")}
              className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.bio")}</span>
            </label>
            <textarea
              rows={3}
              value={settings.bio || ""}
              onChange={(e) => update("bio", e.target.value)}
              placeholder={tUser("settings.account.bioPlaceholder")}
              className="w-full px-4 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tUser("settings.account.dateFormat")}</span>
            </label>
            <div className="relative">
              <select
                dir={dir}
                value={settings.date_format}
                onChange={(e) => update("date_format", e.target.value)}
                className="w-full appearance-none ps-4 pe-10 py-3 bg-gray-50/50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:bg-slate-900 dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none cursor-pointer rtl:text-right ltr:text-left"
              >
                <option
                  value="YYYY-MM-DD"
                  dir="ltr"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.dateFormats.iso")}
                </option>
                <option
                  value="DD/MM/YYYY"
                  dir="ltr"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.dateFormats.eu")}
                </option>
                <option
                  value="MM/DD/YYYY"
                  dir="ltr"
                  className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                >
                  {tUser("settings.account.dateFormats.us")}
                </option>
              </select>
              <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-slate-800">
          <PodaciumButton onClick={handleSave} disabled={saving} glow>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin me-2" />
                <span>{tCommon("saving")}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 me-2" />
                <span>{tCommon("saveChanges")}</span>
              </>
            )}
          </PodaciumButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
