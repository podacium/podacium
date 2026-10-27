// apps/web/src/app/about/_components/AboutTeam.tsx
"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  Users,
  GraduationCap,
  ChevronRight,
  ArrowUpRight,
  Linkedin,
} from "lucide-react";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { useTranslations, useBidi } from "@/lib/i18n";
import { AboutTeamModal } from "./AboutTeamModal";
import type { FounderProfile } from "../types";

export const AboutTeam: React.FC = () => {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const shouldReduceMotion = useReducedMotion();
  const [selectedFounder, setSelectedFounder] = useState<FounderProfile | null>(
    null,
  );

  const founders: (FounderProfile & {
    topHairline: string;
    glowColor: string;
  })[] = [
    {
      id: 1,
      name: t("about.team.founders.0.name"),
      role: t("about.team.founders.0.role"),
      bio: t("about.team.founders.0.bio"),
      avatarInitials: "ZR",
      avatarGradient: "bg-gradient-to-tr from-blue-600 to-indigo-600",
      accentColor: "blue",
      photoUrl: "/images/team/zakarya-roubhi.jpg",
      linkedinUrl: "https://www.linkedin.com/in/zakaryaroubhi/",
      topHairline: "from-blue-500 via-indigo-500 to-cyan-500",
      glowColor: "bg-blue-500/10 dark:bg-blue-500/20",
      parcours: {
        education: [t("about.team.founders.0.parcours.education.0")],
        highlights: [
          t("about.team.founders.0.parcours.highlights.0"),
          t("about.team.founders.0.parcours.highlights.1"),
          t("about.team.founders.0.parcours.highlights.2"),
          t("about.team.founders.0.parcours.highlights.3"),
        ],
      },
    },
    {
      id: 2,
      name: t("about.team.founders.1.name"),
      role: t("about.team.founders.1.role"),
      bio: t("about.team.founders.1.bio"),
      avatarInitials: "MH",
      avatarGradient: "bg-gradient-to-tr from-emerald-600 to-teal-600",
      accentColor: "green",
      photoUrl: "/images/team/mohamed-redha-habib.jpg",
      linkedinUrl: "https://www.linkedin.com/in/mohamed-redha-habib-7885962a3/",
      topHairline: "from-emerald-500 via-teal-500 to-green-500",
      glowColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
      parcours: {
        education: [t("about.team.founders.1.parcours.education.0")],
        highlights: [
          t("about.team.founders.1.parcours.highlights.0"),
          t("about.team.founders.1.parcours.highlights.1"),
          t("about.team.founders.1.parcours.highlights.2"),
          t("about.team.founders.1.parcours.highlights.3"),
        ],
      },
    },
    {
      id: 3,
      name: t("about.team.founders.2.name"),
      role: t("about.team.founders.2.role"),
      bio: t("about.team.founders.2.bio"),
      avatarInitials: "AM",
      avatarGradient: "bg-gradient-to-tr from-purple-600 to-pink-600",
      accentColor: "purple",
      photoUrl: "/images/team/ahmed-merhab.jpg",
      linkedinUrl: "https://www.linkedin.com/in/ahmed-merhab-60b04a336/",
      topHairline: "from-purple-500 via-pink-500 to-indigo-500",
      glowColor: "bg-purple-500/10 dark:bg-purple-500/20",
      parcours: {
        education: [t("about.team.founders.2.parcours.education.0")],
        highlights: [
          t("about.team.founders.2.parcours.highlights.0"),
          t("about.team.founders.2.parcours.highlights.1"),
          t("about.team.founders.2.parcours.highlights.2"),
          t("about.team.founders.2.parcours.highlights.3"),
        ],
      },
    },
  ];

  return (
    <section
      id="about-team"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden"
      dir={dir}
      aria-labelledby="about-team-title"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="gradient"
            className="px-3.5 py-1 text-xs font-semibold"
          >
            <Users className="w-3.5 h-3.5 me-1.5 inline-block" />
            <span>{t("about.team.header.badge")}</span>
          </PodaciumBadge>

          <h2
            id="about-team-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground"
          >
            {t("about.team.header.title")}
          </h2>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("about.team.header.description")}
          </p>
        </div>

        {/* 3 Founder Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {founders.map((founder, idx) => (
            <motion.div
              key={founder.id}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 30 }
              }
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="h-full flex"
            >
              <div className="relative rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] p-6 sm:p-7 flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 group overflow-hidden w-full h-full">
                {/* Top Hairline Gradient Accent */}
                <div
                  className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${founder.topHairline}`}
                  aria-hidden="true"
                />

                {/* Ambient Radial Glow Orb on hover */}
                <div
                  className={`absolute -top-12 -end-12 w-36 h-36 rounded-full blur-3xl ${founder.glowColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                  aria-hidden="true"
                />

                <div className="space-y-5 relative z-10">
                  {/* Photo & LinkedIn Action Row */}
                  <div className="flex items-start justify-between gap-4">
                    {founder.photoUrl ? (
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-md border-2 border-white dark:border-slate-800 ring-1 ring-slate-200/90 dark:ring-slate-700/90 group-hover:scale-105 transition-transform duration-300 flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={founder.photoUrl}
                          alt={founder.name}
                          width={112}
                          height={112}
                          priority
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md group-hover:scale-105 transition-transform duration-300 ${founder.avatarGradient} flex-shrink-0`}
                      >
                        {founder.avatarInitials}
                      </div>
                    )}

                    {founder.linkedinUrl && (
                      <a
                        href={founder.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] dark:text-[#70B5F9] border border-[#0A66C2]/20 transition-all hover:scale-105 shadow-sm"
                        aria-label={t("about.team.linkedInProfile", {
                          name: founder.name,
                        })}
                      >
                        <Linkedin className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">LinkedIn</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Name & Role */}
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {founder.name}
                    </h3>
                    <p className="text-xs sm:text-sm font-semibold text-primary line-clamp-1">
                      {founder.role}
                    </p>
                  </div>

                  {/* Academic Credential */}
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 font-medium w-fit">
                    <GraduationCap className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">
                      {t("about.team.labels.hseAlum")}
                    </span>
                  </div>

                  {/* Bio Excerpt */}
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {founder.bio}
                  </p>
                </div>

                {/* View Details Button */}
                <div className="pt-4 mt-6 border-t border-slate-200/80 dark:border-slate-800/80 relative z-10">
                  <PodaciumButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFounder(founder)}
                    className="w-full justify-between text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl"
                  >
                    <span>{t("about.team.labels.viewParcours")}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isRTL ? "rotate-180" : ""
                      }`}
                    />
                  </PodaciumButton>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <AboutTeamModal
        founder={selectedFounder}
        isOpen={Boolean(selectedFounder)}
        onClose={() => setSelectedFounder(null)}
      />
    </section>
  );
};
