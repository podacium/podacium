"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Building2, X, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

interface OrgRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrgRequiredModal({ isOpen, onClose }: OrgRequiredModalProps) {
  const t = useTranslations();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-modal-title"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <button
                  onClick={onClose}
                  aria-label={t("common.cancel")}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <h2
                id="org-modal-title"
                className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2"
              >
                {t("bi.datasets.upload.errors.noOrganization")}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed">
                {t("bi.organizations.getStarted")}
              </p>

              <div className="space-y-3">
                <Link
                  href="/bi/organizations"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all group"
                >
                  <span>{t("bi.organizations.createFirst")}</span>
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </Link>
                <button
                  onClick={onClose}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-medium rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all"
                >
                  {t("bi.datasets.upload.actions.cancel")}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900/60 p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-center gap-2">
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {t("bi.organizations.alreadyHaveOne")}
              </span>
              <Link
                href="/settings/organizations"
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
              >
                {t("bi.organizations.checkStatus")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
