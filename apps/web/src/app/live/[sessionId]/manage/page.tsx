"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  DollarSign,
  Download,
  Search,
  Send,
  X,
  CheckCircle,
  Clock,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import {
  SectionCard,
  StatCard,
  LoadingState,
  EmptyState,
} from "@/components/SectionComponents";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSession,
  type LiveSessionBooking,
} from "@/lib/api/live-sessions";

export default function ManageSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [bookings, setBookings] = useState<LiveSessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<LiveSessionBooking | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!sessionId || authLoading) return;
    Promise.all([
      liveSessionsApi.getSession(sessionId),
      liveSessionsApi.getMyBookings({ status: statusFilter || undefined }),
    ])
      .then(([sess, res]) => {
        setSession(sess);
        const filtered = res.items.filter((b) => b.liveSessionId === sessionId);
        setBookings(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, authLoading, statusFilter]);

  const isOwner = user && session && user.id === session.ownerId;
  const isScheduled = session?.status === "SCHEDULED";

  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return String(b.userId).includes(q) || String(b.id).includes(q);
  });

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const headers = ["Booking ID", "User ID", "Status", "Attended", "Date"];
      const rows = filteredBookings.map((b) => [
        b.id,
        b.userId,
        b.status,
        b.attended ?? "",
        new Date(b.createdAt).toLocaleDateString(),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n",
      );
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId}-bookings.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [filteredBookings, sessionId]);

  const handleCancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await liveSessionsApi.cancelBooking(cancelTarget.id);
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelTarget.id ? { ...b, status: "cancelled" } : b,
        ),
      );
      setCancelTarget(null);
    } catch {}
    setCancelling(false);
  };

  const handleSendReminder = async (bookingId: number) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: b.status } : b)),
    );
  };

  if (authLoading || loading) {
    return (
      <div dir={dir}>
        <PageLayout background="gray">
          <LoadingState text={t("common.loading")} />
        </PageLayout>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  if (!session) return null;

  const confirmedCount = bookings.filter(
    (b) => b.status === "confirmed",
  ).length;
  const cancelledCount = bookings.filter(
    (b) => b.status === "cancelled",
  ).length;
  const attendedCount = bookings.filter((b) => b.attended).length;
  const revenue = session.priceAmount
    ? session.priceAmount * confirmedCount * 0.9
    : 0;

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <PodaciumBadge variant="success">
            {t("bookings.status.confirmed")}
          </PodaciumBadge>
        );
      case "cancelled":
        return (
          <PodaciumBadge variant="destructive">
            {t("bookings.status.cancelled")}
          </PodaciumBadge>
        );
      case "attended":
        return (
          <PodaciumBadge variant="success">
            {t("bookings.status.attended")}
          </PodaciumBadge>
        );
      default:
        return <PodaciumBadge variant="secondary">{status}</PodaciumBadge>;
    }
  };

  const filterTabs = [
    { value: "", label: t("manage.bookings.filterAll") },
    { value: "confirmed", label: t("manage.bookings.filterConfirmed") },
    { value: "cancelled", label: t("manage.bookings.filterCancelled") },
    { value: "attended", label: t("manage.bookings.filterAttended") },
  ];

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-5xl mx-auto px-4 py-8">
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/live/${sessionId}`)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            {t("common.back")}
          </PodaciumButton>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-4 mb-6">
            {t("manage.title")}: {session.title}
          </h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              value={confirmedCount}
              label={t("manage.bookings.attendee")}
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              value={`${revenue.toLocaleString()} ${t("common.dzd")}`}
              label={t("mySessions.revenue")}
              icon={<DollarSign className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              value={`${confirmedCount > 0 ? Math.round((attendedCount / confirmedCount) * 100) : 0}%`}
              label={t("manage.analytics.attendanceRate")}
              icon={<CheckCircle className="h-5 w-5" />}
              color="purple"
            />
            <StatCard
              value={cancelledCount}
              label={t("bookings.status.cancelled")}
              icon={<X className="h-5 w-5" />}
              color="red"
            />
          </div>

          <SectionCard
            title={t("manage.bookings.title")}
            action={
              <div className="flex gap-2">
                <PodaciumButton
                  size="sm"
                  variant="secondary"
                  onClick={handleExportCsv}
                  disabled={exporting || bookings.length === 0}
                >
                  {exporting
                    ? t("manage.bookings.exporting")
                    : t("manage.bookings.exportCsv")}
                  <Download className="h-4 w-4 ms-1" />
                </PodaciumButton>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <PodaciumInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("manage.bookings.searchAttendees")}
                    inputSize="sm"
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setStatusFilter(tab.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        statusFilter === tab.value
                          ? "bg-purple-100 text-purple-700"
                          : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <EmptyState title={t("manage.bookings.noBookings")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800">
                        <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                          {t("manage.bookings.attendee")}
                        </th>
                        <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                          {t("manage.bookings.email")}
                        </th>
                        <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                          {t("manage.bookings.status")}
                        </th>
                        <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                          {t("manage.bookings.bookingDate")}
                        </th>
                        {isScheduled && (
                          <th className="text-end py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                            {t("common.actions")}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                        >
                          <td className="py-2.5 px-3 text-gray-700 dark:text-slate-300">
                            {t("common.user")} #{b.userId}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 dark:text-slate-400">
                            {b.userId}
                          </td>
                          <td className="py-2.5 px-3">
                            {statusBadge(b.status)}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 dark:text-slate-400">
                            {new Date(b.createdAt).toLocaleDateString()}
                          </td>
                          {isScheduled && (
                            <td className="py-2.5 px-3 text-end">
                              <div className="flex items-center justify-end gap-1">
                                {b.status === "confirmed" && (
                                  <>
                                    <button
                                      onClick={() => handleSendReminder(b.id)}
                                      className="p-1.5 rounded hover:bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                                      title={t("manage.bookings.sendReminder")}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setCancelTarget(b)}
                                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/60 text-red-500 dark:text-red-400"
                                      title={t("common.cancel")}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>
        </main>
      </PageLayout>

      <PodaciumModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t("manage.bookings.cancelBooking")}
      >
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
          {t("manage.bookings.cancelConfirm")}
        </p>
        <div className="flex gap-3 justify-end">
          <PodaciumButton
            variant="secondary"
            onClick={() => setCancelTarget(null)}
          >
            {t("common.cancel")}
          </PodaciumButton>
          <PodaciumButton
            variant="destructive"
            onClick={handleCancelBooking}
            disabled={cancelling}
          >
            {cancelling
              ? t("manage.bookings.cancelling")
              : t("manage.bookings.cancelBooking")}
          </PodaciumButton>
        </div>
      </PodaciumModal>
    </div>
  );
}
