// apps/web/src/app/about/_components/AboutJourney.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Rocket,
  Code,
  Globe,
  TrendingUp,
  Check,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Linkedin,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import type { JourneyMilestone } from "../types";

export const AboutJourney: React.FC = () => {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const shouldReduceMotion = useReducedMotion();

  const milestones: (JourneyMilestone & {
    icon: React.ReactNode;
    theme: {
      topHairline: string;
      glowColor: string;
      iconGradient: string;
      badgeStyle: string;
      bulletStyle: string;
      cardBorder: string;
      watermarkColor: string;
      subtitleColor: string;
    };
  })[] = [
    {
      id: 1,
      year: t("about.journey.milestones.0.year"),
      title: t("about.journey.milestones.0.title"),
      subtitle: t("about.journey.milestones.0.subtitle"),
      description: t("about.journey.milestones.0.description"),
      status: "completed",
      tags: [
        t("about.journey.milestones.0.tags.0"),
        t("about.journey.milestones.0.tags.1"),
        t("about.journey.milestones.0.tags.2"),
      ],
      icon: <Rocket className="w-6 h-6" />,
      theme: {
        topHairline: "from-teal-500 via-emerald-500 to-cyan-500",
        glowColor: "bg-emerald-500/20 dark:bg-emerald-500/15",
        iconGradient:
          "bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-md shadow-emerald-500/25",
        badgeStyle:
          "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60",
        bulletStyle:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
        cardBorder:
          "border-slate-200/90 hover:border-emerald-300/80 dark:border-slate-800/90 dark:hover:border-emerald-500/40",
        watermarkColor: "text-emerald-600/10 dark:text-emerald-400/10",
        subtitleColor: "text-teal-600 dark:text-teal-400",
      },
    },
    {
      id: 2,
      year: t("about.journey.milestones.1.year"),
      title: t("about.journey.milestones.1.title"),
      subtitle: t("about.journey.milestones.1.subtitle"),
      description: t("about.journey.milestones.1.description"),
      status: "completed",
      tags: [
        t("about.journey.milestones.1.tags.0"),
        t("about.journey.milestones.1.tags.1"),
        t("about.journey.milestones.1.tags.2"),
      ],
      icon: <Code className="w-6 h-6" />,
      theme: {
        topHairline: "from-blue-500 via-sky-500 to-indigo-500",
        glowColor: "bg-blue-500/20 dark:bg-blue-500/15",
        iconGradient:
          "bg-gradient-to-br from-blue-600 to-sky-600 text-white shadow-md shadow-blue-500/25",
        badgeStyle:
          "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60",
        bulletStyle:
          "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
        cardBorder:
          "border-slate-200/90 hover:border-blue-300/80 dark:border-slate-800/90 dark:hover:border-blue-500/40",
        watermarkColor: "text-blue-600/10 dark:text-blue-400/10",
        subtitleColor: "text-blue-600 dark:text-blue-400",
      },
    },
    {
      id: 3,
      year: t("about.journey.milestones.2.year"),
      title: t("about.journey.milestones.2.title"),
      subtitle: t("about.journey.milestones.2.subtitle"),
      description: t("about.journey.milestones.2.description"),
      status: "current",
      tags: [
        t("about.journey.milestones.2.tags.0"),
        t("about.journey.milestones.2.tags.1"),
        t("about.journey.milestones.2.tags.2"),
      ],
      icon: <TrendingUp className="w-6 h-6" />,
      theme: {
        topHairline: "from-blue-600 via-indigo-600 to-purple-600",
        glowColor: "bg-indigo-500/30 dark:bg-indigo-500/25",
        iconGradient:
          "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/35",
        badgeStyle:
          "bg-indigo-50 text-indigo-700 border-indigo-200/90 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/80 font-bold shadow-sm",
        bulletStyle:
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
        cardBorder:
          "border-2 border-indigo-400/80 dark:border-indigo-500/70 shadow-[0_16px_45px_rgba(79,70,229,0.12)] dark:shadow-[0_16px_45px_rgba(79,70,229,0.4)] ring-4 ring-indigo-500/10 dark:ring-indigo-500/20",
        watermarkColor: "text-indigo-600/15 dark:text-indigo-400/20",
        subtitleColor: "text-indigo-600 dark:text-indigo-400",
      },
    },
    {
      id: 4,
      year: t("about.journey.milestones.3.year"),
      title: t("about.journey.milestones.3.title"),
      subtitle: t("about.journey.milestones.3.subtitle"),
      description: t("about.journey.milestones.3.description"),
      status: "upcoming",
      tags: [
        t("about.journey.milestones.3.tags.0"),
        t("about.journey.milestones.3.tags.1"),
        t("about.journey.milestones.3.tags.2"),
      ],
      icon: <Globe className="w-6 h-6" />,
      theme: {
        topHairline: "from-purple-500 via-pink-500 to-rose-500",
        glowColor: "bg-purple-500/20 dark:bg-purple-500/15",
        iconGradient:
          "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/25",
        badgeStyle:
          "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60",
        bulletStyle:
          "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300",
        cardBorder:
          "border-slate-200/90 hover:border-purple-300/80 dark:border-slate-800/90 dark:hover:border-purple-500/40",
        watermarkColor: "text-purple-600/10 dark:text-purple-400/10",
        subtitleColor: "text-purple-600 dark:text-purple-400",
      },
    },
  ];

  return (
    <section
      id="about-journey"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden border-t border-border/40"
      dir={dir}
      aria-labelledby="about-journey-title"
    >
      {/* Subtle ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-full blur-3xl opacity-70"
      />

      <div className="max-w-5xl mx-auto space-y-16 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="gradient"
            className="px-3.5 py-1 text-xs font-semibold"
          >
            {t("about.journey.badge")}
          </PodaciumBadge>

          <h2
            id="about-journey-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
          >
            {t("about.journey.title")}
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("about.journey.subtitle")}
          </p>
        </div>

        {/* Timeline List with Gradient Spine */}
        <ol
          className="relative space-y-10 sm:space-y-14 before:absolute before:inset-0 before:start-6 before:md:start-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-gradient-to-b before:from-teal-500/40 before:via-indigo-500/60 before:to-purple-500/40"
          aria-label={t("about.journey.timelineAria")}
        >
          {milestones.map((milestone, idx) => {
            const isCurrent = milestone.status === "current";
            const isCompleted = milestone.status === "completed";
            const isEven = idx % 2 === 0;

            const statusLabel = isCurrent
              ? t("about.journey.status.current")
              : isCompleted
                ? t("about.journey.status.completed")
                : t("about.journey.status.upcoming");

            return (
              <li
                key={milestone.id}
                aria-current={isCurrent ? "step" : undefined}
                className={`relative flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 ${
                  isEven ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Center Node Marker */}
                <div
                  className={`absolute start-6 md:start-1/2 -translate-x-1/2 w-12 h-12 rounded-2xl flex items-center justify-center z-20 shadow-lg transition-transform duration-300 ${
                    isCurrent
                      ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/40 scale-110 ring-4 ring-indigo-500/25"
                      : isCompleted
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/60 shadow-emerald-500/20"
                        : "bg-white dark:bg-slate-900 text-purple-500 dark:text-purple-400 border-2 border-purple-400/60 shadow-purple-500/20"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : isCurrent ? (
                    <Clock className="w-6 h-6 animate-pulse" />
                  ) : (
                    milestone.icon
                  )}
                </div>

                {/* Content Card */}
                <div className="w-full md:w-[calc(50%-3rem)] ps-16 md:ps-0">
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 24 }
                    }
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: idx * 0.08 }}
                  >
                    <div
                      className={`group relative w-full flex flex-col justify-between p-7 sm:p-9 rounded-3xl overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border ${milestone.theme.cardBorder} shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_22px_50px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_22px_50px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5`}
                    >
                      {/* Top Hairline Gradient Accent */}
                      <div
                        aria-hidden="true"
                        className={`absolute top-0 inset-x-0 ${
                          isCurrent ? "h-1.5" : "h-1"
                        } bg-gradient-to-r ${milestone.theme.topHairline} opacity-95`}
                      />

                      {/* Ambient Glow Orb */}
                      <div
                        aria-hidden="true"
                        className={`absolute -top-16 -end-16 w-44 h-44 rounded-full ${milestone.theme.glowColor} blur-3xl pointer-events-none opacity-40 dark:opacity-20 group-hover:opacity-75 transition-opacity duration-500`}
                      />

                      {/* Decorative Watermark Year */}
                      <span
                        aria-hidden="true"
                        className={`absolute top-6 end-7 text-3xl sm:text-4xl font-black font-mono select-none ${milestone.theme.watermarkColor} transition-transform duration-300 group-hover:scale-105 pointer-events-none`}
                      >
                        {milestone.year}
                      </span>

                      <div className="space-y-6 relative z-10">
                        {/* Icon & Status Badge Row */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${milestone.theme.iconGradient} transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2`}
                          >
                            {milestone.icon}
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${milestone.theme.badgeStyle}`}
                          >
                            {isCurrent ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 dark:bg-indigo-400" />
                              </span>
                            ) : isCompleted ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            )}
                            <span>{statusLabel}</span>
                          </span>
                        </div>

                        {/* Title & Subtitle */}
                        <div className="space-y-1.5">
                          <p
                            className={`text-xs font-bold uppercase tracking-wider ${milestone.theme.subtitleColor}`}
                          >
                            {milestone.subtitle}
                          </p>
                          <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                            {milestone.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                            {milestone.description}
                          </p>
                        </div>

                        {/* Deliverables / Highlights List */}
                        <ul
                          className="space-y-2.5 pt-2"
                          aria-label={t("common.uiLabels.deliverablesAria", {
                            title: milestone.title,
                          })}
                        >
                          {milestone.tags.map((tag, tIdx) => (
                            <li
                              key={tIdx}
                              className="flex items-center gap-3 text-xs sm:text-sm text-foreground/90"
                            >
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${milestone.theme.bulletStyle}`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                              <span className="font-semibold leading-relaxed">
                                {tag}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Active Milestone Interactive CTA */}
                      {isCurrent && (
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 mt-6 relative z-10">
                          <Link href="/hub" className="block w-full">
                            <button
                              type="button"
                              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 group/btn"
                            >
                              <span>{t("about.journey.exploreActive")}</span>
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
                      )}
                    </div>
                  </motion.div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* LinkedIn Company Journey Updates */}
        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground">
            {t("about.journey.changelogNotice")}{" "}
            <a
              href="https://www.linkedin.com/company/podacium?originalSubdomain=dz"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 py-0.5"
            >
              <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
              <span>{t("about.journey.changelogLink")}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
