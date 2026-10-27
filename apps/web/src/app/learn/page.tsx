"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Map,
  ChevronRight,
  Award,
  Users,
  Zap,
  CheckCircle,
  GraduationCap,
  Star,
  Globe,
  MonitorPlay,
  Briefcase,
  Layers,
  Clock,
  BarChart,
  Loader2,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQAccordion from "@/components/FAQAccordion";
import { apiHelpers } from "@/lib/api";
import type { ModuleResponse } from "@/lib/api";

// =============================================================================
// ANIMATION CONFIGURATIONS
// =============================================================================

const ANIMATION_CONFIGS = {
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  SPRING: {
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  STAGGER: {
    DEFAULT: 0.1,
  },
} as const;

// =============================================================================
// SUB-COMPONENT: CHOICE CARD
// =============================================================================

interface ChoiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href: string;
  color: "blue" | "purple";
  delay?: number;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({
  icon,
  title,
  description,
  action,
  href,
  color,
  delay = 0,
}) => {
  const colorClasses = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "hover:border-blue-200",
      iconBg: "bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-600",
      border: "hover:border-purple-200",
      iconBg: "bg-purple-100",
      button: "bg-purple-600 hover:bg-purple-700",
    },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay }}
      className={`group relative p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 ${colors.border}`}
    >
      <div
        className={`w-16 h-16 rounded-2xl ${colors.iconBg} ${colors.text} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
      >
        {icon}
      </div>

      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed h-12">
        {description}
      </p>

      <Link
        href={href}
        className={`inline-flex items-center justify-center w-full px-6 py-3 text-white font-semibold rounded-xl transition-colors duration-200 ${colors.button}`}
      >
        <span>{action}</span>
        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
      </Link>
    </motion.div>
  );
};

// =============================================================================
// SUB-COMPONENT: STATS BANNER
// =============================================================================

const StatsBanner = () => {
  const t = useTranslations();
  const [stats, setStats] = useState({
    learners: "...",
    courses: "...",
    paths: "...",
    lessons: "...",
    rating: "...",
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiHelpers.education.getStats();
        setStats({
          learners: data.total_enrollments
            ? `${(data.total_enrollments / 1000).toFixed(1)}k+`
            : data.totalEnrollments
              ? `${(data.totalEnrollments / 1000).toFixed(1)}k+`
              : "0",
          courses: data.total_modules
            ? `${data.total_modules}+`
            : data.totalModules
              ? `${data.totalModules}+`
              : "0",
          paths: data.total_paths
            ? `${data.total_paths}+`
            : data.totalPaths
              ? `${data.totalPaths}+`
              : "0",
          lessons: data.total_lessons
            ? `${data.total_lessons}+`
            : data.totalLessons
              ? `${data.totalLessons}+`
              : "0",
          rating: data.average_module_rating
            ? `${data.average_module_rating.toFixed(1)}/5`
            : data.averageModuleRating
              ? `${data.averageModuleRating.toFixed(1)}/5`
              : "N/A",
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
  }, []);

  const statItems = [
    {
      label: t("learn.landing.stats.learners.label"),
      value: stats.learners,
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: t("learn.landing.stats.courses.label"),
      value: stats.courses,
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      label: t("learn.landing.stats.paths.label"),
      value: stats.paths,
      icon: <Map className="w-5 h-5" />,
    },
    {
      label: t("learn.landing.stats.lessons.label"),
      value: stats.lessons,
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: t("learn.landing.stats.satisfaction.label"),
      value: stats.rating,
      icon: <Star className="w-5 h-5" />,
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border-y border-gray-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {statItems.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-3">
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: HOW IT WORKS
// =============================================================================

const HowItWorks = () => {
  const t = useTranslations();
  const { dir } = useBidi();

  const steps = [
    {
      key: "discover",
      icon: <Globe className="w-8 h-8" />,
      color: "bg-blue-100 text-blue-600",
    },
    {
      key: "learn",
      icon: <MonitorPlay className="w-8 h-8" />,
      color: "bg-purple-100 text-purple-600",
    },
    {
      key: "certify",
      icon: <Award className="w-8 h-8" />,
      color: "bg-green-100 text-green-600",
    },
  ];

  return (
    <section className="py-24 bg-gray-50 dark:bg-slate-900/60" dir={dir}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
            {t("learn.landing.howItWorks.title")}
          </h2>
          <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("learn.landing.howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-200 dark:bg-slate-800/90 -z-0 transform -translate-y-1/2"></div>

          {steps.map((step, index) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="relative z-10"
            >
              <div
                className={`w-24 h-24 rounded-2xl ${step.color} mx-auto flex items-center justify-center mb-6 shadow-sm`}
              >
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t(`learn.landing.howItWorks.steps.${step.key}.title`)}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed px-4">
                {t(`learn.landing.howItWorks.steps.${step.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =============================================================================
// SUB-COMPONENT: AUDIENCE SEGMENTS
// =============================================================================

const AudienceSegments = () => {
  const t = useTranslations();
  const segments = [
    {
      key: "students",
      icon: <GraduationCap className="w-6 h-6" />,
      color: "blue",
    },
    {
      key: "professionals",
      icon: <Briefcase className="w-6 h-6" />,
      color: "purple",
    },
    { key: "teams", icon: <Users className="w-6 h-6" />, color: "indigo" },
  ];

  return (
    <section className="py-24 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
            {t("learn.landing.audience.title")}
          </h2>
          <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("learn.landing.audience.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {segments.map((segment, index) => (
            <motion.div
              key={segment.key}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-gray-50 dark:bg-slate-900/60 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 hover:shadow-lg transition-all duration-300"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                  segment.color === "blue"
                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                    : segment.color === "purple"
                      ? "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                      : segment.color === "emerald" || segment.color === "green"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                        : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400"
                }`}
              >
                {segment.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t(`learn.landing.audience.segments.${segment.key}.title`)}
              </h3>
              <p className="text-gray-600 dark:text-slate-400">
                {t(`learn.landing.audience.segments.${segment.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =============================================================================
// SUB-COMPONENT: FEATURED COURSES (REPLACES TESTIMONIALS)
// =============================================================================

const FeaturedCourses = () => {
  const t = useTranslations();
  const [courses, setCourses] = useState<ModuleResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        // Use apiHelpers and handle array response directly
        const response = await apiHelpers.education.getPublicModules({
          featured: true,
          limit: 3,
        });

        if (Array.isArray(response)) {
          // Map snake_case response to camelCase expected by component
          const mappedCourses = response.map((m: any) => ({
            ...m,
            id: m.id,
            title: m.title,
            description: m.description,
            level: m.level,
            rating: m.rating,
            gradient: m.gradient,
            totalLessons: m.total_lessons ?? m.totalLessons, // Map total_lessons to totalLessons
            duration: m.duration_minutes
              ? `${Math.floor(m.duration_minutes / 60)}h ${m.duration_minutes % 60}m`
              : undefined,
          })) as ModuleResponse[];

          setCourses(mappedCourses);
        }
      } catch (error) {
        console.error("Failed to fetch featured courses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // Skeleton loader
  if (loading) {
    return (
      <section className="py-24 bg-gray-50 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-gray-200 dark:bg-slate-800/90 w-1/3 mx-auto rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 bg-gray-200 dark:bg-slate-800/90 rounded-2xl"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (courses.length === 0) return null;

  return (
    <section className="py-24 bg-gradient-to-br from-blue-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white dark:bg-slate-900 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t("learn.landing.featured.title")}
          </h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            {t("learn.landing.featured.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div
                className={`h-2 bg-gradient-to-r ${course.gradient || "from-blue-500 to-purple-500"}`}
              ></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                    {course.level || t("learn.landing.featured.beginnerLevel")}
                  </span>
                  <div className="flex items-center text-yellow-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="ltr:ml-1 rtl:mr-1 text-sm font-medium">
                      {course.rating
                        ? course.rating.toFixed(1)
                        : t("learn.landing.featured.new")}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2 line-clamp-2 h-14">
                  {course.title}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6 text-sm line-clamp-3 h-16">
                  {course.description}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mb-6">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                    {course.duration || t("learn.landing.featured.duration")}
                  </div>
                  <div className="flex items-center">
                    <BarChart className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
                    {course.totalLessons ||
                      `12 ${t("learn.landing.featured.lessons")}`}
                  </div>
                </div>

                <Link
                  href={`/learn/courses/${course.id}`}
                  className="block w-full py-3 text-center bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  {t("learn.landing.featured.viewCourse")}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =============================================================================
// SUB-COMPONENT: CTA SECTION
// =============================================================================

const CTASection = () => {
  const t = useTranslations();

  return (
    <section className="py-24 bg-gray-50 dark:bg-slate-900/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-12 shadow-xl border border-gray-100 dark:border-slate-800"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-6">
            {t("learn.landing.cta.title")}
          </h2>
          <p className="text-xl text-gray-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            {t("learn.landing.cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-200"
            >
              {t("learn.landing.cta.primary")}
              <ArrowRight className="w-5 h-5 ml-2 rtl:rotate-180" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 dark:border-blue-800/80 transition-all"
            >
              {t("learn.landing.cta.secondary")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function LearnPage() {
  const t = useTranslations();
  const { dir } = useBidi();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900" dir={dir}>
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 dark:bg-blue-950/40 rounded-full blur-3xl mix-blend-multiply opacity-50"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 dark:bg-purple-950/40 rounded-full blur-3xl mix-blend-multiply opacity-50"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10 text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION_CONFIGS.EASING.ENTER}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm mb-8"
            >
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                {t("learn.landing.hero.badge")}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-slate-100 mb-6 tracking-tight"
            >
              {t("learn.landing.hero.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t("learn.landing.hero.highlight")}
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay: 0.2 }}
              className="text-xl text-gray-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              {t("learn.landing.hero.subtitle")}
            </motion.p>

            {/* Main Choices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <ChoiceCard
                icon={<BookOpen className="w-8 h-8" />}
                title={t("learn.landing.choices.courses.title")}
                description={t("learn.landing.choices.courses.desc")}
                action={t("learn.landing.choices.courses.action")}
                href="/learn/courses"
                color="blue"
                delay={0.3}
              />
              <ChoiceCard
                icon={<Map className="w-8 h-8" />}
                title={t("learn.landing.choices.paths.title")}
                description={t("learn.landing.choices.paths.desc")}
                action={t("learn.landing.choices.paths.action")}
                href="/learn/paths"
                color="purple"
                delay={0.4}
              />
            </div>
          </div>
        </section>

        <StatsBanner />

        <HowItWorks />

        <AudienceSegments />

        <FeaturedCourses />

        <FAQAccordion
          items={t.raw("learn.landing.faq.items") || []}
          title={t("learn.landing.faq.title")}
          subtitle={t("learn.landing.faq.subtitle")}
          searchable
          multiOpen
        />

        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
