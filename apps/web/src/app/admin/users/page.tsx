"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  ShieldOff,
  MoreVertical,
  Download,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { PodaciumButton, PodaciumBadge } from "@/components/design-system";

interface UserSummary {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  isDeactivated: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserListResponse {
  users: UserSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300",
  INSTRUCTOR:
    "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
  USER: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  ORGANIZATION:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
};

export default function AdminUsersPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set(),
  );
  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await api.get<UserListResponse>(
        `${ENDPOINTS.ADMIN.USERS}?${params}`,
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await api.patch(ENDPOINTS.ADMIN.USER(userId), { role });
      fetchUsers();
      setActiveMenu(null);
    } catch (err) {
      console.error("Failed to update role", err);
    }
  };

  const handleToggleDeactivate = async (user: UserSummary) => {
    const newState = !user.isDeactivated;
    try {
      await api.patch(ENDPOINTS.ADMIN.USER(user.id), {
        is_deactivated: newState,
      });
      fetchUsers();
      setActiveMenu(null);
    } catch (err) {
      console.error("Failed to toggle user status", err);
    }
  };

  const toggleSelectAll = () => {
    if (!data?.users.length) return;
    const allSelected = data.users.every((u) => selectedUserIds.has(u.id));
    const next = new Set(selectedUserIds);
    if (allSelected) {
      data.users.forEach((u) => next.delete(u.id));
    } else {
      data.users.forEach((u) => next.add(u.id));
    }
    setSelectedUserIds(next);
  };

  const toggleSelectUser = (id: number) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedUserIds(next);
  };

  const exportSelectedUsersCSV = () => {
    if (!data?.users) return;
    const usersToExport = data.users.filter((u) => selectedUserIds.has(u.id));
    if (usersToExport.length === 0) return;

    const sanitizeCell = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = [
      "ID",
      "Name",
      "Email",
      "Role",
      "Status",
      "JoinedAt",
      "LastLoginAt",
    ];
    const rows = usersToExport.map((u) => [
      sanitizeCell(u.id),
      sanitizeCell(u.fullName || ""),
      sanitizeCell(u.email),
      sanitizeCell(u.role),
      sanitizeCell(u.isDeactivated ? "DEACTIVATED" : "ACTIVE"),
      sanitizeCell(u.createdAt),
      sanitizeCell(u.lastLoginAt || ""),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `users-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isAllPageSelected =
    Boolean(data?.users.length) &&
    data?.users.every((u) => selectedUserIds.has(u.id));
  const isSomePageSelected =
    Boolean(data?.users.length) &&
    data?.users.some((u) => selectedUserIds.has(u.id)) &&
    !isAllPageSelected;

  return (
    <div className="relative pb-16">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
          {t("admin.users.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {t("admin.users.subtitle")}
        </p>
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
            placeholder={t("admin.users.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
        >
          <option value="">{t("admin.users.allRoles")}</option>
          <option value="ADMIN">{t("admin.users.roles.ADMIN")}</option>
          <option value="INSTRUCTOR">
            {t("admin.users.roles.INSTRUCTOR")}
          </option>
          <option value="STUDENT">{t("admin.users.roles.STUDENT")}</option>
          <option value="BUSINESS">{t("admin.users.roles.BUSINESS")}</option>
          <option value="FREELANCER">
            {t("admin.users.roles.FREELANCER")}
          </option>
        </select>
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
        ) : !data?.users.length ? (
          <div className="py-20 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p>{t("admin.users.noUsers")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800">
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isAllPageSelected}
                        ref={(el) => {
                          if (el)
                            el.indeterminate = Boolean(isSomePageSelected);
                        }}
                        onChange={toggleSelectAll}
                        aria-label={t("admin.users.selectAll")}
                        className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/20"
                      />
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.name")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.email")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.role")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.status")}
                    </th>
                    <th className="text-start px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.joined")}
                    </th>
                    <th className="text-end px-5 py-3.5 font-semibold text-gray-600 dark:text-slate-400">
                      {t("admin.users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-gray-50 dark:border-slate-800/60 transition-colors ${
                        selectedUserIds.has(user.id)
                          ? "bg-blue-50/70 dark:bg-blue-950/60"
                          : "hover:bg-blue-50/50 dark:hover:bg-blue-950/40"
                      }`}
                    >
                      <td className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          aria-label={t("admin.users.selectUser", {
                            name: user.fullName || user.email,
                          })}
                          className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/20"
                        />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-slate-100">
                        {user.fullName || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-slate-400">
                        {user.email}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[user.role] || "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.isDeactivated ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" : "bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:text-emerald-300"}`}
                        >
                          {user.isDeactivated
                            ? t("admin.users.deactivated")
                            : t("admin.users.active")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-end relative">
                        <button
                          onClick={() =>
                            setActiveMenu(
                              activeMenu === user.id ? null : user.id,
                            )
                          }
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <MoreVertical size={16} className="text-gray-400" />
                        </button>
                        <AnimatePresence>
                          {activeMenu === user.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={`absolute ${dir === "rtl" ? "left-5" : "right-5"} top-12 z-20 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 py-1.5 min-w-[180px]`}
                            >
                              {["ADMIN", "INSTRUCTOR", "USER"]
                                .filter((r) => r !== user.role)
                                .map((role) => (
                                  <button
                                    key={role}
                                    onClick={() =>
                                      handleUpdateRole(user.id, role)
                                    }
                                    className="w-full text-start px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
                                  >
                                    <Shield
                                      size={14}
                                      className="text-blue-500 dark:text-blue-400"
                                    />
                                    {t("admin.users.changeRole")}: {role}
                                  </button>
                                ))}
                              <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                              <button
                                onClick={() => handleToggleDeactivate(user)}
                                className={`w-full text-start px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800/60 flex items-center gap-2 ${user.isDeactivated ? "text-green-600" : "text-red-600 dark:text-red-400"}`}
                              >
                                {user.isDeactivated ? (
                                  <Shield size={14} />
                                ) : (
                                  <ShieldOff size={14} />
                                )}
                                {user.isDeactivated
                                  ? t("admin.users.reactivateUser")
                                  : t("admin.users.deactivateUser")}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-slate-800">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {t("admin.common.showing")} {(page - 1) * pageSize + 1}{" "}
                  {t("admin.common.to")} {Math.min(page * pageSize, data.total)}{" "}
                  {t("admin.common.of")} {data.total}{" "}
                  {t("admin.common.entries")}
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

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedUserIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {selectedUserIds.size}
              </span>
              <span className="text-sm font-medium">
                {t("common.uiLabels.selected")}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-700 mx-1" />
            <PodaciumButton
              size="sm"
              variant="outline"
              onClick={exportSelectedUsersCSV}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-600 gap-1.5"
            >
              <Download size={14} />
              {t("admin.common.exportCsv")}
            </PodaciumButton>
            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors ms-1"
              aria-label={t("admin.users.clearSelection")}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
