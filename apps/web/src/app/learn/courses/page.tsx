"use client";

import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  Clock,
  Star,
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  Home,
} from "lucide-react";
import { useTranslations, useBidi, type Translator } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LearnCard, type LearnCardData } from "@/components/learn/LearnCard";
import { formatDuration, parseCoursePrice } from "@/components/learn/catalog";
import { apiHelpers, ModuleListResponse } from "@/lib/api";
import CourseImage from "@/components/course/Course.png";

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
        {t("courses.hero.title")}
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
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
        <BookOpen className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {t("courses.empty.title")}
      </h3>
      <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
        {t("courses.empty.noFilters")}
      </p>
      <motion.button
        onClick={onClear}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
      >
        <X className="w-5 h-5" />
        {t("courses.buttons.clearAllFilters")}
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
          <div className="h-2 bg-gray-200 dark:bg-slate-800/90" />
          <div className="p-6 space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4" />
            <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-2/3" />
            <div className="flex gap-2">
              <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded-full w-20" />
              <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded-full w-20" />
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
 * Maps an API module onto the shared `LearnCard` view-model. Strings are
 * resolved here so the card itself stays i18n-free and reusable.
 */
function toCourseCardData(
  course: ModuleListResponse,
  t: Translator,
): LearnCardData {
  const lessonCount = course.totalLessons ?? (course as any).total_lessons ?? 0;
  const duration = formatDuration(
    course.duration_minutes ?? course.durationMinutes,
    t("learn.labels.hours"),
    t("learn.labels.minutes"),
  );
  const isNew = Boolean(course.isNew || (course as any).is_new);
  const levelLabel = course.level
    ? t(`courses.levels.${course.level.toLowerCase()}`) || course.level
    : undefined;

  return {
    id: course.id,
    href: `/learn/courses/${course.id}`,
    title: course.title,
    description: course.description || t("courses.noDescription"),
    imageUrl:
      course.thumbnailUrl || (course as any).thumbnail_url || CourseImage.src,
    eyebrow: course.category || t("courses.labels.general"),
    level: levelLabel,
    rating: course.rating ?? null,
    duration,
    count: `${lessonCount} ${t("courses.labels.lessons")}`,
    badges: [
      ...(course.featured
        ? [{ label: t("courses.badges.featured"), tone: "featured" as const }]
        : []),
      ...(isNew
        ? [{ label: t("courses.badges.new"), tone: "new" as const }]
        : []),
    ],
    stats: [
      {
        value: (course.enrolled ?? 0).toLocaleString(),
        label: t("courses.labels.enrolled"),
      },
      { value: String(lessonCount), label: t("courses.labels.lessons") },
    ],
    price: parseCoursePrice(course.price),
    currency: t("course.currency.da"),
    freeLabel: t("courses.pricing.free"),
    ctaLabel: course.isEnrolled
      ? t("courses.buttons.continue")
      : t("courses.buttons.startCourse"),
    isEnrolled: Boolean(course.isEnrolled),
    progress: course.progress,
    progressLabel: t("courses.labels.progress"),
  };
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CoursesPage() {
  const t = useTranslations("learn");
  const { dir } = useBidi();

  // State
  const [courses, setCourses] = useState<ModuleListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    featured: 0,
    avgDuration: "0h",
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiHelpers.education.getPublicModules({
          limit: 50,
          featured: undefined,
          level: selectedLevel || undefined,
          category: selectedCategory || undefined,
        });

        if (Array.isArray(data)) {
          setCourses(data);

          // Calculate stats
          const featured = data.filter((c) => c.featured).length;
          const totalMinutes = data.reduce(
            (sum, c) => sum + (c.duration_minutes || 0),
            0,
          );
          const avgMinutes =
            data.length > 0 ? Math.round(totalMinutes / data.length) : 0;
          const hours = Math.floor(avgMinutes / 60);
          const mins = avgMinutes % 60;

          setStats({
            total: data.length,
            featured,
            avgDuration: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
          });
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
        setError(t("courses.messages.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLevel, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter courses by search
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;

    const query = searchQuery.toLowerCase();
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        (course.description &&
          course.description.toLowerCase().includes(query)) ||
        course.skills.some((skill) => skill.toLowerCase().includes(query)),
    );
  }, [courses, searchQuery]);

  // Get unique levels and categories
  const levels = useMemo(() => {
    const unique = new Set(courses.map((c) => c.level).filter(Boolean));
    return Array.from(unique) as string[];
  }, [courses]);

  const categories = useMemo(() => {
    const unique = new Set(courses.map((c) => c.category).filter(Boolean));
    return Array.from(unique) as string[];
  }, [courses]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedLevel(null);
    setSelectedCategory(null);
  };

  const hasActiveFilters = searchQuery || selectedLevel || selectedCategory;

  const getLevelLabel = (level?: string) => {
    if (!level) return null;
    const key = level.toLowerCase();
    const translated = t(`courses.levels.${key}`);
    return translated || level;
  };

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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {t("courses.hero.title")}
                </h1>
                <p className="text-gray-500 dark:text-slate-400">
                  {t("courses.hero.description")}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={BookOpen}
              label={t("courses.sections.availableModules")}
              value={stats.total.toString()}
              gradient="from-blue-500 to-indigo-500"
            />
            <StatCard
              icon={Star}
              label={t("courses.badges.featured")}
              value={stats.featured.toString()}
              gradient="from-amber-500 to-orange-500"
            />
            <StatCard
              icon={Clock}
              label={t("courses.labels.avgDuration")}
              value={stats.avgDuration}
              gradient="from-purple-500 to-pink-500"
            />
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("courses.search.placeholder")}
                  className="w-full ps-12 pe-10 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                  showFilters
                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <Filter className="w-5 h-5" />
                <span>
                  {showFilters
                    ? t("courses.buttons.clear")
                    : t("courses.buttons.filters")}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Filter Options */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Level Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        {t("courses.labels.level")}
                      </label>
                      <select
                        value={selectedLevel || ""}
                        onChange={(e) =>
                          setSelectedLevel(e.target.value || null)
                        }
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">
                          {t("courses.labels.allLevels")}
                        </option>
                        {levels.map((level) => (
                          <option key={level} value={level}>
                            {getLevelLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        {t("courses.labels.category")}
                      </label>
                      <select
                        value={selectedCategory || ""}
                        onChange={(e) =>
                          setSelectedCategory(e.target.value || null)
                        }
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      >
                        <option value="">
                          {t("courses.labels.allCategories")}
                        </option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="pt-4 flex justify-end">
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                      >
                        {t("courses.buttons.clearAllFilters")}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Results Count */}
          {!loading && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {t("courses.sections.availableModules")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("courses.results.showing", {
                  current: filteredCourses.length.toString(),
                  total: courses.length.toString(),
                })}
                {hasActiveFilters && ` ${t("courses.results.filtered")}`}
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("paths.buttons.tryAgain")}
              </button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <EmptyState t={t} onClear={clearFilters} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <LearnCard
                  key={course.id}
                  variant="course"
                  data={toCourseCardData(course, t)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
