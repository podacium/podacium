"use client";

import React from "react";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, BarChart2 } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { VimeoEmbed } from "@/components/video/VimeoEmbed";

const EXPLAINER_VIDEO_ID = "1167634797";
const EXPLAINER_POSTER_URL =
  "https://i.vimeocdn.com/video/2125698643-57362f0690de81ba90fb2f5d919933efaedfec1eb22d53e2e94e7b96d156cc2e-d_1280x720?region=us";

const VideoExplainer: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const { isRTL } = useBidi();

  return (
    <section
      id="explainer-video"
      className="py-16 md:py-24 bg-gray-50 dark:bg-slate-900/60 border-y border-gray-100 dark:border-slate-800"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
            {t("video.title")}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
            {t("video.description")}
          </p>
        </div>

        <motion.div
          className="relative aspect-video rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(37,99,235,0.18)] border border-gray-200 dark:border-slate-800 bg-black group"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <VimeoEmbed
            videoId={EXPLAINER_VIDEO_ID}
            title={tCommon("uiLabels.podaciumIntroTitle")}
            poster={EXPLAINER_POSTER_URL}
            labels={{
              play: t("video.play"),
              unavailable: t("video.unavailable"),
              watchOnVimeo: t("video.watchOnVimeo"),
              retry: t("video.retry"),
            }}
          />
        </motion.div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: t("video.steps.capture.title"),
              desc: t("video.steps.capture.desc"),
              icon: <Brain className="w-5 h-5" />,
              colors: {
                bg: "bg-blue-50 dark:bg-blue-500/20",
                border: "border-blue-100 dark:border-blue-500/30",
                hoverBg: "group-hover:bg-blue-600",
                hoverBorder: "group-hover:border-blue-600",
                icon: "text-blue-500 dark:text-blue-400",
              },
            },
            {
              step: "02",
              title: t("video.steps.validate.title"),
              desc: t("video.steps.validate.desc"),
              icon: <CheckCircle2 className="w-5 h-5" />,
              colors: {
                bg: "bg-indigo-50 dark:bg-indigo-500/20",
                border: "border-indigo-100 dark:border-indigo-500/30",
                hoverBg: "group-hover:bg-indigo-600",
                hoverBorder: "group-hover:border-indigo-600",
                icon: "text-indigo-500 dark:text-indigo-400",
              },
            },
            {
              step: "03",
              title: t("video.steps.signal.title"),
              desc: t("video.steps.signal.desc"),
              icon: <BarChart2 className="w-5 h-5" />,
              colors: {
                bg: "bg-emerald-50 dark:bg-emerald-500/20",
                border: "border-emerald-100 dark:border-emerald-500/30",
                hoverBg: "group-hover:bg-emerald-600",
                hoverBorder: "group-hover:border-emerald-600",
                icon: "text-emerald-500 dark:text-emerald-400",
              },
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-gray-200/70 dark:border-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center text-center cursor-default relative overflow-hidden"
            >
              <span
                className={`absolute top-3 ${isRTL ? "left-4" : "right-4"} text-[10px] font-black font-mono text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors`}
              >
                {item.step}
              </span>
              <div
                className={`w-12 h-12 rounded-2xl ${item.colors.bg} border ${item.colors.border} flex items-center justify-center mb-4 transition-all duration-300 ${item.colors.hoverBg} ${item.colors.hoverBorder} shadow-xs`}
              >
                <div
                  className={`${item.colors.icon} transition-colors duration-300 group-hover:text-white`}
                >
                  {item.icon}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1 transition-colors duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-lg">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed max-w-xs">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

VideoExplainer.displayName = "VideoExplainer";

export default VideoExplainer;
