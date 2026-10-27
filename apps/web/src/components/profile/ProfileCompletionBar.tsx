"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";

export function ProfileCompletionBar() {
  const t = useTranslations("profile.completion");
  const { dir } = useBidi();
  const [completion, setCompletion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ completion_pct: number }>(ENDPOINTS.PROFILES.COMPLETION)
      .then((data) => setCompletion(data.completion_pct))
      .catch(() => setCompletion(0))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-6 px-4 sm:px-8">
        <div className="h-16 bg-gray-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (completion === null || completion >= 100) return null;

  const getGradient = () => {
    if (completion >= 80)
      return "bg-gradient-to-r from-emerald-500 to-teal-500";
    if (completion >= 50)
      return "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500";
    if (completion >= 25)
      return "bg-gradient-to-r from-amber-500 to-orange-500";
    return "bg-gradient-to-r from-red-500 to-rose-500";
  };

  const getMessage = () => {
    if (completion >= 80) return t("almostDone");
    if (completion >= 50) return t("makingProgress");
    if (completion >= 25) return t("goodStart");
    return t("completeProfile");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 px-4 sm:px-8"
      dir={dir}
    >
      <div className="p-4 bg-white dark:bg-slate-900/85 backdrop-blur-md border border-white/80 dark:border-slate-800/80 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {completion >= 80 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            )}
            <span className="text-xs font-bold text-gray-900 dark:text-slate-100">
              {t("title")}
            </span>
          </div>
          <span className="text-xs font-black text-gray-900 dark:text-slate-100">
            {Math.round(completion)}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-gray-200/50 dark:border-slate-800/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-full transition-all", getGradient())}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 font-medium">
          {getMessage()}
        </p>
      </div>
    </motion.div>
  );
}
