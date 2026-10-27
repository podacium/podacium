"use client";

import { useState, useEffect } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Type,
  Maximize,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  font_size: "small" | "medium" | "large";
  density: "compact" | "comfortable" | "spacious";
  reduced_motion: boolean;
  high_contrast: boolean;
}

export default function AppearanceSettingsPage() {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { dir, isRTL } = useBidi();

  const {
    setTheme,
    setFontSize,
    setDensity,
    setReducedMotion,
    setHighContrast,
  } = useTheme();

  const [settings, setSettings] = useState<AppearanceSettings>({
    theme: "system",
    font_size: "medium",
    density: "comfortable",
    reduced_motion: false,
    high_contrast: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<AppearanceSettings>("/api/v1/settings/appearance")
      .then((data) => {
        setSettings(data);
        setTheme(data.theme);
        setFontSize(data.font_size);
        setDensity(data.density);
        setReducedMotion(data.reduced_motion);
        setHighContrast(data.high_contrast);
        setLoading(false);
      })
      .catch(() => {
        setError(tUser("settings.appearance.loadError"));
        setLoading(false);
      });
  }, [
    setTheme,
    setFontSize,
    setDensity,
    setReducedMotion,
    setHighContrast,
    tUser,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "data-font-size",
          settings.font_size,
        );
        document.documentElement.setAttribute("data-density", settings.density);
      }
      await api.put("/api/v1/settings/appearance", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(tUser("settings.appearance.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    if (key === "theme") setTheme(value as "light" | "dark" | "system");
    else if (key === "font_size") {
      setFontSize(value as "small" | "medium" | "large");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "data-font-size",
          value as string,
        );
      }
    } else if (key === "density") {
      setDensity(value as "compact" | "comfortable" | "spacious");
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-density", value as string);
      }
    } else if (key === "reduced_motion") {
      setReducedMotion(Boolean(value));
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "data-reduced-motion",
          String(value),
        );
      }
    } else if (key === "high_contrast") {
      setHighContrast(Boolean(value));
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "data-high-contrast",
          String(value),
        );
      }
    }
  };

  if (loading)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {tCommon("loading")}
        </p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <p className="text-gray-700 dark:text-slate-200 font-medium">{error}</p>
        <PodaciumButton
          onClick={() => window.location.reload()}
          variant="outline"
        >
          <RefreshCw className="w-4 h-4 me-2" />
          {tCommon("retry")}
        </PodaciumButton>
      </div>
    );

  return (
    <div className="space-y-8" dir={dir}>
      <div>
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
            {tUser("settings.tabs.appearance")}
          </span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
          {tUser("settings.appearance.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
          {tUser("settings.appearance.subtitle")}
        </p>
      </div>

      <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 sm:p-8 space-y-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
        {/* Theme Status Info Badge */}
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-xs">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>{tUser("settings.appearance.themeSavedNotice")}</span>
        </div>

        {/* Theme Radio Group */}
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>{tUser("settings.appearance.themeGroup")}</span>
          </h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            role="radiogroup"
            aria-label={tUser("settings.appearance.themeGroup")}
          >
            {[
              {
                value: "light",
                icon: Sun,
                label: tUser("settings.appearance.light"),
                color: "text-amber-500",
                bg: "bg-amber-50/50 dark:bg-slate-800/90 border-amber-200 dark:border-amber-500/40 text-gray-900 dark:text-slate-100",
              },
              {
                value: "dark",
                icon: Moon,
                label: tUser("settings.appearance.dark"),
                color: "text-indigo-500",
                bg: "bg-slate-900 dark:bg-slate-800 border-slate-700 text-white",
              },
              {
                value: "system",
                icon: Monitor,
                label: tUser("settings.appearance.system"),
                color: "text-blue-500",
                bg: "bg-blue-50/50 dark:bg-slate-800/90 border-blue-200 dark:border-blue-500/40 text-gray-900 dark:text-slate-100",
              },
            ].map(({ value, icon: Icon, label, color, bg }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                onClick={() =>
                  update("theme", value as "light" | "dark" | "system")
                }
                className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 ${
                  settings.theme === value
                    ? `${bg} ring-2 ring-blue-500 shadow-md scale-[1.02]`
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-gray-700 dark:text-slate-300"
                }`}
              >
                <Icon className={`w-8 h-8 ${color}`} />
                <span className="font-semibold text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size Radio Group */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-8">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Type className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <span>{tUser("settings.appearance.fontSizeGroup")}</span>
          </h2>
          <div
            className="flex flex-col sm:flex-row gap-3"
            role="radiogroup"
            aria-label={tUser("settings.appearance.fontSizeGroup")}
          >
            {["small", "medium", "large"].map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={settings.font_size === size}
                onClick={() =>
                  update("font_size", size as "small" | "medium" | "large")
                }
                className={`flex-1 p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                  settings.font_size === size
                    ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-900/60"
                }`}
              >
                <span
                  className={`block font-bold text-gray-900 dark:text-slate-100 ${size === "large" ? "text-xl" : size === "medium" ? "text-base" : "text-sm"}`}
                >
                  Aa
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-1 block capitalize">
                  {tUser(`settings.appearance.fontSize.${size}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Layout Density */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-8">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Maximize className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <span>{tUser("settings.appearance.densityGroup")}</span>
          </h2>
          <div
            className="flex flex-col sm:flex-row gap-3"
            role="radiogroup"
            aria-label={tUser("settings.appearance.densityGroup")}
          >
            {[
              {
                d: "compact",
                label: tUser("settings.appearance.density.compact"),
                sub: tUser("settings.appearance.density.compactDesc"),
              },
              {
                d: "comfortable",
                label: tUser("settings.appearance.density.comfortable"),
                sub: tUser("settings.appearance.density.comfortableDesc"),
              },
              {
                d: "spacious",
                label: tUser("settings.appearance.density.spacious"),
                sub: tUser("settings.appearance.density.spaciousDesc"),
              },
            ].map(({ d, label, sub }) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={settings.density === d}
                onClick={() =>
                  update("density", d as "compact" | "comfortable" | "spacious")
                }
                className={`flex-1 p-4 rounded-2xl border-2 text-center transition-all duration-200 ${
                  settings.density === d
                    ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500 shadow-xs"
                    : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white/60 dark:bg-slate-900/60"
                }`}
              >
                <span className="font-semibold text-sm text-gray-900 dark:text-slate-100 capitalize">
                  {label}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400 mt-1 block">
                  {sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Canvas */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-8">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <span>{tUser("settings.appearance.previewTitle")}</span>
          </h2>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/80 border border-gray-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {tUser("settings.appearance.previewCardTitle")}
              </span>
              <span className="text-xs font-mono text-gray-400">
                {tUser("settings.appearance.previewMeta", {
                  font: tUser(
                    `settings.appearance.fontSize.${settings.font_size}`,
                  ),
                  density: tUser(
                    `settings.appearance.density.${settings.density}`,
                  ),
                })}
              </span>
            </div>
            <h3 className="font-extrabold text-gray-900 dark:text-slate-100">
              {tUser("settings.appearance.previewHeading")}
            </h3>
            <p className="text-gray-600 dark:text-slate-400">
              {tUser("settings.appearance.previewText")}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 transition-colors"
              >
                {tUser("settings.appearance.previewPrimaryBtn")}
              </button>
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                {tUser("settings.appearance.previewSecondaryBtn")}
              </button>
            </div>
          </div>
        </div>

        {/* Accessibility Toggles */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-8">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            <span>{tUser("settings.appearance.accessibilityGroup")}</span>
          </h2>
          <div className="space-y-4">
            {[
              {
                key: "reduced_motion" as const,
                label: tUser("settings.appearance.reducedMotion"),
                desc: tUser("settings.appearance.reducedMotionDesc"),
              },
              {
                key: "high_contrast" as const,
                label: tUser("settings.appearance.highContrast"),
                desc: tUser("settings.appearance.highContrastDesc"),
              },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 bg-gray-50/70 dark:bg-slate-800/50 rounded-2xl border border-gray-200/80 dark:border-slate-800"
              >
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                    {label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {desc}
                  </p>
                </div>
                <button
                  dir="ltr"
                  type="button"
                  role="switch"
                  aria-checked={settings[key]}
                  aria-label={label}
                  onClick={() => update(key, !settings[key])}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    settings[key]
                      ? "bg-blue-600"
                      : "bg-gray-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 transition-transform duration-200 ${
                      settings[key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <PodaciumButton onClick={handleSave} disabled={saving} glow>
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin me-2" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4 me-2" />
          ) : null}
          {saving
            ? tCommon("saving")
            : saved
              ? tCommon("saved")
              : tCommon("saveChanges")}
        </PodaciumButton>
      </div>
    </div>
  );
}
