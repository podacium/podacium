"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Download, X, Share, PlusSquare } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export default function PWAInstallBanner() {
  const t = useTranslations();
  const { isRTL } = useBidi();
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if dismissed previously within 7 days
    const dismissedTime = localStorage.getItem("podacium_pwa_banner_dismissed");
    if (dismissedTime) {
      const now = Date.now();
      if (now - parseInt(dismissedTime, 10) < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }
    setDismissed(false);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("podacium_pwa_banner_dismissed", String(Date.now()));
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else {
      const accepted = await promptInstall();
      if (accepted) {
        setDismissed(true);
      }
    }
  };

  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-6 md:bottom-6 start-4 md:start-6 lg:start-8 z-40 max-w-md pb-safe"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-200/80 dark:border-slate-800 text-gray-900 dark:text-slate-100 rounded-2xl shadow-2xl shadow-indigo-500/10 dark:shadow-slate-950/50 p-4 backdrop-blur-xl relative overflow-hidden transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <Smartphone className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 tracking-tight">
                {t("pwa.installTitle")}
              </h4>
              <p className="text-xs text-gray-600 dark:text-slate-300 truncate mt-0.5">
                {t("pwa.installSubtitle")}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PodaciumButton
                variant="gradient"
                size="sm"
                onClick={handleInstallClick}
                className="font-bold text-xs shadow-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                {t("pwa.installButton")}
              </PodaciumButton>

              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors"
                aria-label={t("pwa.dismissBanner")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* iOS Safari Installation Guide Modal */}
          {showIOSGuide && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-600 dark:text-slate-300 space-y-2 animate-in fade-in duration-200">
              <p className="font-semibold text-gray-900 dark:text-slate-100">
                {t("pwa.iosGuideTitle")}
              </p>
              <ol className="space-y-1.5 pl-4 list-decimal text-gray-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span>{t("pwa.iosStep1")}</span>
                  <Share className="w-4 h-4 text-blue-500 dark:text-blue-400 inline" />
                </li>
                <li className="flex items-center gap-2">
                  <span>{t("pwa.iosStep2")}</span>
                  <PlusSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400 inline" />
                </li>
              </ol>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
