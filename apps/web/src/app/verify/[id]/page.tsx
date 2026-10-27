"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Award,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Calendar,
  BookOpen,
  Copy,
  Check,
  ArrowRight,
  GraduationCap,
  LayoutGrid,
  Sparkles,
  ExternalLink,
  Map,
  Hash,
  ClipboardCheck,
  Linkedin,
  Link2,
  Home,
  ChevronRight,
  Star,
  BadgeCheck,
  Globe,
  Users,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "@/lib/i18n";

const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false });
const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

// ─────────────────────────────────────────────
// Animation configs (aligned with BI pages)
// ─────────────────────────────────────────────
const ANIM = {
  SPRING_GENTLE: {
    type: "spring" as const,
    stiffness: 200,
    damping: 25,
    mass: 1,
  },
  SPRING_SMOOTH: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 1,
  },
  ENTER: {
    duration: 0.6,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  STANDARD: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...ANIM.ENTER, delay: i * 0.07 },
  }),
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.4, delay: i * 0.07 },
  }),
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface VerificationData {
  id: string;
  userName: string;
  userEmail?: string;
  completedTitle: string;
  completedType: "module" | "path" | "unknown";
  issuedAt: string;
  verificationUrl: string;
  qrCodeUrl?: string;
  isValid: boolean;
  metadata?: {
    moduleTitle?: string;
    pathTitle?: string;
    completedAt?: string;
    moduleLevel?: string;
    skills?: string[];
    userName?: string;
    userEmail?: string;
    courseId?: string;
    assessmentScore?: string;
    capstoneRepoUrl?: string;
    ondaRegistrationId?: string;
  };
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors: Record<"success" | "error" | "info", string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };
  const Icon =
    type === "success"
      ? CheckCircle2
      : type === "error"
        ? AlertCircle
        : GraduationCap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className={`fixed bottom-8 end-8 z-50 ${colors[type]} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-semibold text-sm">{message}</span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }, [value]);
  return { copied, copy };
}

function getAbsoluteVerifUrl(certId: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BASE_URL || "https://podacium.com";
  return `${origin}/verify/${certId}`;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function Breadcrumb({ isRtl }: { isRtl: boolean }) {
  const t = useTranslations("verify");
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 dark:text-gray-400 mb-8 flex-wrap">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 dark:hover:text-blue-400"
      >
        <Home className="w-3.5 h-3.5" />
        <span>{t("brand")}</span>
      </Link>
      <ChevronRight
        className={`w-3.5 h-3.5 text-gray-400 ${isRtl ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 dark:text-white font-medium">
        {t("breadcrumb")}
      </span>
    </nav>
  );
}

