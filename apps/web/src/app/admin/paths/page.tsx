"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route,
  Search,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  BookOpen,
  Users as UsersIcon,
  Star,
  ChevronRight,
} from "lucide-react";

interface PathSummary {
  id: string;
  title: string;
  description: string | null;
  featured: boolean;
  module_count: number;
  enrollment_count: number;
  createdAt: string;
}

interface PathListResponse {
  paths: PathSummary[];
  total: number;
}

export default function AdminPathsPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [data, setData] = useState<PathListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPaths = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await api.get<PathListResponse>(
        `${ENDPOINTS.ADMIN.PATHS}${params}`,
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load paths", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPaths();
  }, [fetchPaths]);

  const handleDelete = async (pathId: string) => {
    if (!confirm(t("admin.paths.confirmDelete"))) return;
    try {
      await api.delete(ENDPOINTS.ADMIN.PATH(pathId));
      fetchPaths();
    } catch (err) {
      console.error("Failed to delete path", err);
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
            {t("admin.paths.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.paths.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6"
      >
        <div className="relative max-w-md">
          <Search
            size={18}
            className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
          />
          <input
            type="text"
            placeholder={t("admin.paths.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
          />
        </div>
      </motion.div>

      {/* Path Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : !data?.paths.length ? (
        <div className="py-20 text-center text-gray-400">
          <Route size={40} className="mx-auto mb-3 opacity-40" />
          <p>{t("admin.paths.noPaths")}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.paths.map((path, i) => (
            <motion.div
              key={path.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 line-clamp-1">
                  {path.title}
                </h3>
                {path.featured && (
                  <Star
                    size={16}
                    className="text-amber-500 dark:text-amber-400 flex-shrink-0"
                    fill="currentColor"
                  />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mb-4">
                {path.description || "—"}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <BookOpen size={14} /> {path.module_count}{" "}
                  {t("admin.paths.modules")}
                </span>
                <span className="flex items-center gap-1">
                  <UsersIcon size={14} /> {path.enrollment_count}{" "}
                  {t("admin.paths.enrollments")}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href={`/admin/paths/${path.id}/edit`}
                  className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Edit3 size={16} />
                </Link>
                <button
                  onClick={() => handleDelete(path.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
