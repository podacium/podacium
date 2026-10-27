"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import {
  Plus,
  Search,
  Loader2,
  LayoutTemplate,
  Sparkles,
  Home,
  ChevronRight,
  BarChart3,
  Eye,
  Layout,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { api, BiDashboardMetadata } from "@/lib/api";
import { DashboardCard } from "@/components/bi/dashboards/DashboardCard";

// SUB-COMPONENTS
// ===========================================================================

function Breadcrumb({ t, dir }: { t: (key: string) => string; dir: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-4 h-4" />
        <span>{t("nav.breadcrumb.home")}</span>
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("nav.breadcrumb.bi")}
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("nav.breadcrumb.dashboards")}
      </span>
    </nav>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
  delay,
}: {
  icon: any;
  label: string;
  value: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient}`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {value}
          </div>
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {label}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

export default function DashboardListPage() {
  const router = useRouter();
  const t = useTranslations("bi.dashboards");
  const [loading, setLoading] = useState(true);
  const [dashboards, setDashboards] = useState<BiDashboardMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDashboards = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await api.listDashboards()) as any;
      if (Array.isArray(res)) {
        setDashboards(res);
        setTotal(res.length);
      } else if (res && res.dashboards) {
        setDashboards(res.dashboards);
        setTotal(res.total || res.dashboards.length);
      }
    } catch (error) {
      console.error("Failed to fetch dashboards:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async () => {
    try {
      const res = await api.createDashboard({
        title: t("list.newDashboardDefaultName"),
        description: t("list.newDashboardDefaultDescription"),
      });
      if (res.success && res.dashboard) {
        router.push(`/bi/dashboards/${res.dashboard.id}`);
      }
    } catch (error) {
      console.error("Failed to create dashboard:", error);
    }
  };

  const filteredDashboards = useMemo(
    () =>
      dashboards.filter(
        (d) =>
          (d.title || d.name || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (d.description &&
            d.description.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [dashboards, searchQuery],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>

      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Breadcrumb t={t} dir={t.dir} />

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {t("list.title")}
            </h1>
            <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl font-medium">
              {t("list.subtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold"
            >
              <Plus className="w-5 h-5" />
              {t("list.createButton")}
            </button>
          </motion.div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon={Layout}
            label={t("list.stats.total")}
            value={total.toString()}
            gradient="from-blue-600 to-blue-400"
            delay={0.1}
          />
          <StatCard
            icon={Eye}
            label={t("list.stats.public")}
            value={dashboards.filter((d) => d.is_public).length.toString()}
            gradient="from-emerald-600 to-teal-400"
            delay={0.2}
          />
          <StatCard
            icon={BarChart3}
            label={t("list.stats.widgets")}
            value={dashboards
              .reduce((acc, d) => acc + (d.widget_count || 0), 0)
              .toString()}
            gradient="from-indigo-600 to-purple-400"
            delay={0.3}
          />
        </div>

        {/* Filters & Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1 group max-w-md">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 dark:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder={t("list.search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-12 pe-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>
        </motion.div>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900/50 rounded-full animate-spin border-t-blue-600" />
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-bold tracking-wide animate-pulse">
              {t("list.loading")}
            </p>
          </div>
        ) : filteredDashboards.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredDashboards.map((dashboard) => (
              <DashboardCard key={dashboard.id} dashboard={dashboard} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-[2.5rem] border-2 border-dashed border-gray-200/50 dark:border-slate-800/50"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
              <LayoutTemplate className="w-12 h-12 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">
              {t("list.empty.title")}
            </h3>
            <p className="text-gray-500 dark:text-slate-400 text-center max-w-sm mb-10 leading-relaxed font-medium">
              {t("list.empty.description")}
            </p>
            <button
              onClick={handleCreate}
              className="group flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all duration-300 font-bold shadow-xl shadow-blue-500/20"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              {t("list.empty.cta")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
