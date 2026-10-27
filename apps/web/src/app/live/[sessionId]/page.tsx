"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Tag,
  Play,
  StopCircle,
  Share2,
  AlertCircle,
  DollarSign,
  User,
  Globe,
  Languages,
  Clock3,
  Edit,
  Copy,
  Settings,
  BarChart3,
  ListOrdered,
  Eye,
  Star,
  MessageSquare,
  SendHorizonal,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import {
  SectionCard,
  LoadingState,
  ProgressBar,
} from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumTabs from "@/components/design-system/PodaciumTabs";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSession,
  type WaitlistResult,
  type ReviewResponse,
  type ReviewListResponse,
} from "@/lib/api/live-sessions";
import { api } from "@/lib/api";

const ANIMATION_CONFIGS = {
  EASING: {
    ENTER: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
} as const;

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [inProgressModalOpen, setInProgressModalOpen] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistResult | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewListResponse | null>(null);
  const [myReview, setMyReview] = useState<ReviewResponse | null | "loading">(
    "loading",
  );
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isOwner = user && session && user.id === session.ownerId;
  const isLive = session?.status === "LIVE";
  const isScheduled = session?.status === "SCHEDULED";
  const isEnded = session?.status === "ENDED";
  const isFree = !session?.priceAmount || session.priceAmount === 0;

  const statusLabel = (status: string) => {
    switch (status) {
      case "LIVE":
        return t("common.live");
      case "SCHEDULED":
        return t("common.scheduled");
      case "ENDED":
        return t("common.ended");
      default:
        return status;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "LIVE":
        return "destructive";
      case "SCHEDULED":
        return "warning";
      case "ENDED":
        return "secondary";
      default:
        return "secondary";
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    liveSessionsApi
      .getSession(sessionId)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    if (user) {
      liveSessionsApi
        .getMyWaitlistStatus(sessionId)
        .then((res) => {
          if (res) setWaitlist(res);
        })
        .catch(() => {});
      liveSessionsApi
        .getMyBookings()
        .then((res) => {
          if (res?.items?.some((b) => b.liveSessionId === sessionId)) {
            setIsBooked(true);
          }
        })
        .catch(() => {});
    }
  }, [sessionId, user]);

  useEffect(() => {
    if (!sessionId) return;
    liveSessionsApi
      .getSessionReviews(sessionId)
      .then(setReviews)
      .catch(() => {});
    if (user) {
      liveSessionsApi
        .getMyReview(sessionId)
        .then((res) => setMyReview(res || ("loading" as any)))
        .catch(() => setMyReview("loading" as any));
    } else {
      setMyReview("loading" as any);
    }
  }, [sessionId, user]);

  const handleSubmitReview = async () => {
    if (!sessionId || reviewRating < 1) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await liveSessionsApi.createReview(sessionId, {
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      const [updatedReviews, myUpdated] = await Promise.all([
        liveSessionsApi.getSessionReviews(sessionId),
        liveSessionsApi.getMyReview(sessionId),
      ]);
      setReviews(updatedReviews);
      setMyReview(myUpdated);
      setReviewRating(0);
      setReviewComment("");
    } catch (err: any) {
      setReviewError(err?.message || t("reviews.error"));
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    const isSuccess = searchParams.get("booking") === "success";
    if (!isSuccess) return;
    setBookingSuccess(true);

    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    const poll = setInterval(async () => {
      try {
        const updated = await liveSessionsApi.getSession(sessionId);
        setSession(updated);
        if (updated.bookingCount > 0) {
          clearInterval(poll);
          return;
        }
        const checkoutId = sessionStorage.getItem("pending_checkout_id");
        if (checkoutId) {
          const verified = await api.verifyCheckout({
            checkout_id: checkoutId,
          });
          if (verified?.finalized) {
            const updated = await liveSessionsApi.getSession(sessionId);
            setSession(updated);
          }
        }
      } catch {}
    }, 2000);

    setTimeout(() => clearInterval(poll), 30000);
  }, [searchParams, sessionId]);

  const isAdmin =
    (user?.role as string) === "ADMIN" ||
    (user?.role as string) === "SUPERADMIN";

  const hasAccess = Boolean(isOwner || isAdmin || isBooked || isFree);

  const getElapsedMinutes = () => {
    if (!session?.startedAt) return 0;
    const start = new Date(session.startedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60)));
  };

  const elapsedMinutes = getElapsedMinutes();

  const formatElapsed = (mins: number) => {
    if (mins < 1) return "< 1 min";
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins} min`;
  };

  const handleLiveBookClick = () => {
    if (!user) {
      router.push(`/auth/login?redirect=/live/${sessionId}/book`);
      return;
    }
    if (elapsedMinutes > 10) {
      setInProgressModalOpen(true);
    } else {
      router.push(`/live/${sessionId}/book`);
    }
  };

  const handleStart = async () => {
    if (!sessionId) return;
    setActionLoading("start");
    setError(null);
    try {
      if (isAdmin && !session?.approvedAt) {
        await liveSessionsApi.approveSession(sessionId);
      }
      const updated = await liveSessionsApi.startSession(sessionId);
      setSession(updated);
    } catch (err: any) {
      if (
        err?.code === "NOT_APPROVED" ||
        err?.status === 403 ||
        err?.message?.includes("approval") ||
        err?.message?.includes("approved")
      ) {
        setError(t("detail.pendingApprovalError"));
      } else {
        setError(err.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAndStart = async () => {
    if (!sessionId) return;
    setActionLoading("approve");
    setError(null);
    try {
      await liveSessionsApi.approveSession(sessionId);
      const updated = await liveSessionsApi.startSession(sessionId);
      setSession(updated);
    } catch (err: any) {
      setError(err?.message || t("detail.pendingApprovalError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    setActionLoading("end");
    try {
      const updated = await liveSessionsApi.endSession(sessionId);
      setSession(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoin = async () => {
    if (!sessionId || !user) return;
    setActionLoading("join");
    try {
      // The join happens in the room page, which fetches its token over the
      // authenticated API. The URL must never carry the LiveKit token.
      const { token } = await liveSessionsApi.joinSession(sessionId);
      if (token) {
        window.location.href = `/live/${sessionId}/room`;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleWatchReplay = async () => {
    if (!sessionId || !user) return;
    setActionLoading("replay");
    try {
      // The replay is a short-lived CloudFront signed URL fetched over the
      // authenticated API. Never embed or pass the URL through the address bar.
      const { url } = await liveSessionsApi.getReplayToken(sessionId);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setError(t("errors.replayUnavailable"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!sessionId) return;
    setWaitlistLoading(true);
    try {
      const res = await liveSessionsApi.joinWaitlist(sessionId);
      setWaitlist(res);
    } catch (err: any) {
      setError(err?.message || t("errors.genericError"));
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!sessionId) return;
    setWaitlistLoading(true);
    try {
      await liveSessionsApi.leaveWaitlist(sessionId);
      setWaitlist(null);
    } catch {
    } finally {
      setWaitlistLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailTabs = [
    { id: "overview", label: t("detail.overview") },
    { id: "agenda", label: t("detail.agenda") },
    { id: "materials", label: t("detail.materials") },
    { id: "reviews", label: t("detail.reviews") },
  ];

  if (loading) {
    return (
      <div dir={dir}>
        <PageLayout background="gray">
          <LoadingState text={t("common.loading")} />
        </PageLayout>
      </div>
    );
  }

  if (!session) {
    return (
      <div dir={dir}>
        <PageLayout background="gray">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <AlertCircle className="h-12 w-12 text-gray-600 dark:text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl text-gray-900 dark:text-slate-100 font-semibold mb-2">
              {t("detail.notFoundTitle")}
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              {error || t("detail.notFoundMessage")}
            </p>
            <Link
              href="/live"
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700"
            >
              {t("detail.browseLink")}
            </Link>
          </div>
        </PageLayout>
      </div>
    );
  }

  const date = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleDateString()
    : "";
  const time = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const duration = session.durationMinutes;
  const hasAgenda = false;
  const hasMaterials = false;
  const hasReviews = false;

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-4xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: ANIMATION_CONFIGS.EASING.ENTER,
            }}
          >
            <SectionCard flush>
              <div className="relative h-64 bg-gradient-to-br from-purple-900/50 to-gray-900 rounded-t-xl overflow-hidden">
                {session.thumbnailUrl && (
                  <img
                    src={session.thumbnailUrl}
                    alt={session.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-4 start-4 flex flex-wrap gap-2 items-center">
                  <PodaciumBadge
                    variant={statusBadgeVariant(session.status) as any}
                  >
                    {session.status === "LIVE" && (
                      <span className="h-2 w-2 bg-white dark:bg-slate-900 rounded-full animate-pulse me-1" />
                    )}
                    {statusLabel(session.status)}
                  </PodaciumBadge>
                  {isLive && session.startedAt && (
                    <PodaciumBadge
                      variant="outline"
                      className="bg-black/50 text-white border-white/20 backdrop-blur-sm"
                    >
                      <Clock className="h-3 w-3 me-1" />
                      {t("detail.startedAgo", {
                        time: formatElapsed(elapsedMinutes),
                      })}
                    </PodaciumBadge>
                  )}
                  {session.category && (
                    <PodaciumBadge variant="secondary">
                      {t("categories." + (session.category || "")) ||
                        session.category}
                    </PodaciumBadge>
                  )}
                </div>

                {isOwner && isLive && (
                  <div className="absolute top-4 end-4 flex gap-2">
                    <PodaciumButton
                      variant="destructive"
                      size="sm"
                      onClick={handleEnd}
                      disabled={actionLoading === "end"}
                      icon={<StopCircle className="h-4 w-4" />}
                    >
                      {actionLoading === "end"
                        ? t("detail.ending")
                        : t("detail.endSession")}
                    </PodaciumButton>
                  </div>
                )}
                {isOwner && isScheduled && (
                  <div className="absolute top-4 end-4 flex gap-2">
                    <PodaciumButton
                      variant="primary"
                      size="sm"
                      onClick={handleStart}
                      disabled={actionLoading === "start"}
                      icon={<Play className="h-4 w-4" />}
                    >
                      {actionLoading === "start"
                        ? t("detail.starting")
                        : t("detail.startSession")}
                    </PodaciumButton>
                  </div>
                )}
              </div>

              <div className="p-6">
                {isOwner && isScheduled && !session.approvedAt && (
                  <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          {t("detail.pendingApprovalTitle")}
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                          {t("detail.pendingApprovalNotice")}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <PodaciumButton
                        size="sm"
                        variant="primary"
                        onClick={handleApproveAndStart}
                        disabled={actionLoading === "approve"}
                        icon={<Play className="h-4 w-4" />}
                      >
                        {actionLoading === "approve"
                          ? t("common.loading")
                          : t("detail.approveAndStart")}
                      </PodaciumButton>
                    )}
                  </div>
                )}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {session.title}
                    </h1>
                    {session.owner && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        {t("detail.hostedBy", {
                          name: session.owner.name || t("common.unknown"),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {isLive && hasAccess && (
                      <PodaciumButton
                        variant="primary"
                        onClick={handleJoin}
                        disabled={actionLoading === "join"}
                      >
                        {actionLoading === "join"
                          ? t("detail.connecting")
                          : t("detail.joinSession")}
                      </PodaciumButton>
                    )}
                    {isLive &&
                      !hasAccess &&
                      !isOwner &&
                      (session.maxParticipants &&
                      session.bookingCount >= session.maxParticipants ? (
                        waitlist ? (
                          <div className="flex items-center gap-2">
                            <PodaciumBadge variant="warning">
                              <ListOrdered className="h-3 w-3 me-1" />
                              {t("waitlist.joined", {
                                pos: String(waitlist.position),
                              })}
                            </PodaciumBadge>
                            <PodaciumButton
                              variant="outline"
                              size="sm"
                              onClick={handleLeaveWaitlist}
                              disabled={waitlistLoading}
                              loading={waitlistLoading}
                            >
                              {t("waitlist.leave")}
                            </PodaciumButton>
                          </div>
                        ) : (
                          <PodaciumButton
                            variant="secondary"
                            onClick={handleJoinWaitlist}
                            disabled={waitlistLoading}
                            loading={waitlistLoading}
                            icon={<Users className="h-4 w-4" />}
                          >
                            {t("waitlist.join")}
                          </PodaciumButton>
                        )
                      ) : (
                        <PodaciumButton
                          variant="primary"
                          onClick={handleLiveBookClick}
                          icon={<Play className="h-4 w-4 fill-current" />}
                        >
                          {t("detail.bookAndJoin")}
                        </PodaciumButton>
                      ))}
                    {isEnded && session.hasRecording && (
                      <PodaciumButton
                        variant="primary"
                        onClick={handleWatchReplay}
                        disabled={actionLoading === "replay"}
                        loading={actionLoading === "replay"}
                        icon={<Play size={16} />}
                      >
                        {t("replays.watch")}
                      </PodaciumButton>
                    )}
                    {isScheduled &&
                      !isOwner &&
                      (hasAccess ? (
                        <PodaciumBadge
                          variant="success"
                          className="py-2 px-3 text-sm"
                        >
                          {t("common.booked")}
                        </PodaciumBadge>
                      ) : session.maxParticipants &&
                        session.bookingCount >= session.maxParticipants ? (
                        waitlist ? (
                          <div className="flex items-center gap-2">
                            <PodaciumBadge variant="warning">
                              <ListOrdered className="h-3 w-3 me-1" />
                              {t("waitlist.joined", {
                                pos: String(waitlist.position),
                              })}
                            </PodaciumBadge>
                            <PodaciumButton
                              variant="outline"
                              size="sm"
                              onClick={handleLeaveWaitlist}
                              disabled={waitlistLoading}
                              loading={waitlistLoading}
                            >
                              {t("waitlist.leave")}
                            </PodaciumButton>
                          </div>
                        ) : (
                          <PodaciumButton
                            variant="secondary"
                            onClick={handleJoinWaitlist}
                            disabled={waitlistLoading}
                            loading={waitlistLoading}
                            icon={<Users className="h-4 w-4" />}
                          >
                            {t("waitlist.join")}
                          </PodaciumButton>
                        )
                      ) : (
                        <Link href={`/live/${sessionId}/book`}>
                          <PodaciumButton variant="primary">
                            {t("detail.bookNow")}
                          </PodaciumButton>
                        </Link>
                      ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-slate-400 mb-6">
                  {isScheduled && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-gray-400" /> {date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" /> {time}
                      </span>
                    </>
                  )}
                  {duration && (
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4 text-gray-400" />{" "}
                      {t("detail.duration", { n: String(duration) })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-gray-400" />{" "}
                    {t("detail.capacity", {
                      count: String(session.bookingCount),
                      max: String(
                        session.maxParticipants || t("common.unlimited"),
                      ),
                    })}
                  </span>
                  {session.priceAmount && session.priceAmount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-gray-400" />{" "}
                      {session.priceAmount} {t("common.dzd")}
                    </span>
                  )}
                </div>

                {session.tags && session.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {session.description && (
                  <p className="text-gray-600 dark:text-slate-400 mb-6 whitespace-pre-wrap">
                    {session.description}
                  </p>
                )}

                {isOwner && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <PodaciumButton
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/live/${sessionId}/edit`)}
                      icon={<Edit className="h-4 w-4" />}
                    >
                      {t("detail.editSession")}
                    </PodaciumButton>
                    <PodaciumButton
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/live/${sessionId}/manage`)}
                      icon={<Settings className="h-4 w-4" />}
                    >
                      {t("mySessions.manage")}
                    </PodaciumButton>
                    <PodaciumButton
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        router.push(`/live/${sessionId}/analytics`)
                      }
                      icon={<BarChart3 className="h-4 w-4" />}
                    >
                      {t("mySessions.viewAnalytics")}
                    </PodaciumButton>
                    {session.status !== "LIVE" && (
                      <PodaciumButton
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/live/${sessionId}/clone`)}
                        icon={<Copy className="h-4 w-4" />}
                      >
                        {t("mySessions.clone")}
                      </PodaciumButton>
                    )}
                    <PodaciumButton
                      size="sm"
                      variant="secondary"
                      onClick={copyShareLink}
                      icon={<Share2 className="h-4 w-4" />}
                    >
                      {copied ? t("common.copied") : t("common.copyLink")}
                    </PodaciumButton>
                  </div>
                )}

                {!isOwner && (
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                    <PodaciumButton
                      size="sm"
                      variant="secondary"
                      onClick={copyShareLink}
                      icon={<Share2 className="h-4 w-4" />}
                    >
                      {copied ? t("common.copied") : t("common.share")}
                    </PodaciumButton>
                  </div>
                )}
              </div>
            </SectionCard>

            <div className="mt-8">
              <PodaciumTabs
                tabs={detailTabs}
                defaultTab="overview"
                onChange={setActiveTab}
              >
                {() => (
                  <div className="mt-6">
                    {activeTab === "overview" && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SectionCard title={t("detail.sessions")}>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500 dark:text-slate-400">
                                {t("common.host")}
                              </span>
                              <span className="text-gray-700 dark:text-slate-300">
                                {session.owner?.name || t("common.unknown")}
                              </span>
                            </div>
                            {session.category && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 dark:text-slate-400">
                                  {t("detail.categoryLabel")}
                                </span>
                                <PodaciumBadge variant="secondary">
                                  {t(
                                    "categories." + (session.category || ""),
                                  ) || session.category}
                                </PodaciumBadge>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500 dark:text-slate-400">
                                {t("detail.languageLabel")}
                              </span>
                              <span className="text-gray-700 dark:text-slate-300">
                                {session.language
                                  ? t(
                                      `create.form.languageOptions.${session.language}`,
                                    )
                                  : t("create.form.languageOptions.ar")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500 dark:text-slate-400">
                                {t("create.form.visibility")}
                              </span>
                              <span className="text-gray-700 dark:text-slate-300">
                                {session.visibility
                                  ? t(`visibility.${session.visibility}`) ||
                                    session.visibility
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </SectionCard>
                        <SectionCard title={t("detail.rating")}>
                          <div className="text-center py-4">
                            <p className="text-4xl font-bold text-gray-900 dark:text-slate-100">
                              —
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                              {t("reviews.noReviews")}
                            </p>
                          </div>
                        </SectionCard>
                        {session.tags && session.tags.length > 0 && (
                          <SectionCard title={t("detail.tagsLabel")}>
                            <div className="flex flex-wrap gap-1.5">
                              {session.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 text-xs rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </SectionCard>
                        )}
                      </div>
                    )}
                    {activeTab === "agenda" && (
                      <SectionCard>
                        <p className="text-sm text-gray-400 text-center py-8">
                          {t("detail.noAgenda")}
                        </p>
                      </SectionCard>
                    )}
                    {activeTab === "materials" && (
                      <SectionCard>
                        <p className="text-sm text-gray-400 text-center py-8">
                          {t("detail.noMaterials")}
                        </p>
                      </SectionCard>
                    )}
                    {activeTab === "reviews" && (
                      <div className="space-y-6">
                        {user && !isOwner && !myReview && (
                          <SectionCard>
                            <div className="p-6">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                                {t("reviews.title")}
                              </h3>
                              <div className="flex items-center gap-1 mb-4">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button
                                    key={n}
                                    onClick={() => setReviewRating(n)}
                                    className="p-0.5 transition-colors"
                                  >
                                    <Star
                                      className={`h-6 w-6 ${
                                        n <= reviewRating
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={reviewComment}
                                onChange={(e) =>
                                  setReviewComment(e.target.value)
                                }
                                placeholder={t("reviews.reviewPlaceholder")}
                                rows={3}
                                className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                              />
                              {reviewError && (
                                <p className="text-sm text-red-500 dark:text-red-400 mb-3">
                                  {reviewError}
                                </p>
                              )}
                              <PodaciumButton
                                variant="primary"
                                onClick={handleSubmitReview}
                                disabled={submittingReview || reviewRating < 1}
                                loading={submittingReview}
                                icon={<SendHorizonal className="h-4 w-4" />}
                              >
                                {t("reviews.submit")}
                              </PodaciumButton>
                            </div>
                          </SectionCard>
                        )}

                        {myReview && myReview !== "loading" && (
                          <SectionCard>
                            <div className="p-6">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                  {t("reviews.yourRating")}
                                </p>
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star
                                      key={n}
                                      className={`h-4 w-4 ${n <= myReview.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              {myReview.comment && (
                                <p className="text-sm text-gray-600 dark:text-slate-400">
                                  {myReview.comment}
                                </p>
                              )}
                            </div>
                          </SectionCard>
                        )}

                        {reviews?.items && reviews.items.length > 0 && (
                          <SectionCard>
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                                    {reviews.averageRating}
                                  </p>
                                  <div className="flex mt-1">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                      <Star
                                        key={n}
                                        className={`h-4 w-4 ${n <= Math.round(reviews.averageRating) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                      />
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {reviews.total} {t("common.attendees")}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {(reviews.items || []).map((r) => (
                                <div key={r.id} className="p-6">
                                  <div className="flex items-center gap-3 mb-2">
                                    <PodaciumAvatar
                                      src={r.user?.avatarUrl || undefined}
                                      alt={r.user?.name || t("common.user")}
                                      size="sm"
                                      fallback={(
                                        r.user?.name || t("common.user")
                                      )
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                        {r.user?.name || t("common.user")}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex">
                                          {[1, 2, 3, 4, 5].map((n) => (
                                            <Star
                                              key={n}
                                              className={`h-3 w-3 ${n <= r.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-xs text-gray-400">
                                          {new Date(
                                            r.createdAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {r.comment && (
                                    <p className="text-sm text-gray-600 dark:text-slate-400 ms-11">
                                      {r.comment}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </SectionCard>
                        )}

                        {(!reviews || reviews.items.length === 0) &&
                          myReview !== "loading" &&
                          !myReview && (
                            <SectionCard>
                              <p className="text-sm text-gray-400 text-center py-8">
                                {t("reviews.noReviews")}
                              </p>
                            </SectionCard>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </PodaciumTabs>
            </div>
          </motion.div>
        </main>

        <PodaciumModal
          isOpen={inProgressModalOpen}
          onClose={() => setInProgressModalOpen(false)}
          title={t("detail.inProgressModalTitle")}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {t("detail.inProgressModalDesc", {
                  time: formatElapsed(elapsedMinutes),
                  duration: String(session?.durationMinutes || 60),
                })}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <PodaciumButton
                variant="ghost"
                onClick={() => setInProgressModalOpen(false)}
              >
                {t("detail.inProgressModalCancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="primary"
                onClick={() => {
                  setInProgressModalOpen(false);
                  router.push(`/live/${sessionId}/book`);
                }}
              >
                {t("detail.inProgressModalConfirm")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      </PageLayout>
    </div>
  );
}