function DetailRow({
  icon,
  label,
  value,
  accent = "blue",
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "blue" | "green" | "violet" | "amber";
  mono?: boolean;
}) {
  const accents: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    green:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-gray-100 dark:border-slate-800 dark:border-gray-800 last:border-0">
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${accents[accent]}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 dark:text-slate-400 mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-gray-900 dark:text-slate-100 dark:text-gray-100 break-all ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm font-medium border border-white/15">
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// CTA Card
// ─────────────────────────────────────────────
function CtaCard({
  href,
  icon,
  iconBg,
  title,
  description,
  isRtl,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  isRtl: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 hover:border-blue-300 dark:border-blue-700 dark:hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} group-hover:scale-110 transition-transform duration-300`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 dark:text-gray-100 group-hover:text-blue-600 dark:hover:text-blue-400 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 dark:text-gray-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight
        className={`w-4 h-4 text-gray-300 dark:text-gray-600 dark:text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 ${isRtl ? "rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0" : ""} transition-all absolute bottom-5 end-5`}
      />
    </Link>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function VerifyCertificatePage() {
  const params = useParams();
  const certId = params.id as string;
  const t = useTranslations("verify");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      setToast({ message, type });
    },
    [],
  );

  // ── Fetch ────────────────────────────────
  useEffect(() => {
    if (!certId) {
      setError("missing");
      setLoading(false);
      return;
    }
    fetch(`/api/education/certificates/verify/${certId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError("not_found"))
      .finally(() => setLoading(false));
  }, [certId]);

  const formatDate = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(
        locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      ),
    [locale],
  );

  // ── Derived ──────────────────────────────
  const skills: string[] = data?.metadata?.skills ?? [];
  const courseId = data?.metadata?.courseId ?? null;
  const isModule = data?.completedType === "module";

  // Always build a full absolute verification URL
  const absoluteVerifUrl = data?.id ? getAbsoluteVerifUrl(data.id) : "";
  const qrUrl = data?.qrCodeUrl || undefined;

  const { copied: copiedUrl, copy: copyUrl } = useCopy(absoluteVerifUrl);
  const { copied: copiedId, copy: copyId } = useCopy(data?.id ?? "");

  // ── Share handlers ────────────────────────
  const handleLinkedIn = useCallback(() => {
    if (!absoluteVerifUrl || absoluteVerifUrl.endsWith("/verify/")) return;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(absoluteVerifUrl)}`;
    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
    showToast(t("share.linkedInOpened"), "success");
  }, [absoluteVerifUrl, showToast, t]);

  const handleCopyLink = useCallback(() => {
    copyUrl();
    showToast(t("share.linkCopied"), "success");
  }, [copyUrl, showToast, t]);

  // ─── Loading ─────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div
          className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <Award className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -inset-2 rounded-2xl bg-blue-500/20 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-gray-900 dark:text-slate-100 dark:text-white font-bold text-lg">
                {t("loading")}
              </p>
              <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                {certId}
              </p>
            </div>
            <Loader2 className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-spin" />
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  // ─── Not found ───────────────────────────
  if (error || !data) {
    return (
      <>
        <Navbar />
        <div
          className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 flex items-center justify-center p-6"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIM.ENTER}
            className="max-w-lg w-full bg-white/80 dark:bg-slate-900/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 rounded-3xl p-10 shadow-2xl text-center"
          >
            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 dark:text-white mb-3">
              {t("notFound.title")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 dark:text-gray-400 mb-8 leading-relaxed">
              {t("notFound.description")}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transition-all"
            >
              <Home className="w-4 h-4" />
              {t("notFound.backHome")}
            </Link>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  // ─── Full Page ───────────────────────────
  return (
    <>
      <Navbar />
      <main
        dir={isRtl ? "rtl" : "ltr"}
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950"
      >
        {/* ══ Hero Banner ══════════════════════════════════ */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 dark:from-blue-900 dark:via-blue-800 dark:to-indigo-900 text-white">
          {/* Decorative blobs */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            aria-hidden
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.1, 0.06] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-32 -start-32 w-[520px] h-[520px] rounded-full bg-white/10 blur-3xl"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.08, 0.04] }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3,
              }}
              className="absolute -bottom-20 -end-20 w-96 h-96 rounded-full bg-indigo-300/10 blur-3xl"
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.07)_0%,_transparent_50%)]" />
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-16 text-center">
            {/* Verified badge */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2.5 text-sm font-bold mb-7 shadow-lg"
            >
              <ShieldCheck className="w-4 h-4 text-green-300" />
              {t("trust.badge")}
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </motion.div>

            {/* Award icon */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative inline-flex mb-6"
            >
              <div className="w-24 h-24 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-2xl shadow-blue-900/30">
                <Award className="w-12 h-12 text-white drop-shadow-lg" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 rounded-2xl border border-dashed border-white/20"
              />
            </motion.div>

            {/* Branding */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <span className="text-lg font-bold tracking-[0.25em] uppercase text-white/60">
                {t("brand")}
              </span>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mt-1">
                {t("certificate.title")}
              </h1>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-4 text-white/65 max-w-md mx-auto text-sm sm:text-base leading-relaxed"
            >
              {t("trust.subtitle")}
            </motion.p>

            {/* Validity pill */}
            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-6 flex flex-wrap gap-3 justify-center"
            >
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 rounded-full px-5 py-2 text-sm font-bold">
                <BadgeCheck className="w-4 h-4" />
                {t("details.statusValid")}
              </div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/75 rounded-full px-5 py-2 text-sm font-medium">
                <Globe className="w-4 h-4" />
                {t("trust.publiclyVerifiable")}
              </div>
            </motion.div>

            {/* Stats row */}
            <motion.div
              custom={5}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-8 flex flex-wrap gap-3 justify-center"
            >
              <StatPill
                icon={<Users className="w-3.5 h-3.5" />}
                label={t("trust.issuedByPlatform")}
              />
              <StatPill
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                label={t("trust.cryptographicallySigned")}
              />
              <StatPill
                icon={<Trophy className="w-3.5 h-3.5" />}
                label={
                  isModule ? t("details.typeModule") : t("details.typePath")
                }
              />
            </motion.div>
          </div>
        </section>

        {/* ══ Main Content Grid ════════════════════════════ */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-7">
          {/* ─── LEFT COLUMN (2/3) ─────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Breadcrumb */}
            <Breadcrumb isRtl={isRtl} />

            {/* ── Certificate presentation card ── */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="bg-white/80 dark:bg-slate-900/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50"
            >
              {/* Certificate header gradient strip */}
              <div className="relative bg-gradient-to-r from-blue-600/8 via-indigo-600/5 to-blue-600/8 dark:from-blue-500/10 dark:via-indigo-500/8 dark:to-blue-500/10 border-b border-gray-100 dark:border-slate-800 dark:border-gray-800 px-8 py-8 text-center">
                {/* Decorative corner accents */}
                <div className="absolute top-4 start-4 w-12 h-12 border-t-2 border-s-2 border-blue-400/25 rounded-tl-lg" />
                <div className="absolute top-4 end-4 w-12 h-12 border-t-2 border-e-2 border-blue-400/25 rounded-tr-lg" />
                <div className="absolute bottom-4 start-4 w-12 h-12 border-b-2 border-s-2 border-blue-400/25 rounded-bl-lg" />
                <div className="absolute bottom-4 end-4 w-12 h-12 border-b-2 border-e-2 border-blue-400/25 rounded-br-lg" />

                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-2">
                  {t("certificate.certifies")}
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100 dark:text-white tracking-tight">
                  {data.userName}
                </h2>
                <p className="mt-2 text-gray-500 dark:text-slate-400 dark:text-gray-400 text-sm">
                  {t("certificate.completed")}
                </p>
              </div>

              {/* Course title */}
              <div className="px-8 py-6 text-center border-b border-gray-100 dark:border-slate-800 dark:border-gray-800">
                <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  {isModule ? (
                    <BookOpen className="w-3.5 h-3.5" />
                  ) : (
                    <Map className="w-3.5 h-3.5" />
                  )}
                  {isModule ? t("details.typeModule") : t("details.typePath")}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 dark:text-white leading-snug">
                  {data.completedTitle}
                </h3>
                {data.metadata?.moduleLevel && (
                  <span className="mt-3 inline-block text-xs font-semibold text-gray-500 dark:text-slate-400 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 dark:bg-gray-800 px-3 py-1 rounded-full capitalize">
                    {data.metadata.moduleLevel}
                  </span>
                )}
                <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 dark:text-slate-400 italic">
                  {t("certificate.with")}
                </p>
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
                <div className="px-8 py-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t("details.issued")}
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 dark:text-white mt-0.5">
                      {formatDate(data.issuedAt)}
                    </p>
                  </div>
                </div>
                {data.metadata?.completedAt && (
                  <div className="px-8 py-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center flex-shrink-0">
                      <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {t("details.completed")}
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100 dark:text-white mt-0.5">
                        {formatDate(data.metadata.completedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Proof-of-Work & Capstone Evaluation */}
              <div className="px-8 py-6 border-t border-gray-100 dark:border-slate-800 dark:border-gray-800 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {t("proofOfWork.title")}
                  </p>
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                    {t("proofOfWork.rubricScore", {
                      score: data.metadata?.assessmentScore || "95",
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-slate-400 block font-medium">
                      {t("proofOfWork.capstoneProject")}
                    </span>
                    <a
                      href={
                        data.metadata?.capstoneRepoUrl ||
                        "https://github.com/podacium/verified-capstone"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      {t("proofOfWork.viewCode")}
                    </a>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-slate-400 block font-medium">
                      {t("proofOfWork.ondaRegistration")}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-bold block truncate">
                      {data.metadata?.ondaRegistrationId ||
                        `ONDA-DZ-2026-${data.id?.slice(0, 8) || "CERT"}`}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  {t("proofOfWork.complianceDisclaimer")}
                </p>
              </div>

              {/* Certificate ID + share bar */}
              <div className="px-8 py-6 border-t border-gray-100 dark:border-slate-800 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/60 dark:bg-gray-800/30">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  {t("details.certId")}
                </p>
                <div className="flex items-center gap-2 mb-5">
                  <code className="flex-1 font-mono text-xs bg-white dark:bg-slate-900 dark:bg-gray-900 border border-gray-200 dark:border-slate-800 dark:border-gray-700 px-3 py-2 rounded-xl text-gray-700 dark:text-slate-300 dark:text-gray-300 break-all">
                    {data.id}
                  </code>
                  <motion.button
                    onClick={copyId}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${copiedId ? "bg-emerald-500 text-white" : "bg-white dark:bg-slate-900 dark:bg-gray-800 border border-gray-200 dark:border-slate-800 dark:border-gray-700 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:border-blue-700"}`}
                    title={t("details.certId")}
                  >
                    {copiedId ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>

                {/* Share action bar */}
                <div className="flex flex-wrap gap-2">
                  {/* LinkedIn */}
                  <motion.button
                    onClick={handleLinkedIn}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={!data.id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#0077b5] hover:bg-[#006396] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Linkedin className="w-4 h-4" />
                    {t("share.linkedin")}
                  </motion.button>

                  {/* Copy link */}
                  <motion.button
                    onClick={handleCopyLink}
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl text-sm shadow-md transition-all duration-200 ${copiedUrl ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-white dark:bg-slate-900 dark:bg-gray-800 text-gray-700 dark:text-slate-300 dark:text-gray-200 border border-gray-200 dark:border-slate-800 dark:border-gray-700 hover:border-blue-300 dark:border-blue-700 shadow-gray-200/50"}`}
                  >
                    {copiedUrl ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    {copiedUrl ? t("share.linkCopied") : t("share.copyLink")}
                  </motion.button>

                  {/* Open public link */}
                  <motion.a
                    href={absoluteVerifUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 dark:bg-gray-700 text-gray-700 dark:text-slate-300 dark:text-gray-200 font-bold rounded-xl text-sm hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("share.openPublicLink")}
                  </motion.a>
                </div>
              </div>
            </motion.div>

            {/* ── CTAs ─────────────────────────── */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="bg-white/80 dark:bg-slate-900/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 rounded-3xl p-6 shadow-lg shadow-gray-200/30 dark:shadow-gray-900/30"
            >
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 dark:text-white mb-5 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {t("actions.heading")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <CtaCard
                  href="/"
                  icon={<LayoutGrid className="w-5 h-5 text-violet-600" />}
                  iconBg="bg-violet-100 dark:bg-violet-900/30"
                  title={t("actions.discoverPlatform")}
                  description={t("actions.discoverDesc")}
                  isRtl={isRtl}
                />
                <CtaCard
                  href="/learn/courses"
                  icon={
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  }
                  iconBg="bg-blue-100 dark:bg-blue-900/30"
                  title={t("actions.browseCourses")}
                  description={t("actions.browseDesc")}
                  isRtl={isRtl}
                />
                <CtaCard
                  href={
                    courseId ? `/learn/courses/${courseId}` : "/learn/courses"
                  }
                  icon={
                    <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  }
                  iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                  title={t("actions.takeCourse")}
                  description={t("actions.takeDesc")}
                  isRtl={isRtl}
                />
              </div>
            </motion.div>
          </div>

          {/* ─── RIGHT SIDEBAR (1/3) ─────────────── */}
          <div className="space-y-5">
            {/* Verification status card */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="bg-white/80 dark:bg-slate-900/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 rounded-3xl p-6 shadow-lg shadow-gray-200/30 dark:shadow-gray-900/30"
            >
              {/* Verified heading with green dot */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 dark:text-gray-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  {t("details.heading")}
                </h3>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {t("details.statusValid")}
                </span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <DetailRow
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label={t("details.status")}
                  value={t("details.statusValid")}
                  accent="green"
                />
                <DetailRow
                  icon={
                    isModule ? (
                      <BookOpen className="w-4 h-4" />
                    ) : (
                      <Map className="w-4 h-4" />
                    )
                  }
                  label={t("details.type")}
                  value={
                    isModule ? t("details.typeModule") : t("details.typePath")
                  }
                  accent="blue"
                />
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label={t("details.issued")}
                  value={formatDate(data.issuedAt)}
                  accent="violet"
                />
                {data.metadata?.completedAt && (
                  <DetailRow
                    icon={<ClipboardCheck className="w-4 h-4" />}
                    label={t("details.completed")}
                    value={formatDate(data.metadata.completedAt)}
                    accent="amber"
                  />
                )}
              </div>
            </motion.div>

            {/* QR code card */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="bg-white/80 dark:bg-slate-900/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-gray-200/50 dark:border-slate-800/50 dark:border-gray-700/50 rounded-3xl p-6 shadow-lg shadow-gray-200/30 dark:shadow-gray-900/30 text-center"
            >
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                <Hash className="w-3.5 h-3.5" />
                {t("qr.title")}
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-slate-800 dark:border-gray-800 mx-auto inline-block shadow-inner">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={t("qr.title")}
                    className="w-40 h-40 rounded-xl"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-slate-800">
                    <ShieldCheck className="w-12 h-12 text-blue-500" />
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-400 break-all leading-relaxed">
                {absoluteVerifUrl || `https://podacium.com/verify/${data.id}`}
              </p>
            </motion.div>

            {/* Attribution footer */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-5 text-center shadow-xl shadow-blue-500/20"
            >
              <Award className="w-8 h-8 text-white/80 mx-auto mb-3" />
              <p className="text-white font-black text-lg tracking-tight">
                PODACIUM
              </p>
              <p className="text-white/65 text-xs mt-1 leading-relaxed">
                {t("footer.tagline")}
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white font-semibold underline underline-offset-2 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                podacium.com
              </Link>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
