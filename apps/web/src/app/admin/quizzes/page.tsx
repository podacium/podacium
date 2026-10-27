"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  HelpCircle,
  Search,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Quiz {
  id: number;
  title: string;
  lessonId: string | null;
  lessonTitle: string | null;
  passingScore: number;
  questionCount: number;
  attemptCount: number;
  createdAt: string;
}

export default function AdminQuizzesPage() {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>("/api/admin/quizzes");
      setQuizzes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.quizzes.confirmDeleteQuiz"))) return;
    try {
      await api.delete(`/api/admin/quizzes/${id}`);
      toast.success(t("admin.quizzes.quizDeleted"));
      fetchQuizzes();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const filtered = quizzes.filter(
    (q) =>
      !search ||
      q.title?.toLowerCase().includes(search.toLowerCase()) ||
      q.lessonTitle?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            {t("admin.quizzes.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.quizzes.subtitle")} ({filtered.length})
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search
            size={16}
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-gray-400`}
          />
          <input
            type="text"
            placeholder={t("admin.common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${isRTL ? "pr-9 pl-4" : "pl-9 pr-4"} py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none`}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
            <tr>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.quizzes.quizTitle")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.lessons.title")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.quizzes.passingScore")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.quizzes.questions")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.quizzes.attempts")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-left" : "text-right"}`}
              >
                {t("admin.common.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {filtered.map((q) => (
              <tr
                key={q.id}
                className="hover:bg-gray-50/50 dark:hover:bg-slate-800/60"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                  {q.title || `Quiz #${q.id}`}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {q.lessonTitle || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {q.passingScore}%
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {q.questionCount}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                  {q.attemptCount}
                </td>
                <td
                  className={`px-4 py-3 ${isRTL ? "text-left" : "text-right"}`}
                >
                  <div
                    className={`flex items-center ${isRTL ? "justify-start" : "justify-end"} gap-1`}
                  >
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-slate-400">
            {t("admin.common.noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
