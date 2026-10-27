"use client";

import React, { useState, Suspense, lazy } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Briefcase,
  BarChart3,
  ChevronRight,
  Search,
  CheckCircle,
  ArrowRight,
  Shield,
  CreditCard,
  Bell,
  User,
  LayoutGrid,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { getAccentStyle } from "@/lib/accent-styles";
import FAQAccordion from "@/components/FAQAccordion";

const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// Animation configurations matching BI/Learn/Hub design system
const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
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
  },
};

// Platform Card Component
interface PlatformCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  href: string;
  color: "blue" | "purple" | "green";
  delay?: number;
  exploreText: string;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  icon,
  title,
  description,
  features,
  href,
  color,
  delay = 0,
  exploreText,
}) => {
  const colorClasses = {
    blue: {
      bg: "from-blue-100 to-indigo-100",
      text: "text-blue-600",
      border: "hover:border-blue-200",
      gradient:
        "from-blue-50 to-indigo-50/30 dark:from-slate-900 dark:to-slate-900/60",
    },
    purple: {
      bg: "from-purple-100 to-pink-100",
      text: "text-purple-600",
      border: "hover:border-purple-200",
      gradient: "from-purple-50 to-pink-50/30",
    },
    green: {
      bg: "from-green-100 to-emerald-100",
      text: "text-green-600",
      border: "hover:border-green-200",
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
      className={`group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 border border-gray-200/50 dark:border-slate-800/50 ${colors.border}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      ></div>
      <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-8 h-full flex flex-col">
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br ${colors.bg} w-fit mb-6 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
        >
          <div className={colors.text}>{icon}</div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed flex-grow">
          {description}
        </p>
        <ul className="space-y-4 mb-8">
          {(features || []).map((feature, index) => (
            <li
              key={index}
              className="flex items-center text-gray-700 dark:text-slate-300 text-sm font-medium"
            >
              <CheckCircle
                className={`w-5 h-5 ${colors.text} mr-3 flex-shrink-0 rtl:ml-3 rtl:mr-0`}
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className={`inline-flex items-center justify-center w-full py-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800 ${colors.text} font-semibold transition-colors mt-auto`}
        >
          {exploreText}{" "}
          <ChevronRight className="w-4 h-4 ml-2 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
        </Link>
      </div>
    </motion.div>
  );
};

// Feature Card Component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
  delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  items,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-8 hover:shadow-xl transition-all duration-300 hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80"
    >
      <div className="flex flex-col h-full">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 w-fit mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-sm border border-blue-100 dark:border-blue-900/50">
          <div className="text-blue-600 dark:text-blue-400">{icon}</div>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-6">
          {description}
        </p>
        <ul className="space-y-3 flex-1">
          {(items || []).map((item, index) => (
            <li
              key={index}
              className="flex items-start text-sm text-gray-700 dark:text-slate-300 font-medium"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 rtl:ml-3 rtl:mr-0 mt-2"></div>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-b-2xl"></div>
    </motion.div>
  );
};

// Guide Card Component
interface GuideCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  delay?: number;
}

const GuideCard: React.FC<GuideCardProps> = ({
  icon,
  title,
  description,
  href,
  delay = 0,
}) => {
  const t = useTranslations("docs");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -8 }}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-8 hover:shadow-xl hover:border-indigo-200 dark:border-indigo-800/80 transition-all duration-300"
    >
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 w-fit mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
        <div className="text-indigo-600 dark:text-indigo-400">{icon}</div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-slate-400 leading-relaxed mb-6">
        {description}
      </p>
      <Link
        href={href}
        className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 transition-colors"
      >
        {t("guides.learnMore")}{" "}
        <ChevronRight className="w-4 h-4 ml-1 rtl:ml-0 rtl:mr-1 rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
      </Link>
    </motion.div>
  );
};

// Main Documentation Page
export default function DocsPage() {
  const t = useTranslations("docs");
  const { dir } = useBidi();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  const safeArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val as string[];
    return typeof val === "string" ? [val] : [];
  };

  const platforms = [
    {
      icon: <GraduationCap className="w-7 h-7" />,
      title: t("platforms.learn.title"),
      description: t("platforms.learn.description"),
      features: safeArray(t.raw("platforms.learn.features")),
      href: "/learn",
      color: "blue" as const,
    },
    {
      icon: <Briefcase className="w-7 h-7" />,
      title: t("platforms.hub.title"),
      description: t("platforms.hub.description"),
      features: safeArray(t.raw("platforms.hub.features")),
      href: "/hub",
      color: "purple" as const,
    },
    {
      icon: <BarChart3 className="w-7 h-7" />,
      title: t("platforms.bi.title"),
      description: t("platforms.bi.description"),
      features: safeArray(t.raw("platforms.bi.features")),
      href: "/bi",
      color: "green" as const,
    },
  ];

  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: t("features.authentication.title"),
      description: t("features.authentication.description"),
      items: safeArray(t.raw("features.authentication.items")),
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: t("features.billing.title"),
      description: t("features.billing.description"),
      items: safeArray(t.raw("features.billing.items")),
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: t("features.notifications.title"),
      description: t("features.notifications.description"),
      items: safeArray(t.raw("features.notifications.items")),
    },
    {
      icon: <User className="w-6 h-6" />,
      title: t("features.profile.title"),
      description: t("features.profile.description"),
      items: safeArray(t.raw("features.profile.items")),
    },
  ];

  const guides = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: t("guides.gettingStarted.title"),
      description: t("guides.gettingStarted.description"),
      href: "/help",
    },
    {
      icon: <User className="w-6 h-6" />,
      title: t("guides.account.title"),
      description: t("guides.account.description"),
      href: "/settings",
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: t("guides.billing.title"),
      description: t("guides.billing.description"),
      href: "/billing",
    },
  ];

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 selection:bg-blue-200 dark:bg-blue-800/80 selection:text-blue-900 dark:text-blue-100"
    >
      <Suspense
        fallback={
          <div className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm" />
        }
      >
        <Navbar />
      </Suspense>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/80 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-900/90"></div>

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-200/40 to-indigo-300/20 rounded-full filter blur-3xl opacity-50 mix-blend-multiply pointer-events-none transform translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-200/40 to-pink-300/20 rounded-full filter blur-3xl opacity-50 mix-blend-multiply pointer-events-none transform -translate-x-1/3 translate-y-1/4"></div>

        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="text-center"
          >
            <span className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md text-blue-700 dark:text-blue-300 text-sm font-semibold mb-8 border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50 shadow-sm uppercase tracking-wider">
              <BookOpen className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-blue-500 dark:text-blue-400" />
              {t("hero.badge")}
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-slate-100 mb-8 tracking-tight">
              {t("hero.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("hero.titleHighlight")}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
              {t("hero.subtitle")}
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto group relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl transition-all duration-300 group-hover:bg-blue-500/10"></div>
              <div className="relative flex items-center bg-white dark:bg-slate-900/95 backdrop-blur-lg border border-gray-200/60 dark:border-slate-800/80 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-blue-300/50 dark:border-blue-700 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500">
                <Search className="absolute left-6 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 dark:text-blue-400 transition-colors rtl:right-6 rtl:left-auto" />
                <input
                  type="text"
                  placeholder={t("hero.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 bg-transparent focus:outline-none text-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 rtl:pr-16 rtl:pl-6 rounded-2xl"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Navigation Sticky Bar */}
      <section className="sticky top-16 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto hide-scrollbar py-4 justify-start md:justify-center gap-2 md:gap-4">
            {[
              {
                id: "getting-started",
                label: t("navigation.gettingStarted"),
                icon: <LayoutGrid className="w-4 h-4 mr-2" />,
              },
              {
                id: "platforms",
                label: t("navigation.platforms"),
                icon: <BarChart3 className="w-4 h-4 mr-2" />,
              },
              {
                id: "features",
                label: t("navigation.features"),
                icon: <Shield className="w-4 h-4 mr-2" />,
              },
              {
                id: "guides",
                label: t("navigation.guides"),
                icon: <BookOpen className="w-4 h-4 mr-2" />,
              },
            ].map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveSection(id);
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex items-center whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
                  activeSection === id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "bg-gray-50 dark:bg-slate-900/60 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/60 dark:border-slate-800/80 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {icon}
                {label || id}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="pb-24">
        {/* Getting Started Section */}
        <section id="getting-started" className="py-24 scroll-mt-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 tracking-tight">
                {t("gettingStarted.title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("gettingStarted.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <BookOpen className="w-8 h-8" />,
                  title: t("gettingStarted.whatIs.title"),
                  description: t("gettingStarted.whatIs.description"),
                  color: "blue",
                },
                {
                  icon: <ArrowRight className="w-8 h-8" />,
                  title: t("gettingStarted.quickstart.title"),
                  description: t("gettingStarted.quickstart.description"),
                  color: "purple",
                },
                {
                  icon: <User className="w-8 h-8" />,
                  title: t("gettingStarted.accountSetup.title"),
                  description: t("gettingStarted.accountSetup.description"),
                  color: "green",
                },
              ].map((card, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`group relative bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 shadow-lg hover:shadow-2xl transition-all duration-500 p-8 ${getAccentStyle(card.color).hoverBorder}`}
                >
                  <div
                    className={`p-4 rounded-2xl ${getAccentStyle(card.color).softBg} w-fit mb-8 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-sm border ${getAccentStyle(card.color).softBorder}`}
                  >
                    <div className={`${getAccentStyle(card.color).text}`}>
                      {card.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 leading-relaxed text-lg">
                    {card.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Documentation Section */}
        <section
          id="platforms"
          className="py-24 bg-gray-50 dark:bg-slate-900/60 border-y border-gray-200/50 dark:border-slate-800/50 scroll-mt-32 relative overflow-hidden"
        >
          {/* Subtle decorative blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-blue-100/30 to-purple-100/30 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 tracking-tight">
                {t("platforms.title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("platforms.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {platforms.map((platform, index) => (
                <PlatformCard
                  key={index}
                  {...platform}
                  delay={index * 0.1}
                  exploreText={t("platforms.explore")}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section id="features" className="py-24 scroll-mt-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 tracking-tight">
                {t("features.title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("features.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} delay={index * 0.05} />
              ))}
            </div>
          </div>
        </section>

        {/* User Guides Section */}
        <section
          id="guides"
          className="py-24 bg-gray-50 dark:bg-slate-900/60 border-t border-gray-200/50 dark:border-slate-800/50 scroll-mt-32"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 tracking-tight">
                {t("guides.title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("guides.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {guides.map((guide, index) => (
                <GuideCard key={index} {...guide} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <FAQAccordion
          items={t.raw("faq.items") || []}
          title={t("faq.title")}
          subtitle={t("faq.subtitle")}
          searchable
          multiOpen
        />

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900"></div>
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-12 md:p-16 max-w-4xl mx-auto shadow-2xl"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
                {t("cta.title")}
              </h2>
              <p className="text-xl md:text-2xl text-blue-100 max-w-2xl mx-auto mb-10 font-light">
                {t("cta.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                <Link
                  href="/auth/signup"
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-2xl text-lg"
                >
                  {t("cta.primary")}{" "}
                  <ArrowRight className="w-5 h-5 ml-3 rtl:ml-0 rtl:mr-3 rtl:rotate-180" />
                </Link>
                <Link
                  href="/contact"
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white font-bold rounded-xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all text-lg"
                >
                  {t("cta.secondary")}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Suspense fallback={<div className="h-64" />}>
        <Footer />
      </Suspense>
    </div>
  );
}
