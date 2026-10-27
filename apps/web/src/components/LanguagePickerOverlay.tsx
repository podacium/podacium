"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Sun,
  Moon,
  Laptop,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";

const LANGS = [
  { code: "en", label: "EN", native: "English", desc: "English" },
  { code: "fr", label: "FR", native: "Français", desc: "French" },
  { code: "ar", label: "AR", native: "العربية", desc: "Arabic", dir: "rtl" },
  { code: "kab", label: "KAB", native: "Taqbaylit", desc: "Kabyle" },
];

const I18N_CONTENT: Record<
  string,
  {
    badge: string;
    title: string;
    subtitle: string;
    langLabel: string;
    themeLabel: string;
    getStarted: string;
    themes: Record<ThemeMode, { label: string; desc: string }>;
  }
> = {
  en: {
    badge: "Welcome to Podacium",
    title: "Personalize Your Experience",
    subtitle:
      "Select your preferred language and display theme to get started.",
    langLabel: "Primary Language",
    themeLabel: "Display Theme",
    getStarted: "Get Started",
    themes: {
      light: { label: "Light Mode", desc: "Clean, bright visual appearance" },
      dark: { label: "Dark Mode", desc: "Sleek, low-light OLED slate tones" },
      system: { label: "System", desc: "Match your OS system preference" },
    },
  },
  fr: {
    badge: "Bienvenue sur Podacium",
    title: "Personnalisez votre expérience",
    subtitle:
      "Sélectionnez votre langue préférée et le thème d'affichage pour commencer.",
    langLabel: "Langue principale",
    themeLabel: "Thème d'affichage",
    getStarted: "Commencer",
    themes: {
      light: {
        label: "Mode Clair",
        desc: "Apparence visuelle claire et lumineuse",
      },
      dark: {
        label: "Mode Sombre",
        desc: "Tonalités ardoise élégantes pour faible luminosité",
      },
      system: {
        label: "Système",
        desc: "S'adapte aux préférences de votre système",
      },
    },
  },
  ar: {
    badge: "مرحباً بكم في بوداكيوم",
    title: "خصّص تجربتك",
    subtitle: "اختر لغتك المفضلة ومظهر العرض للبدء.",
    langLabel: "اللغة الأساسية",
    themeLabel: "مظهر العرض",
    getStarted: "ابدأ الآن",
    themes: {
      light: { label: "الوضع الفاتح", desc: "مظهر بصري واضح ومشرق" },
      dark: { label: "الوضع الداكن", desc: "مظهر داكن أنيق مريح للعينين" },
      system: { label: "النظام", desc: "مطابقة تفضيلات نظام التشغيل الخاص بك" },
    },
  },
  kab: {
    badge: "Ansuf yis-wen ɣer Podacium",
    title: "Sagen tarmit-ik",
    subtitle: "Fren tutlayt i tḥemmleḍ d uskar n uskan iwakken ad tebduḍ.",
    langLabel: "Tutlayt tamezwarut",
    themeLabel: "Askar n usekles",
    getStarted: "Bdu tura",
    themes: {
      light: { label: "Askar Aceɛlal", desc: "Tamuɣli tafatant yeṣfan" },
      dark: {
        label: "Askar Ubrik",
        desc: "Iniwen imellalen i tefsest n wallen",
      },
      system: {
        label: "Anagraw",
        desc: "Amṣada akked yisemyifiyen n unagraw-ik",
      },
    },
  },
};

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  icon: typeof Sun;
}> = [
  {
    id: "light",
    icon: Sun,
  },
  {
    id: "dark",
    icon: Moon,
  },
  {
    id: "system",
    icon: Laptop,
  },
];

export default function LanguagePickerOverlay() {
  const [show, setShow] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>("light");
  const { setTheme } = useTheme();

  const isRTL = selectedLang === "ar";
  const content = I18N_CONTENT[selectedLang] || I18N_CONTENT.en;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cookies = document.cookie.split(";");
    const localeCookie = cookies.find((c) => c.trim().startsWith("locale="));
    const setupDone = localStorage.getItem("podacium_setup_completed");

    if (localeCookie || setupDone === "true") {
      return;
    }

    // Default theme selection to Light mode for first-time onboarding
    setSelectedTheme("light");
    setTheme("light");
    setShow(true);
  }, [setTheme]);

  const handleThemeChange = (mode: ThemeMode) => {
    setSelectedTheme(mode);
    setTheme(mode);
  };

  const handleCompleteSetup = () => {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `locale=${selectedLang}; path=/; max-age=${maxAge}; samesite=Lax`;
    try {
      localStorage.setItem("podacium_setup_completed", "true");
    } catch {}

    setTheme(selectedTheme);
    setShow(false);

    // Apply locale cookie transition smoothly if changed
    const currentLocaleMatch = document.cookie.match(/locale=([^;]+)/);
    if (!currentLocaleMatch || currentLocaleMatch[1] !== selectedLang) {
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        dir={isRTL ? "rtl" : "ltr"}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl overflow-y-auto"
      >
        {/* Glow ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="relative max-w-2xl w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-slate-800/80 shadow-[0_30px_90px_rgba(0,0,0,0.3)] p-6 sm:p-10 text-gray-900 dark:text-slate-100 overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 mb-3 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>{content.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-slate-100">
              {content.title}
            </h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm sm:text-base mt-2 max-w-md mx-auto">
              {content.subtitle}
            </p>
          </div>

          {/* Section 1: Choose Language */}
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span>{content.langLabel}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LANGS.map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`relative p-3.5 rounded-2xl border-2 text-start transition-all duration-200 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 shadow-md ring-2 ring-blue-500/30"
                        : "border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 font-semibold">
                        {lang.label}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {lang.native}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Choose Theme Mode */}
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>{content.themeLabel}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedTheme === opt.id;
                const themeInfo = content.themes[opt.id];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleThemeChange(opt.id)}
                    className={`relative p-4 rounded-2xl border-2 text-start transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-md ring-2 ring-indigo-500/30"
                        : "border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {themeInfo.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {themeInfo.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleCompleteSetup}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 group hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>{content.getStarted}</span>
            <ArrowRight
              className={`w-5 h-5 transition-transform ${isRTL ? "group-hover:-translate-x-1 rotate-180" : "group-hover:translate-x-1"}`}
            />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
