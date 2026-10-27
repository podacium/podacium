"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Banknote,
  TrendingUp,
  TrendingDown,
  Equal,
  Award,
  Clock,
  CheckCircle,
  Plus,
  ChevronRight,
  Target,
  BarChart3,
  MessageSquare,
  FileText,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Shield,
  Rocket,
  Sparkles,
  ArrowUpRight,
  HelpCircle,
  Phone,
  Code,
  Palette,
  Megaphone,
  Database,
  ShieldCheck,
  Layers,
  Cpu,
  Cloud,
  UserX,
  XCircle,
  Mail,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { ProjectCard } from "@/components/hub/ProjectCard";
import { FreelancerCard } from "@/components/hub/FreelancerCard";
import { api, ProjectResponse, FreelancerProfileResponse } from "@/lib/api";

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
    BOUNCY: { type: "spring", stiffness: 400, damping: 15, mass: 1 },
    SMOOTH: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
    STANDARD: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    BOUNCE: { duration: 0.6, ease: [0.68, -0.55, 0.265, 1.55] },
  },
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
    SLOW: 0.2,
  },
} as const;

interface SectionHeaderProps {
  title: string;
  description?: string;
  actionText?: string;
  actionLink?: string;
  actionOnClick?: () => void;
  showViewAll?: boolean;
  isLoading?: boolean;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actionText,
  actionLink,
  actionOnClick,
  showViewAll = true,
  isLoading = false,
  badge,
}) => {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-64"></div>
          {description && (
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-96"></div>
          )}
        </div>
        {(actionText || showViewAll) && (
          <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-24 mt-4 sm:mt-0"></div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {title}
            </h2>
            {badge && (
              <span className="px-2.5 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-gray-600 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {(actionText || showViewAll) && (
        <div className="mt-4 sm:mt-0">
          {actionLink ? (
            <Link
              href={actionLink}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : actionOnClick ? (
            <button
              onClick={actionOnClick}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface CategoryPillProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

const CategoryPill: React.FC<CategoryPillProps> = ({
  icon,
  label,
  count,
  isActive,
  onClick,
}) => {
  const t = useTranslations();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 min-w-[180px] ${
        isActive
          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
          : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 text-gray-700 dark:text-slate-300 hover:border-blue-200 hover:shadow-md"
      }`}
    >
      <div
        className={`p-2 rounded-lg transition-transform duration-300 ${
          isActive
            ? "bg-white/20 group-hover:scale-110"
            : "bg-gray-100 dark:bg-slate-800 group-hover:bg-blue-50 group-hover:scale-110"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 text-left">
        <div
          className={`font-semibold ${isActive ? "text-white" : "text-gray-900 dark:text-slate-100"}`}
        >
          {label}
        </div>
        <div
          className={`text-sm flex items-center justify-between ${
            isActive ? "text-blue-100" : "text-gray-500 dark:text-slate-400"
          }`}
        >
          <span>
            {count}{" "}
            {count === 1 ? t("hub.projectSingular") : t("hub.projectPlural")}
          </span>
          {isActive && <CheckCircle className="w-4 h-4" />}
        </div>
      </div>

      {count > 0 && !isActive && (
        <span
          className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold ${
            count === 0
              ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
              : count < 3
                ? "bg-blue-100 text-blue-600"
                : count < 10
                  ? "bg-green-100 text-green-600"
                  : "bg-purple-100 text-purple-600"
          }`}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
};

const ProjectGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 h-64">
          <div className="flex items-start justify-between mb-4">
            <div className="w-3/4 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3"></div>
          <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-3 w-2/3"></div>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
              <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            </div>
            <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const FreelancerGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 h-72">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3"></div>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            <div className="w-14 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full"></div>
            </div>
            <div className="text-center">
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full"></div>
            </div>
            <div className="text-center">
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full"></div>
            </div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
        </div>
      </div>
    ))}
  </div>
);

export const PublicFreelanceCatalog = () => {
  const t = useTranslations();
  const router = useRouter();
  const [trendingProjects, setTrendingProjects] = useState<ProjectResponse[]>(
    [],
  );
  const [topFreelancers, setTopFreelancers] = useState<
    FreelancerProfileResponse[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [filteredProjects, setFilteredProjects] = useState<ProjectResponse[]>(
    [],
  );

  const categories = useMemo(() => {
    const baseCategories = [
      {
        id: "all",
        label: t("hub.categories.all"),
        icon: <Layers className="w-5 h-5" />,
        count: 0,
        keywords: [],
      },
      {
        id: "web",
        label: t("hub.categories.webDevelopment"),
        icon: <Code className="w-5 h-5" />,
        count: 0,
        keywords: [
          "html",
          "css",
          "javascript",
          "react",
          "vue",
          "angular",
          "node",
          "next",
          "frontend",
          "backend",
          "fullstack",
          "web",
          "website",
          "wordpress",
          "php",
          "laravel",
          "django",
          "express",
        ],
      },
      {
        id: "design",
        label: t("hub.categories.uiUxDesign"),
        icon: <Palette className="w-5 h-5" />,
        count: 0,
        keywords: [
          "design",
          "ui",
          "ux",
          "figma",
          "photoshop",
          "illustrator",
          "adobe",
          "sketch",
          "prototype",
          "wireframe",
          "user interface",
          "user experience",
          "visual design",
        ],
      },
      {
        id: "marketing",
        label: t("hub.categories.digitalMarketing"),
        icon: <Megaphone className="w-5 h-5" />,
        count: 0,
        keywords: [
          "marketing",
          "seo",
          "social media",
          "digital marketing",
          "content",
          "email",
          "campaign",
          "branding",
          "advertising",
          "google ads",
          "facebook ads",
          "analytics",
        ],
      },
      {
        id: "data",
        label: t("hub.categories.dataScience"),
        icon: <Database className="w-5 h-5" />,
        count: 0,
        keywords: [
          "data",
          "python",
          "machine learning",
          "ai",
          "analytics",
          "sql",
          "database",
          "analysis",
          "pandas",
          "numpy",
          "tensorflow",
          "pytorch",
          "big data",
        ],
      },
      {
        id: "mobile",
        label: t("hub.categories.mobileApps"),
        icon: <Cpu className="w-5 h-5" />,
        count: 0,
        keywords: [
          "mobile",
          "flutter",
          "react native",
          "ios",
          "android",
          "swift",
          "kotlin",
          "mobile app",
          "cross-platform",
          "xamarin",
          "ionic",
        ],
      },
      {
        id: "devops",
        label: t("hub.categories.devopsCloud"),
        icon: <Cloud className="w-5 h-5" />,
        count: 0,
        keywords: [
          "devops",
          "cloud",
          "aws",
          "azure",
          "gcp",
          "docker",
          "kubernetes",
          "ci/cd",
          "terraform",
          "jenkins",
          "linux",
          "server",
        ],
      },
      {
        id: "business",
        label: t("hub.categories.businessConsulting"),
        icon: <Briefcase className="w-5 h-5" />,
        count: 0,
        keywords: [
          "business",
          "consulting",
          "management",
          "strategy",
          "planning",
          "analysis",
          "excel",
          "powerpoint",
          "presentation",
        ],
      },
    ];

    return baseCategories.map((category) => {
      if (category.id === "all") {
        return { ...category, count: trendingProjects.length };
      }

      const count = trendingProjects.filter((project) => {
        if (!project.skills || project.skills.length === 0) return false;
        const projectSkills = project.skills.map((skill) =>
          skill.toLowerCase(),
        );
        return projectSkills.some((skill) =>
          category.keywords.some(
            (keyword) =>
              skill.includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(skill),
          ),
        );
      }).length;

      return { ...category, count };
    });
  }, [trendingProjects, t]);

  useEffect(() => {
    if (activeCategory === "all") {
      setFilteredProjects(trendingProjects);
    } else {
      const activeCat = categories.find((cat) => cat.id === activeCategory);
      if (!activeCat) {
        setFilteredProjects(trendingProjects);
        return;
      }

      const filtered = trendingProjects.filter((project) => {
        if (!project.skills || project.skills.length === 0) return false;
        const projectSkills = project.skills.map((skill) =>
          skill.toLowerCase(),
        );
        return projectSkills.some((skill) =>
          activeCat.keywords.some(
            (keyword) =>
              skill.includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(skill),
          ),
        );
      });

      setFilteredProjects(filtered);
    }
  }, [activeCategory, trendingProjects, categories]);

  const fetchPublicData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const projectsResponse = await api.listPublicProjects({
        limit: 50,
        skills: undefined,
      });

      const transformedProjects: ProjectResponse[] = (
        projectsResponse.projects || []
      ).map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        ownerId: project.owner?.id || 0,
        skills: project.skills || [],
        status: project.status,
        createdAt: project.createdAt,
        owner: project.owner
          ? {
              id: project.owner.id,
              fullName: project.owner.fullName,
              profilePictureUrl: project.owner.profilePictureUrl,
              country: project.owner.country,
              city: project.owner.city,
              phoneVerified: false,
            }
          : undefined,
        has_applied: false,
        is_owner: false,
      }));

      setTrendingProjects(transformedProjects);

      const freelancersResponse = await api.searchPublicFreelancers({
        limit: 6,
      });

      const transformedFreelancers: FreelancerProfileResponse[] = (
        freelancersResponse.freelancers || []
      ).map((freelancer) => {
        let trustScore = 0;
        if (freelancer.phone_verified) trustScore += 30;
        if (freelancer.certificates_count > 0) trustScore += 20;
        if (freelancer.completed_projects > 0)
          trustScore += Math.min(freelancer.completed_projects * 10, 50);
        if (freelancer.skills && freelancer.skills.length > 0)
          trustScore += Math.min(freelancer.skills.length * 5, 20);
        trustScore = Math.min(trustScore, 100);

        return {
          id: freelancer.id,
          full_name: freelancer.fullName || "",
          fullName: freelancer.fullName || "",
          bio: freelancer.bio || "",
          profile_picture_url: freelancer.profilePictureUrl || "",
          profilePictureUrl: freelancer.profilePictureUrl || "",
          skills: freelancer.skills || [],
          city: freelancer.city || "",
          country: freelancer.country || "",
          phone_verified: freelancer.phone_verified || false,
          phoneVerified: freelancer.phone_verified || false,
          role: freelancer.role || "FREELANCER",
          certificates_count: freelancer.certificates_count || 0,
          completed_projects: freelancer.completed_projects || 0,
          avg_rating: 0,
          total_earnings: 0,
          certificates: [],
          skills_details: [],
          completed_contracts: [],
          trust_score: trustScore,
          accepted_proposals: 0,
        };
      });

      setTopFreelancers(transformedFreelancers);
    } catch (err: any) {
      console.error("Error fetching public catalog:", err);
      setError(t("hub.errors.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  return (
    <>
      <section className="relative pt-28 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid-gray-100/50 dark:bg-grid-slate-800/30 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
        <div className="relative max-w-8xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="text-center space-y-8"
          >
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg">
              <Sparkles className="w-4 h-4 mr-2" />
              {t("hub.hero.badge")}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
              {t("hub.hero.titleLine1")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("hub.hero.titleHighlight")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t("hub.hero.description")}
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Link
                href="/auth/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Briefcase className="w-5 h-5 mr-2" />
                {t("hub.buttons.startFreelancing")}
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
              </Link>
              <Link
                href="/auth/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
              >
                <Users className="w-5 h-5 mr-2" />
                {t("hub.buttons.hireTalent")}
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-slate-900/60">
        <div className="max-w-8xl mx-auto">
          <SectionHeader
            title={t("hub.sections.trendingProjects")}
            description={t("hub.sections.trendingProjectsDesc")}
            actionText={t("hub.buttons.browseAllProjects")}
            actionLink="/hub/projects"
          />

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {t("hub.filters.category")}
              </h3>
              <div className="text-sm text-gray-600 dark:text-slate-400">
                {t("hub.filters.showingCount", {
                  showing: filteredProjects.length.toString(),
                  total: trendingProjects.length.toString(),
                })}
              </div>
            </div>

            <div className="relative">
              <div className="flex flex-nowrap gap-6 pb-4 overflow-x-auto scrollbar-hide px-3 pr-6">
                {categories.map((category) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-shrink-0 py-4"
                  >
                    <CategoryPill
                      icon={category.icon}
                      label={category.label}
                      count={category.count}
                      isActive={activeCategory === category.id}
                      onClick={() => handleCategoryClick(category.id)}
                    />
                  </motion.div>
                ))}
              </div>

              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-50 to-transparent dark:from-slate-900 dark:to-transparent pointer-events-none"></div>
            </div>

            {activeCategory !== "all" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-blue-200 dark:border-blue-800/80"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    {categories.find((c) => c.id === activeCategory)?.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-slate-100">
                      {categories.find((c) => c.id === activeCategory)?.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      {t("hub.filters.matchingProjects", {
                        count: filteredProjects.length.toString(),
                        category:
                          categories.find((c) => c.id === activeCategory)
                            ?.label || "",
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveCategory("all")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                >
                  {t("hub.buttons.clearFilter")}
                </button>
              </motion.div>
            )}
          </div>

          {loading ? (
            <ProjectGridSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {t("hub.errors.unableToLoadProjects")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
              <button
                onClick={fetchPublicData}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                {t("hub.buttons.tryAgain")}
              </button>
            </div>
          ) : filteredProjects.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.slice(0, 6).map((project) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -8 }}
                  >
                    <ProjectCard
                      project={project}
                      variant="grid"
                      onClick={() => router.push(`/hub/projects/${project.id}`)}
                      compact
                    />
                  </motion.div>
                ))}
              </div>

              {filteredProjects.length > 6 && (
                <div className="mt-8 text-center">
                  <p className="text-gray-600 dark:text-slate-400 mb-4">
                    {t("hub.sections.showingFilteredProjects", {
                      showing: "6",
                      total: filteredProjects.length.toString(),
                      category:
                        categories.find((c) => c.id === activeCategory)
                          ?.label || "",
                    })}
                  </p>
                  <button
                    onClick={() =>
                      router.push(`/hub/projects?category=${activeCategory}`)
                    }
                    className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300 inline-flex items-center"
                  >
                    {t("hub.buttons.viewAllCategoryProjects", {
                      category:
                        categories.find((c) => c.id === activeCategory)
                          ?.label || "",
                    })}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {t("hub.empty.noProjectsInCategory", {
                  category:
                    categories.find((c) => c.id === activeCategory)?.label ||
                    "",
                })}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6">
                {t("hub.empty.noProjectsMatchCategory")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => setActiveCategory("all")}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                >
                  {t("hub.buttons.browseAllProjects")}
                </button>
                <Link
                  href="/hub/projects"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300 inline-flex items-center justify-center"
                >
                  {t("hub.buttons.exploreAllCategories")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
        <div className="max-w-8xl mx-auto">
          <SectionHeader
            title={t("hub.sections.topFreelancers")}
            description={t("hub.sections.topFreelancersDesc")}
            actionText={t("hub.buttons.browseAllFreelancers")}
            actionLink="/hub/freelancers"
          />

          {loading ? (
            <FreelancerGridSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {t("hub.errors.unableToLoadFreelancers")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
            </div>
          ) : topFreelancers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topFreelancers.slice(0, 6).map((freelancer) => (
                <motion.div
                  key={freelancer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -8 }}
                >
                  <FreelancerCard
                    freelancer={freelancer}
                    variant="grid"
                    onClick={() => router.push(`/profile/${freelancer.id}`)}
                    compact
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {t("hub.empty.noFreelancersAvailable")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6">
                {t("hub.empty.checkBackLater")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-8xl mx-auto">
          <SectionHeader
            title={t("hub.sections.howItWorks")}
            description={t("hub.sections.howItWorksDesc")}
            badge={t("hub.badges.easySecure")}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-slate-800/50 shadow-sm h-full">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl w-fit mb-4">
                  <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("hub.howItWorks.step1Title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("hub.howItWorks.step1Description")}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-slate-800/50 shadow-sm h-full">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl w-fit mb-4">
                  <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("hub.howItWorks.step2Title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("hub.howItWorks.step2Description")}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-3 -left-4 w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-slate-800/50 shadow-sm h-full">
                <div className="p-3 bg-green-100 dark:bg-emerald-950/60 rounded-xl w-fit mb-4">
                  <Banknote className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("hub.howItWorks.step3Title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("hub.howItWorks.step3Description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-blue-900">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              {t("hub.cta.title")}
            </h2>
            <p className="text-xl text-blue-200 mb-10 max-w-2xl mx-auto">
              {t("hub.cta.description")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/auth/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-3xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {t("hub.buttons.getStartedFree")}
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
              </Link>
              <Link
                href="/auth/login"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center px-8 py-3.5 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
              >
                {t("hub.buttons.signInToContinue")}
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};
