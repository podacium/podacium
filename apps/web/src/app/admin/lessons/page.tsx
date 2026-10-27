"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Edit3,
  Video,
  HelpCircle,
  Filter,
  BookOpen,
  Plus,
} from "lucide-react";

interface Module {
  id: string;
  title: string;
}

interface LessonSummary {
  id: string;
  title: string;
  description: string | null;
  moduleId: string;
  moduleName?: string;
  order: number;
  type: string;
  durationMinutes: number | null;
  difficulty: string | null;
  hasVideo: boolean;
  hasQuiz: boolean;
  createdAt: string;
}

interface LessonListResponse {
  lessons: LessonSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const typeColors: Record<string, string> = {
  video: "bg-red-100 text-red-700",
  text: "bg-blue-100 text-blue-700",
  quiz: "bg-purple-100 text-purple-700",
  interactive: "bg-green-100 text-green-700",
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

export default function AdminLessonsPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [data, setData] = useState<LessonListResponse | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const pageSize = 20;

  const fetchModules = useCallback(async () => {
    try {
      const res = await api.get<any>(
        `${ENDPOINTS.ADMIN.MODULES}?page_size=100`,
      );
      setModules(res.modules || []);
    } catch (err) {
      console.error("Failed to load modules", err);
    }
  }, []);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      // Since there's no direct lessons endpoint, we need to fetch lessons per module
      // For now, we'll fetch from all modules
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search) params.set("search", search);

      // Fetch all modules first, then their lessons
      const modulesRes = await api.get<any>(
        `${ENDPOINTS.ADMIN.MODULES}?page_size=100`,
      );
      const allLessons: any[] = [];

      for (const courseModule of modulesRes.modules || []) {
        try {
          const lessonsRes = await api.get<any>(
            `${ENDPOINTS.ADMIN.MODULE(courseModule.id)}/lessons`,
          );
          if (lessonsRes && Array.isArray(lessonsRes)) {
            lessonsRes.forEach((lesson: any) => {
              allLessons.push({
                ...lesson,
                moduleName: courseModule.title,
              });
            });
          }
        } catch (e) {
          // Module might not have lessons
        }
      }

      setData({
        lessons: allLessons,
        total: allLessons.length,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });
    } catch (err) {
      console.error("Failed to load lessons", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleDelete = async (lessonId: string) => {
    if (!confirm(t("admin.lessons.confirmDelete"))) return;
    try {
      await api.delete(ENDPOINTS.ADMIN.LESSON(lessonId));
      fetchLessons();
    } catch (err) {
      console.error("Failed to delete lesson", err);
    }
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t("admin.lessons.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.lessons.subtitle")}
          </p>
        </div>
        <Link
          href="/admin/lessons/new"
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          {t("admin.lessons.newLesson")}
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex flex-wrap gap-4"
      >
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={18}
            className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
          />
          <input
            type="text"
            placeholder={t("admin.lessons.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
        >
          <option value="">{t("admin.lessons.allModules")}</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Lessons Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      ) : !data?.lessons.length ? (
        <div className="py-20 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p>{t("admin.lessons.noLessons")}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.lesson")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.module")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.type")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.duration")}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.features")}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("admin.lessons.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.lessons
                  .filter(
                    (lesson) =>
                      !moduleFilter || lesson.moduleId === moduleFilter,
                  )
                  .map((lesson) => (
                    <tr
                      key={lesson.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                            {lesson.order}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">
                              {lesson.title}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">
                              {lesson.description || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {lesson.moduleName || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[lesson.type] || "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"}`}
                        >
                          {lesson.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                        {lesson.durationMinutes
                          ? `${lesson.durationMinutes} min`
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {lesson.hasVideo && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full text-xs">
                              <Video size={12} />
                              {t("admin.lessons.types.video")}
                            </span>
                          )}
                          {lesson.hasQuiz && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full text-xs">
                              <HelpCircle size={12} />
                              {t("admin.lessons.types.quiz")}
                            </span>
                          )}
                          {!lesson.hasVideo && !lesson.hasQuiz && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/lessons/${lesson.id}/edit`}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Edit3 size={16} />
                          </Link>
                          <button
                            onClick={() => handleDelete(lesson.id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
