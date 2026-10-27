"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Brain,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";

const Button = PodaciumButton;

const EducationLayer: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const { isRTL } = useBidi();
  const isArabic = isRTL;

  const educationFeatures = [
    {
      title: t("layers.education.features.micro.title"),
      desc: t("layers.education.features.micro.desc"),
      icon: <PlayCircle className="w-5 h-5" />,
    },
    {
      title: t("layers.education.features.paths.title"),
      desc: t("layers.education.features.paths.desc"),
      icon: <ChevronRight className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />,
    },
    {
      title: t("layers.education.features.validation.title"),
      desc: t("layers.education.features.validation.desc"),
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
  ];

  return (
    <section className="py-24 bg-white dark:bg-slate-900 relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div
          className={`absolute top-0 ${isRTL ? "right-0" : "left-0"} w-[500px] h-[500px] bg-blue-100 dark:bg-blue-950/60 blur-[120px] rounded-full`}
        />
        <div
          className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-[400px] h-[400px] bg-indigo-100 dark:bg-indigo-950/60 blur-[100px] rounded-full`}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className={`grid lg:grid-cols-2 gap-16 lg:gap-24 items-center ${isRTL ? "lg:rtl" : ""}`}
        >
          <motion.div
            initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={isRTL ? "text-right" : "text-left"}
          >
            <div
              className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 mb-6 ${isRTL ? "space-x-reverse" : ""}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 tracking-[0.2em] uppercase">
                {t("layers.education.label")}
              </span>
            </div>

            <h2
              className={`text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 leading-tight ${isArabic ? "font-arabic" : ""}`}
            >
              {t("pillars.learn.subtitle")}
            </h2>
            <p className="text-gray-500 dark:text-slate-400 text-lg mb-10 leading-relaxed max-w-xl">
              {t("pillars.learn.description")}
            </p>

            <div className="space-y-4">
              {educationFeatures.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start p-3 rounded-2xl hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50 transition-all duration-300 group cursor-default"
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:border-transparent group-hover:shadow-md group-hover:shadow-blue-500/20 ${isRTL ? "ms-5" : "me-5"}`}
                  >
                    <div className="text-blue-600 dark:text-blue-400 transition-colors duration-300 group-hover:text-white">
                      {f.icon}
                    </div>
                  </div>
                  <div>
                    <h3
                      className={`font-bold text-gray-900 dark:text-slate-100 text-lg mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors ${isArabic ? "font-arabic" : ""}`}
                    >
                      {f.title}
                    </h3>
                    <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            {/* Visual Illustration */}
            <div
              className={`aspect-[4/3] sm:aspect-square bg-gradient-to-br from-blue-50/90 via-indigo-50/60 to-purple-50/40 dark:from-slate-900 dark:via-blue-950/40 dark:to-indigo-950/40 rounded-[3rem] border border-blue-100 dark:border-slate-800 p-8 md:p-10 flex flex-col justify-between shadow-[0_25px_60px_-15px_rgba(37,99,235,0.12)] relative group overflow-hidden`}
            >
              {/* Floating Cards Simulation */}
              <div className="absolute top-10 inset-x-10 h-1/2">
                <div
                  className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} w-48 h-32 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-50 dark:border-slate-800 p-4 transform transition-all group-hover:-translate-y-2 group-hover:rotate-3`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className="h-2 w-20 bg-gray-100 dark:bg-slate-800 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full" />
                    <div className="h-1.5 w-3/4 bg-gray-100 dark:bg-slate-800 rounded-full" />
                  </div>
                </div>

                <div
                  className={`absolute bottom-0 ${isRTL ? "right-0" : "left-0"} w-48 h-32 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-50 dark:border-slate-800 p-4 transform transition-all group-hover:translate-y-2 group-hover:-rotate-3`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
                      <PlayCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div className="h-2 w-20 bg-gray-100 dark:bg-slate-800 rounded-full" />
                  </div>
                  <div className="h-8 w-8 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mx-auto" />
                </div>
              </div>

              <div className="mt-auto relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800/80 p-6 rounded-3xl"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-4xl lg:text-5xl font-black text-blue-900 dark:text-blue-100 mb-1">
                        94%
                      </div>
                      <p className="text-blue-700 dark:text-blue-300 font-bold text-sm tracking-wide uppercase">
                        {t("layers.education.stats.accuracy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-600 dark:text-blue-300 text-xs font-medium leading-tight max-w-[120px]">
                        {t("layers.education.stats.behavioral")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Decorative blobs */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-200/20 dark:bg-blue-800/80 blur-3xl rounded-full" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-200/20 dark:bg-indigo-800/80 blur-3xl rounded-full" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

EducationLayer.displayName = "EducationLayer";

export default EducationLayer;
