"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, CheckCircle2 } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export default function NetworkStatusToast() {
  const t = useTranslations();
  const { isRTL } = useBidi();
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const { pendingCount, isSyncing } = useOfflineSync();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    // Initial check
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline-toast"
          initial={{ y: -50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-[110] max-w-md mx-auto pointer-events-auto"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="bg-amber-600/95 dark:bg-amber-700/95 text-white rounded-2xl shadow-2xl p-3.5 backdrop-blur-xl border border-amber-400/30 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight">
                {t("pwa.offlineTitle")}
              </p>
              <p className="text-[11px] opacity-90 leading-tight mt-0.5">
                {t("pwa.offlineDesc")}
                {pendingCount > 0
                  ? ` • ${pendingCount} offline action${pendingCount > 1 ? "s" : ""} queued`
                  : ""}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          key="online-toast"
          initial={{ y: -50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-[110] max-w-md mx-auto pointer-events-auto"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="bg-emerald-600/95 dark:bg-emerald-700/95 text-white rounded-2xl shadow-2xl p-3.5 backdrop-blur-xl border border-emerald-400/30 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight">
                {t("pwa.onlineTitle")}
              </p>
              <p className="text-[11px] opacity-90 leading-tight mt-0.5">
                {t("pwa.onlineDesc")}
                {isSyncing
                  ? t("pwa.syncingActions")
                  : pendingCount > 0
                    ? t("pwa.remainingToSync", { count: pendingCount })
                    : ""}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
