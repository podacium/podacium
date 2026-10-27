"use client";

import React from "react";
import { motion } from "framer-motion";
import { Users, ArrowRight, CheckCircle2, BarChart2 } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";

const Button = PodaciumButton;

const FreelancingLayer: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const { isRTL } = useBidi();
  const isArabic = isRTL;

  return (
    <section className="py-24 bg-white dark:bg-slate-900 text-gray-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div
          className={`absolute top-0 ${isRTL ? "left-0" : "right-0"} w-[600px] h-[600px] bg-indigo-200/50 dark:bg-indigo-900/40 blur-[150px] rounded-full`}
        />
        <div
          className={`absolute bottom-0 ${isRTL ? "right-0" : "left-0"} w-[500px] h-[500px] bg-purple-200/40 dark:bg-purple-900/30 blur-[120px] rounded-full`}
        />
        <div className="absolute inset-0 grid-light opacity-20 dark:opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className={`grid lg:grid-cols-2 gap-16 lg:gap-24 items-center ${isRTL ? "lg:rtl" : ""}`}
        >
          <motion.div
            initial={{ opacity: 0, x: isRTL ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className={`order-2 lg:order-1 ${isRTL ? "lg:order-2" : ""}`}
          >
            <div className="relative bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-[2.5rem] p-6 md:p-10 aspect-[4/3] sm:aspect-square flex flex-col justify-center overflow-hidden group shadow-xl dark:shadow-2xl backdrop-blur-xl transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent opacity-60 dark:opacity-30 pointer-events-none" />

              <div className="space-y-4 relative z-10">
                {[
                  {
                    name: t("pillars.hub.talentProfiles.0.skill"),
                    match: "98%",
                    delay: 0,
                  },
                  {
                    name: t("pillars.hub.talentProfiles.1.skill"),
                    match: "94%",
                    delay: 0.1,
                  },
                  {
                    name: t("pillars.hub.talentProfiles.2.skill"),
                    match: "89%",
                    delay: 0.2,
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: item.delay }}
                    className={`flex items-center gap-4 bg-white dark:bg-slate-800/70 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm dark:shadow-none backdrop-blur-md transition-all duration-300 hover:border-indigo-400 dark:hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10 ${isRTL ? "flex-row-reverse" : ""}`}
                  >
                    <div className="relative w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-100 dark:border-indigo-400/20">
                      <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    </div>
                    <div
                      className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}
                    >
                      <div
                        className={`text-sm font-bold text-gray-900 dark:text-white mb-1.5 ${isArabic ? "font-arabic" : ""}`}
                      >
                        {item.name}
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: item.match }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: item.delay + 0.3 }}
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-500 dark:via-indigo-500 dark:to-purple-500"
                        />
                      </div>
                    </div>
                    <div className="text-indigo-700 dark:text-indigo-300 text-[10px] font-black font-mono tracking-tighter bg-indigo-50 dark:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-400/20">
                      SIGNAL_MATCH_{item.match}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Decorative nodes */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className={`order-1 lg:order-2 ${isRTL ? "lg:order-1 text-right" : "text-left"}`}
          >
            <div
              className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 mb-6 ${isRTL ? "space-x-reverse" : ""}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 tracking-[0.2em] uppercase">
                {t("layers.freelancing.label")}
              </span>
            </div>

            <h2
              className={`text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6 leading-tight ${isArabic ? "font-arabic" : ""}`}
            >
              {t("pillars.hub.subtitle")}
            </h2>
            <p className="text-gray-600 dark:text-slate-400 text-lg mb-10 leading-relaxed max-w-xl">
              {t("pillars.hub.description")}
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/50 shadow-sm dark:shadow-none backdrop-blur-sm hover:border-indigo-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-500/30">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] mb-2 uppercase tracking-widest">
                  {t("layers.freelancing.readiness.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("layers.freelancing.readiness.desc")}
                </p>
              </div>
              <div className="p-6 rounded-[2rem] bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/50 shadow-sm dark:shadow-none backdrop-blur-sm hover:border-indigo-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-500/30">
                  <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] mb-2 uppercase tracking-widest">
                  {t("layers.freelancing.reputation.title")}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("layers.freelancing.reputation.desc")}
                </p>
              </div>
            </div>

            <div className="mt-10 text-center lg:text-left">
              <Button
                variant="primary"
                size="lg"
                href="/hub"
                className="font-bold shadow-lg shadow-indigo-600/20"
              >
                {t("layers.freelancing.cta")}
                <ArrowRight className="ms-2 w-5 h-5 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180 transition-transform" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

FreelancingLayer.displayName = "FreelancingLayer";

export default FreelancingLayer;
