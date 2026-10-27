"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Copy,
  Check,
  Share2,
  Users,
  Trophy,
  Gift,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Link2,
  BarChart3,
  Globe,
  MessageCircle,
  Target,
  Rocket,
  UserPlus,
  Zap,
  BookOpen,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import { cn } from "@/lib/utils";
import {
  getFingerprint,
  getReferralCodeFromUrl,
  getUtmsFromUrl,
  getShareableLink,
  getShareUrls,
  waitlistApi,
} from "@/lib/api/waitlist";
import type {
  WaitlistEntry,
  WaitlistLeaderboardEntry,
} from "@/lib/api/waitlist";

const LAUNCH_DATE = new Date("2026-09-23T00:00:00+01:00");
const WAITLIST_EMAIL_KEY = "waitlist_email";

function useCountdown() {
  const [remaining, setRemaining] = useState(
    LAUNCH_DATE.getTime() - Date.now(),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(LAUNCH_DATE.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (remaining <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
    expired: false,
  };
}

const UnitBox = ({
  value,
  label,
  isRTL,
}: {
  value: number;
  label: string;
  isRTL: boolean;
}) => (
  <div className="flex flex-col items-center">
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-3 min-w-[80px] text-center">
      <span className="text-3xl md:text-4xl font-black text-white tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
    </div>
    <span
      className={cn(
        "text-xs font-semibold text-white/70 mt-2 uppercase tracking-wider",
        isRTL && "font-arabic",
      )}
    >
      {label}
    </span>
  </div>
);

export default function WaitlistPage() {
  const { t } = useTranslations("waitlist");
  const { dir, isRTL } = useBidi();
  const { user } = useAuth();
  const countdown = useCountdown();

  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<WaitlistLeaderboardEntry[]>(
    [],
  );
  const [totalCount, setTotalCount] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    async function check() {
      const storedEmail =
        user?.email || localStorage.getItem(WAITLIST_EMAIL_KEY);
      if (!storedEmail) {
        setLoadingStatus(false);
        return;
      }
      try {
        const statusRes = await waitlistApi.getStatus(storedEmail);
        if (statusRes.registered && statusRes.entry) {
          setEntry(statusRes.entry);
          const posRes = await waitlistApi.getPosition(storedEmail);
          setPosition(posRes.position);
          if (!user?.email)
            localStorage.setItem(WAITLIST_EMAIL_KEY, storedEmail);
        } else {
          if (!user?.email) localStorage.removeItem(WAITLIST_EMAIL_KEY);
        }
        const [lb, stats] = await Promise.all([
          waitlistApi.getLeaderboard(),
          waitlistApi.getStats(),
        ]);
        setLeaderboard(lb.entries);
        setTotalCount(stats.totalCount);
      } catch {
        /* ignore */
      }
      setLoadingStatus(false);
    }
    check();
  }, [user?.email]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState(
    getReferralCodeFromUrl() || "",
  );
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMsg, setServerMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const referralInputRef = useRef<HTMLInputElement>(null);
  const [referralState, setReferralState] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [referralInviter, setReferralInviter] = useState<string | null>(null);
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReferralCodeFormatValid = useCallback((code: string) => {
    const REFERRAL_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return (
      code.length === 8 && [...code].every((c) => REFERRAL_CHARSET.includes(c))
    );
  }, []);

  const referralCodeHandler = useCallback(
    (value: string) => {
      const upper = value.toUpperCase();
      setReferralCode(upper);
      setErrors((p) => ({ ...p, referralCode: "" }));

      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);

      if (!upper || upper.length < 8) {
        setReferralState("idle");
        setReferralInviter(null);
        return;
      }

      if (!isReferralCodeFormatValid(upper)) {
        setReferralState("invalid");
        setReferralInviter(null);
        return;
      }

      setReferralState("validating");
      validateTimerRef.current = setTimeout(async () => {
        try {
          const res = await waitlistApi.validateReferral(upper);
          if (res.valid) {
            setReferralState("valid");
            setReferralInviter(res.inviterName ?? null);
          } else {
            setReferralState("invalid");
            setReferralInviter(null);
          }
        } catch {
          setReferralState("idle");
          setReferralInviter(null);
        }
      }, 400);
    },
    [isReferralCodeFormatValid],
  );

  useEffect(() => {
    const urlCode = getReferralCodeFromUrl();
    if (urlCode) {
      referralCodeHandler(urlCode);
    }
    return () => {
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setReferralCode("");
    setAgreeTerms(false);
    setErrors({});
    setReferralState("idle");
    setReferralInviter(null);
  }, []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const nameTrimmed = name.trim();
    if (!nameTrimmed) e.name = t("form.errors.nameRequired");
    else if (nameTrimmed.length < 2 || nameTrimmed.length > 80)
      e.name = t("form.errors.nameInvalid");
    const emailTrimmed = email.trim();
    if (!emailTrimmed) e.email = t("form.errors.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed))
      e.email = t("form.errors.emailInvalid");
    if (!agreeTerms) e.terms = t("form.errors.termsRequired");
    return e;
  }, [name, email, agreeTerms, t]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerMsg(null);
      const v = validate();
      setErrors(v);
      if (Object.keys(v).length > 0) return;
      setSubmitting(true);
      try {
        const utms = getUtmsFromUrl();
        const res = await waitlistApi.register({
          fullName: name.trim(),
          email: email.trim(),
          referralCode: referralCode.toUpperCase() || undefined,
          fingerprint: getFingerprint(),
          userAgent: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          locale:
            document.cookie
              .split("; ")
              .find((c) => c.startsWith("locale="))
              ?.split("=")[1] || "en",
          utmSource: utms.utmSource,
          utmMedium: utms.utmMedium,
          utmCampaign: utms.utmCampaign,
        });
        localStorage.setItem(WAITLIST_EMAIL_KEY, email.trim());
        if (res.alreadyRegistered) {
          setServerMsg({
            type: "success",
            text: t("form.errors.duplicateEmail"),
          });
          if (res.entry) {
            setEntry(res.entry);
            setPosition(res.queuePosition);
          }
        } else {
          setServerMsg({ type: "success", text: t("form.success") });
          setEntry(res.entry);
          setPosition(res.queuePosition);
          resetForm();
        }
        const [lb, stats] = await Promise.all([
          waitlistApi.getLeaderboard(),
          waitlistApi.getStats(),
        ]);
        setLeaderboard(lb.entries);
        setTotalCount(stats.totalCount);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        const code = typeof detail === "object" ? detail?.code : detail;
        if (code === "DUPLICATE_EMAIL" || code === "ALREADY_BOUNCED") {
          setServerMsg({
            type: "success",
            text: t("form.errors.duplicateEmail"),
          });
        } else if (code === "INVALID_REFERRAL") {
          setErrors((prev) => ({
            ...prev,
            referralCode: t("form.errors.invalidReferral"),
          }));
        } else if (code === "SELF_REFERRAL") {
          setErrors((prev) => ({
            ...prev,
            referralCode: t("form.errors.selfReferral"),
          }));
        } else if (code === "DISPOSABLE_EMAIL" || code === "ROLE_BASED_EMAIL") {
          setErrors((prev) => ({
            ...prev,
            email: t("form.errors.emailDisposable"),
          }));
        } else if (code === "RATE_LIMITED") {
          setServerMsg({ type: "error", text: t("form.errors.rateLimited") });
        } else {
          setServerMsg({ type: "error", text: t("form.errors.serverError") });
        }
      }
      setSubmitting(false);
    },
    [name, email, referralCode, agreeTerms, validate, resetForm, t],
  );

  const handleCopyLink = useCallback(async () => {
    if (!entry) return;
    const link = getShareableLink(entry.referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  }, [entry]);

  const getMilestoneLabel = useCallback(
    (goal: number) => {
      return t("dashboard.referral.milestones.earlyAccess");
    },
    [t],
  );

  if (loadingStatus) {
    return (
      <div
        className="min-h-screen bg-gray-950 flex items-center justify-center"
        dir={dir}
      >
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const isRegistered = !!entry;

  return (
    <div dir={dir} className="min-h-screen bg-white dark:bg-slate-900">
      <Navbar />

      {isRegistered ? (
        <main className="py-24 px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            {/* Dashboard Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-6"
            >
              <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                {t("dashboard.title", { name: entry.fullName.split(" ")[0] })}
              </h1>
              <div className="inline-flex items-center gap-3 bg-blue-50 dark:bg-blue-950/60 px-6 py-3 rounded-2xl">
                <Trophy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {t("dashboard.position", {
                    position: String(position ?? "?"),
                  })}
                </span>
              </div>
            </motion.div>

            {/* Referral Dashboard */}
            <div className="grid md:grid-cols-2 gap-8">
              <PodaciumCard
                variant="elevated"
                padding="lg"
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    {t("dashboard.referral.title")}
                  </h2>
                </div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                  {t("dashboard.referral.subtitle")}
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("dashboard.referral.linkLabel")}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-gray-600 dark:text-slate-400 truncate">
                      <Link2 className="w-4 h-4 shrink-0 text-gray-400" />
                      <span className="truncate">
                        {getShareableLink(entry.referralCode)}
                      </span>
                    </div>
                    <PodaciumButton
                      variant="outline"
                      size="default"
                      onClick={handleCopyLink}
                      icon={
                        copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )
                      }
                    >
                      {copied
                        ? t("dashboard.referral.copied")
                        : t("dashboard.referral.copy")}
                    </PodaciumButton>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("dashboard.referral.shareTitle")}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      {
                        id: "whatsapp",
                        color:
                          "hover:bg-green-500 hover:text-white hover:border-green-500",
                        bg: "bg-green-50 border-green-200",
                        icon: MessageCircle,
                      },
                      {
                        id: "telegram",
                        color:
                          "hover:bg-blue-500 hover:text-white hover:border-blue-500",
                        bg: "bg-blue-50 border-blue-200",
                        icon: Globe,
                      },
                      {
                        id: "facebook",
                        color:
                          "hover:bg-blue-700 hover:text-white hover:border-blue-700",
                        bg: "bg-blue-50 border-blue-200",
                        icon: Globe,
                      },
                      {
                        id: "twitter",
                        color:
                          "hover:bg-black hover:text-white hover:border-black",
                        bg: "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800",
                        icon: MessageCircle,
                      },
                    ].map((s) => {
                      const urls = getShareUrls(entry.referralCode);
                      const href = (urls as any)[s.id];
                      return (
                        <a
                          key={s.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200",
                            "hover:scale-105 active:scale-95",
                            s.bg,
                            s.color,
                          )}
                        >
                          <s.icon className="w-4 h-4" />
                          <span className="capitalize">{s.id}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </PodaciumCard>

              {/* Stats Card */}
              <PodaciumCard
                variant="elevated"
                padding="lg"
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    {t("leaderboard.title")}
                  </h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        {t("dashboard.referral.progress", {
                          count: String(entry.friendsReferredCount),
                          goal: "5",
                        })}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-2.5 max-w-[200px]">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min((entry.friendsReferredCount / 5) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <PodaciumBadge variant="secondary" className="shrink-0">
                      {t("dashboard.referral.nextReward", { goal: "5" })}
                    </PodaciumBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                        {totalCount}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400/70 font-medium">
                        {t("admin.stats.total")}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl">
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                        {entry.friendsReferredCount}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400/70 font-medium">
                        {t("dashboard.referral.title")}
                      </p>
                    </div>
                  </div>
                </div>
              </PodaciumCard>
            </div>

            {/* Leaderboard */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                {t("leaderboard.title")}
              </h2>
              <PodaciumCard
                variant="elevated"
                padding="none"
                className="overflow-hidden"
              >
                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    {t("leaderboard.empty")}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
                          <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-slate-400">
                            {t("leaderboard.rank")}
                          </th>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-slate-400">
                            {t("leaderboard.name")}
                          </th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-600 dark:text-slate-400">
                            {t("leaderboard.referrals")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((e, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-50 dark:border-slate-800/60 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <td className="px-6 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                                  i === 0
                                    ? "bg-amber-100 text-amber-700"
                                    : i === 1
                                      ? "bg-gray-200 dark:bg-slate-800/90 text-gray-600 dark:text-slate-400"
                                      : i === 2
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400",
                                )}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-800 dark:text-slate-200">
                              {e.fullName}
                            </td>
                            <td className="px-6 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                              {e.friendsReferredCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </PodaciumCard>
            </div>
          </div>
        </main>
      ) : (
        <main>
          {/* Hero */}
          <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 text-white overflow-hidden pt-32 pb-24">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-300 rounded-full blur-[120px]" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-[120px]" />
            </div>
            <div className="relative max-w-6xl mx-auto px-4 text-center space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <PodaciumBadge
                  variant="secondary"
                  className="inline-flex bg-white/10 text-white border-white/20 backdrop-blur-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {t("hero.badge")}
                </PodaciumBadge>
                <h1
                  className={cn(
                    "text-5xl md:text-7xl font-black tracking-tight leading-tight",
                    isRTL && "font-arabic",
                  )}
                >
                  {t("hero.headline")}
                </h1>
                <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
                  {t("hero.subheadline")}
                </p>
              </motion.div>

              {/* Countdown */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <p className="text-sm font-semibold text-blue-200 uppercase tracking-wider flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("hero.countdown")}
                </p>
                {countdown.expired ? (
                  <p className="text-3xl font-black text-white">
                    {t("countdown.live")}
                  </p>
                ) : (
                  <div className="flex justify-center gap-3 md:gap-6">
                    <UnitBox
                      value={countdown.days}
                      label={t("countdown.days")}
                      isRTL={isRTL}
                    />
                    <UnitBox
                      value={countdown.hours}
                      label={t("countdown.hours")}
                      isRTL={isRTL}
                    />
                    <UnitBox
                      value={countdown.minutes}
                      label={t("countdown.minutes")}
                      isRTL={isRTL}
                    />
                    <UnitBox
                      value={countdown.seconds}
                      label={t("countdown.seconds")}
                      isRTL={isRTL}
                    />
                  </div>
                )}
              </motion.div>

              {/* Total count */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-blue-200 text-sm"
              >
                {t("countdown.totalGoal", {
                  count: String(totalCount),
                  goal: "1000",
                })}
              </motion.p>
            </div>
          </section>

          {/* Form + Why Cards */}
          <section className="py-20 px-4">
            <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
              {/* Form Card */}
              <div className="md:col-span-1 md:order-2">
                <PodaciumCard
                  variant="elevated"
                  padding="lg"
                  className="sticky top-24 space-y-6"
                >
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {t("form.title")}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {t("form.subtitle")}
                    </p>
                  </div>

                  <AnimatePresence>
                    {serverMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl text-sm font-medium",
                          serverMsg.type === "success"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-800",
                        )}
                      >
                        {serverMsg.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        {serverMsg.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <PodaciumInput
                      label={t("form.nameLabel")}
                      placeholder={t("form.namePlaceholder")}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((p) => ({ ...p, name: "" }));
                      }}
                      error={errors.name}
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    />
                    <PodaciumInput
                      label={t("form.emailLabel")}
                      type="email"
                      placeholder={t("form.emailPlaceholder")}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((p) => ({ ...p, email: "" }));
                      }}
                      error={errors.email}
                      leftIcon={<Zap className="w-4 h-4" />}
                    />
                    <div className="space-y-1.5">
                      <PodaciumInput
                        label={t("form.referralLabel")}
                        placeholder={t("form.referralPlaceholder")}
                        value={referralCode}
                        onChange={(e) => {
                          referralCodeHandler(e.target.value);
                        }}
                        error={
                          errors.referralCode ||
                          (referralState === "invalid" && !errors.referralCode
                            ? t("form.referralInvalid")
                            : "")
                        }
                        hint={
                          referralState === "valid" && referralInviter
                            ? t("form.referralValid", { name: referralInviter })
                            : ""
                        }
                        leftIcon={<Gift className="w-4 h-4" />}
                        rightIcon={
                          referralState === "validating" ? (
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          ) : referralState === "valid" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                          ) : referralState === "invalid" ? (
                            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                          ) : undefined
                        }
                        ref={referralInputRef}
                      />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => {
                          setAgreeTerms(e.target.checked);
                          setErrors((p) => ({ ...p, terms: "" }));
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {t("form.terms")}
                      </span>
                    </label>
                    {errors.terms && (
                      <p className="text-xs text-red-500 dark:text-red-400">
                        {errors.terms}
                      </p>
                    )}

                    <PodaciumButton
                      type="submit"
                      fullWidth
                      size="lg"
                      loading={submitting}
                      disabled={submitting}
                    >
                      {submitting ? t("form.submitting") : t("form.submit")}
                    </PodaciumButton>
                  </form>
                </PodaciumCard>
              </div>

              {/* Why Cards */}
              <div className="md:col-span-2 md:order-1 space-y-6">
                <h2
                  className={cn(
                    "text-3xl font-black text-gray-900 dark:text-slate-100",
                    isRTL && "font-arabic",
                  )}
                >
                  {t("why.title")}
                </h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {[
                    {
                      key: "learn",
                      icon: BookOpen,
                      color: "bg-violet-100 text-violet-600",
                    },
                    {
                      key: "earn",
                      icon: Briefcase,
                      color: "bg-emerald-100 text-emerald-600",
                    },
                    {
                      key: "analyze",
                      icon: TrendingUp,
                      color: "bg-blue-100 text-blue-600",
                    },
                    {
                      key: "local",
                      icon: Globe,
                      color: "bg-amber-100 text-amber-600",
                    },
                  ].map((card) => (
                    <PodaciumCard
                      key={card.key}
                      variant="elevated"
                      padding="md"
                      hover
                      className="space-y-3"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          card.color.split(" ")[0],
                        )}
                      >
                        <card.icon
                          className={cn("w-5 h-5", card.color.split(" ")[1])}
                        />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100">
                        {t(`why.cards.${card.key}.title`)}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                        {t(`why.cards.${card.key}.desc`)}
                      </p>
                    </PodaciumCard>
                  ))}
                </div>

                {/* Mini leaderboard preview */}
                <PodaciumCard
                  variant="elevated"
                  padding="md"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      {t("leaderboard.title")}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {totalCount} {t("admin.stats.total")}
                    </span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      {t("leaderboard.empty")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.slice(0, 5).map((e, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-800/60 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                i === 0
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400",
                              )}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                              {e.fullName}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {e.friendsReferredCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </PodaciumCard>
              </div>
            </div>
          </section>
        </main>
      )}

      <Footer />
    </div>
  );
}
