"use client";

import {
  Clock,
  Users,
  Star,
  Award,
  BookOpen,
  ChevronRight,
  Home,
  Play,
  CheckCircle,
  Share2,
  Bookmark,
  Loader2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface PathHeroProps {
  path: any;
  modulesCount: number;
  isEnrolled: boolean;
  isCompleted: boolean;
  progress: number;
  accessState: string;
  isRtl: boolean;
  t: (key: string) => string;
  onEnroll: () => void;
  onShare: () => void;
  onBookmark: () => void;
  isBookmarked?: boolean;
  isEnrolling: boolean;
  enrolledCount: number;
  nextCourseId?: string;
}

export default function PathHero({
  path,
  modulesCount,
  isEnrolled,
  isCompleted,
  progress,
  accessState,
  isRtl,
  t,
  onEnroll,
  onShare,
  onBookmark,
  isBookmarked,
  isEnrolling,
  enrolledCount,
  nextCourseId,
}: PathHeroProps) {
  if (!path) return null;
  const level = (path.level || "beginner").toLowerCase();

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* Floating Accents */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/20 blur-[100px] rounded-full"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -40, 0],
          y: [0, 60, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-48 -left-24 w-[500px] h-[500px] bg-purple-400/10 blur-[120px] rounded-full"
      />

      {/* Dot Pattern */}
      <div
        className="absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(79 70 229 / 0.15) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Content */}
      <div className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <motion.nav
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-8"
          >
            <Link
              href="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              {t("learn.nav.breadcrumb.home")}
            </Link>
            <ChevronRight
              className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`}
            />
            <Link
              href="/learn/paths"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {t("path.hero.badge")}
            </Link>
            <ChevronRight
              className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`}
            />
            <span className="text-gray-400 truncate max-w-[200px]">
              {path.title}
            </span>
          </motion.nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Main Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 flex flex-col items-start text-start"
            >
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="inline-flex items-center px-4 py-1.5 bg-blue-600/10 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md">
                  <Award className="w-3.5 h-3.5 mr-2" />
                  {level}
                </span>
                {path.featured && (
                  <span className="inline-flex items-center px-4 py-1.5 bg-amber-500/10 border border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    {t("paths.badges.featured")}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-slate-100 mb-6 leading-[1.1] tracking-tight">
                {path.title}
              </h1>

              {/* Description */}
              <p className="text-xl text-gray-600 dark:text-slate-400 mb-10 leading-relaxed font-medium max-w-2xl">
                {path.description}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10 p-6 bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-xl shadow-blue-900/5 w-full">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("path.hero.stats.modules")}
                  </span>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {modulesCount}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("path.hero.stats.duration")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {path.totalDuration || t("path.hero.stats.selfPaced")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("path.hero.stats.enrolled")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {enrolledCount}
                    </span>
                  </div>
                </div>
                {path.rating && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {t("path.hero.stats.rating")}
                    </span>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-500" />
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {path.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {path.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {path.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold shadow-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress Bar for enrolled */}
              {isEnrolled && (
                <div className="max-w-md w-full mb-6">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400 mb-2">
                    <span className="font-medium">
                      {t("path.hero.progress")}
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Action Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="lg:col-span-5 w-full sticky top-32"
            >
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[32px] border border-white/60 dark:border-slate-800/80 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.1)] p-8 relative overflow-hidden ring-1 ring-white/20">
                {/* Thumbnail */}
                {path.thumbnailUrl && (
                  <div className="relative rounded-2xl overflow-hidden mb-6 shadow-lg">
                    <img
                      src={path.thumbnailUrl}
                      alt={path.title}
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {accessState === "UNAUTHENTICATED" && (
                    <a
                      href="/auth/login"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-blue-200"
                    >
                      <Play className="w-4 h-4" />
                      {t("path.hero.actions.signIn")}
                    </a>
                  )}
                  {accessState === "AUTHENTICATED_NOT_ENROLLED" && (
                    <button
                      type="button"
                      onClick={() => onEnroll()}
                      disabled={isEnrolling}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-blue-200"
                    >
                      {isEnrolling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {t("path.hero.actions.enrollNow")}
                    </button>
                  )}
                  {isEnrolled && !isCompleted && (
                    <a
                      href={
                        nextCourseId
                          ? `/learn/courses/${nextCourseId}`
                          : "#curriculum"
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-200"
                    >
                      <Play className="w-4 h-4" />
                      {t("path.hero.actions.continue")} ({Math.round(progress)}
                      %)
                    </a>
                  )}
                  {isCompleted && (
                    <a
                      href="#certificate"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-blue-200"
                    >
                      <Award className="w-4 h-4" />
                      {t("path.hero.actions.viewCertificate")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onShare}
                    title={t("course.social.share")}
                    className="p-3.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onBookmark}
                    title={
                      isBookmarked
                        ? t("course.social.unbookmark")
                        : t("course.social.bookmark")
                    }
                    className={`p-3.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                      isBookmarked
                        ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 shadow-sm"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
                    }`}
                  >
                    <Bookmark
                      className={`w-5 h-5 ${isBookmarked ? "fill-current text-blue-600 dark:text-blue-400" : ""}`}
                    />
                  </button>
                </div>

                {/* Features list */}
                <div className="space-y-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {t("path.hero.features.0")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {t("path.hero.features.2")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {t("path.hero.features.3")}
                    </span>
                  </div>
                </div>

                {/* Guarantee */}
                <div className="text-center mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-xs text-gray-400">
                    {t("path.hero.actions.guarantee")}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
