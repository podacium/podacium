"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  GraduationCap,
  Search,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Enrollment {
  id: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  moduleId: string;
  moduleTitle: string | null;
  progress: number;
  completedAt: string | null;
  createdAt: string;
}

export default function AdminEnrollmentsPage() {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<any>(`/api/admin/enrollments?${params}`);
      setEnrollments(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const handleRevoke = async (id: string) => {
    if (!confirm(t("admin.enrollments.confirmRevoke"))) return;
    try {
      await api.delete(`/api/admin/enrollments/${id}`);
      toast.success(t("admin.enrollments.revoked"));
      fetchEnrollments();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            {t("admin.enrollments.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.enrollments.subtitle")} ({total})
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-gray-400`}
          />
          <input
            type="text"
            placeholder={t("admin.enrollments.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`w-full ${isRTL ? "pr-9 pl-4" : "pl-9 pr-4"} py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
        >
          <option value="">{t("admin.enrollments.allStatuses")}</option>
          <option value="active">{t("admin.enrollments.active")}</option>
          <option value="completed">{t("admin.enrollments.completed")}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-x-auto shadow-sm">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
            <tr>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.enrollments.user")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.enrollments.module")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.enrollments.progress")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.enrollments.status")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("admin.enrollments.enrolledAt")}
              </th>
              <th
                className={`px-4 py-3 font-medium text-gray-600 dark:text-slate-400 ${isRTL ? "text-left" : "text-right"}`}
              >
                {t("admin.common.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {enrollments.map((e) => (
              <tr
                key={e.id}
                className="hover:bg-gray-50/50 dark:hover:bg-slate-800/60"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {e.userName || "—"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {e.userEmail}
                  </p>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300">
                  {e.moduleTitle || e.moduleId}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${e.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {e.progress}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.completedAt ? "bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"}`}
                  >
                    {e.completedAt
                      ? t("admin.enrollments.completed")
                      : t("admin.enrollments.active")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                  {new Date(e.createdAt).toLocaleDateString()}
                </td>
                <td
                  className={`px-4 py-3 ${isRTL ? "text-left" : "text-right"}`}
                >
                  <button
                    onClick={() => handleRevoke(e.id)}
                    className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg"
                    title={t("admin.enrollments.revoke")}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {enrollments.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500 dark:text-slate-400">
            {t("admin.common.noResults")}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.common.showing")} {(page - 1) * 20 + 1}–
            {Math.min(page * 20, total)} {t("admin.common.of")} {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-200 dark:border-slate-800 rounded-lg disabled:opacity-50"
            >
              {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-gray-200 dark:border-slate-800 rounded-lg disabled:opacity-50"
            >
              {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
