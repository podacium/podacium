"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, XCircle, Send, Play } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import {
  SectionCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSessionBooking,
} from "@/lib/api/live-sessions";

export default function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [bookings, setBookings] = useState<LiveSessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    liveSessionsApi
      .getMyBookings()
      .then((res) => setBookings(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const [replayLoading, setReplayLoading] = useState<number | null>(null);

  const handleWatchReplay = async (bookingId: number, sessionId: string) => {
    setReplayLoading(bookingId);
    try {
      const { url } = await liveSessionsApi.getReplayToken(sessionId);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
    } finally {
      setReplayLoading(null);
    }
  };

  const handleCancel = async (bookingId: number) => {
    if (!window.confirm(t("bookings.cancelConfirm"))) return;
    setCancelling(bookingId);
    try {
      await liveSessionsApi.cancelBooking(bookingId);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      console.error("Failed to cancel booking:", err);
    } finally {
      setCancelling(null);
    }
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <PageHeader
            title={t("bookings.title")}
            icon={<Calendar className="h-6 w-6" />}
          />

          {loading ? (
            <LoadingState text={t("common.loading")} />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title={t("bookings.noBookings")}
            />
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <SectionCard key={booking.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() =>
                          router.push(`/live/${booking.liveSessionId}`)
                        }
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                            {booking.session?.title ||
                              t("common.sessionNumber", {
                                n: String(booking.liveSessionId),
                              })}
                          </h3>
                          <PodaciumBadge
                            variant={
                              booking.status === "confirmed"
                                ? "success"
                                : "secondary"
                            }
                          >
                            {booking.status === "confirmed"
                              ? t("bookings.status.confirmed")
                              : booking.status === "cancelled"
                                ? t("bookings.status.cancelled")
                                : booking.attended
                                  ? t("bookings.status.attended")
                                  : t("bookings.status.noShow")}
                          </PodaciumBadge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {booking.status === "confirmed" && (
                        <div className="flex items-center gap-2">
                          <Link href={`/live/transfer/${booking.id}`}>
                            <PodaciumButton
                              variant="secondary"
                              size="sm"
                              icon={<Send className="h-4 w-4" />}
                            >
                              {t("transfer.title")}
                            </PodaciumButton>
                          </Link>
                          <PodaciumButton
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(booking.id)}
                            disabled={cancelling === booking.id}
                            icon={<XCircle className="h-4 w-4" />}
                          >
                            {cancelling === booking.id
                              ? t("bookings.cancelling")
                              : t("bookings.cancelButton")}
                          </PodaciumButton>
                        </div>
                      )}
                      {booking.session?.status === "ENDED" &&
                        booking.session?.hasRecording && (
                          <PodaciumButton
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              handleWatchReplay(
                                booking.id,
                                booking.liveSessionId,
                              )
                            }
                            disabled={replayLoading === booking.id}
                            loading={replayLoading === booking.id}
                            icon={<Play className="h-4 w-4" />}
                          >
                            {t("replays.watch")}
                          </PodaciumButton>
                        )}
                    </div>
                  </div>
                </SectionCard>
              ))}
            </div>
          )}
        </div>
      </PageLayout>
    </div>
  );
}
