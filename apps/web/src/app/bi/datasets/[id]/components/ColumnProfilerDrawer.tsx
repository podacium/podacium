"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart2,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Layers,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import { formatNumber } from "./types";

export function ColumnProfilerDrawer({
  datasetId,
  columnName,
  isOpen,
  onClose,
  t: propsT,
}: {
  datasetId: string;
  columnName: string | null;
  isOpen: boolean;
  onClose: () => void;
  t?: (key: string, params?: any) => string;
}) {
  const i18n = useTranslations();
  const t = propsT || i18n;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && columnName) {
      setLoading(true);
      api.bi
        .getColumnProfile(datasetId, columnName)
        .then((res) => setProfile(res))
        .catch((err) => {
          console.error("Profiler error:", err);
          toast.error(t("bi.datasets.detail.schema.profilerError"));
        })
        .finally(() => setLoading(false));
    }
  }, [datasetId, columnName, isOpen, t]);

  if (!isOpen || !columnName) return null;

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end" size="lg">
      <DrawerContent
        className="w-full max-w-lg"
        overlayClassName="bg-slate-950/60"
      >
        {/* Drawer Header */}
        <DrawerHeader className="items-center border-slate-200/80 bg-white/90 px-6 py-6 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                {columnName}
              </DrawerTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.columnModal.profilingTitle")}
              </p>
            </div>
          </div>
          <DrawerClose className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
        </DrawerHeader>

        {/* Drawer Content */}
        <DrawerBody className="space-y-6 p-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.columnModal.calculatingStats")}
              </p>
            </div>
          ) : profile ? (
            <>
              {/* Warnings Banner */}
              {profile.warnings && profile.warnings.length > 0 && (
                <div className="space-y-2">
                  {profile.warnings.map((w: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium"
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {t("bi.datasets.detail.columnModal.totalRows")}
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatNumber(profile.total_rows)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {t("bi.datasets.detail.columnModal.uniqueValues")}
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {formatNumber(profile.unique_count)}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {t("bi.datasets.detail.columnModal.missingNulls")}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                      {formatNumber(profile.null_count)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${profile.null_percentage > 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                    >
                      ({profile.null_percentage}%)
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                    {t("bi.datasets.detail.columnModal.semanticType")}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-500/20 inline-block mt-1">
                    {profile.semantic_type || "STRING"}
                  </span>
                </div>
              </div>

              {/* Numeric Statistics */}
              {profile.stats && Object.keys(profile.stats).length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {t("bi.datasets.detail.columnModal.descStats")}
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.min")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.min ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.max")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.max ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.mean")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.mean ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.median")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.median ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.stdDev")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.std ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("bi.datasets.detail.columnModal.quartiles")}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {profile.stats.q25 ?? "—"} / {profile.stats.q75 ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Frequency Distribution */}
              {profile.distribution && profile.distribution.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    {t("bi.datasets.detail.columnModal.topValues")}
                  </h4>
                  <div className="space-y-2.5">
                    {profile.distribution.map((item: any, i: number) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                            {item.value}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">
                            {formatNumber(item.count)} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percentage}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DrawerBody>
      </DrawerContent>
    </PodaciumDrawer>
  );
}
