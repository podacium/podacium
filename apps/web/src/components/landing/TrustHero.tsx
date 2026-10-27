"use client";

import React from "react";
import { motion } from "framer-motion";
import { Brain, Play, Sparkles } from "lucide-react";
import { useTranslations, useLocale, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";

const Button = PodaciumButton;

const TrustHero: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const locale = useLocale();
  const { isRTL } = useBidi();
  const isArabic = locale === "ar";

  return (
    <section className="relative bg-white dark:bg-slate-900 pt-24 pb-8 lg:pt-32 lg:pb-10 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-50 dark:bg-blue-950/60 blur-[120px]" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] rounded-full bg-indigo-50 dark:bg-indigo-950/60 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[20%] w-[25%] h-[25%] rounded-full bg-emerald-50 dark:bg-emerald-950/60 blur-[80px]" />
        <div className="absolute inset-0 grid-light opacity-35" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-15 brightness-100 contrast-150" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <motion.div
            className={`flex-1 text-center lg:text-left ${isRTL ? "lg:text-right" : "lg:text-left"}`}
            initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 backdrop-blur-md border border-blue-100 dark:border-blue-900/50 mb-6 mx-auto lg:mx-0 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300 tracking-widest uppercase">
                {t("hero.benefits.noCreditCard")}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight mb-6 leading-[1.1]">
              <span className="block">{t("variation1.title.part1")}</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">
                {t("variation1.title.part2")}
              </span>
              <span className="block">{t("variation1.title.part3")}</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-500 dark:text-slate-400 max-w-2xl mb-8 leading-relaxed mx-auto lg:mx-0">
              {t("hero.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                variant="gradient"
                size="xl"
                href="/learn"
                className="font-bold"
                glow
              >
                {t("variation1.cta.startLearning")}
              </Button>
              <Button
                variant="outline"
                size="xl"
                onClick={() => {
                  const el = document.getElementById("explainer-video");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="font-bold bg-white dark:bg-slate-900/70 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 border-gray-200 dark:border-slate-800"
              >
                <Play className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                {t("variation1.cta.learnAboutUs")}
              </Button>
            </div>

            <div
              className={`mt-8 flex items-center justify-center lg:justify-start ${isRTL ? "space-x-reverse" : ""} space-x-6`}
            >
              <div
                className={`flex ${isRTL ? "space-x-reverse" : ""} -space-x-3`}
                aria-hidden="true"
              >
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-sm"
                  >
                    <span className="text-white text-xs font-bold">
                      {String.fromCharCode(64 + i)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                <span className="text-gray-900 dark:text-slate-100 font-bold font-mono">
                  {t("variation1.stats.builders")}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="flex-1 w-full max-w-xl"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <div className="relative">
              {/* Floating micro-badges */}
              <div
                className={`absolute -top-4 ${isRTL ? "-left-2" : "-right-2"} z-30 px-3.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-100 dark:border-indigo-900/50 shadow-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 animate-float-slow`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>{t("hero.aiEngineActive")}</span>
              </div>

              {/* Glassmorphic Dashboard UI Simulation */}
              <div className="bg-white dark:bg-slate-900/85 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 dark:border-slate-800/80 shadow-[0_32px_64px_-16px_rgba(79,70,229,0.14)] p-6 md:p-8 max-lg:[transform:none] lg:perspective-1000 lg:rotate-y-[-10deg] lg:rotate-x-[5deg] transition-all duration-500 hover:rotate-y-0 hover:rotate-x-0">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {t("hero.talentSignal")}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono tracking-wider">
                        ID_4829_SECURE
                      </div>
                    </div>
                  </div>
                  <div className="h-2 w-24 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(
                    (t.raw("hero.effectStats") as Array<{
                      label: string;
                      before: string;
                      after: string;
                      color: string;
                    }>) || []
                  ).map((stat, i) => (
                    <motion.div
                      key={i}
                      className="rounded-2xl p-4 flex items-center justify-between cursor-default overflow-hidden relative border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50"
                      initial="rest"
                      whileHover="hover"
                    >
                      {/* Splashtic Multi-Blob Background Expansion */}
                      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        {/* Primary Blob (Center) */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600"
                          variants={{
                            rest: {
                              clipPath: isRTL
                                ? "circle(0% at 100% 50%)"
                                : "circle(0% at 0% 50%)",
                            },
                            hover: {
                              clipPath: isRTL
                                ? "circle(150% at 90% 50%)"
                                : "circle(150% at 10% 50%)",
                            },
                          }}
                          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                        />
                        {/* Secondary Blob (Top-biased) */}
                        <motion.div
                          className="absolute inset-0 bg-blue-700/40"
                          variants={{
                            rest: {
                              clipPath: isRTL
                                ? "circle(0% at 100% 0%)"
                                : "circle(0% at 0% 0%)",
                            },
                            hover: {
                              clipPath: isRTL
                                ? "circle(120% at 85% 20%)"
                                : "circle(120% at 15% 20%)",
                            },
                          }}
                          transition={{
                            duration: 1.1,
                            delay: 0.1,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                        />
                        {/* Tertiary Blob (Bottom-biased) */}
                        <motion.div
                          className="absolute inset-0 bg-indigo-700/30"
                          variants={{
                            rest: {
                              clipPath: isRTL
                                ? "circle(0% at 100% 100%)"
                                : "circle(0% at 0% 100%)",
                            },
                            hover: {
                              clipPath: isRTL
                                ? "circle(120% at 85% 80%)"
                                : "circle(120% at 15% 80%)",
                            },
                          }}
                          transition={{
                            duration: 1.2,
                            delay: 0.2,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                        />
                      </div>

                      <motion.span
                        className="text-xs font-semibold relative z-10"
                        variants={{
                          rest: { color: "rgb(107, 114, 128)" }, // gray-500
                          hover: { color: "rgb(255, 255, 255)" },
                        }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                      >
                        {stat.label}
                      </motion.span>

                      <div className="relative h-5 overflow-hidden z-20">
                        <motion.span
                          className="text-sm font-bold block"
                          variants={{
                            rest: {
                              y: 0,
                              opacity: 1,
                              color: stat.color.includes("emerald")
                                ? "#10b981"
                                : stat.color.includes("blue")
                                  ? "#3b82f6"
                                  : "#6366f1",
                            },
                            hover: {
                              y: -20,
                              opacity: 0,
                              color: "rgb(255, 255, 255)",
                            },
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                        >
                          {stat.before}
                        </motion.span>
                        <motion.span
                          className="text-sm font-bold block absolute top-full left-0 right-0 text-right text-white"
                          variants={{
                            rest: { y: 0, opacity: 0 },
                            hover: { y: -20, opacity: 1 },
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                        >
                          {stat.after}
                        </motion.span>
                      </div>

                      {/* Subtle liquid highlight */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 pointer-events-none z-30"
                        variants={{
                          rest: { opacity: 0 },
                          hover: { opacity: 1 },
                        }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div
                        key={i}
                        className="h-8 rounded-lg bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-600/10 blur-3xl rounded-full" />
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full" />
            </div>
          </motion.div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-slate-800">
          <p className="text-center text-[10px] font-black tracking-[0.2em] text-gray-500 dark:text-slate-400 uppercase mb-5">
            {t("hero.pillars.title")}
          </p>
          <div className="flex flex-wrap justify-center lg:justify-between items-center gap-x-8 gap-y-3">
            {[
              {
                key: "learning",
                label: t("hero.pillars.learning"),
                dot: "bg-blue-500",
              },
              {
                key: "freelancing",
                label: t("hero.pillars.freelancing"),
                dot: "bg-indigo-500",
              },
              {
                key: "bi",
                label: t("hero.pillars.bi"),
                dot: "bg-emerald-500",
              },
              {
                key: "hub",
                label: t("hero.pillars.hub"),
                dot: "bg-purple-500",
              },
            ].map((pillar) => (
              <div
                key={pillar.key}
                className="flex items-center gap-2 text-gray-700 dark:text-slate-300 text-sm font-semibold"
              >
                <span className={`w-2 h-2 rounded-full ${pillar.dot}`} />
                <span>{pillar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

TrustHero.displayName = "TrustHero";

export default TrustHero;
