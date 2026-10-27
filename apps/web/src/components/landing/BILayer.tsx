"use client";

import React from "react";
import { motion } from "framer-motion";
import { BarChart2, Brain, Users, Lock } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";

const BILayer: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const { isRTL } = useBidi();
  const isArabic = isRTL;

  return (
    <section className="py-24 bg-white dark:bg-slate-900 relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div
          className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} w-[500px] h-[500px] bg-emerald-100 dark:bg-emerald-950/60 blur-[120px] rounded-full`}
        />
        <div
          className={`absolute bottom-0 ${isRTL ? "right-0" : "left-0"} w-[400px] h-[400px] bg-blue-100 dark:bg-blue-950/60 blur-[100px] rounded-full`}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 mb-6 ${isRTL ? "space-x-reverse" : ""}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 tracking-[0.2em] uppercase">
              {t("layers.bi.label")}
            </span>
          </motion.div>
          <h2
            className={`text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 leading-tight ${isArabic ? "font-arabic" : ""}`}
          >
            {t("pillars.bi.subtitle")}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-lg leading-relaxed">
            {t("pillars.bi.description")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: t("layers.bi.features.supply.title"),
              desc: t("layers.bi.features.supply.desc"),
              colors: {
                bg: "bg-emerald-50 dark:bg-emerald-500/20",
                border: "border-emerald-100 dark:border-emerald-500/30",
                hoverBg: "group-hover:bg-emerald-600",
                hoverBorder: "group-hover:border-emerald-600",
                text: "text-emerald-600 dark:text-emerald-400",
                cardBorder: "border-slate-200/80 dark:border-slate-800/80",
                cardHover:
                  "hover:border-emerald-300 dark:hover:border-emerald-500/40",
              },
              icon: <Brain className="w-6 h-6" />,
            },
            {
              title: t("layers.bi.features.performance.title"),
              desc: t("layers.bi.features.performance.desc"),
              colors: {
                bg: "bg-blue-50 dark:bg-blue-500/20",
                border: "border-blue-100 dark:border-blue-500/30",
                hoverBg: "group-hover:bg-blue-600",
                hoverBorder: "group-hover:border-blue-600",
                text: "text-blue-600 dark:text-blue-400",
                cardBorder: "border-slate-200/80 dark:border-slate-800/80",
                cardHover:
                  "hover:border-blue-300 dark:hover:border-blue-500/40",
              },
              icon: <BarChart2 className="w-6 h-6" />,
            },
            {
              title: t("layers.bi.features.insights.title"),
              desc: t("layers.bi.features.insights.desc"),
              colors: {
                bg: "bg-indigo-50 dark:bg-indigo-500/20",
                border: "border-indigo-100 dark:border-indigo-500/30",
                hoverBg: "group-hover:bg-indigo-600",
                hoverBorder: "group-hover:border-indigo-600",
                text: "text-indigo-600 dark:text-indigo-400",
                cardBorder: "border-slate-200/80 dark:border-slate-800/80",
                cardHover:
                  "hover:border-indigo-300 dark:hover:border-indigo-500/40",
              },
              icon: <Users className="w-6 h-6" />,
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`group p-8 rounded-[2.5rem] border bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xl shadow-gray-200/20 dark:shadow-none hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 ${item.colors.cardBorder} ${item.colors.cardHover} ${isRTL ? "text-right" : "text-left"} relative overflow-hidden`}
            >
              <div
                className={`w-12 h-12 rounded-2xl mb-6 flex items-center justify-center transition-all duration-300 ${item.colors.bg} ${item.colors.text} ${item.colors.hoverBg} shadow-xs border ${item.colors.border}`}
              >
                <div className="transition-colors duration-300 group-hover:text-white">
                  {item.icon}
                </div>
              </div>
              <h3
                className={`text-xl font-bold mb-3 text-gray-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors ${isArabic ? "font-arabic" : ""}`}
              >
                {item.title}
              </h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Dashboard Simulation CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`mt-20 relative bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 rounded-[3rem] p-10 md:p-16 overflow-hidden flex flex-col lg:flex-row items-center gap-12 border border-white/10 shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] ${isRTL ? "lg:flex-row-reverse" : ""}`}
        >
          {/* Decorative background elements */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/20 blur-[100px] rounded-full" />
            <div className="absolute inset-0 grid-light opacity-10" />
          </div>

          <div
            className={`flex-1 relative z-10 ${isRTL ? "text-right" : "text-left"}`}
          >
            <h3
              className={`text-2xl md:text-3xl font-bold text-white mb-6 ${isArabic ? "font-arabic" : ""}`}
            >
              {t("layers.bi.infrastructure.title")}
            </h3>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed max-w-md">
              {t("layers.bi.infrastructure.description")}
            </p>
            <div
              className={`inline-flex items-center gap-4 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-emerald-400 font-bold text-sm backdrop-blur-md hover:bg-white/10 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
            >
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>{t("layers.bi.infrastructure.dashboard")}</span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md relative z-10 group">
            <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/15 p-8 shadow-3xl transform transition-all duration-500 group-hover:scale-[1.02] group-hover:rotate-1">
              <div className="space-y-6">
                {[
                  {
                    label: t("layers.bi.stats.connectivity"),
                    progress: "78%",
                    color: "from-emerald-500 to-teal-400",
                  },
                  {
                    label: t("layers.bi.stats.velocity"),
                    progress: "92%",
                    color: "from-blue-500 to-indigo-400",
                  },
                  {
                    label: t("layers.bi.stats.retention"),
                    progress: "85%",
                    color: "from-indigo-500 to-purple-400",
                  },
                ].map((stat, i) => (
                  <div key={i} className="space-y-2">
                    <div
                      className={`flex justify-between items-center text-xs font-bold text-slate-200 ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <span className={isArabic ? "font-arabic text-sm" : ""}>
                        {stat.label}
                      </span>
                      <span className="font-mono text-white">
                        {stat.progress}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: stat.progress }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.2 }}
                        className={`h-full bg-gradient-to-r ${stat.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className={`mt-8 pt-6 border-t border-white/10 flex justify-between items-center text-[10px] font-black tracking-[0.2em] text-slate-400 font-mono ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  SYS_HEALTH_ACTIVE
                </span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  OPTIMIZED
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

BILayer.displayName = "BILayer";

export default BILayer;
