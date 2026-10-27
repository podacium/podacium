"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Download,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminEntry {
  id: number;
  fullName: string;
  email: string;
  referralCode: string;
  friendsReferredCount: number;
  status: string;
  createdAt: string;
  referralsCount: number;
  convertedToUserId: number | null;
}

interface WaitlistListResponse {
  data: AdminEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface AdminStats {
  totalEntries: number;
  pendingCount: number;
  verifiedCount: number;
  convertedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  conversionRate: number;
  avgReferrals: number;
  hourlySignups: { hour: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:
    "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300",
  VERIFIED: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300",
  CONVERTED:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300",
  BOUNCED: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300",
  UNSUBSCRIBED:
    "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400",
};

const STAT_FILTERS = [
  "all",
  "pending",
  "verified",
  "converted",
  "bounced",
  "unsubscribed",
] as const;

export default function AdminWaitlistPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const wl = (key: string) => `waitlist.admin.${key}`;
  const [data, setData] = useState<WaitlistListResponse | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "25",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter.toUpperCase());
      const [listRes, statsRes] = await Promise.all([
        api.get<WaitlistListResponse>(`${ENDPOINTS.ADMIN.WAITLIST}?${params}`),
        api.get<AdminStats>(ENDPOINTS.ADMIN.WAITLIST_STATS),
      ]);
      setData(listRes);
      setStats(statsRes);
    } catch (err) {
      console.error("Failed to load waitlist", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (entryId: number) => {
    if (!confirm(t(wl("confirmDelete")))) return;
    setDeletingId(entryId);
    try {
      await api.delete(ENDPOINTS.ADMIN.WAITLIST_ENTRY(entryId));
      fetchData();
    } catch (err) {
      console.error("Failed to delete entry", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(ENDPOINTS.ADMIN.WAITLIST_EXPORT, {
        credentials: "include",
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`Export failed (${response.status}): ${errBody}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "waitlist_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const statCards = stats
    ? [
        {
          label: wl("stats.total"),
          value: stats.totalEntries.toLocaleString(),
          color: "bg-blue-50 text-blue-700",
        },
        {
          label: wl("stats.pending"),
          value: stats.pendingCount.toLocaleString(),
          color: "bg-yellow-50 text-yellow-700",
        },
        {
          label: wl("stats.verified"),
          value: stats.verifiedCount.toLocaleString(),
          color: "bg-blue-50 text-blue-700",
        },
        {
          label: wl("stats.converted"),
          value: stats.convertedCount.toLocaleString(),
          color: "bg-emerald-50 text-emerald-700",
        },
        {
          label: wl("stats.bounced"),
          value: stats.bouncedCount.toLocaleString(),
          color: "bg-red-50 text-red-700",
        },
        {
          label: wl("stats.unsubscribed"),
          value: stats.unsubscribedCount.toLocaleString(),
          color:
            "bg-gray-50 dark:bg-slate-900/60 text-gray-600 dark:text-slate-400",
        },
        {
          label: wl("stats.conversionRate"),
          value: `${stats.conversionRate}%`,
          color:
            "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
        },
        {
          label: wl("stats.avgReferrals"),
          value: stats.avgReferrals.toString(),
          color: "bg-indigo-50 text-indigo-700",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
          {t(wl("title"))}
        </h1>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t(card.label)}
            </p>
            <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={18}
            className={cn(
              "absolute top-3 text-gray-400",
              dir === "rtl" ? "right-3" : "left-3",
            )}
          />
          <input
            type="text"
            placeholder={t(wl("filters.search"))}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={cn(
              "w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900",
              "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm",
              dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4",
            )}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STAT_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setStatusFilter(f === "all" ? "" : f);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                statusFilter === f || (f === "all" && !statusFilter)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60",
              )}
            >
              {t(wl(`filters.${f}`))}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <Download size={16} />
          {t(wl("filters.export"))}
        </button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : !data?.data.length ? (
          <div className="py-20 text-center text-gray-400">
            <UserPlus size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t(wl("empty"))}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800">
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.name"))}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.email"))}
                    </th>
                    <th className="text-center px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.referrals"))}
                    </th>
                    <th className="text-center px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.status"))}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.date"))}
                    </th>
                    <th className="text-end px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t(wl("table.actions"))}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((entry, i) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-slate-100">
                        {entry.fullName}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {entry.email}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {entry.friendsReferredCount}
                        </span>
                        {entry.referralsCount > 0 && (
                          <span className="text-gray-400 text-xs ml-1">
                            (+{entry.referralsCount})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold",
                            STATUS_COLORS[entry.status] ||
                              "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400",
                          )}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-slate-400 text-xs">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors text-gray-400 hover:text-red-500 dark:text-red-400 disabled:opacity-40"
                        >
                          {deletingId === entry.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
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
                  {t("waitlist.admin.pageOf", {
                    page: data.page,
                    totalPages: data.total_pages,
                  })}
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
