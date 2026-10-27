// apps/web/src/app/about/_components/AboutHero.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Sparkles, ArrowDown, ArrowUpRight } from "lucide-react";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useOptionalAuth } from "@/hooks/useAuth";

export const AboutHero: React.FC = () => {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const shouldReduceMotion = useReducedMotion();
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;

  const handleScrollToStory = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById("about-flywheel");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative pt-28 pb-16 lg:pt-36 lg:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
      dir={dir}
      aria-labelledby="about-hero-title"
    >
      {/* Background ambient mesh */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-indigo-50/30 to-transparent dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 start-1/2 -translate-x-1/2 w-[600px] h-[320px] bg-gradient-to-tr from-blue-400/15 to-indigo-500/15 dark:from-blue-600/10 dark:to-indigo-500/10 blur-[100px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto text-center space-y-8">
        {/* Badge */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center"
        >
          <PodaciumBadge
            variant="gradient"
            className="px-4 py-1.5 text-xs sm:text-sm font-semibold shadow-sm inline-flex items-center gap-2"
          >
            <Sparkles
              className="w-3.5 h-3.5 flex-shrink-0 animate-pulse"
              aria-hidden="true"
            />
            <span>{t("about.hero.badge")}</span>
          </PodaciumBadge>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          id="about-hero-title"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.12]"
        >
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {t("about.hero.title")}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
        >
          {t("about.hero.description")}
        </motion.p>

        {/* Primary CTA Buttons */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link
            href={isAuthenticated ? "/dashboard" : "/auth/signup"}
            className="w-full sm:w-auto"
          >
            <PodaciumButton
              variant="gradient"
              size="lg"
              glow
              className="w-full sm:w-auto min-h-[48px] px-8 text-base shadow-lg hover:shadow-xl group"
            >
              <span>
                {isAuthenticated
                  ? t("about.cta.buttons.dashboard")
                  : t("about.hero.buttons.explorePlatform")}
              </span>
              <ArrowUpRight
                className={`w-4 h-4 ms-2 transition-transform duration-300 ${
                  isRTL
                    ? "group-hover:-translate-x-1"
                    : "group-hover:translate-x-1"
                } group-hover:-translate-y-1`}
                aria-hidden="true"
              />
            </PodaciumButton>
          </Link>

          <a
            href="#about-flywheel"
            onClick={handleScrollToStory}
            className="w-full sm:w-auto"
          >
            <PodaciumButton
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-h-[48px] px-8 text-base border-border hover:bg-muted/80 transition-colors duration-300"
            >
              <span>{t("about.hero.buttons.originStory")}</span>
              <ArrowDown
                className="w-4 h-4 ms-2 animate-bounce"
                aria-hidden="true"
              />
            </PodaciumButton>
          </a>
        </motion.div>

        {/* Founder Quote */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pt-6"
        >
          <blockquote className="text-base sm:text-lg font-medium italic text-muted-foreground">
            {t("about.hero.quote")}
          </blockquote>
        </motion.div>
      </div>
    </section>
  );
};
