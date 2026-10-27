"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { DatasetSelector } from "@/components/bi/analytics/DatasetSelector";
import { CoreAnalyticsView } from "@/components/bi/analytics/CoreAnalyticsView";
import { useTranslations, useBidi } from "@/lib/i18n";
import api, { BiDatasetMetadata } from "@/lib/api";
import { ArrowLeft, Sparkles, BarChart2 } from "lucide-react";

// Components lazy loaded for layout
const Navbar = React.lazy(() => import("@/components/Navbar"));
const Footer = React.lazy(() => import("@/components/Footer"));

export default function AnalyticsPage() {
  const { t, i18n } = useTranslations("bi.analytics");
  const locale = i18n.language;

  // State
  const [viewMode, setViewMode] = useState<"selection" | "analysis">(
    "selection",
  );
  const [datasets, setDatasets] = useState<BiDatasetMetadata[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [coreAnalyticsData, setCoreAnalyticsData] = useState<any>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const selectedDataset = datasets.find(
    (d) => String(d.dataset_id ?? d.id) === selectedDatasetId,
  );

  // Initial load
  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoadingDatasets(true);
      const res = await api.listDatasets(1, 50);
      setDatasets(res.datasets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleSelectDataset = async (id: string) => {
    setSelectedDatasetId(id);
    setAnalyzing(true);
    setAnalyticsError(null);
    setCoreAnalyticsData(null);
    setViewMode("analysis"); // Switch immediately, show skeleton

    try {
      // Fetch core analytics
      const data = await api.getDatasetCoreAnalytics(id);
      setCoreAnalyticsData(data);
    } catch (error) {
      console.error("Failed to analyze dataset:", error);
      setAnalyticsError(t("errors.analysisFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetry = () => {
    if (selectedDatasetId) handleSelectDataset(selectedDatasetId);
  };

  const handleBack = () => {
    setViewMode("selection");
    setSelectedDatasetId(null);
    setCoreAnalyticsData(null);
    setAnalyticsError(null);
  };

  const { dir } = useBidi();

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <React.Suspense
        fallback={
          <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
        }
      >
        <Navbar />
      </React.Suspense>

      {/* Premium Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100 dark:bg-indigo-950/40 dark:bg-indigo-900/50 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 dark:bg-purple-950/60 dark:bg-purple-900/50 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 pb-16">
        {/* Hero Section - Only visible in selection mode or if transitioning */}
        <AnimatePresence mode="popLayout">
          {viewMode === "selection" && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="mb-12 text-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm font-bold uppercase tracking-widest mb-6 border border-blue-200 dark:border-blue-800/80"
              >
                <Sparkles className="w-4 h-4" />
                {t("hero.badge")}
              </motion.div>

              <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-slate-100 tracking-tight mb-6 leading-tight">
                {t("hero.title")} <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {t("hero.titleHighlight")}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-gray-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                {t("hero.subtitle")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {viewMode === "selection" ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <DatasetSelector
                  datasets={datasets}
                  selectedId={selectedDatasetId}
                  onSelect={handleSelectDataset}
                  loading={loadingDatasets}
                />
              </motion.div>
            ) : (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Analysis Header - Premium Card Style */}
                <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 dark:border-slate-800/40 shadow-xl shadow-indigo-500/5">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleBack}
                      className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm border border-transparent hover:border-gray-100 dark:border-slate-800"
                    >
                      <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        {selectedDataset?.name || t("analysis.defaultTitle")}
                      </h2>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                        {selectedDataset?.domain || t("analysis.generalDomain")}{" "}
                        • {selectedDataset?.row_count?.toLocaleString(locale)}{" "}
                        {t("analysis.rows")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Core Views */}
                <CoreAnalyticsView
                  data={coreAnalyticsData}
                  loading={analyzing}
                  error={analyticsError}
                  onRetry={handleRetry}
                  onSelectAnother={handleBack}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <React.Suspense
        fallback={<div className="h-20 bg-gray-50 dark:bg-slate-900/60" />}
      >
        <Footer />
      </React.Suspense>
    </main>
  );
}
