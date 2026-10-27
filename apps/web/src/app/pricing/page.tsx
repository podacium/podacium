"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Sparkles,
  Crown,
  Zap,
  Star,
  GraduationCap,
  Briefcase,
  BarChart3,
  Percent,
  Shield,
  TrendingUp,
  Building,
  Users,
  Award,
  X as XIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations, useBidi } from "@/lib/i18n";

// =============================================================================
// TYPES
// =============================================================================

interface PricingPlan {
  plan: string;
  name: string;
  description: string;
  price: number;
  yearly_price?: number;
  max_courses?: number;
  max_datasets?: number;
  max_dashboards?: number;
  max_api_calls?: number;
  trial_days?: number;
}
interface CommissionRate {
  tier: string;
  commission_percent: number;
  description: string;
}
interface PricingData {
  edtech: PricingPlan[];
  bi: PricingPlan[];
  freelance: CommissionRate[];
}

// =============================================================================
// HELPERS
// =============================================================================

function calcSavingsPercent(monthly: number, yearly?: number): number {
  if (!yearly || monthly === 0) return 0;
  return Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);
}

function calcSavingsAmount(monthly: number, yearly?: number): number {
  if (!yearly) return 0;
  return monthly * 12 - yearly;
}

function fmtDZD(value: number): string {
  if (value === 0) return "0";
  return value.toLocaleString();
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

function BillingToggle({
  isYearly,
  onChange,
  t,
  isRTL,
  color = "blue",
  savingsPercent,
}: {
  isYearly: boolean;
  onChange: (v: boolean) => void;
  t: any;
  isRTL: boolean;
  color?: string;
  savingsPercent?: number;
}) {
  const monthlyLabel = t("pricing.common.billing.monthly");
  const yearlyLabel = t("pricing.common.billing.yearly");
  const switchBg = isYearly
    ? color === "purple"
      ? "bg-purple-600"
      : "bg-blue-600"
    : "bg-gray-300";

  // DOM order is always: Monthly → Switch → Yearly → Save badge
  // In LTR: renders left-to-right as written
  // In RTL: browser reverses flex to right-to-left, so Monthly appears on RIGHT (start)
  // Switch knob: in LTR goes right for yearly, in RTL goes left for yearly
  const knobLeft = isRTL
    ? isYearly
      ? "4px"
      : "30px" // RTL: yearly = knob left (toward سنوي which is visually left)
    : isYearly
      ? "30px"
      : "4px"; // LTR: yearly = knob right (toward Yearly which is visually right)

  return (
    <div className="flex items-center justify-center gap-3 mb-12 flex-wrap">
      <span
        className={`text-sm font-bold whitespace-nowrap ${!isYearly ? "text-gray-900 dark:text-slate-100" : "text-gray-400"}`}
      >
        {monthlyLabel}
      </span>
      <button
        onClick={() => onChange(!isYearly)}
        className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${switchBg}`}
        role="switch"
        aria-checked={isYearly}
      >
        <div
          className="absolute top-1 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm transition-all duration-200"
          style={{ left: knobLeft }}
        />
      </button>
      <span
        className={`text-sm font-bold whitespace-nowrap ${isYearly ? "text-gray-900 dark:text-slate-100" : "text-gray-400"}`}
      >
        {yearlyLabel}
      </span>
      {isYearly && savingsPercent != null && savingsPercent > 0 && (
        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-100 dark:border-emerald-900/50 whitespace-nowrap">
          {t("pricing.common.billing.savePercent", {
            percent: String(savingsPercent),
          })}
        </span>
      )}
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className={`flex items-center gap-2.5`}>
      <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
      <span className="text-sm text-gray-700 dark:text-slate-300">{text}</span>
    </div>
  );
}

function PriceDisplay({
  price,
  yearlyPrice,
  isYearly,
  trialDays,
  t,
  isRTL,
}: {
  price: number;
  yearlyPrice?: number;
  isYearly: boolean;
  trialDays?: number;
  t: any;
  isRTL: boolean;
}) {
  const displayPrice = isYearly && yearlyPrice ? yearlyPrice / 12 : price;
  const savings = calcSavingsAmount(price, yearlyPrice);
  const currency = t("pricing.common.currency");
  const perMonth = t("pricing.common.billing.abbrMonth");

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-gray-900 dark:text-slate-100">
          {fmtDZD(displayPrice)}
        </span>
        <span className="text-sm text-gray-400 font-medium">
          {currency}/{perMonth}
        </span>
      </div>
      {isYearly && savings > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
          {t("pricing.common.billing.youSave", {
            amount: fmtDZD(savings),
            currency,
          })}
        </p>
      )}
      {trialDays != null && trialDays > 0 && (
        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
          {t("pricing.common.trialDays", { days: String(trialDays) })}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PricingPage() {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const [activePillar, setActivePillar] = useState<
    "education" | "freelancing" | "bi"
  >("education");
  const [isYearly, setIsYearly] = useState(false);
  const [pricing, setPricing] = useState<PricingData | null>(null);

  useEffect(() => {
    fetch("/api/subscriptions/pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPricing)
      .catch(() => null);
  }, []);

  const pillars = [
    {
      key: "education" as const,
      label: t("pricing.common.pillars.education"),
      icon: <GraduationCap className="w-5 h-5" />,
    },
    {
      key: "freelancing" as const,
      label: t("pricing.common.pillars.freelancing"),
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      key: "bi" as const,
      label: t("pricing.common.pillars.business"),
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900" dir={dir}>
      <Navbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Hero */}
        <section className="relative pt-32 pb-16 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div
              className={`absolute top-0 ${isRTL ? "right-1/4" : "left-1/4"} w-[600px] h-[600px] bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 blur-[150px] rounded-full`}
            />
            <div
              className={`absolute bottom-0 ${isRTL ? "left-1/4" : "right-1/4"} w-[400px] h-[400px] bg-indigo-50 dark:bg-slate-900/80 dark:bg-indigo-950/60 blur-[120px] rounded-full`}
            />
          </div>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className={`inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-full mb-6 ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest">
                  {t("pricing.hero.badge")}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 tracking-tight mb-6 leading-[1.1]">
                {t("pricing.hero.title")}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {t("pricing.hero.titleHighlight")}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("pricing.hero.subtitle")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Tabs */}
        <section className="sticky top-20 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center py-4">
            <div className="flex gap-1 p-1.5 bg-gray-100/80 dark:bg-slate-800/80 rounded-2xl">
              {pillars.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActivePillar(p.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activePillar === p.key ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-md" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300"}`}
                >
                  {p.icon}
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait">
              {activePillar === "education" && (
                <motion.div
                  key="ed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <EducationSection
                    pricing={pricing}
                    isYearly={isYearly}
                    setIsYearly={setIsYearly}
                    t={t}
                    isRTL={isRTL}
                  />
                </motion.div>
              )}
              {activePillar === "freelancing" && (
                <motion.div
                  key="fl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <FreelancingSection pricing={pricing} t={t} isRTL={isRTL} />
                </motion.div>
              )}
              {activePillar === "bi" && (
                <motion.div
                  key="bi"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <BISection
                    pricing={pricing}
                    isYearly={isYearly}
                    setIsYearly={setIsYearly}
                    t={t}
                    isRTL={isRTL}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Trust */}
        <section className="py-12 border-t border-gray-100 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className={`flex flex-wrap justify-center gap-8 text-sm text-gray-400 font-medium ${isRTL ? "flex-row-reverse" : ""}`}
            >
              {[
                t("pricing.common.trust.0"),
                t("pricing.common.trust.1"),
                t("pricing.common.trust.2"),
                t("pricing.common.trust.3"),
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Domestic Algerian Payment Badges */}
            <div className="mt-8 pt-6 border-t border-gray-100/60 dark:border-slate-800/60 text-center">
              <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold mb-3">
                {t("pricing.common.acceptedPayments")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-gray-500 dark:text-slate-400">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 font-mono">
                  {t("pricing.common.paymentMethods.edahabia")}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 font-mono">
                  {t("pricing.common.paymentMethods.cib")}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 font-mono">
                  {t("pricing.common.paymentMethods.satim")}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200/60 dark:border-slate-700 font-mono">
                  {t("pricing.common.paymentMethods.visa")}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

// =============================================================================
// EDUCATION SECTION
// =============================================================================

function EducationSection({
  pricing,
  isYearly,
  setIsYearly,
  t,
  isRTL,
}: {
  pricing: PricingData | null;
  isYearly: boolean;
  setIsYearly: (v: boolean) => void;
  t: any;
  isRTL: boolean;
}) {
  const apiPlans = pricing?.edtech?.filter((p) => p.price > 0) || [];

  // Plan keys for i18n mapping — regardless of what the DB returns in English,
  // we map plan codes to translation keys for localized display
  const planI18n: Record<string, { name: string; desc: string }> = {
    STUDENT_STARTER: {
      name: t("pricing.education.plans.starter"),
      desc: t("pricing.education.plans.starterDesc"),
    },
    STUDENT_PLUS: {
      name: t("pricing.education.plans.plus"),
      desc: t("pricing.education.plans.plusDesc"),
    },
    STUDENT_PRO: {
      name: t("pricing.education.plans.pro"),
      desc: t("pricing.education.plans.proDesc"),
    },
  };

  const plans =
    apiPlans.length > 0
      ? apiPlans.map((p) => ({
          ...p,
          name: planI18n[p.plan]?.name || p.name,
          description: planI18n[p.plan]?.desc || p.description,
        }))
      : [
          {
            plan: "STUDENT_STARTER",
            name: planI18n.STUDENT_STARTER.name,
            description: planI18n.STUDENT_STARTER.desc,
            price: 1900,
            yearly_price: 17900,
            max_courses: 3,
            trial_days: 7,
          },
          {
            plan: "STUDENT_PLUS",
            name: planI18n.STUDENT_PLUS.name,
            description: planI18n.STUDENT_PLUS.desc,
            price: 3400,
            yearly_price: 31900,
            max_courses: 5,
            trial_days: 7,
          },
          {
            plan: "STUDENT_PRO",
            name: planI18n.STUDENT_PRO.name,
            description: planI18n.STUDENT_PRO.desc,
            price: 5400,
            yearly_price: 49900,
            max_courses: 10,
            trial_days: 14,
          },
        ];

  const icons = [
    <Zap key="0" className="w-6 h-6" />,
    <Star key="1" className="w-6 h-6" />,
    <Crown key="2" className="w-6 h-6" />,
  ];
  const gradients = [
    "from-blue-500 to-cyan-500",
    "from-indigo-500 to-purple-500",
    "from-purple-500 to-pink-500",
  ];
  const avgSavings =
    plans.length > 0
      ? Math.round(
          plans.reduce(
            (s, p) => s + calcSavingsPercent(p.price, p.yearly_price),
            0,
          ) / plans.length,
        )
      : 0;

  const features: string[][] = [
    [
      t("pricing.education.features.skillPassport"),
      t("pricing.education.features.tracking"),
    ],
    [
      t("pricing.education.features.skillPassport"),
      t("pricing.education.features.tracking"),
      t("pricing.education.features.certificates"),
    ],
    [
      t("pricing.education.features.skillPassport"),
      t("pricing.education.features.tracking"),
      t("pricing.education.features.certificates"),
      t("pricing.education.features.mentor"),
      t("pricing.education.features.priority"),
    ],
  ];

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
          {t("pricing.education.title")}
        </h2>
        <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
          {t("pricing.education.description")}
        </p>
      </div>
      <BillingToggle
        isYearly={isYearly}
        onChange={setIsYearly}
        t={t}
        isRTL={isRTL}
        color="blue"
        savingsPercent={isYearly ? avgSavings : undefined}
      />
      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan, i) => {
          const isPopular = i === 1;
          return (
            <motion.div
              key={plan.plan}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isPopular ? "border-blue-500 shadow-lg shadow-blue-500/10" : "border-gray-100 dark:border-slate-800 hover:border-gray-200"}`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                  {t("pricing.common.mostPopular")}
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[i]} flex items-center justify-center text-white mb-5`}
              >
                {icons[i]}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                {plan.description}
              </p>
              <PriceDisplay
                price={plan.price}
                yearlyPrice={plan.yearly_price}
                isYearly={isYearly}
                trialDays={plan.trial_days}
                t={t}
                isRTL={isRTL}
              />
              <div className="flex-1 space-y-3 mb-8">
                {plan.max_courses && (
                  <Feature
                    text={`${plan.max_courses} ${t("pricing.education.features.coursesPerMonth")}`}
                  />
                )}
                {(features[i] || []).map((f, fi) => (
                  <Feature key={fi} text={f} />
                ))}
              </div>
              <Link
                href="/billing"
                className={`w-full py-3.5 rounded-xl text-center font-bold text-sm transition-all active:scale-[0.98] block ${isPopular ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30" : "bg-gray-900 text-white hover:bg-black"}`}
              >
                {t("pricing.education.cta", { tier: plan.name })}
              </Link>
            </motion.div>
          );
        })}
      </div>
      <p className="text-center text-sm text-gray-400 mt-8">
        {t("pricing.common.cancelAnytime")}
      </p>

      {/* Skill Passport Note */}
      <div className="mt-10 max-w-2xl mx-auto p-5 bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
          {t("pricing.education.notes.skillPassportTitle")}
        </p>
        <ul className="text-xs text-blue-700 dark:text-blue-300/70 leading-relaxed space-y-1.5 list-disc list-inside">
          {(t.raw("pricing.education.notes.skillPassportBullets") || []).map(
            (bullet: string, i: number) => (
              <li key={i}>{bullet}</li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}

// =============================================================================
// FREELANCING SECTION
// =============================================================================

function FreelancingSection({
  pricing,
  t,
  isRTL,
}: {
  pricing: PricingData | null;
  t: any;
  isRTL: boolean;
}) {
  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      color: "from-emerald-400 to-teal-500",
      name: t("pricing.freelancing.oldTiers.0.tier"),
      price: t("pricing.freelancing.oldTiers.0.price"),
      period: t("pricing.freelancing.oldTiers.0.period"),
      desc: t("pricing.freelancing.oldTiers.0.description"),
    },
    {
      icon: <Star className="w-6 h-6" />,
      color: "from-blue-500 to-indigo-500",
      name: t("pricing.freelancing.oldTiers.1.tier"),
      price: t("pricing.freelancing.oldTiers.1.price"),
      period: t("pricing.freelancing.oldTiers.1.period"),
      desc: t("pricing.freelancing.oldTiers.1.description"),
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      color: "from-purple-500 to-pink-500",
      name: t("pricing.freelancing.oldTiers.2.tier"),
      price: t("pricing.freelancing.oldTiers.2.price"),
      period: t("pricing.freelancing.oldTiers.2.period"),
      desc: t("pricing.freelancing.oldTiers.2.description"),
    },
    {
      icon: <Award className="w-6 h-6" />,
      color: "from-amber-500 to-orange-500",
      name: t("pricing.freelancing.oldTiers.3.tier"),
      price: t("pricing.freelancing.oldTiers.3.price"),
      period: t("pricing.freelancing.oldTiers.3.period"),
      desc: t("pricing.freelancing.oldTiers.3.description"),
    },
  ];

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
          {t("pricing.freelancing.title")}
        </h2>
        <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
          {t("pricing.freelancing.description")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="grid gap-4">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 flex items-center gap-6 hover:shadow-lg hover:border-gray-200 dark:hover:border-slate-800 transition-all group"
            >
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform`}
              >
                {f.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-lg">
                  {f.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {f.desc}
                </p>
              </div>
              <div className="flex-shrink-0 text-end">
                <div className="text-3xl font-black text-gray-900 dark:text-slate-100">
                  {f.price}
                </div>
                <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
                  {f.period}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={`mt-12 grid sm:grid-cols-3 gap-6`}>
          {[
            {
              icon: (
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ),
              title: t("pricing.freelancing.benefits.podapoints"),
              desc: t("pricing.freelancing.benefits.podapointsDesc"),
            },
            {
              icon: (
                <Percent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ),
              title: t("pricing.freelancing.benefits.flexibility"),
              desc: t("pricing.freelancing.benefits.flexibilityDesc"),
            },
            {
              icon: (
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ),
              title: t("pricing.freelancing.benefits.expiry"),
              desc: t("pricing.freelancing.benefits.expiryDesc"),
            },
          ].map((b, i) => (
            <div
              key={i}
              className="text-center p-6 rounded-xl bg-gray-50/50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800"
            >
              <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-3">
                {b.icon}
              </div>
              <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm mb-1">
                {b.title}
              </h4>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {b.desc}
              </p>
            </div>
          ))}
        </div>

        {/* PodaPoints Feature Pricing */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-6 text-center">
            {t(
              "pricing.freelancing.podaPointsTitle",
              "Unlock Features with PodaPoints",
            )}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: <Sparkles className="w-5 h-5" />,
                color: "from-blue-500 to-cyan-500",
                label: "pricing.freelancing.podaPoints.projectPost",
                price: 200,
              },
              {
                icon: <Star className="w-5 h-5" />,
                color: "from-amber-500 to-orange-500",
                label: "pricing.freelancing.podaPoints.featuredProject",
                price: 500,
              },
              {
                icon: <Zap className="w-5 h-5" />,
                color: "from-purple-500 to-pink-500",
                label: "pricing.freelancing.podaPoints.boost",
                price: 200,
              },
              {
                icon: <Award className="w-5 h-5" />,
                color: "from-emerald-500 to-teal-500",
                label: "pricing.freelancing.podaPoints.skillPassport",
                price: 500,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 text-center hover:shadow-lg hover:border-gray-200 dark:hover:border-slate-800 transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mx-auto mb-3 group-hover:scale-110 transition-transform`}
                >
                  {item.icon}
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-2">
                  {t(item.label)}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-xl font-black text-gray-900 dark:text-slate-100">
                    {item.price}
                  </span>
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    {t("common.uiLabels.pts")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
            >
              {t("pricing.freelancing.podaPointsCta", "Go to Billing →")}
            </Link>
          </div>
        </div>

        {/* Freelance Payment Note */}
        <div className="mt-10 p-5 bg-emerald-50 dark:bg-emerald-950/40 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
          <p className="text-sm text-emerald-900 dark:text-emerald-100 font-medium mb-2">
            {t("pricing.freelancing.notes.howItWorksTitle")}
          </p>
          <ul className="text-xs text-emerald-700 dark:text-emerald-300/70 leading-relaxed space-y-1.5 list-disc list-inside">
            {(t.raw("pricing.freelancing.notes.howItWorksBullets") || []).map(
              (bullet: string, i: number) => (
                <li key={i}>{bullet}</li>
              ),
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BI SECTION
// =============================================================================

function BISection({
  pricing,
  isYearly,
  setIsYearly,
  t,
  isRTL,
}: {
  pricing: PricingData | null;
  isYearly: boolean;
  setIsYearly: (v: boolean) => void;
  t: any;
  isRTL: boolean;
}) {
  const planI18n: Record<string, { name: string; desc: string }> = {
    BI_GROWTH: {
      name: t("pricing.business.plans.starter"),
      desc: t("pricing.business.plans.starterDesc"),
    },
    BI_SCALE: {
      name: t("pricing.business.plans.growth"),
      desc: t("pricing.business.plans.growthDesc"),
    },
    BI_ELITE: {
      name: t("pricing.business.plans.pro"),
      desc: t("pricing.business.plans.proDesc"),
    },
  };

  const apiPlans = pricing?.bi || [];
  const plans: PricingPlan[] =
    apiPlans.length > 0
      ? apiPlans.map((p) => ({
          ...p,
          name: planI18n[p.plan]?.name || p.name,
          description: planI18n[p.plan]?.desc || p.description,
        }))
      : [
          {
            plan: "BI_GROWTH",
            name: planI18n.BI_GROWTH.name,
            description: planI18n.BI_GROWTH.desc,
            price: 3500,
            yearly_price: 32900,
            max_datasets: 3,
            max_dashboards: 2,
            trial_days: 30,
          },
          {
            plan: "BI_SCALE",
            name: planI18n.BI_SCALE.name,
            description: planI18n.BI_SCALE.desc,
            price: 8000,
            yearly_price: 74900,
            max_datasets: 10,
            max_dashboards: 10,
            trial_days: 14,
          },
          {
            plan: "BI_ELITE",
            name: planI18n.BI_ELITE.name,
            description: planI18n.BI_ELITE.desc,
            price: 15000,
            yearly_price: 139900,
            max_datasets: 100,
            max_dashboards: 50,
            trial_days: 14,
          },
        ];

  const icons = [
    <BarChart3 key="0" className="w-6 h-6" />,
    <TrendingUp key="1" className="w-6 h-6" />,
    <Crown key="2" className="w-6 h-6" />,
  ];
  const gradients = [
    "from-purple-500 to-indigo-500",
    "from-indigo-500 to-blue-500",
    "from-blue-600 to-cyan-500",
  ];
  const avgSavings =
    plans.length > 0
      ? Math.round(
          plans.reduce(
            (s, p) => s + calcSavingsPercent(p.price, p.yearly_price),
            0,
          ) / plans.length,
        )
      : 0;

  const features: string[][] = [
    [
      t("pricing.business.features.cityLevel"),
      t("pricing.business.features.weeklyDigest"),
    ],
    [
      t("pricing.business.features.wilayaLevel"),
      t("pricing.business.features.salaryBenchmarks"),
      t("pricing.business.features.apiAccess"),
    ],
    [
      t("pricing.business.features.customReports"),
      t("pricing.business.features.hiringForecasts"),
      t("pricing.business.features.apiAccess"),
      t("pricing.business.features.dedicatedManager"),
    ],
  ];

  return (
    <div>
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
          {t("pricing.business.title")}
        </h2>
        <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
          {t("pricing.business.description")}
        </p>
      </div>
      <BillingToggle
        isYearly={isYearly}
        onChange={setIsYearly}
        t={t}
        isRTL={isRTL}
        color="purple"
        savingsPercent={isYearly ? avgSavings : undefined}
      />
      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan, i) => {
          const isPopular = i === 1;
          return (
            <motion.div
              key={plan.plan}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 p-8 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isPopular ? "border-purple-500 shadow-lg shadow-purple-500/10" : "border-gray-100 dark:border-slate-800 hover:border-gray-200"}`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                  {t("pricing.common.recommended")}
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[i]} flex items-center justify-center text-white mb-5`}
              >
                {icons[i]}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                {plan.description}
              </p>
              <PriceDisplay
                price={plan.price}
                yearlyPrice={plan.yearly_price}
                isYearly={isYearly}
                trialDays={plan.trial_days}
                t={t}
                isRTL={isRTL}
              />
              <div className="flex-1 space-y-3 mb-8">
                {plan.max_datasets && (
                  <Feature
                    text={`${plan.max_datasets} ${t("pricing.business.features.datasets")}`}
                  />
                )}
                {plan.max_dashboards && (
                  <Feature
                    text={`${plan.max_dashboards} ${t("pricing.business.features.dashboards")}`}
                  />
                )}
                {(features[i] || []).map((f, fi) => (
                  <Feature key={fi} text={f} />
                ))}
              </div>
              <Link
                href="/billing"
                className={`w-full py-3.5 rounded-xl text-center font-bold text-sm transition-all active:scale-[0.98] block ${isPopular ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-xl" : "bg-gray-900 text-white hover:bg-black"}`}
              >
                {t("pricing.business.cta.startTrial")}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
