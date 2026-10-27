// apps/web/src/app/about/_components/AboutVision.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Building2, Heart, TrendingUp } from "lucide-react";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import type { VisionTarget } from "../types";

export const AboutVision: React.FC = () => {
  const t = useTranslations();
  const { dir } = useBidi();
  const shouldReduceMotion = useReducedMotion();

  const targets: (VisionTarget & { icon: React.ReactNode })[] = [
    {
      id: 1,
      value: t("about.vision.targets.0.value"),
      label: t("about.vision.targets.0.label"),
      detail: t("about.vision.targets.0.detail"),
      color: "blue",
      icon: <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
    },
    {
      id: 2,
      value: t("about.vision.targets.1.value"),
      label: t("about.vision.targets.1.label"),
      detail: t("about.vision.targets.1.detail"),
      color: "green",
      icon: (
        <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
      ),
    },
    {
      id: 3,
      value: t("about.vision.targets.2.value"),
      label: t("about.vision.targets.2.label"),
      detail: t("about.vision.targets.2.detail"),
      color: "purple",
      icon: <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
    },
    {
      id: 4,
      value: t("about.vision.targets.3.value"),
      label: t("about.vision.targets.3.label"),
      detail: t("about.vision.targets.3.detail"),
      color: "indigo",
      icon: (
        <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
      ),
    },
  ];

  return (
    <section
      id="about-vision"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden border-t border-border"
      dir={dir}
      aria-labelledby="about-vision-title"
    >
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="gradient"
            className="px-3.5 py-1 text-xs font-semibold"
          >
            {t("about.vision.badge")}
          </PodaciumBadge>

          <h2
            id="about-vision-title"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          >
            {t("about.vision.title")}
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {t("about.vision.subtitle")}
          </p>
        </div>

        {/* 4 Targets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {targets.map((target, idx) => (
            <motion.div
              key={target.id}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95 }
              }
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="h-full"
            >
              <PodaciumCard
                variant="elevated"
                hover
                className="p-6 text-center h-full flex flex-col justify-between bg-card border-border/80"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                    {target.icon}
                  </div>

                  <div>
                    <span className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
                      {target.value}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-foreground mt-1">
                      {target.label}
                    </h3>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {target.detail}
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
