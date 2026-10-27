"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock, Play, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface LockedCourseCTAProps {
  onEnroll: () => void;
  onLogin: () => void;
  isAuthenticated: boolean;
  isEnrolling?: boolean;
}

export const LockedCourseCTA: React.FC<LockedCourseCTAProps> = ({
  onEnroll,
  onLogin,
  isAuthenticated,
  isEnrolling = false,
}) => {
  const t = useTranslations();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 relative group">
        {/* Decorative Background */}
        <div className="absolute top-0 end-0 w-64 h-64 bg-blue-50 dark:bg-blue-950/60 rounded-full -me-32 -mt-32 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-950/60 rounded-full -ms-32 -mb-32 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />

        <div className="relative p-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-blue-200 rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <Lock className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-black text-gray-900 dark:text-slate-100 mb-4 tracking-tight">
            {t("course.states.lockedTitle")}
          </h2>

          <p className="text-gray-500 dark:text-slate-400 text-lg mb-10 max-w-lg leading-relaxed">
            {t("course.states.lockedDescription")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            {isAuthenticated ? (
              <button
                onClick={onEnroll}
                disabled={isEnrolling}
                className="col-span-2 py-4 px-8 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                {isEnrolling
                  ? t("course.actions.enrolling")
                  : t("course.actions.enrollNow")}
              </button>
            ) : (
              <>
                <button
                  onClick={onLogin}
                  className="py-4 px-8 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  {t("course.actions.login")}
                </button>
                <button
                  onClick={onLogin} // Usually refers to Auth flow
                  className="py-4 px-8 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-2 border-blue-600 rounded-2xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all"
                >
                  {t("course.actions.signUp")}
                </button>
              </>
            )}
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-8 border-t border-gray-50 dark:border-slate-800/60 pt-8 w-full">
            <div className="flex items-center gap-2 text-sm text-gray-400 font-bold uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              {t("course.features.lifetimeAccess")}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              {t("course.features.certificate")}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
