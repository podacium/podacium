"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Star,
  Check,
  Square,
  MoreVertical,
  Eye,
  CheckSquare,
  Archive,
} from "lucide-react";
import { PodaciumConfirmDialog } from "@/components/design-system";
import { toast } from "sonner";

interface ModuleSummary {
  id: string;
  title: string;
  level: string | null;
  featured: boolean;
  instructor_name: string | null;
  enrollment_count: number;
  totalLessons: number;
  createdAt: string;
}

interface ModuleListResponse {
  modules: ModuleSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const levelColors: Record<string, string> = {
  Beginner:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  Intermediate:
    "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  Advanced:
    "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
};

export default function AdminCoursesPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [data, setData] = useState<ModuleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });
  const pageSize = 20;

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search) params.set("search", search);
      if (levelFilter) params.set("level", levelFilter);
      if (featuredFilter) params.set("featured", featuredFilter);
      const res = await api.get<ModuleListResponse>(
        `${ENDPOINTS.ADMIN.MODULES}?${params}`,
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load modules", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, levelFilter, featuredFilter]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleDelete = (moduleId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t("admin.courses.deleteTitle", "Delete Course Module"),
      description: t("admin.courses.confirmDelete"),
      confirmText: t("admin.courses.deleteBtn", "Delete Module"),
      onConfirm: async () => {
        try {
          await api.delete(ENDPOINTS.ADMIN.MODULE(moduleId));
          toast.success(
            t("admin.courses.deleteSuccess", "Course module deleted"),
          );
          fetchModules();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          console.error("Failed to delete module", err);
          toast.error(
            err?.message ||
              t("admin.courses.deleteError", "Failed to delete module"),
          );
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (!data) return;
    if (selected.size === data.modules.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.modules.map((m) => m.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (!selected.size) return;
    try {
      await api.post(ENDPOINTS.ADMIN.MODULES_BULK, {
        ids: Array.from(selected),
        action,
      });
      setSelected(new Set());
      setBulkMenuOpen(false);
      fetchModules();
    } catch (err) {
      console.error("Bulk action failed", err);
    }
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t("admin.courses.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.courses.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search size={18} className="absolute top-3 start-3 text-gray-400" />
          <input
            type="text"
            placeholder={t("admin.courses.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-700 dark:text-slate-300"
        >
          <option value="">{t("admin.common.all")}</option>
          <option value="Beginner">{t("admin.courses.levels.beginner")}</option>
          <option value="Intermediate">
            {t("admin.courses.levels.intermediate")}
          </option>
          <option value="Advanced">{t("admin.courses.levels.advanced")}</option>
        </select>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="relative">
            <button
              onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {t("admin.courses.bulkActions")} ({selected.size})
            </button>
            <AnimatePresence>
              {bulkMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-12 right-0 z-20 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 py-1.5 min-w-[160px]"
                >
                  <button
                    onClick={() => handleBulkAction("publish")}
                    className="w-full text-start px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
                  >
                    <Eye size={14} className="text-green-500" />{" "}
                    {t("admin.courses.publish")}
                  </button>
                  <button
                    onClick={() => handleBulkAction("unpublish")}
                    className="w-full text-start px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
                  >
                    <Archive
                      size={14}
                      className="text-amber-500 dark:text-amber-400"
                    />{" "}
                    {t("admin.courses.unpublish")}
                  </button>
                  <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                  <button
                    onClick={() => handleBulkAction("delete")}
                    className="w-full text-start px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> {t("admin.courses.bulkDelete")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : !data?.modules.length ? (
          <div className="py-20 text-center text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t("admin.courses.noCourses")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800">
                    <th className="px-5 py-3.5">
                      <button
                        onClick={selectAll}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                      >
                        {selected.size === data.modules.length ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.name")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.level")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.instructor")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.lessons")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.enrollments")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.featured")}
                    </th>
                    <th className="text-end px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.courses.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.modules.map((m, i) => (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-gray-50 dark:border-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-colors ${selected.has(m.id) ? "bg-blue-50/80 dark:bg-blue-950/60" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleSelect(m.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                        >
                          {selected.has(m.id) ? (
                            <CheckSquare
                              size={18}
                              className="text-blue-600 dark:text-blue-400"
                            />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-slate-100">
                        {m.title}
                      </td>
                      <td className="px-5 py-3.5">
                        {m.level && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${levelColors[m.level] || "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"}`}
                          >
                            {m.level}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {m.instructor_name || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {m.totalLessons}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                          {m.enrollment_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {m.featured ? (
                          <Star
                            size={16}
                            className="text-amber-500 dark:text-amber-400"
                            fill="currentColor"
                          />
                        ) : (
                          <Star size={16} className="text-gray-300" />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/courses/${m.id}/edit`}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Edit3 size={16} />
                          </Link>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-slate-800">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("admin.common.showing")} {(page - 1) * pageSize + 1}{" "}
                  {t("admin.common.to")} {Math.min(page * pageSize, data.total)}{" "}
                  {t("admin.common.of")} {data.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 dark:border-slate-800 enabled:hover:bg-gray-50 dark:hover:bg-slate-800/60 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setPage(Math.min(data.total_pages, page + 1))
                    }
                    disabled={page === data.total_pages}
                    className="p-2 rounded-lg border border-gray-200 dark:border-slate-800 enabled:hover:bg-gray-50 dark:hover:bg-slate-800/60 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <PodaciumConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant="danger"
      />
    </div>
  );
}
