"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, Calendar, Download } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import {
  SectionCard,
  StatCard,
  LoadingState,
  EmptyState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSession,
  type LiveSessionBooking,
} from "@/lib/api/live-sessions";

export default function AnalyticsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [bookings, setBookings] = useState<LiveSessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("all");

  useEffect(() => {
    if (!sessionId || authLoading) return;
    Promise.all([
      liveSessionsApi.getSession(sessionId),
      liveSessionsApi
        .getSessionBookings(sessionId)
        .catch(() => liveSessionsApi.getMyBookings()),
    ])
      .then(([sess, res]) => {
        setSession(sess);
        const sessionBookings = res.items.filter(
          (b) => b.liveSessionId === sessionId,
        );
        setBookings(sessionBookings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, authLoading]);

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

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const attended = bookings.filter((b) => b.attended);
  const revenue = session.priceAmount
    ? session.priceAmount * confirmed.length * 0.9
    : 0;

  const now = Date.now();
  const rangeMs =
    timeRange === "7d"
      ? 7 * 86400000
      : timeRange === "30d"
        ? 30 * 86400000
        : Infinity;
  const filteredBookings = bookings.filter(
    (b) => now - new Date(b.createdAt).getTime() < rangeMs,
  );

  const daysSinceCreation = session.createdAt
    ? Math.max(
        1,
        Math.ceil((now - new Date(session.createdAt).getTime()) / 86400000),
      )
    : 1;

  const bookingsPerDay = filteredBookings.length / daysSinceCreation;

  const ratingDistribution = [0, 0, 0, 0, 0];

  const timeRanges = [
    { value: "7d", label: t("manage.analytics.last7days") },
    { value: "30d", label: t("manage.analytics.last30days") },
    { value: "all", label: t("manage.analytics.allTime") },
  ];

  const maxRating = Math.max(...ratingDistribution, 1);

  const handleExportReport = () => {
    const lines = [
      "Metric,Value",
      `Total Bookings,${bookings.length}`,
      `Confirmed,${confirmed.length}`,
      `Cancelled,${cancelled.length}`,
      `Attended,${attended.length}`,
      `Revenue (DZD),${revenue}`,
      `Price,${session.priceAmount || 0}`,
      `Attendance Rate,${confirmed.length > 0 ? Math.round((attended.length / confirmed.length) * 100) : 0}%`,
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

          <div className="flex items-center justify-between mt-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {t("manage.analytics.title")}
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                {timeRanges.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setTimeRange(r.value as any)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      timeRange === r.value
                        ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-sm"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <PodaciumButton
                size="sm"
                variant="secondary"
                onClick={handleExportReport}
              >
                <Download className="h-4 w-4" />
                <span className="ms-1">
                  {t("manage.analytics.exportReport")}
                </span>
              </PodaciumButton>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              value={bookings.length}
              label={t("manage.bookings.title")}
              icon={<Calendar className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              value={`${bookingsPerDay.toFixed(1)}/day`}
              label={t("manage.analytics.bookingsOverTime")}
              icon={<TrendingUp className="h-5 w-5" />}
              color="purple"
            />
            <StatCard
              value={`${confirmed.length > 0 ? Math.round((attended.length / confirmed.length) * 100) : 0}%`}
              label={t("manage.analytics.attendanceRate")}
              icon={<TrendingUp className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              value={`${revenue.toLocaleString()} ${t("common.dzd")}`}
              label={t("mySessions.revenue")}
              icon={<TrendingUp className="h-5 w-5" />}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SectionCard title={t("manage.analytics.engagement")}>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/60 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {bookings.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("manage.bookings.title")}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/60 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {attended.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("common.attended")}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-slate-900/60 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {cancelled.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t("common.cancelled")}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t("manage.analytics.topReferrers")}>
              <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">
                {t("manage.analytics.noReferrerData")}
              </div>
            </SectionCard>
          </div>

          <SectionCard title={t("manage.bookings.title")}>
            {filteredBookings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {t("manage.analytics.noData")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                      <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                        {t("common.date")}
                      </th>
                      <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                        {t("common.status")}
                      </th>
                      <th className="text-start py-2 px-3 text-gray-500 dark:text-slate-400 font-medium">
                        {t("common.attended")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.slice(0, 20).map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-gray-50 dark:border-slate-800/60"
                      >
                        <td className="py-2 px-3 text-gray-700 dark:text-slate-300">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              b.status === "confirmed"
                                ? "bg-green-100 text-green-700"
                                : b.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {b.attended === true
                            ? t("common.yes")
                            : b.attended === false
                              ? t("common.no")
                              : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </main>
      </PageLayout>
    </div>
  );
}
