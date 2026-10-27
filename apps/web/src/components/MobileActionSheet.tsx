"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { FabAction } from "@/hooks/useMobileNavigation";
import { useBidi, useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  actions: FabAction[];
}

export default function MobileActionSheet({
  isOpen,
  onClose,
  actions,
}: MobileActionSheetProps) {
  const { isRTL } = useBidi();
  const t = useTranslations("nav");

  // Handle Escape key listener
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="mobile-action-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
          className="fixed inset-0 z-50 md:hidden overflow-hidden"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Scrim Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Action Sheet Container */}
          <div className="absolute inset-x-0 bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center">
            <motion.div
              initial={{ y: "100%", opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 border border-white/20 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl relative"
            >
              {/* Top Drag Indicator / Header */}
              <div className="pt-3 px-5 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3
                      id="action-sheet-title"
                      className="text-sm font-bold text-gray-900 dark:text-white"
                    >
                      {t("actions.quickActions")}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400">
                      {t("actions.quickActionsSub")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-11 h-11 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={t("ariaCloseSheet")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Actions List */}
              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      onClick={onClose}
                      className="group flex items-center gap-3.5 p-3 rounded-2xl bg-gray-50/80 dark:bg-slate-800/40 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-gray-200/50 dark:border-slate-800/60 transition-all duration-200"
                    >
                      <div
                        className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md bg-gradient-to-br shrink-0",
                          action.color || "from-blue-600 to-indigo-600",
                        )}
                      >
                        <Icon className="w-5.5 h-5.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {action.title}
                          </h4>
                          {action.badge && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-md shrink-0">
                              {action.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                          {action.description}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0 rtl:rotate-180" />
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
