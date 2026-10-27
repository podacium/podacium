"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Users,
  Tag,
  DollarSign,
  User,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Shield,
  Info,
  BookOpen,
  Ticket,
  Percent,
  ExternalLink,
  Download,
  RefreshCw,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import {
  SectionCard,
  LoadingState,
  ProgressBar,
} from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveSession,
  type WaitlistResult,
} from "@/lib/api/live-sessions";
import { api } from "@/lib/api";
import WalletPaymentModal from "@/components/billing/WalletPaymentModal";
import {
  generateIcsBlob,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from "@/lib/ics";

const ANIMATION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export default function BookSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [waitlist, setWaitlist] = useState<WaitlistResult | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{
    amount: number;
    skip_wallet: boolean;
  } | null>(null);

  const findWaitlistPosition = async (sessionId: string) => {
    try {
      const res = await liveSessionsApi.getMyWaitlistStatus(sessionId);
      if (res?.id) setWaitlist(res);
    } catch {}
  };

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      liveSessionsApi.getSession(sessionId),
      liveSessionsApi.getMyBookings().catch(() => ({ items: [] })),
      findWaitlistPosition(sessionId),
    ])
      .then(([session, bookings]) => {
        setSession(session);
        if (bookings.items.some((b) => b.liveSessionId === sessionId)) {
          setAlreadyBooked(true);
        }
      })
      .catch(() => setError(t("book.sessionNotFound")))
      .finally(() => setLoading(false));
  }, [sessionId, t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/auth/login?redirect=/live/${sessionId}/book`);
    }
  }, [authLoading, user, router, sessionId]);

  useEffect(() => {
    setWalletBalance(null);
  }, [user]);

  const handleBook = async () => {
    if (!sessionId) return;
    setBooking(true);
    setError(null);
    try {
      await liveSessionsApi.bookSession(sessionId, {
        hostCode: couponApplied || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push(`/live/${sessionId}`), 1800);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("ALREADY_BOOKED")) setError(t("book.alreadyBooked"));
      else if (msg.includes("SESSION_FULL")) setError(t("book.sessionFull"));
      else if (msg.includes("OWN_SESSION")) setError(t("book.ownSession"));
      else setError(t("book.genericError"));
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!sessionId) return;
    setWaitlistLoading(true);
    try {
      const res = await liveSessionsApi.joinWaitlist(sessionId);
      setWaitlist(res);
    } catch (err: any) {
      setError(err?.message || t("book.genericError"));
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

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    try {
      const res = await liveSessionsApi.validateHostCode(
        sessionId!,
        code.toUpperCase(),
      );
      if (res.valid) {
        setCouponApplied(code.toUpperCase());
        setCouponError(null);
      } else {
        setCouponError(t("book.couponInvalid"));
        setCouponApplied(null);
      }
    } catch {
      setCouponError(t("book.couponInvalid"));
      setCouponApplied(null);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError(null);
  };

  const computePrice = () => {
    if (!session?.priceAmount) return null;
    if (couponApplied) return 0;
    return session.priceAmount;
  };

  const handleDownloadIcs = () => {
    if (!session) return;
    const blob = generateIcsBlob({
      title: session.title,
      description: session.description || undefined,
      startDate: session.scheduledAt || new Date().toISOString(),
      durationMinutes: session.durationMinutes,
      organizer: session.owner?.name || undefined,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]/gi, "_")}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePurchase = async (skipWallet?: boolean) => {
    if (!sessionId) return;

    const price = session?.priceAmount || 0;
    if (
      !skipWallet &&
      price > 0 &&
      walletBalance !== null &&
      walletBalance >= price
    ) {
      setPendingPurchase({ amount: price, skip_wallet: false });
      setShowWalletModal(true);
      return;
    }

    setBooking(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await api.purchaseLiveSession({
        session_id: sessionId,
        success_url: `${origin}/live/${sessionId}?booking=success`,
        failure_url: `${origin}/live/${sessionId}/book`,
        skip_wallet: skipWallet ?? false,
      });
      if (res?.data?.paid_with_wallet) {
        setSuccess(true);
        setTimeout(() => router.push(`/live/${sessionId}`), 1800);
        return;
      }
      const checkoutUrl = res?.data?.checkout_url;
      const transactionId = res?.data?.transaction_id;
      if (checkoutUrl) {
        sessionStorage.setItem("pending_tx_id", String(transactionId));
        sessionStorage.setItem("pending_session_id", sessionId);
        sessionStorage.setItem(
          "pending_checkout_id",
          checkoutUrl.split("/").pop() || "",
        );
        window.location.href = checkoutUrl;
      } else {
        setError(t("book.genericError"));
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("already_booked")) setError(t("book.alreadyBooked"));
      else if (msg.includes("session_full")) setError(t("book.sessionFull"));
      else if (msg.includes("own_session")) setError(t("book.ownSession"));
      else setError(t("book.genericError"));
    } finally {
      setBooking(false);
    }
  };

  const handleWalletPay = async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    await handlePurchase(false);
    setPendingPurchase(null);
  };

  const handleCardPay = async () => {
    if (!pendingPurchase) return;
    setShowWalletModal(false);
    await handlePurchase(true);
    setPendingPurchase(null);
  };

  if (authLoading || loading) {
    return (
      <div dir={dir}>
        <PageLayout background="gray">
          <LoadingState text={t("book.loading")} />
        </PageLayout>
      </div>
    );
  }

  if (!user) return null;

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

  const isFree = !session.priceAmount || session.priceAmount === 0;
  const effectivelyFree = isFree || (couponApplied && computePrice() === 0);
  const isOwner = user.id === session.ownerId;
  const dateStr = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const timeStr = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const capacityPct = session.maxParticipants
    ? Math.round((session.bookingCount / session.maxParticipants) * 100)
    : 0;

  const ownerName =
    session.owner?.name || `${t("common.user")} ${session.ownerId}`;
  const ownerAvatar = session.owner?.avatarUrl || undefined;

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-3xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION}
          >
            <Link
              href={`/live/${sessionId}`}
              className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
              <span className="text-sm font-medium">{t("common.back")}</span>
            </Link>

            {success ? (
              <SectionCard>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="p-10 text-center"
                >
                  <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("book.success")}
                  </h2>
                  <p className="text-gray-500 dark:text-slate-400 mb-2">
                    {session.title}
                  </p>
                  <p className="text-sm text-gray-400">{t("common.loading")}</p>
                </motion.div>
              </SectionCard>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("book.title")}
                  </h1>
                  <p className="text-gray-500 dark:text-slate-400">
                    {t("book.subtitle")}
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 px-5 py-4 rounded-xl mb-6 flex items-start gap-3"
                  >
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">
                        {error.includes(t("book.alreadyBooked"))
                          ? t("book.alreadyBooked")
                          : error.includes(t("book.sessionFull"))
                            ? t("book.sessionFull")
                            : error.includes(t("book.ownSession"))
                              ? t("book.ownSession")
                              : error}
                      </p>
                      <Link
                        href="/live/bookings"
                        className="text-red-800 dark:text-red-200 underline hover:text-red-900 font-medium"
                      >
                        {t("book.viewSessions")}
                      </Link>
                    </div>
                  </motion.div>
                )}

                <div className="grid gap-6">
                  <SectionCard>
                    <div className="relative h-56 bg-gradient-to-br from-purple-900/40 to-gray-800 rounded-t-xl overflow-hidden">
                      {session.thumbnailUrl && (
                        <img
                          src={session.thumbnailUrl}
                          alt={session.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute top-4 start-4 flex gap-2">
                        <PodaciumBadge variant={isFree ? "success" : "default"}>
                          {isFree
                            ? t("common.free")
                            : `${session.priceAmount!} ${t("common.dzd")}`}
                        </PodaciumBadge>
                        {isOwner && (
                          <PodaciumBadge variant="warning">
                            <User className="h-3 w-3 me-1" />
                            {t("detail.hostedBy", { name: "" }).split(" ")[0]}
                          </PodaciumBadge>
                        )}
                      </div>
                      <div className="absolute bottom-4 inset-x-4">
                        <h2 className="text-xl font-bold text-white drop-shadow-lg">
                          {session.title}
                        </h2>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {session.description && (
                        <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">
                          {session.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl">
                        <PodaciumAvatar
                          src={ownerAvatar}
                          alt={ownerName}
                          size="md"
                          fallback={ownerName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {ownerName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {t("book.hostedBy", { name: "" })
                              .split(" ")
                              .slice(0, -1)
                              .join(" ")}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {dateStr && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-lg">
                              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {t("book.date")}
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {dateStr}
                              </p>
                            </div>
                          </div>
                        )}
                        {timeStr && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 rounded-lg">
                              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {t("book.time")}
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {timeStr}
                              </p>
                            </div>
                          </div>
                        )}
                        {session.durationMinutes && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-orange-50 rounded-lg">
                              <Clock className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {t("detail.duration", { n: "0" }).split(
                                  " ",
                                )[1] || t("common.minutes")}
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {t("detail.duration", {
                                  n: String(session.durationMinutes),
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {session.category && (
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-50 dark:bg-emerald-950/40 rounded-lg">
                              <Tag className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {t("create.form.category")}
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {t("categories." + (session.category || "")) ||
                                  session.category}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-lg">
                            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              {t("book.capacity")}
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {session.bookingCount}/
                              {session.maxParticipants || t("common.unlimited")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {session.maxParticipants &&
                        session.maxParticipants > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                              <span>
                                {t("detail.capacity", {
                                  count: String(session.bookingCount),
                                  max: String(session.maxParticipants),
                                })}
                              </span>
                              <span>{capacityPct}%</span>
                            </div>
                            <ProgressBar
                              value={capacityPct}
                              color={
                                capacityPct >= 90
                                  ? "red"
                                  : capacityPct >= 60
                                    ? "orange"
                                    : "blue"
                              }
                              height="sm"
                            />
                            {capacityPct >= 100 &&
                              !alreadyBooked &&
                              !waitlist && (
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl">
                                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                                    {t("waitlist.full")}
                                  </p>
                                  <PodaciumButton
                                    variant="secondary"
                                    size="sm"
                                    fullWidth
                                    onClick={handleJoinWaitlist}
                                    disabled={waitlistLoading}
                                    loading={waitlistLoading}
                                    icon={<Users className="h-4 w-4" />}
                                  >
                                    {t("waitlist.join")}
                                  </PodaciumButton>
                                </div>
                              )}
                            {waitlist && (
                              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                  {t("waitlist.joined", {
                                    pos: String(waitlist.position),
                                  })}
                                </p>
                                <PodaciumButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleLeaveWaitlist}
                                  disabled={waitlistLoading}
                                  loading={waitlistLoading}
                                >
                                  {t("waitlist.leave")}
                                </PodaciumButton>
                              </div>
                            )}
                          </div>
                        )}

                      {session.tags && session.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {session.tags.map((tag) => (
                            <PodaciumBadge key={tag} variant="outline">
                              {tag}
                            </PodaciumBadge>
                          ))}
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {t("book.title")}
                      </h3>

                      <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {couponApplied
                              ? `${t("book.pricePaid")} (${session.priceAmount!} ${t("common.dzd")})`
                              : isFree
                                ? t("book.priceFree")
                                : t("book.pricePaid")}
                          </span>
                          <span
                            className={`text-xl font-bold ${computePrice() === 0 ? "text-green-600" : "text-gray-900 dark:text-slate-100"}`}
                          >
                            {computePrice() === 0
                              ? t("common.free")
                              : `${computePrice()} ${t("common.dzd")}`}
                          </span>
                        </div>
                        {couponApplied && computePrice() === 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            {t("book.couponFree")}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-3 text-xs text-gray-500 dark:text-slate-400">
                          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <p>{t("book.bookAnother")}</p>
                        </div>
                        <div className="flex items-start gap-3 text-xs text-gray-500 dark:text-slate-400">
                          <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <p>{t("book.hostedBy", { name: ownerName })}</p>
                        </div>
                        <div className="flex items-start gap-3 text-xs text-gray-500 dark:text-slate-400">
                          <BookOpen className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <p>
                            {t("detail.capacity", {
                              count: String(session.bookingCount),
                              max: String(
                                session.maxParticipants ||
                                  t("common.unlimited"),
                              ),
                            })}
                          </p>
                        </div>
                      </div>

                      {!isFree && !alreadyBooked && (
                        <div className="mb-6 p-4 border border-gray-200 dark:border-slate-800 rounded-xl">
                          <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 block">
                            {t("book.coupon")}
                          </label>
                          {couponApplied ? (
                            <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800/80 rounded-lg px-3 py-2">
                              <div>
                                <span className="text-sm font-medium text-green-700">
                                  {t("book.couponApplied")}
                                </span>
                                <p className="text-xs text-green-600 mt-0.5">
                                  {computePrice() === 0
                                    ? t("book.couponFree")
                                    : t("book.couponDiscount", {
                                        amount: String(session.priceAmount!),
                                      })}
                                </p>
                              </div>
                              <button
                                onClick={handleRemoveCoupon}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
                                aria-label={t("common.removeCoupon")}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                                placeholder={t("book.couponPlaceholder")}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                onKeyDown={(e) =>
                                  e.key === "Enter" && handleApplyCoupon()
                                }
                              />
                              <PodaciumButton
                                variant="secondary"
                                size="sm"
                                onClick={handleApplyCoupon}
                                disabled={!couponCode.trim()}
                                icon={<Percent className="h-4 w-4" />}
                              >
                                {t("book.couponApply")}
                              </PodaciumButton>
                            </div>
                          )}
                          {couponError && (
                            <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">
                              {couponError}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mb-6">
                        <button
                          onClick={() => setCalendarOpen(!calendarOpen)}
                          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition-colors"
                        >
                          <Calendar className="h-4 w-4" />
                          {t("book.addToCalendar")}
                          <motion.span
                            animate={{ rotate: calendarOpen ? 180 : 0 }}
                            className="text-xs"
                          >
                            ▾
                          </motion.span>
                        </button>
                        {calendarOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 flex flex-wrap gap-2"
                          >
                            <a
                              href={getGoogleCalendarUrl({
                                title: session.title,
                                description: session.description || undefined,
                                startDate: session.scheduledAt || "",
                                durationMinutes: session.durationMinutes,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t("book.googleCalendar")}
                            </a>
                            <a
                              href={getOutlookCalendarUrl({
                                title: session.title,
                                description: session.description || undefined,
                                startDate: session.scheduledAt || "",
                                durationMinutes: session.durationMinutes,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t("book.outlookCalendar")}
                            </a>
                            <button
                              onClick={handleDownloadIcs}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {t("book.downloadIcs")}
                            </button>
                          </motion.div>
                        )}
                      </div>

                      {alreadyBooked ? (
                        <div className="space-y-3">
                          <div className="bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800/80 rounded-xl p-4 text-center">
                            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-green-800">
                              {t("book.alreadyBooked")}
                            </p>
                          </div>
                          <Link href={`/live/${sessionId}`}>
                            <PodaciumButton
                              variant="outline"
                              size="lg"
                              fullWidth
                            >
                              {t("detail.joinSession")}
                            </PodaciumButton>
                          </Link>
                        </div>
                      ) : effectivelyFree ? (
                        <PodaciumButton
                          variant="primary"
                          size="lg"
                          fullWidth
                          onClick={handleBook}
                          disabled={booking || isOwner}
                          loading={booking}
                          icon={<Ticket className="h-5 w-5" />}
                        >
                          {isOwner
                            ? t("book.ownSession")
                            : booking
                              ? t("book.confirming")
                              : t("book.confirmButton")}
                        </PodaciumButton>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                                {t("book.pricePaid")}
                              </span>
                              <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
                                {session.priceAmount!} {t("common.dzd")}
                              </span>
                            </div>
                          </div>
                          <PodaciumButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            onClick={() => handlePurchase()}
                            disabled={booking || isOwner || alreadyBooked}
                            loading={booking}
                            icon={<DollarSign className="h-5 w-5" />}
                          >
                            {isOwner
                              ? t("book.ownSession")
                              : booking
                                ? t("book.confirming")
                                : t("book.payAndBook", {
                                    amount: `${session.priceAmount!} ${t("common.dzd")}`,
                                  })}
                          </PodaciumButton>
                          <p className="text-xs text-gray-400 text-center">
                            {t("common.secure")}
                          </p>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>
              </>
            )}
          </motion.div>
        </main>

        <WalletPaymentModal
          isOpen={showWalletModal}
          onClose={() => {
            setShowWalletModal(false);
            setPendingPurchase(null);
          }}
          amount={pendingPurchase?.amount || 0}
          walletBalance={walletBalance || 0}
          onPayWithWallet={handleWalletPay}
          onPayWithCard={handleCardPay}
          processing={booking}
        />
      </PageLayout>
    </div>
  );
}
