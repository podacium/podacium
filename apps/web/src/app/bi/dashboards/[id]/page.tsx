"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/lib/i18n";
import {
  ArrowLeft,
  Settings,
  Layout,
  Eye,
  Save,
  Loader2,
  ChevronLeft,
  AlertCircle,
  X,
  Gauge,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  useBiDashboard,
  useBiDatasets,
  useUpdateBiDashboard,
  biKeys,
} from "@/hooks/useBi";

import { DashboardOverview } from "@/components/bi/dashboards/DashboardOverview";
import { DashboardEditor } from "@/components/bi/dashboards/DashboardEditor";
import { DashboardSettings } from "@/components/bi/dashboards/DashboardSettings";

const ExecutiveCockpit = dynamic(
  () =>
    import("@/components/bi/cockpit/ExecutiveCockpit").then(
      (m) => m.ExecutiveCockpit,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />
    ),
  },
);

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function DashboardPage({ params }: PageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("bi.dashboards");
  const tGlobal = useTranslations();
  const [activeTab, setActiveTab] = useState<
    "overview" | "cockpit" | "edit" | "settings"
  >("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedParams = React.use(params);
  const dashboardId = parseInt(resolvedParams.id);

  const dashboardQuery = useBiDashboard(dashboardId);
  const fetchedDashboard = dashboardQuery.data?.dashboard;
  const datasetsQuery = useBiDatasets({
    enabled: !!fetchedDashboard?.organization_id,
    organizationId: fetchedDashboard?.organization_id,
  });
  const updateDashboardMutation = useUpdateBiDashboard();

  const loading = dashboardQuery.isLoading;
  const dashboardData = dashboardQuery.data;
  const datasets = datasetsQuery.data?.datasets || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900/60 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
        <p className="text-gray-500 dark:text-slate-400 font-medium animate-pulse">
          {t("list.loading")}
        </p>
      </div>
    );
  }

  if (!dashboardData || !dashboardData.dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900/60 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
            {t("detail.notFound.title")}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
            {t("detail.notFound.description")}
          </p>
          <button
            onClick={() => router.push("/bi/dashboards")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            {t("detail.notFound.backToDashboards")}
          </button>
        </motion.div>
      </div>
    );
  }

  const { dashboard, widgets } = dashboardData;

  const handleSave = async (updatedWidgets?: unknown[]) => {
    setIsSaving(true);
    try {
      const widgetsToSave = updatedWidgets || dashboardData.widgets;
      await updateDashboardMutation.mutateAsync({
        id: dashboardId,
        data: { widgets: widgetsToSave },
      });
      toast.success(t("detail.success.updated"));
    } catch (error: unknown) {
      console.error("Failed to save dashboard", error);
      toast.error(t("detail.errors.updateFailed"));
      const errorDetail =
        (error as { response?: { data?: { detail?: { detail?: string } } } })
          ?.response?.data?.detail?.detail ||
        "bi.dashboards.errors.updateFailed";
      setError(errorDetail);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      {/* Premium Header */}
      <header className="pt-[calc(var(--chrome-offset)+1rem)] pb-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-800/50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-6">
              <motion.button
                whileHover={{ scale: 1.1, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/bi/dashboards")}
                className="mt-1 md:mt-0 p-2.5 bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-800 rounded-2xl text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:border-blue-800/80 hover:shadow-md transition-all flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
              </motion.button>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                    {dashboard.title || dashboard.name}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      dashboard.is_public
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {dashboard.is_public
                      ? t("list.filters.public")
                      : t("list.filters.private")}
                  </span>
                </div>
                {dashboard.description && (
                  <p className="text-gray-500 dark:text-slate-400 max-w-2xl leading-relaxed font-medium">
                    {dashboard.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 self-end lg:self-auto">
              {/* Tabs */}
              <div className="bg-gray-100/80 dark:bg-slate-800/80 p-1.5 rounded-[1.25rem] flex items-center backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 shadow-inner">
                <TabButton
                  active={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  icon={<Eye className="w-4 h-4" />}
                  label={t("detail.tabs.overview")}
                />
                <TabButton
                  active={activeTab === "cockpit"}
                  onClick={() => setActiveTab("cockpit")}
                  icon={<Gauge className="w-4 h-4 text-emerald-500" />}
                  label={t("detail.tabs.cockpit")}
                />
                <TabButton
                  active={activeTab === "edit"}
                  onClick={() => setActiveTab("edit")}
                  icon={<Layout className="w-4 h-4" />}
                  label={t("detail.tabs.edit")}
                />
                <TabButton
                  active={activeTab === "settings"}
                  onClick={() => setActiveTab("settings")}
                  icon={<Settings className="w-4 h-4" />}
                  label={t("detail.tabs.settings")}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSave()}
                disabled={isSaving}
                className="hidden sm:flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-bold disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{t("detail.actions.save")}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              <DashboardOverview
                dashboard={dashboard}
                widgets={widgets || []}
              />
            )}
            {activeTab === "cockpit" && (
              <div className="p-2 sm:p-4 lg:p-6">
                <ExecutiveCockpit
                  dashboardTitle={dashboard.title || dashboard.name}
                  dashboardDescription={dashboard.description}
                  widgets={widgets || []}
                />
              </div>
            )}
            {activeTab === "edit" && (
              <DashboardEditor
                dashboard={dashboard}
                widgets={widgets || []}
                datasets={datasets}
                isSaving={isSaving}
                onSave={handleSave}
                onUpdate={(updatedWidgets) => {
                  queryClient.setQueryData(
                    biKeys.dashboard(dashboardId),
                    (prev: Record<string, unknown> | undefined) =>
                      prev ? { ...prev, widgets: updatedWidgets } : prev,
                  );
                  // Proactive save for better UX? Or only on manual save?
                  // Let's do manual for now as per plan, but we can enable auto-save here later.
                }}
              />
            )}
            {activeTab === "settings" && (
              <DashboardSettings dashboard={dashboard} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed bottom-6 end-6 z-50 p-4 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/50 shadow-xl flex items-center gap-3 max-w-sm"
          >
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-sm">{tGlobal("common.error")}</h4>
              <p className="text-sm font-medium opacity-90">{tGlobal(error)}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 dark:bg-red-900/50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-[0.9rem] text-sm font-black transition-all ${
        active
          ? "text-blue-700"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/40"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 rounded-[0.9rem]"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10">{label}</span>
    </button>
  );
}
