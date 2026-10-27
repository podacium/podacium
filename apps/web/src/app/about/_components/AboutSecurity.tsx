// apps/web/src/app/about/_components/AboutSecurity.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Lock, UserCheck } from "lucide-react";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import type { SecurityPillar } from "../types";

export const AboutSecurity: React.FC = () => {
  const t = useTranslations();
  const { dir } = useBidi();
  const shouldReduceMotion = useReducedMotion();

  const securityPillars: (SecurityPillar & {
    icon: React.ReactNode;
    color: string;
  })[] = [
    {
      id: "escrow",
      title: t("about.security.escrow.title"),
      badge: t("about.security.escrow.badge"),
      description: t("about.security.escrow.description"),
      iconName: "shield",
      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      icon: <ShieldCheck className="w-6 h-6" />,
    },
    {
      id: "verification",
      title: t("about.security.verification.title"),
      badge: t("about.security.verification.badge"),
      description: t("about.security.verification.description"),
      iconName: "award",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      icon: <UserCheck className="w-6 h-6" />,
    },
    {
      id: "privacy",
      title: t("about.security.privacy.title"),
      badge: t("about.security.privacy.badge"),
      description: t("about.security.privacy.description"),
      iconName: "lock",
      color: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      icon: <Lock className="w-6 h-6" />,
    },
  ];

  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30 dark:bg-slate-900/30 border-t border-border"
      dir={dir}
      aria-labelledby="about-security-title"
    >
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="outline"
            className="px-3 py-1 text-xs font-semibold"
          >
            {t("about.security.badge")}
          </PodaciumBadge>

          <h2
            id="about-security-title"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          >
            {t("about.security.title")}
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {t("about.security.subtitle")}
          </p>
        </div>

        {/* 3-Column Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {securityPillars.map((pillar, idx) => (
            <motion.div
              key={pillar.id}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }
              }
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="h-full"
            >
              <PodaciumCard
                variant="elevated"
                hover
                className="p-7 h-full flex flex-col justify-between bg-card border-border/80"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${pillar.color}`}>
                      {pillar.icon}
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    {pillar.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </PodaciumCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
