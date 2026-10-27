"use client";

import React, { useState } from "react";
import { BiDashboardMetadata, api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, X } from "lucide-react";

interface DashboardSettingsProps {
  dashboard: BiDashboardMetadata;
}

export function DashboardSettings({ dashboard }: DashboardSettingsProps) {
  const router = useRouter();
  const t = useTranslations("bi");
  const [title, setTitle] = useState(dashboard.title || dashboard.name || "");
  const [description, setDescription] = useState(dashboard.description || "");
  const [isPublic, setIsPublic] = useState(dashboard.is_public);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateDashboard(dashboard.id, {
        title,
        description,
        is_public: isPublic,
      });
      toast.success(t("dashboards.detail.settings.saveSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("dashboards.detail.settings.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteDashboard(dashboard.id);
      toast.success(t("dashboards.detail.settings.deleteSuccess"));
      router.push("/bi/dashboards");
    } catch (e) {
      console.error(e);
      toast.error(t("dashboards.detail.settings.deleteError"));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="p-10 max-w-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-gray-200/50 dark:border-slate-800/50 shadow-xl shadow-blue-500/5 m-6 lg:mx-auto">
      <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 mb-10 tracking-tight">
        {t("dashboards.detail.tabs.settings")}
      </h2>

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="block text-sm font-black text-gray-700 dark:text-slate-300 uppercase tracking-widest ml-1">
            {t("widgets.config.title")}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-6 py-4 bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-gray-900 dark:text-slate-100 shadow-sm"
            placeholder={t("dashboards.detail.settings.titlePlaceholder")}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-black text-gray-700 dark:text-slate-300 uppercase tracking-widest ml-1">
            {t("widgets.config.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-6 py-4 bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none font-medium text-gray-900 dark:text-slate-100 shadow-sm"
            placeholder={t("dashboards.detail.settings.descriptionPlaceholder")}
          />
        </div>

        <div className="flex items-center gap-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-6 h-6 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-700 rounded-lg focus:ring-blue-500 cursor-pointer shadow-inner transition-colors"
            />
          </div>
          <div className="space-y-0.5">
            <label
              htmlFor="isPublic"
              className="block text-base font-black text-gray-900 dark:text-slate-100 cursor-pointer"
            >
              {t("dashboards.detail.settings.public.label")}
            </label>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium leading-relaxed opacity-80">
              {t("dashboards.detail.settings.public.description")}
            </p>
          </div>
        </div>

        <div className="pt-10 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full sm:w-auto px-8 py-3.5 text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-2xl font-black transition-all"
          >
            {t("dashboards.detail.actions.delete")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-black disabled:opacity-50 disabled:scale-100"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("dashboards.detail.settings.saving")}
              </div>
            ) : (
              t("dashboards.detail.actions.save")
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setShowDeleteConfirm(false)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("dashboards.detail.deleteConfirm")}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-8"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950/60 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" />
                </div>
                <button
                  onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                  aria-label={t("accessibility.closePanel")}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-2">
                {t("dashboards.detail.actions.delete")}
              </h3>
              <p className="text-gray-500 dark:text-slate-400 leading-relaxed mb-8">
                {t("dashboards.detail.deleteConfirm")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3.5 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-black rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {t("dashboards.detail.actions.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3.5 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("dashboards.detail.actions.delete")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
