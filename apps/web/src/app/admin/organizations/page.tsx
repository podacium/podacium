"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Eye,
  MoreVertical,
} from "lucide-react";

interface OrgSummary {
  id: number;
  name: string;
  sector: string | null;
  country: string | null;
  owner_name: string | null;
  member_count: number;
  createdAt: string;
}

interface OrgListResponse {
  organizations: OrgSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function AdminOrganizationsPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [data, setData] = useState<OrgListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
      });
      if (search) params.set("search", search);
      const res = await api.get<OrgListResponse>(
        `${ENDPOINTS.ADMIN.ORGANIZATIONS}?${params}`,
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load organizations", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleDelete = async (orgId: number) => {
    if (!confirm(t("admin.organizations.confirmDelete"))) return;
    try {
      await api.delete(ENDPOINTS.ADMIN.ORGANIZATION(orgId));
      fetchOrgs();
    } catch (err) {
      console.error("Failed to delete org", err);
    }
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
          {t("admin.organizations.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {t("admin.organizations.subtitle")}
        </p>
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
            placeholder={t("admin.organizations.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
          />
        </div>
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
        ) : !data?.organizations.length ? (
          <div className="py-20 text-center text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t("admin.organizations.noOrganizations")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800">
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.name")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.sector")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.owner")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.members")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.created")}
                    </th>
                    <th className="text-end px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.organizations.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.organizations.map((org, i) => (
                    <motion.tr
                      key={org.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-slate-100">
                        {org.name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {org.sector || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {org.owner_name || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          {org.member_count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-slate-400">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        <button
                          onClick={() => handleDelete(org.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors text-gray-400 hover:text-red-500 dark:text-red-400"
                          title={t("admin.organizations.deleteOrg")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-slate-800">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("admin.common.page")} {page} {t("admin.common.of")}{" "}
                  {data.total_pages}
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
    </div>
  );
}
