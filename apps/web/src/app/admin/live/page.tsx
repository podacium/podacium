"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Radio,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  AlertCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Video,
  Globe,
  Lock,
} from "lucide-react";

import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSession,
  type AdminStats,
} from "@/lib/api/live-sessions";

const ANIMATION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export default function AdminLiveSessionsPage() {
  const lt = useTranslations("live");
  const { dir } = useBidi();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    sessionId: string;
    title: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchSessions = () => {
    Promise.all([
      liveSessionsApi.getAdminStats().catch(() => null),
      liveSessionsApi
        .getAdminSessions({ limit: 100 })
        .catch(() => ({ items: [] })),
    ])
      .then(([s, sess]) => {
        setStats(s);
        setSessions(sess.items);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleApprove = async (sessionId: string) => {
    setActionLoading(`approve_${sessionId}`);
    try {
      await liveSessionsApi.approveSession(sessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                approvedAt: new Date().toISOString(),
                rejectedAt: null as any,
                rejectionReason: null as any,
              }
            : s,
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const { sessionId } = rejectModal;
    setActionLoading(`reject_${sessionId}`);
    try {
      await liveSessionsApi.rejectSession(sessionId, rejectReason);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                approvedAt: null as any,
                rejectedAt: new Date().toISOString(),
                rejectionReason: rejectReason,
              }
            : s,
        ),
      );
      setRejectModal(null);
      setRejectReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<
      string,
      {
        variant: "destructive" | "warning" | "success" | "secondary";
        icon: React.ReactNode;
        label: string;
      }
    > = {
      LIVE: {
        variant: "destructive",
        icon: <Radio className="h-3 w-3" />,
        label: lt("common.live"),
      },
      SCHEDULED: {
        variant: "warning",
        icon: <Clock className="h-3 w-3" />,
        label: lt("common.scheduled"),
      },
      ENDED: {
        variant: "success",
        icon: <CheckCircle className="h-3 w-3" />,
        label: lt("common.ended"),
      },
      CANCELLED: {
        variant: "secondary",
        icon: <XCircle className="h-3 w-3" />,
        label: lt("common.cancelled"),
      },
    };
    const m = map[status];
    return (
      <PodaciumBadge variant={m?.variant || "secondary"} className="gap-1">
        {m?.icon}
        {m?.label || status}
      </PodaciumBadge>
    );
  };

  const filtered = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (typeFilter && s.type !== typeFilter) return false;
    if (
      search &&
      !s.title.toLowerCase().includes(search.toLowerCase()) &&
      !(s.owner?.name || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ANIMATION}
      className="text-gray-900 dark:text-slate-100"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {lt("admin.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {stats
              ? `${stats.total} ${lt("admin.statsTotal")} · ${stats.live} ${lt("admin.statsLive")} · ${stats.scheduled} ${lt("admin.statsScheduled")}`
              : lt("common.loading")}
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: lt("admin.statsTotal"),
              value: stats.total,
              color: "from-blue-500 to-blue-600",
            },
            {
              label: lt("admin.statsLive"),
              value: stats.live,
              color: "from-red-500 to-red-600",
            },
            {
              label: lt("admin.statsScheduled"),
              value: stats.scheduled,
              color: "from-amber-500 to-amber-600",
            },
            {
              label: lt("admin.statsEnded"),
              value: stats.ended,
              color: "from-green-500 to-green-600",
            },
            {
              label: lt("admin.statsCancelled"),
              value: stats.cancelled,
              color: "from-gray-500 to-gray-600",
            },
            {
              label: lt("admin.statsBookings"),
              value: stats.totalBookings,
              color: "from-purple-500 to-purple-600",
            },
            {
              label: lt("admin.statsParticipants"),
              value: stats.totalParticipants,
              color: "from-cyan-500 to-cyan-600",
            },
            {
              label: lt("admin.statsUpcoming"),
              value: stats.upcoming24h,
              color: "from-indigo-500 to-indigo-600",
            },
          ].map((stat, idx) => (
            <PodaciumCard
              key={idx}
              className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
            >
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                {stat.label}
              </p>
              <p
                className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}
              >
                {stat.value}
              </p>
            </PodaciumCard>
          ))}
        </div>
      )}

      <PodaciumCard className="p-4 mb-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lt("common.search")}
              className="w-full ps-9 pe-3 py-2 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">
              {lt("common.all")} ({lt("common.status")})
            </option>
            <option value="SCHEDULED">{lt("common.scheduled")}</option>
            <option value="LIVE">{lt("common.live")}</option>
            <option value="ENDED">{lt("common.ended")}</option>
            <option value="CANCELLED">{lt("common.cancelled")}</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">
              {lt("common.all")} ({lt("admin.typeLabel")})
            </option>
            <option value="COURSE">{lt("types.COURSE")}</option>
            <option value="MEETING">{lt("types.MEETING") || "Meeting"}</option>
          </select>
        </div>
      </PodaciumCard>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <PodaciumCard
              key={i}
              className="p-6 animate-pulse bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
            >
              <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 dark:bg-slate-800/60 rounded w-1/4" />
            </PodaciumCard>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PodaciumCard className="p-12 text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
          <Radio className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">
            {lt("listing.noSessions")}
          </p>
        </PodaciumCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => {
            const isPending =
              !session.approvedAt &&
              !session.rejectedAt &&
              session.status === "SCHEDULED";
            return (
              <PodaciumCard
                key={session.id}
                className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Link
                        href={`/live/${session.id}`}
                        className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                      >
                        {session.title}
                      </Link>
                      {statusBadge(session.status)}
                      <PodaciumBadge variant="secondary" className="text-xs">
                        {lt("types." + session.type) || session.type}
                      </PodaciumBadge>
                      <PodaciumBadge variant="outline" className="text-xs">
                        {lt("visibility." + session.visibility) ||
                          session.visibility}
                      </PodaciumBadge>
                      {session.category && (
                        <PodaciumBadge variant="secondary" className="text-xs">
                          {lt("categories." + session.category) ||
                            session.category}
                        </PodaciumBadge>
                      )}
                      {isPending && (
                        <PodaciumBadge variant="warning" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {lt("admin.pendingReview")}
                        </PodaciumBadge>
                      )}
                      {session.approvedAt && (
                        <PodaciumBadge variant="success" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {lt("admin.approved")}
                        </PodaciumBadge>
                      )}
                      {session.rejectedAt && (
                        <PodaciumBadge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {lt("admin.rejected")}
                        </PodaciumBadge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                      <span>
                        {lt("admin.creator")}:{" "}
                        <strong className="text-gray-700 dark:text-slate-300">
                          {session.owner?.name || `#${session.ownerId}`}
                        </strong>
                      </span>
                      <span>
                        {lt("admin.priceLabel")}:{" "}
                        <strong className="text-gray-700 dark:text-slate-300">
                          {session.priceAmount
                            ? `${session.priceAmount} ${lt("common.dzd")}`
                            : lt("common.free")}
                        </strong>
                      </span>
                      <span>
                        {lt("admin.bookingsLabel")}:{" "}
                        <strong className="text-gray-700 dark:text-slate-300">
                          {session.bookingCount}/
                          {session.maxParticipants || lt("common.unlimited")}
                        </strong>
                      </span>
                      {session.scheduledAt && (
                        <span>
                          {new Date(session.scheduledAt).toLocaleDateString()}{" "}
                          {new Date(session.scheduledAt).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      )}
                    </div>
                    {session.rejectionReason && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-2 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
                        {lt("admin.reasonLabel")}: {session.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/live/${session.id}`}>
                      <PodaciumButton
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="h-4 w-4" />}
                      />
                    </Link>
                    {isPending && (
                      <>
                        <PodaciumButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(session.id)}
                          disabled={actionLoading === `approve_${session.id}`}
                          loading={actionLoading === `approve_${session.id}`}
                          icon={<ThumbsUp className="h-4 w-4" />}
                        >
                          {lt("admin.approve")}
                        </PodaciumButton>
                        <PodaciumButton
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setRejectModal({
                              sessionId: session.id,
                              title: session.title,
                            })
                          }
                          disabled={actionLoading?.startsWith("reject_")}
                          icon={<ThumbsDown className="h-4 w-4" />}
                        >
                          {lt("admin.reject")}
                        </PodaciumButton>
                      </>
                    )}
                  </div>
                </div>
              </PodaciumCard>
            );
          })}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {lt("admin.reject")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {lt("admin.rejectReason")}:{" "}
              <strong className="text-gray-800 dark:text-slate-200">
                {rejectModal.title}
              </strong>
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={lt("admin.rejectReasonPlaceholder")}
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <PodaciumButton
                variant="outline"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
              >
                {lt("common.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="destructive"
                onClick={handleReject}
                disabled={
                  !rejectReason.trim() ||
                  actionLoading === `reject_${rejectModal.sessionId}`
                }
                loading={actionLoading === `reject_${rejectModal.sessionId}`}
              >
                {lt("admin.reject")}
              </PodaciumButton>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
