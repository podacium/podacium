/* eslint-disable @next/next/no-img-element */
"use client";

import React, { Suspense, lazy, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart2,
  Brain,
  TrendingUp,
  Database,
  Users,
  Building2,
  Zap,
  Target,
  LineChart,
  PieChart,
  Activity,
  Sparkles,
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Rocket,
  Shield,
  Clock,
  Upload,
  BarChart,
  LayoutDashboard,
  BookOpen,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";

import FAQAccordion from "@/components/FAQAccordion";

import { useAuth } from "@/contexts/AuthContext";
import { AuthenticatedBIHome } from "@/components/bi/AuthenticatedBIHome";

// Lazy load heavy components
const Navbar = lazy(() => import("../../components/Navbar"));
const Footer = lazy(() => import("../../components/Footer"));

// =============================================================================
// ANIMATION CONFIGURATIONS
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    BOUNCY: { type: "spring" as const, stiffness: 400, damping: 15, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
    SLOW: 0.2,
  },
} as const;

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-200 dark:border-blue-800/50 dark:border-blue-800/80"
    >
      <div className="flex flex-col h-full">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
          <div className="text-blue-600 dark:text-blue-400">{icon}</div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 leading-relaxed flex-1">
          {description}
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </motion.div>
  );
};

interface AudienceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  delay?: number;
  color: "blue" | "purple" | "green";
}

const AudienceCard: React.FC<AudienceCardProps> = ({
  icon,
  title,
  description,
  benefits,
  delay = 0,
  color,
}) => {
  const colorClasses = {
    blue: {
      bg: "from-blue-100 to-indigo-100",
      text: "text-blue-600",
      border: "border-blue-200/50",
      gradient:
        "from-blue-50 to-indigo-50/30 dark:from-slate-900 dark:to-slate-900/60",
    },
    purple: {
      bg: "from-purple-100 to-pink-100",
      text: "text-purple-600",
      border: "border-purple-200/50",
      gradient: "from-purple-50 to-pink-50/30",
    },
    green: {
      bg: "from-green-100 to-emerald-100",
      text: "text-green-600",
      border: "border-green-200/50",
      gradient: "from-green-50 to-emerald-50/30",
    },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.SMOOTH, delay }}
      whileHover={{ y: -8 }}
      className={`group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 border ${colors.border}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      ></div>
      <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-8 h-full">
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${colors.bg} w-fit mb-6 group-hover:scale-110 transition-transform duration-300`}
        >
          <div className={colors.text}>{icon}</div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>
        <ul className="space-y-3">
          {benefits.map((benefit, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: delay + index * 0.1 }}
              className="flex items-center text-gray-700 dark:text-slate-300"
            >
              <CheckCircle
                className={`w-4 h-4 ${colors.text} ltr:mr-3 rtl:ml-3 flex-shrink-0`}
              />
              <span className="text-sm">{benefit}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

interface UseCaseCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  featuresLabel: string;
  impact: string;
  delay?: number;
}

