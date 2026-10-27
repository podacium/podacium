"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Trash2,
  Plus,
  GripVertical,
} from "lucide-react";

interface PathDetail {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  featured: boolean;
  price: { amount: number; currency: string } | null;
  modules: {
    pathModuleId: string;
    moduleId: string;
    title: string;
    level: string | null;
    order: number;
    totalLessons: number;
  }[];
  enrollmentCount: number;
}

interface Module {
  id: string;
  title: string;
  level: string | null;
}

export default function EditPathPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();
  const params = useParams();
  const pathId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    featured: false,
    price_amount: "",
    price_currency: "DZD",
  });
  const [modules, setModules] = useState<PathDetail["modules"]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch path details
        const pathData = await api.get<PathDetail>(
          ENDPOINTS.ADMIN.PATH(pathId),
        );
        setFormData({
          title: pathData.title,
          description: pathData.description || "",
          thumbnail_url: pathData.thumbnailUrl || "",
          featured: pathData.featured,
          price_amount: pathData.price?.amount?.toString() || "",
          price_currency: pathData.price?.currency || "DZD",
        });
        setModules(pathData.modules || []);

        // Fetch all modules for picker
        const modulesRes = await api.get<any>(
          `${ENDPOINTS.ADMIN.MODULES}?page_size=100`,
        );
        setAllModules(modulesRes.modules || []);
      } catch (err) {
        console.error("Failed to load path", err);
        setError(t("admin.paths.edit.errors.notFound"));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [pathId]);

  const handleSave = async () => {
    setError(null);

    if (!formData.title.trim()) {
      setError(t("admin.paths.edit.errors.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
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

      await api.put(ENDPOINTS.ADMIN.PATH(pathId), payload);
      router.push("/admin/paths");
    } catch (err: any) {
      console.error("Failed to update path", err);
      setError(err?.message || t("admin.paths.edit.errors.failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async () => {
    if (!selectedModule) return;

    try {
      await api.post(ENDPOINTS.ADMIN.PATH_MODULES(pathId), {
        module_id: selectedModule,
        order: modules.length + 1,
      });

      // Refresh path data
      const pathData = await api.get<PathDetail>(ENDPOINTS.ADMIN.PATH(pathId));
      setModules(pathData.modules || []);
      setShowModulePicker(false);
      setSelectedModule("");
    } catch (err) {
      console.error("Failed to add module", err);
    }
  };

  const handleRemoveModule = async (pathModuleId: string) => {
    if (!confirm(t("admin.paths.edit.confirmRemoveModule"))) return;

    try {
      await api.delete(`/api/admin/paths/${pathId}/modules/${pathModuleId}`);
      setModules(modules.filter((m) => m.pathModuleId !== pathModuleId));
    } catch (err) {
      console.error("Failed to remove module", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

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
            {t("admin.paths.edit.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.paths.edit.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-4xl space-y-6"
      >
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.paths.edit.basicInfo")}
          </h3>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.edit.titleField")}{" "}
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
                placeholder={t("admin.paths.edit.titlePlaceholder")}
                className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.edit.description")}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("admin.paths.edit.descriptionPlaceholder")}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
            />
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.paths.edit.thumbnailUrl")}
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
              {t("admin.paths.edit.price")}
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
                {t("admin.paths.edit.featured")}
              </span>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {t("admin.paths.edit.modules")} ({modules.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowModulePicker(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              {t("admin.paths.edit.addModule")}
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Route size={40} className="mx-auto mb-3 opacity-40" />
              <p>{t("admin.paths.edit.noModules")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modules.map((module, index) => (
                <div
                  key={module.pathModuleId}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl"
                >
                  <GripVertical
                    size={16}
                    className="text-gray-400 cursor-grab"
                  />
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                      {module.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {module.level} • {module.totalLessons}{" "}
                      {t("common.uiLabels.lessons")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveModule(module.pathModuleId)}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Module Picker Modal */}
          {showModulePicker && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">
                  {t("admin.paths.edit.selectModule")}
                </h3>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm mb-4"
                >
                  <option value="">{t("admin.paths.edit.chooseModule")}</option>
                  {allModules
                    .filter(
                      (m) =>
                        !modules.find((existing) => existing.moduleId === m.id),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                </select>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleAddModule}
                    disabled={!selectedModule}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {t("admin.paths.edit.add")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModulePicker(false)}
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                  >
                    {t("admin.common.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.paths.edit.save")}
          </button>
          <Link
            href="/admin/paths"
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            {t("admin.common.cancel")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
