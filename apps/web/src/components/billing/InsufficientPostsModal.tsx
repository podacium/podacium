"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CreditCard, Sparkles, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface InsufficientPostsModalProps {
  open: boolean;
  onClose: () => void;
  remaining?: number;
}

export default function InsufficientPostsModal({
  open,
  onClose,
  remaining,
}: InsufficientPostsModalProps) {
  const t = useTranslations();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 end-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-600 dark:text-amber-400 mb-5">
                <Sparkles className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 mb-2">
                {t("billing.insufficientPosts.title")}
              </h3>

              <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 max-w-xs">
                {remaining !== undefined && remaining <= 0
                  ? t("billing.insufficientPosts.noPosts")
                  : t("billing.insufficientPosts.description")}
              </p>

              <Link
                href="/billing#feature-store"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg w-full justify-center"
              >
                <CreditCard className="w-5 h-5" />
                {t("billing.insufficientPosts.buyButton")}
              </Link>

              <button
                onClick={onClose}
                className="mt-4 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 font-medium transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
