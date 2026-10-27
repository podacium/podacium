"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Settings, ShieldCheck, Info } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import PodaciumButton from "./design-system/PodaciumButton";
import { cn } from "@/lib/utils";

const CookieBanner = () => {
  const t = useTranslations("cookies.banner");
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem("podacium_cookie_consent");
    if (!consent) {
      setIsVisible(true);
    } else {
      try {
        const savedPrefs = JSON.parse(consent);
        setPreferences(savedPrefs);
      } catch (e) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allPrefs = { essential: true, analytics: true, marketing: true };
    localStorage.setItem("podacium_cookie_consent", JSON.stringify(allPrefs));
    setPreferences(allPrefs);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const minPrefs = { essential: true, analytics: false, marketing: false };
    localStorage.setItem("podacium_cookie_consent", JSON.stringify(minPrefs));
    setPreferences(minPrefs);
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem(
      "podacium_cookie_consent",
      JSON.stringify(preferences),
    );
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-14 md:bottom-0 inset-x-0 z-[100] p-4 md:p-6 pb-safe pointer-events-none"
      >
        <div className="max-w-7xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Cookie className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {t("title")}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                  {t("description")}
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto md:items-end">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <PodaciumButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomize(!showCustomize)}
                    icon={<Settings className="w-4 h-4" />}
                  >
                    {t("customize")}
                  </PodaciumButton>
                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={handleRejectAll}
                  >
                    {t("rejectAll")}
                  </PodaciumButton>
                  <PodaciumButton
                    variant="primary"
                    size="sm"
                    onClick={handleAcceptAll}
                    icon={<ShieldCheck className="w-4 h-4" />}
                  >
                    {t("acceptAll")}
                  </PodaciumButton>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-primary/60 font-medium tracking-tight uppercase">
                  <Info className="w-3 h-3" />
                  {t("arabicDominance")}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showCustomize && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <PreferenceItem
                      label={t("essential")}
                      checked={preferences.essential}
                      disabled={true}
                      onChange={() => {}}
                    />
                    <PreferenceItem
                      label={t("analytics")}
                      checked={preferences.analytics}
                      onChange={(checked) =>
                        setPreferences({ ...preferences, analytics: checked })
                      }
                    />
                    <PreferenceItem
                      label={t("marketing")}
                      checked={preferences.marketing}
                      onChange={(checked) =>
                        setPreferences({ ...preferences, marketing: checked })
                      }
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <PodaciumButton
                      variant="primary"
                      size="sm"
                      onClick={handleSavePreferences}
                    >
                      {t("savePreferences")}
                    </PodaciumButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const PreferenceItem = ({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
        checked
          ? "bg-primary/5 border-primary/20"
          : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
        {label}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="form-checkbox h-5 w-5 text-primary rounded border-gray-300 dark:border-slate-700 focus:ring-primary"
      />
    </label>
  );
};

export default CookieBanner;
