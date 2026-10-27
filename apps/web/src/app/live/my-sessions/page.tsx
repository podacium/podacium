"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Plus,
  BarChart3,
  Settings,
  Copy,
  DollarSign,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumTabs from "@/components/design-system/PodaciumTabs";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi, type LiveSession } from "@/lib/api/live-sessions";

export default function MySessionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");

  const tabs = [
    { id: "", label: t("mySessions.tabs.all") },
    { id: "SCHEDULED", label: t("mySessions.tabs.scheduled") },
    { id: "LIVE", label: t("mySessions.tabs.live") },
    { id: "ENDED", label: t("mySessions.tabs.ended") },
  ];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const params: any = {};
    if (tab) params.status = tab;
    liveSessionsApi
      .getMySessions(params)
      .then((res) => setSessions(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, tab, authLoading]);

  if (authLoading) return null;
  if (!user) return null;

  const badgeVariant = (status: string) => {
    switch (status) {
      case "LIVE":
        return "destructive";
      case "SCHEDULED":
        return "warning";
      default:
        return "secondary";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "LIVE":
        return t("common.live");
      case "SCHEDULED":
        return t("common.scheduled");
      default:
        return t("common.ended");
    }
  };

  const totalRevenue = sessions.reduce(
    (sum, s) => sum + (s.priceAmount || 0) * (s.bookingCount || 0) * 0.9,
    0,
  );
  const totalBookings = sessions.reduce(
    (sum, s) => sum + (s.bookingCount || 0),
    0,
  );

  const renderList = () => {
    if (loading) return <LoadingState text={t("common.loading")} />;
    if (sessions.length === 0) {
      return (
        <EmptyState
          icon={<Calendar className="h-12 w-12" />}
          title={t("mySessions.noSessions")}
          action={
            <PodaciumButton
              variant="primary"
              onClick={() => router.push("/live/create")}
            >
              {t("mySessions.createButton")}
            </PodaciumButton>
          }
        />
      );
    }
    return (
      <div className="space-y-4">
        {sessions.map((session) => {
          const revenue =
            (session.priceAmount || 0) * (session.bookingCount || 0) * 0.9;
          return (
            <div
              key={session.id}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:border-purple-500/50 transition-all cursor-pointer shadow-sm"
              onClick={() => router.push(`/live/${session.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {session.status === "LIVE" && (
                      <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                    )}
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                      {session.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {session.scheduledAt &&
                      new Date(session.scheduledAt).toLocaleDateString()}
                    {session.scheduledAt && (
                      <>
                        {" "}
                        {new Date(session.scheduledAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {session.bookingCount}
                    </span>
                    {revenue > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />{" "}
                        {revenue.toLocaleString()} {t("common.dzd")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ms-4">
                  <PodaciumBadge variant={badgeVariant(session.status) as any}>
                    {statusLabel(session.status)}
                  </PodaciumBadge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <PodaciumButton
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/live/${session.id}/manage`);
                  }}
                  icon={<Settings className="h-3.5 w-3.5" />}
                >
                  {t("mySessions.manage")}
                </PodaciumButton>
                <PodaciumButton
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/live/${session.id}/analytics`);
                  }}
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                >
                  {t("mySessions.viewAnalytics")}
                </PodaciumButton>
                {session.status !== "LIVE" && (
                  <PodaciumButton
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/live/${session.id}/clone`);
                    }}
                    icon={<Copy className="h-3.5 w-3.5" />}
                  >
                    {t("mySessions.clone")}
                  </PodaciumButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <PageHeader
            title={t("mySessions.title")}
            icon={<Calendar className="h-6 w-6" />}
            actions={
              <PodaciumButton
                variant="primary"
                size="sm"
                onClick={() => router.push("/live/create")}
                icon={<Plus className="h-4 w-4" />}
              >
                {t("mySessions.createButton")}
              </PodaciumButton>
            }
          />

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {sessions.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {t("manage.stats.totalSessions")}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {totalBookings}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {t("manage.stats.totalAttendees")}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {totalRevenue.toLocaleString()} {t("common.dzd")}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {t("mySessions.revenue")}
              </p>
            </div>
          </div>

          <PodaciumTabs tabs={tabs} defaultTab="" onChange={setTab}>
            {() => renderList()}
          </PodaciumTabs>
        </div>
      </PageLayout>
    </div>
  );
}
