"use client";

import React, { useState, useEffect, useRef } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useBidi, useTranslations } from "@/lib/i18n";

const LANGS = [
  {
    code: "en",
    label: "EN",
    native: "English",
  },
  {
    code: "fr",
    label: "FR",
    native: "Français",
  },
  {
    code: "ar",
    label: "AR",
    native: "العربية",
  },
  {
    code: "kab",
    label: "KAB",
    native: "Taqbaylit",
  },
];

export type Locale = "en" | "fr" | "ar" | "kab";

/**
 * Atomically rewrite path prefix and update locale cookies.
 */
export function handleLanguageChange(newLocale: Locale | string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `locale=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;

  try {
    localStorage.setItem("podacium_locale", String(newLocale));
  } catch {
    // Ignore storage errors in restricted iframe/private modes
  }

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const localePrefixRegex = /^\/(en|fr|ar|kab)(\/|$)/;

  let newPath: string;
  if (localePrefixRegex.test(currentPath)) {
    newPath = currentPath.replace(localePrefixRegex, `/${newLocale}$2`);
  } else {
    newPath = `/${newLocale}${currentPath === "/" ? "" : currentPath}`;
  }

  if (typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("lang");
    const qs = searchParams.toString();
    const finalUrl = `${newPath}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.location.href = finalUrl;
  }
}

export default function LanguageSwitcher({
  variant = "default",
}: {
  variant?: "default" | "footer";
}) {
  const activeLocale = useLocale();
  const { isRTL } = useBidi();
  const { t } = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(
    () => LANGS.find((l) => l.code === activeLocale) || LANGS[0],
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Sync currentLang with active locale from IntlContext (RSC / Middleware)
  useEffect(() => {
    const matched = LANGS.find((l) => l.code === activeLocale);
    if (matched) {
      setCurrentLang(matched);
    }
  }, [activeLocale]);

  // 2. Multi-Tab Synchronization via localStorage & StorageEvent
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "podacium_locale" && e.newValue) {
        const matched = LANGS.find((l) => l.code === e.newValue);
        if (matched && matched.code !== currentLang.code) {
          const maxAge = 60 * 60 * 24 * 365;
          document.cookie = `locale=${matched.code}; path=/; max-age=${maxAge}; sameSite=Lax`;
          window.location.reload();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentLang.code]);

  // 3. Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const changeLang = (lang: (typeof LANGS)[0]) => {
    if (lang.code === currentLang.code) {
      setIsOpen(false);
      return;
    }

    handleLanguageChange(lang.code as Locale);
  };

  // Navbar variant (default)
  if (variant === "default") {
    return (
      <div
        className="relative shrink-0"
        ref={dropdownRef}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Navbar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-1.5 2xl:gap-2 px-2.5 2xl:px-3 h-10 rounded-xl border border-gray-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
          aria-label={t("settings.account.language")}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="relative">
            <Globe className="w-4 h-4 text-gray-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            <div className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
          </div>

          <span className="text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
            {currentLang.label}
          </span>

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-gray-400 group-hover:text-indigo-400"
          >
            <ChevronDown className="w-3 h-3" />
          </motion.div>
        </button>

        {/* Navbar Dropdown (opens down) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute end-0 mt-2 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 py-1 z-50 overflow-hidden"
              role="listbox"
              aria-label={t("settings.account.language")}
            >
              <div className="py-1">
                {LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLang(lang)}
                    role="option"
                    aria-selected={currentLang.code === lang.code}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                      currentLang.code === lang.code
                        ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          currentLang.code === lang.code
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                        }`}
                      >
                        <span className="text-xs font-bold">{lang.label}</span>
                      </div>
                      <span className="font-medium">{lang.native}</span>
                    </div>

                    {currentLang.code === lang.code && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef} dir={isRTL ? "rtl" : "ltr"}>
      {/* Footer Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-indigo-500 bg-gray-800/50 hover:bg-gray-700/50 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={t("settings.account.language")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-400 transition-colors" />

        <span className="text-xs font-medium text-gray-300 group-hover:text-white">
          {currentLang.label}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-500 dark:text-slate-400 group-hover:text-indigo-400"
        >
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>

      {/* DROPUP Menu (appears above the button) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full end-0 mb-2 w-40 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-1 z-50 overflow-hidden"
            role="listbox"
            aria-label={t("settings.account.language")}
            style={{
              bottom: "100%",
              marginBottom: "0.5rem",
            }}
          >
            {LANGS.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLang(lang)}
                role="option"
                aria-selected={currentLang.code === lang.code}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                  currentLang.code === lang.code
                    ? "bg-gradient-to-r from-indigo-900/40 to-purple-900/40 text-white font-semibold"
                    : "hover:bg-gray-700 text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center ${
                      currentLang.code === lang.code
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    <span className="text-[10px] font-bold">{lang.label}</span>
                  </div>
                  <span>{lang.native}</span>
                </div>

                {currentLang.code === lang.code && (
                  <Check className="w-3 h-3 text-indigo-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
