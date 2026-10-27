"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import { motion } from "framer-motion";
import {
  Search,
  Map,
  ChevronRight,
  X,
  Home,
  Users,
  Layers,
} from "lucide-react";
import { useTranslations, useBidi, type Translator } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LearnCard, type LearnCardData } from "@/components/learn/LearnCard";
import {
  formatDuration,
  parsePathPrice,
  summarizePathModules,
  type PathModuleLike,
} from "@/components/learn/catalog";
import { apiHelpers, PathListResponse, PathResponse } from "@/lib/api";
import PathImage from "@/components/course/Path.png";

// =============================================================================
// ANIMATION CONFIGS (BI Pattern)
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

// =============================================================================
// SUB-COMPONENTS (BI Pattern)
// =============================================================================

function Breadcrumb({ t, dir }: { t: (key: string) => string; dir: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-4 h-4" />
        <span>{t("learn.nav.breadcrumb.home")}</span>
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/learn"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("learn.nav.breadcrumb.learn")}
      </Link>
      <ChevronRight
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("paths.results.header")}
      </span>
    </nav>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
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

function EmptyState({
  t,
  onClear,
}: {
  t: (key: string) => string;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16"
    >
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
        <Map className="w-10 h-10 text-purple-600 dark:text-purple-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {t("paths.emptyState.title")}
      </h3>
      <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
        {t("paths.emptyState.noFilters")}
      </p>
      <motion.button
        onClick={onClear}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
      >
        <X className="w-5 h-5" />
        {t("paths.buttons.clearAllFilters")}
      </motion.button>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-pulse"
        >
          <div className="h-3 bg-gradient-to-r from-purple-200 to-indigo-200" />
          <div className="p-6 space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4" />
            <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
            <div className="flex gap-3">
              <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded w-16" />
              <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded w-16" />
              <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// CARD DATA ADAPTER
// =============================================================================

/**
 * Maps an API learning path onto the shared `LearnCard` view-model. The card
 * owns the presentation; this only decides what each slot contains.
 */
function toPathCardData(path: PathResponse, t: Translator): LearnCardData {
  const { totalLessons, totalMinutes, avgRating, skills, tags } =
    summarizePathModules(path.featured_modules as PathModuleLike[] | undefined);

  const isEnrolled = Boolean(path.is_enrolled ?? path.isEnrolled);
  const levelLabel = path.level
    ? t(`courses.levels.${path.level.toLowerCase()}`) ||
      t(`paths.levels.${path.level.toLowerCase()}`) ||
      path.level
    : undefined;

  return {
    id: path.id,
    href: `/learn/paths/${path.id}`,
    title: path.title,
    description: path.description || t("paths.pathCard.defaultDescription"),
    imageUrl: path.thumbnail_url || PathImage.src,
    chips: [
      ...skills.map((label) => ({ label, tone: "skill" as const })),
      ...tags.map((label) => ({ label, tone: "tag" as const })),
    ],
    level: levelLabel,
    rating: avgRating,
    duration: formatDuration(
      totalMinutes,
      t("learn.labels.hours"),
      t("learn.labels.minutes"),
    ),
    count: `${path.modules_count || path.total_modules || 0} ${t(
      "learn.labels.modules",
    )}`,
    badges: path.featured
      ? [{ label: t("paths.badges.featured"), tone: "featured" as const }]
      : [],
    stats: [
      {
        value: (path.enrolled_count || 0).toLocaleString(),
        label: t("learn.labels.enrolled"),
      },
      { value: String(totalLessons), label: t("learn.labels.lessons") },
    ],
    price: parsePathPrice(path),
    currency: t("course.currency.da"),
    freeLabel: t("courses.pricing.free"),
    ctaLabel: isEnrolled
      ? t("paths.buttons.continue")
      : t("paths.buttons.explore"),
    isEnrolled,
    progress: path.progress,
    progressLabel: t("paths.labels.progress"),
  };
}

// =============================================================================
// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function PathsPage() {
  const t = useTranslations();
  const { dir } = useBidi();

  // State
  const [paths, setPaths] = useState<PathListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    totalModules: 0,
    totalEnrolled: 0,
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiHelpers.education.getPublicPaths({ limit: 50 });

        if (Array.isArray(data)) {
          setPaths(data);

          // Calculate stats
          const totalModules = data.reduce(
            (sum, p) => sum + (p.total_modules || 0),
            0,
          );
          const totalEnrolled = data.reduce(
            (sum, p) => sum + (p.enrolled || 0),
            0,
          );

          setStats({
            total: data.length,
            totalModules,
            totalEnrolled,
          });
        }
      } catch (err) {
        console.error("Failed to load paths:", err);
        setError(t("learn.paths.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter paths by search
  const filteredPaths = useMemo(() => {
    if (!searchQuery.trim()) return paths;

    const query = searchQuery.toLowerCase();
    return paths.filter(
      (path) =>
        path.title.toLowerCase().includes(query) ||
        (path.description && path.description.toLowerCase().includes(query)),
    );
  }, [paths, searchQuery]);

  const clearFilters = () => {
    setSearchQuery("");
  };

  const hasActiveFilters = !!searchQuery;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60" dir={dir}>
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <Breadcrumb t={t} dir={dir} />

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Map className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {t("paths.results.header")}
                </h1>
                <p className="text-gray-500 dark:text-slate-400">
                  {t("paths.hero.description")}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={Map}
              label={t("paths.results.header")}
              value={stats.total.toString()}
              gradient="from-purple-500 to-indigo-500"
            />
            <StatCard
              icon={Layers}
              label={t("learn.labels.modules")}
              value={stats.totalModules.toString()}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              icon={Users}
              label={t("learn.labels.enrolled")}
              value={stats.totalEnrolled.toLocaleString()}
              gradient="from-green-500 to-teal-500"
            />
          </div>

          {/* Search */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("paths.search.placeholder")}
                  className="w-full ps-11 pe-11 py-3 rounded-xl border border-gray-200 dark:border-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none text-start"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label={t("paths.buttons.clearSearch")}
                    className="absolute end-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                  <span>{t("paths.buttons.clearSearch")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Count */}
          {!loading && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {t("paths.results.header")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("paths.results.showing", {
                  current: filteredPaths.length.toString(),
                  total: paths.length.toString(),
                })}
                {hasActiveFilters && ` ${t("paths.results.filtered")}`}
              </p>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {t("paths.buttons.tryAgain")}
              </button>
            </div>
          ) : filteredPaths.length === 0 ? (
            <EmptyState t={t} onClear={clearFilters} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPaths.map((path) => (
                <LearnCard
                  key={path.id}
                  variant="path"
                  data={toPathCardData(path, t)}
                />
              ))}
            </div>
          )}

          {/* FAQ */}
          <div className="mt-20">
            <FAQAccordion
              items={t.raw("paths.faq.items") || []}
              title={t("paths.faq.title")}
              subtitle={t("paths.faq.subtitle")}
              variant="embedded"
              searchable
              multiOpen
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
