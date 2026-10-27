import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface PathEnrollmentCTAProps {
  path: any;
  onEnroll: () => void;
  isLoading: boolean;
}

const PathEnrollmentCTA: React.FC<PathEnrollmentCTAProps> = ({
  path,
  onEnroll,
  isLoading,
}) => {
  const t = useTranslations();
  if (!path) return null;

  const price = path.price
    ? typeof path.price === "number"
      ? path.price
      : path.price.discounted || path.price.original || path.price.amount || 0
    : 0;
  const isFree = price === 0;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl"
    >
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl px-6 py-5 rounded-[40px] border border-white/40 dark:border-slate-800/80 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] ring-1 ring-white/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-lg transition-transform hover:rotate-3 ${
                isFree
                  ? "bg-emerald-600 text-white shadow-emerald-500/20"
                  : "bg-blue-600 text-white shadow-blue-500/20"
              }`}
            >
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-slate-100 tracking-tight leading-none mb-2">
                {t("path.enrollmentCta.title.authenticated")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                {t("path.enrollmentCta.description.authenticated")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {!isFree && (
              <div className="px-6 py-3 bg-gray-50 dark:bg-slate-900/60 rounded-[22px] border border-gray-100 dark:border-slate-800 flex-1 md:flex-none text-center">
                <div className="text-2xl font-black text-gray-900 dark:text-slate-100 tabular-nums leading-none mb-1">
                  {price}
                  <span className="text-sm font-bold text-gray-400 ml-1 mr-1">
                    {t("course.currency.da")}
                  </span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">
                  {t("course.pricing.oneTimePayment")}
                </div>
              </div>
            )}

            <button
              onClick={() => onEnroll?.()}
              disabled={isLoading}
              className={`relative h-16 px-10 rounded-[28px] font-black uppercase tracking-widest text-sm transition-all duration-300 shadow-2xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none flex items-center justify-center gap-3 ${
                isFree
                  ? "bg-emerald-600 text-white shadow-emerald-500/30 hover:bg-emerald-500 hover:scale-105 active:scale-95"
                  : "bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-500 hover:scale-105 active:scale-95"
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isFree
                    ? t("course.actions.enrollFree")
                    : t("course.actions.enrollNow")}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}

              {!isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:animate-[shimmer_2s_infinite]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PathEnrollmentCTA;
