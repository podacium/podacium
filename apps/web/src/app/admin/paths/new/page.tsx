"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Route,
  ArrowLeft,
  Save,
  Loader2,
  Star,
  Image as ImageIcon,
  DollarSign,
  FileText,
  AlertCircle,
} from "lucide-react";

export default function NewPathPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    description: "",
    thumbnail_url: "",
    featured: false,
    price_amount: "",
    price_currency: "DZD",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.id.trim() || !formData.title.trim()) {
      setError(t("admin.paths.new.errors.required"));
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        id: formData.id.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        featured: formData.featured,
      };

      if (formData.price_amount) {
        payload.price = {
          amount: parseInt(formData.price_amount),
          currency: formData.price_currency,
        };
      }

      await api.post(ENDPOINTS.ADMIN.PATHS, payload);
      router.push("/admin/paths");
    } catch (err: any) {
      console.error("Failed to create path", err);
      setError(err?.message || t("admin.paths.new.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/admin/paths"
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className={dir === "rtl" ? "rotate-180" : ""} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t("admin.paths.new.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.paths.new.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="max-w-2xl"
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
          {/* Path ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.new.pathId")}{" "}
              <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder={t("admin.paths.new.pathIdPlaceholder")}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              {t("admin.paths.new.pathIdHint")}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.new.titleField")}{" "}
              <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="relative">
              <Route
                size={18}
                className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
              />
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder={t("admin.paths.new.titlePlaceholder")}
                className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.new.description")}
            </label>
            <div className="relative">
              <FileText
                size={18}
                className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
              />
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("admin.paths.new.descriptionPlaceholder")}
                rows={4}
                className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none`}
              />
            </div>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.new.thumbnailUrl")}
            </label>
            <div className="relative">
              <ImageIcon
                size={18}
                className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
              />
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail_url: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.new.price")}
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <DollarSign
                  size={18}
                  className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                />
                <input
                  type="number"
                  min="0"
                  value={formData.price_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, price_amount: e.target.value })
                  }
                  placeholder="0"
                  className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                />
              </div>
              <select
                value={formData.price_currency}
                onChange={(e) =>
                  setFormData({ ...formData, price_currency: e.target.value })
                }
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              >
                <option value="DZD">DZD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Featured */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, featured: !formData.featured })
              }
              className={`w-12 h-6 rounded-full transition-colors ${formData.featured ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-800/90"}`}
            >
              <div
                className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm transition-transform ${formData.featured ? (dir === "rtl" ? "-translate-x-6" : "translate-x-6") : "translate-x-0.5"}`}
              />
            </button>
            <div className="flex items-center gap-2">
              <Star
                size={16}
                className={
                  formData.featured
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-gray-400"
                }
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                {t("admin.paths.new.featured")}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.paths.new.create")}
          </button>
          <Link
            href="/admin/paths"
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            {t("admin.common.cancel")}
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