const UseCaseCard: React.FC<UseCaseCardProps> = ({
  icon,
  title,
  description,
  features,
  featuresLabel,
  impact,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.GENTLE, delay }}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-slate-900/50 dark:to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative p-8">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 group-hover:scale-110 transition-transform duration-300">
            <div className="text-blue-600 dark:text-blue-400">{icon}</div>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>

        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wide">
            {featuresLabel}
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {features.map((feature, index) => (
              <li
                key={index}
                className="flex items-center text-sm text-gray-700 dark:text-slate-300"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 me-2"></div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
          <div className="flex items-center text-sm">
            <Sparkles className="w-4 h-4 text-yellow-500 me-2" />
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {impact}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface TechStackBannerProps {
  delay?: number;
}

const TechStackBanner: React.FC<TechStackBannerProps> = ({ delay = 0 }) => {
  const t = useTranslations();

  const technologies = [
    {
      icon: <Database className="w-5 h-5" />,
      label: t("bi.hero.integrations.datasets"),
    },
    {
      icon: <PieChart className="w-5 h-5" />,
      label: t("bi.hero.integrations.dashboards"),
    },
    {
      icon: <BarChart className="w-5 h-5" />,
      label: t("bi.hero.integrations.reports"),
    },
    {
      icon: <Activity className="w-5 h-5" />,
      label: t("bi.hero.integrations.insights"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay }}
      className="mt-16"
    >
      <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-6 uppercase tracking-wider">
        {t("bi.hero.integrations.label")}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {technologies.map((tech, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-5 py-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-gray-200 dark:border-slate-800 rounded-full shadow-sm hover:shadow-md hover:border-blue-200 dark:border-blue-800/80 transition-all duration-300"
          >
            <div className="text-blue-600 dark:text-blue-400">{tech.icon}</div>
            <span className="text-gray-700 dark:text-slate-300 font-medium">
              {tech.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

interface StepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stepNumber: number;
  delay?: number;
}

const StepCard: React.FC<StepCardProps> = ({
  icon,
  title,
  description,
  stepNumber,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.SMOOTH, delay }}
      className="relative"
    >
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <div className="text-white">{icon}</div>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {stepNumber}
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 pt-2">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

type BIView = "dashboard" | "info";

function ViewSwitcher({
  view,
  onSwitch,
  t,
}: {
  view: BIView;
  onSwitch: (v: BIView) => void;
  t: any;
}) {
  return (
    <div className="flex flex-col items-center justify-center pt-28 pb-6 px-4 bg-gradient-to-b from-gray-50/80 to-transparent dark:from-slate-950/80 dark:to-transparent relative z-10">
      <div className="text-center mb-6">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight"
        >
          {t("bi.home.header.brand")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            {t("bi.home.header.brandHighlight")}
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm text-gray-500 dark:text-slate-400 mt-2 font-medium tracking-wide uppercase"
        >
          {t("bi.hero.badge")}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative inline-flex items-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-gray-200/60 dark:border-slate-800/80 rounded-2xl p-1.5 shadow-sm"
      >
        {/* Dashboard Tab */}
        <button
          onClick={() => onSwitch("dashboard")}
          className={`relative z-10 flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${
            view === "dashboard"
              ? "text-blue-700"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/40"
          }`}
        >
          {view === "dashboard" && (
            <motion.div
              layoutId="switcher-active-bg"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50"
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <LayoutDashboard
              className={`w-4 h-4 ${view === "dashboard" ? "text-blue-600 dark:text-blue-400" : ""}`}
            />
            {t("bi.home.header.badge")}
          </span>
        </button>

        {/* Info/Learn Tab */}
        <button
          onClick={() => onSwitch("info")}
          className={`relative z-10 flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 ${
            view === "info"
              ? "text-indigo-700"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/40"
          }`}
        >
          {view === "info" && (
            <motion.div
              layoutId="switcher-active-bg"
              className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-indigo-100/50 dark:border-indigo-900/50"
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <BookOpen
              className={`w-4 h-4 ${view === "info" ? "text-indigo-600 dark:text-indigo-400" : ""}`}
            />
            {t("bi.home.header.educationalHub")}
          </span>
        </button>
      </motion.div>
    </div>
  );
}

export default function BIPage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const { isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<BIView>("dashboard");

  const handleNeedsSetup = React.useCallback(() => {
    setView("info");
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-900/50 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const showInfoContent = !isAuthenticated || view === "info";

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={dir}
    >
      <Suspense
        fallback={
          <div className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"></div>
        }
      >
        <Navbar />
      </Suspense>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {isAuthenticated && (
          <ViewSwitcher view={view} onSwitch={setView} t={t} />
        )}

        {isAuthenticated && view === "dashboard" && (
          <div className={isAuthenticated ? "" : "pt-24"}>
            <AuthenticatedBIHome onNeedsSetup={handleNeedsSetup} />
          </div>
        )}

        {showInfoContent && (
          <>
            {/* Hero Section */}
            <section
              className={`relative ${isAuthenticated ? "pt-8" : "pt-32"} pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden`}
            >
              {/* Background Elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/30 dark:bg-blue-800/80 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-800/80 rounded-full blur-3xl"></div>
              </div>

              <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                  {/* Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={ANIMATION_CONFIGS.EASING.ENTER}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200 dark:border-blue-800/50 dark:border-blue-800/80 mb-8"
                  >
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {t("bi.hero.badge")}
                    </span>
                  </motion.div>

                  {/* Title */}
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...ANIMATION_CONFIGS.EASING.ENTER,
                      delay: 0.1,
                    }}
                    className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-slate-100 mb-6"
                  >
                    {t("bi.hero.title")}{" "}
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {t("bi.hero.titleHighlight")}
                    </span>
                  </motion.h1>

                  {/* Subtitle */}
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...ANIMATION_CONFIGS.EASING.ENTER,
                      delay: 0.2,
                    }}
                    className="text-xl md:text-2xl text-gray-600 dark:text-slate-400 mb-10 leading-relaxed"
                  >
                    {t("bi.hero.subtitle")}
                  </motion.p>

                  {/* CTAs */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...ANIMATION_CONFIGS.EASING.ENTER,
                      delay: 0.3,
                    }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                  >
                    <Link
                      href="/bi/datasets"
                      className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                    >
                      {t("bi.hero.cta.primary")}
                      <ArrowRight
                        className={`w-5 h-5 ltr:ml-2 rtl:mr-2 rtl:rotate-180`}
                      />
                    </Link>
                    <Link
                      href="#use-cases"
                      className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 border-2 border-gray-300 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                    >
                      {t("bi.hero.cta.secondary")}
                    </Link>
                  </motion.div>

                  {/* Tech Stack Banner */}
                  <TechStackBanner delay={0.4} />
                </div>
              </div>
            </section>

            {/* What is BI Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
              <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6"
                  >
                    {t("bi.what.title")}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-gray-600 dark:text-slate-400 leading-relaxed"
                  >
                    {t("bi.what.subtitle")}
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <FeatureCard
                    icon={<Brain className="w-6 h-6" />}
                    title={t("bi.what.features.analytics.title")}
                    description={t("bi.what.features.analytics.description")}
                    delay={0}
                  />
                  <FeatureCard
                    icon={<BarChart2 className="w-6 h-6" />}
                    title={t("bi.what.features.dashboards.title")}
                    description={t("bi.what.features.dashboards.description")}
                    delay={0.1}
                  />
                  <FeatureCard
                    icon={<Target className="w-6 h-6" />}
                    title={t("bi.what.features.insights.title")}
                    description={t("bi.what.features.insights.description")}
                    delay={0.2}
                  />
                  <FeatureCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    title={t("bi.what.features.decisions.title")}
                    description={t("bi.what.features.decisions.description")}
                    delay={0.3}
                  />
                  <FeatureCard
                    icon={<Zap className="w-6 h-6" />}
                    title={t("bi.what.features.integration.title")}
                    description={t("bi.what.features.integration.description")}
                    delay={0.4}
                  />
                  <FeatureCard
                    icon={<Activity className="w-6 h-6" />}
                    title={t("bi.what.features.realtime.title")}
                    description={t("bi.what.features.realtime.description")}
                    delay={0.5}
                  />
                </div>
              </div>
            </section>

            {/* How It Works Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
              <div className="max-w-5xl mx-auto">
                <div className="text-center mb-16">
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6"
                  >
                    {t("bi.howItWorks.title")}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-gray-600 dark:text-slate-400 leading-relaxed"
                  >
                    {t("bi.howItWorks.subtitle")}
                  </motion.p>
                </div>

                <div className="space-y-12">
                  <StepCard
                    icon={<Upload className="w-7 h-7" />}
                    title={t("bi.howItWorks.steps.upload.title")}
                    description={t("bi.howItWorks.steps.upload.description")}
                    stepNumber={1}
                    delay={0}
                  />
                  <StepCard
                    icon={<Brain className="w-7 h-7" />}
                    title={t("bi.howItWorks.steps.analyze.title")}
                    description={t("bi.howItWorks.steps.analyze.description")}
                    stepNumber={2}
                    delay={0.1}
                  />
                  <StepCard
                    icon={<Target className="w-7 h-7" />}
                    title={t("bi.howItWorks.steps.decide.title")}
                    description={t("bi.howItWorks.steps.decide.description")}
                    stepNumber={3}
                    delay={0.2}
                  />
                </div>
              </div>
            </section>

            {/* Who It's For Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
              <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6"
                  >
                    {t("bi.audience.title")}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-gray-600 dark:text-slate-400 leading-relaxed"
                  >
                    {t("bi.audience.subtitle")}
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <AudienceCard
                    icon={<TrendingUp className="w-6 h-6" />}
                    title={t("bi.audience.segments.businesses.title")}
                    description={t(
                      "bi.audience.segments.businesses.description",
                    )}
                    benefits={
                      t.raw("bi.audience.segments.businesses.benefits") || []
                    }
                    color="blue"
                    delay={0}
                  />
                  <AudienceCard
                    icon={<Building2 className="w-6 h-6" />}
                    title={t("bi.audience.segments.enterprises.title")}
                    description={t(
                      "bi.audience.segments.enterprises.description",
                    )}
                    benefits={
                      t.raw("bi.audience.segments.enterprises.benefits") || []
                    }
                    color="purple"
                    delay={0.1}
                  />
                  <AudienceCard
                    icon={<Rocket className="w-6 h-6" />}
                    title={t("bi.audience.segments.startups.title")}
                    description={t("bi.audience.segments.startups.description")}
                    benefits={
                      t.raw("bi.audience.segments.startups.benefits") || []
                    }
                    color="green"
                    delay={0.2}
                  />
                </div>
              </div>
            </section>

            {/* Use Cases Section */}
            <section
              id="use-cases"
              className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
            >
              <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6"
                  >
                    {t("bi.useCases.title")}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-gray-600 dark:text-slate-400 leading-relaxed"
                  >
                    {t("bi.useCases.subtitle")}
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <UseCaseCard
                    icon={<PieChart className="w-6 h-6" />}
                    title={t("bi.useCases.cases.dashboards.title")}
                    description={t("bi.useCases.cases.dashboards.description")}
                    features={
                      t.raw("bi.useCases.cases.dashboards.features") || []
                    }
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.dashboards.impact")}
                    delay={0}
                  />
                  <UseCaseCard
                    icon={<LineChart className="w-6 h-6" />}
                    title={t("bi.useCases.cases.insights.title")}
                    description={t("bi.useCases.cases.insights.description")}
                    features={
                      t.raw("bi.useCases.cases.insights.features") || []
                    }
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.insights.impact")}
                    delay={0.1}
                  />
                  <UseCaseCard
                    icon={<Database className="w-6 h-6" />}
                    title={t("bi.useCases.cases.decisions.title")}
                    description={t("bi.useCases.cases.decisions.description")}
                    features={
                      t.raw("bi.useCases.cases.decisions.features") || []
                    }
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.decisions.impact")}
                    delay={0.2}
                  />
                  <UseCaseCard
                    icon={<Users className="w-6 h-6" />}
                    title={t("bi.useCases.cases.marketing.title")}
                    description={t("bi.useCases.cases.marketing.description")}
                    features={
                      t.raw("bi.useCases.cases.marketing.features") || []
                    }
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.marketing.impact")}
                    delay={0.3}
                  />
                  <UseCaseCard
                    icon={<Shield className="w-6 h-6" />}
                    title={t("bi.useCases.cases.risk.title")}
                    description={t("bi.useCases.cases.risk.description")}
                    features={t.raw("bi.useCases.cases.risk.features") || []}
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.risk.impact")}
                    delay={0.4}
                  />
                  <UseCaseCard
                    icon={<Activity className="w-6 h-6" />}
                    title={t("bi.useCases.cases.supply.title")}
                    description={t("bi.useCases.cases.supply.description")}
                    features={t.raw("bi.useCases.cases.supply.features") || []}
                    featuresLabel={t("bi.useCases.featuresLabel")}
                    impact={t("bi.useCases.cases.supply.impact")}
                    delay={0.5}
                  />
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <FAQAccordion
              items={t.raw("bi.faq.questions") || []}
              title={t("bi.faq.title")}
              subtitle={t("bi.faq.subtitle")}
              searchable
              multiOpen
            />

            {/* CTA Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                ></div>
              </div>

              <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-12">
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold text-white mb-6"
                  >
                    {t("bi.cta.title")}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="text-xl text-blue-100 leading-relaxed"
                  >
                    {t("bi.cta.subtitle")}
                  </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                  {[
                    {
                      icon: <Database className="w-6 h-6" />,
                      title: t("bi.cta.actions.datasets.title"),
                      description: t("bi.cta.actions.datasets.description"),
                      link: t("bi.cta.actions.datasets.link"),
                      delay: 0,
                    },
                    {
                      icon: <BarChart2 className="w-6 h-6" />,
                      title: t("bi.cta.actions.dashboards.title"),
                      description: t("bi.cta.actions.dashboards.description"),
                      link: t("bi.cta.actions.dashboards.link"),
                      delay: 0.1,
                    },
                    {
                      icon: <Brain className="w-6 h-6" />,
                      title: t("bi.cta.actions.analytics.title"),
                      description: t("bi.cta.actions.analytics.description"),
                      link: t("bi.cta.actions.analytics.link"),
                      delay: 0.2,
                    },
                  ].map((action, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: action.delay }}
                    >
                      <Link
                        href={action.link}
                        className="group block bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 hover:bg-white/20 hover:border-white/40 transition-all duration-300 hover:-translate-y-2"
                      >
                        <div className="p-3 rounded-xl bg-white/20 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                          <div className="text-white">{action.icon}</div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">
                          {action.title}
                        </h3>
                        <p className="text-blue-100 mb-4">
                          {action.description}
                        </p>
                        <div className="flex items-center text-white font-semibold">
                          <span>{t("bi.cta.getStarted")}</span>
                          <ChevronRight
                            className={`w-5 h-5 ltr:ml-2 rtl:mr-2 group-hover:ltr:translate-x-2 group-hover:rtl:-translate-x-2 transition-transform duration-300 ${dir === "rtl" ? "rotate-180" : ""}`}
                          />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="text-center text-blue-100 text-sm"
                >
                  {t("bi.cta.footer")}
                </motion.div>
              </div>
            </section>
          </>
        )}
      </main>

      <Suspense
        fallback={<div className="h-64 bg-gray-50 dark:bg-slate-900/60"></div>}
      >
        <Footer />
      </Suspense>
    </div>
  );
}
