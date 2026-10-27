// apps/web/src/app/about/_components/AboutFlywheel.tsx
"use client";

import React, { useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  ChartNoAxesCombined,
  Check,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumSpotlightCard } from "@/components/design-system/PodaciumSpotlightCard";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useOptionalAuth } from "@/hooks/useAuth";
import type { EcosystemPillar } from "../types";

export const AboutFlywheel: React.FC = () => {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<
    "all" | "learn" | "earn" | "scale"
  >("all");
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;

  const pillars: EcosystemPillar[] = [
    {
      id: "learn",
      number: "01",
      title: t("about.flywheel.learn.title"),
      badge: t("about.flywheel.learn.badge"),
      description: t("about.flywheel.learn.description"),
      features: [
        t("about.flywheel.learn.features.0"),
        t("about.flywheel.learn.features.1"),
        t("about.flywheel.learn.features.2"),
      ],
      color: "text-blue-600 dark:text-blue-400",
      accentBg: "bg-blue-500/10 dark:bg-blue-400/10",
      borderColor: "hover:border-blue-400 dark:hover:border-blue-500/50",
      gradient: "from-blue-500/10 to-transparent",
      ctaText: t("about.flywheel.learn.ctaText"),
      ctaLink: "/learn",
      iconName: "book",
      topHairline: "from-blue-500 via-indigo-500 to-cyan-400",
      glowColor: "bg-blue-500/20 dark:bg-blue-500/15",
      iconGradient:
        "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25",
      badgeStyle:
        "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
      bulletStyle:
        "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
      ctaStyle:
        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30",
      cardBorder:
        "border-slate-200/90 hover:border-blue-300/80 dark:border-slate-800/90 dark:hover:border-blue-500/40",
      watermarkColor: "text-blue-600/10 dark:text-blue-400/10",
    },
    {
      id: "earn",
      number: "02",
      title: t("about.flywheel.earn.title"),
      badge: t("about.flywheel.earn.badge"),
      description: t("about.flywheel.earn.description"),
      features: [
        t("about.flywheel.earn.features.0"),
        t("about.flywheel.earn.features.1"),
        t("about.flywheel.earn.features.2"),
      ],
      color: "text-indigo-600 dark:text-indigo-400",
      accentBg: "bg-indigo-500/10 dark:bg-indigo-400/10",
      borderColor: "hover:border-indigo-400 dark:hover:border-indigo-500/50",
      gradient: "from-indigo-500/10 to-transparent",
      ctaText: t("about.flywheel.earn.ctaText"),
      ctaLink: "/hub",
      iconName: "briefcase",
      topHairline: "from-indigo-500 via-purple-500 to-indigo-600",
      glowColor: "bg-indigo-500/20 dark:bg-indigo-500/15",
      iconGradient:
        "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25",
      badgeStyle:
        "bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60",
      bulletStyle:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
      ctaStyle:
        "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30",
      cardBorder:
        "border-slate-200/90 hover:border-indigo-300/80 dark:border-slate-800/90 dark:hover:border-indigo-500/40",
      watermarkColor: "text-indigo-600/10 dark:text-indigo-400/10",
    },
    {
      id: "scale",
      number: "03",
      title: t("about.flywheel.scale.title"),
      badge: t("about.flywheel.scale.badge"),
      description: t("about.flywheel.scale.description"),
      features: [
        t("about.flywheel.scale.features.0"),
        t("about.flywheel.scale.features.1"),
        t("about.flywheel.scale.features.2"),
      ],
      color: "text-purple-600 dark:text-purple-400",
      accentBg: "bg-purple-500/10 dark:bg-purple-400/10",
      borderColor: "hover:border-purple-400 dark:hover:border-purple-500/50",
      gradient: "from-purple-500/10 to-transparent",
      ctaText: t("about.flywheel.scale.ctaText"),
      ctaLink: "/bi",
      iconName: "chart",
      topHairline: "from-purple-500 via-pink-500 to-indigo-500",
      glowColor: "bg-purple-500/20 dark:bg-purple-500/15",
      iconGradient:
        "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25",
      badgeStyle:
        "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60",
      bulletStyle:
        "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300",
      ctaStyle:
        "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30",
      cardBorder:
        "border-slate-200/90 hover:border-purple-300/80 dark:border-slate-800/90 dark:hover:border-purple-500/40",
      watermarkColor: "text-purple-600/10 dark:text-purple-400/10",
    },
  ];

  const filteredPillars =
    activeTab === "all" ? pillars : pillars.filter((p) => p.id === activeTab);

  const getPillarIcon = (name: string) => {
    switch (name) {
      case "book":
        return <BookOpen className="w-6 h-6" />;
      case "briefcase":
        return <Briefcase className="w-6 h-6" />;
      case "chart":
        return <ChartNoAxesCombined className="w-6 h-6" />;
      default:
        return <Sparkles className="w-6 h-6" />;
    }
  };

  return (
    <section
      id="about-flywheel"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden"
      dir={dir}
      aria-labelledby="about-flywheel-title"
    >
      {/* Subtle ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-full blur-3xl opacity-70"
      />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="gradient"
            className="px-3.5 py-1 text-xs font-semibold"
          >
            {t("about.flywheel.badge")}
          </PodaciumBadge>

          <h2
            id="about-flywheel-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
          >
            {t("about.flywheel.title")}
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("about.flywheel.subtitle")}
          </p>
        </div>

        {/* Persona Perspective Tabs */}
        <div className="flex justify-center">
          <div
            role="tablist"
            aria-label={t("about.flywheel.filtersAria")}
            className="inline-flex p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-inner max-w-full overflow-x-auto"
          >
            {[
              {
                id: "all",
                label: t("about.flywheel.tabs.all"),
              },
              {
                id: "learn",
                label: t("about.flywheel.tabs.learn"),
              },
              {
                id: "earn",
                label: t("about.flywheel.tabs.earn"),
              },
              {
                id: "scale",
                label: t("about.flywheel.tabs.scale"),
              },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs sm:text-sm rounded-xl transition-all duration-200 whitespace-nowrap min-h-[40px] ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-800 text-foreground dark:text-white shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-slate-200 font-medium"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pillars Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredPillars.map((pillar, idx) => (
              <motion.div
                key={pillar.id}
                layout
                initial={
                  shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="h-full flex"
              >
                <div
                  className={`group relative w-full h-full flex flex-col justify-between p-7 sm:p-9 rounded-3xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border ${pillar.cardBorder} shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_22px_50px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_22px_50px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5`}
                >
                  {/* Top Hairline Gradient Accent */}
                  <div
                    aria-hidden="true"
                    className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${pillar.topHairline} opacity-90`}
                  />

                  {/* Ambient Glow Orb */}
                  <div
                    aria-hidden="true"
                    className={`absolute -top-16 -end-16 w-44 h-44 rounded-full ${pillar.glowColor} blur-3xl pointer-events-none opacity-40 dark:opacity-20 group-hover:opacity-75 transition-opacity duration-500`}
                  />

                  {/* Decorative Watermark Number */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-5 end-7 text-4xl font-black font-mono select-none ${pillar.watermarkColor} transition-transform duration-300 group-hover:scale-110`}
                  >
                    {pillar.number}
                  </span>

                  <div className="space-y-6 relative z-10">
                    {/* Icon & Badge Row */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pillar.iconGradient} transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2`}
                      >
                        {getPillarIcon(pillar.iconName)}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${pillar.badgeStyle}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        <span>{pillar.badge}</span>
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-2.5">
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                        {pillar.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>

                    {/* Features List */}
                    <ul
                      className="space-y-3 pt-2"
                      aria-label={t("common.uiLabels.featuresAria", {
                        title: pillar.title,
                      })}
                    >
                      {pillar.features.map((feature, fIdx) => (
                        <li
                          key={fIdx}
                          className="flex items-start gap-3 text-xs sm:text-sm text-foreground/90"
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${pillar.bulletStyle}`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <span className="leading-relaxed font-medium">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pillar CTA Full-Width Button */}
                  <div className="pt-8 border-t border-slate-100 dark:border-slate-800/80 mt-6 relative z-10">
                    <Link href={pillar.ctaLink} className="block w-full">
                      <button
                        type="button"
                        className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 group/btn cursor-pointer ${pillar.ctaStyle}`}
                      >
                        <span>{pillar.ctaText}</span>
                        <ArrowRight
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isRTL
                              ? "group-hover/btn:-translate-x-1"
                              : "group-hover/btn:translate-x-1"
                          }`}
                        />
                      </button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Circular Integration Flow Callout */}
        <PodaciumSpotlightCard
          tone="brand"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          contentClassName="p-7 sm:p-9"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-6 h-6 animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base sm:text-lg text-white">
                  {t("about.flywheel.closedLoopTitle")}
                </h4>
                <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-3xl">
                  {t("about.flywheel.loopDescription")}
                </p>
              </div>
            </div>

            <Link
              href={isAuthenticated ? "/dashboard" : "/auth/signup"}
              className="flex-shrink-0 w-full sm:w-auto"
            >
              <PodaciumButton
                variant="secondary"
                size="default"
                className="w-full sm:w-auto font-semibold bg-white text-blue-700 hover:bg-white/90"
              >
                <span>
                  {isAuthenticated
                    ? t("about.cta.buttons.dashboard")
                    : t("about.cta.buttons.signup")}
                </span>
                <ArrowUpRight className="w-4 h-4 ms-1.5" />
              </PodaciumButton>
            </Link>
          </div>
        </PodaciumSpotlightCard>
      </div>
    </section>
  );
};
