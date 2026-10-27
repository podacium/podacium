"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";

export default function SWUpdateToast() {
  const t = useTranslations();
  const { isRTL } = useBidi();
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    // Check for registered service worker updates
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  const handleReload = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-20 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-[100] max-w-sm mx-auto pointer-events-auto"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-2xl p-3.5 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0 animate-bounce" />
            <span className="text-xs font-semibold truncate">
              {t("pwa.updateAvailable")}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PodaciumButton
              variant="secondary"
              size="sm"
              onClick={handleReload}
              className="text-xs font-bold bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
              {t("pwa.reloadButton")}
            </PodaciumButton>

            <button
              onClick={() => setShowUpdate(false)}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white dark:hover:bg-slate-800/10"
              aria-label={t("pwa.closeNotification")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
