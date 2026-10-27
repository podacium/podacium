// /app/hub/projects/page.tsx - COMPLETE PROJECTS BROWSE PAGE
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Banknote,
  TrendingUp,
  TrendingDown,
  Equal,
  Star,
  Award,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Zap,
  Target,
  Calendar,
  BarChart3,
  MessageSquare,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Shield,
  Rocket,
  Sparkles,
  ArrowUpRight,
  HelpCircle,
  Eye,
  BarChart,
  MapPin,
  Phone,
  Mail,
  Globe,
  Building,
  Code,
  Palette,
  Megaphone,
  Database,
  ShieldCheck,
  Layers,
  Cpu,
  Cloud,
  Lock,
  Unlock,
  ExternalLink,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  ThumbsUp,
  Users2,
  TrendingUp as TrendingUpIcon,
  Award as AwardIcon,
  Globe as GlobeIcon,
  Sparkles as SparklesIcon,
  X,
  SlidersHorizontal,
  CalendarDays,
  Tag,
  ChevronLeft,
  ChevronDown,
  Grid3x3,
  List,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ProjectCard } from "@/components/hub/ProjectCard";
import { useAuth } from "@/contexts/AuthContext";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import { ProjectResponse, ProjectStatus, UserRole } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useProjects, usePublicProjects } from "@/hooks/useProjects";

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

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

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

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
              <ChevronRight className="w-4 h-4 mr-2 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : actionOnClick ? (
            <button
              onClick={actionOnClick}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 mr-2 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface FilterPillProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  icon?: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({
  label,
  value,
  isActive,
  onClick,
  count,
  icon,
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`group relative flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300 ${
      isActive
        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 text-gray-700 dark:text-slate-300 hover:border-blue-200 hover:shadow-sm"
    }`}
  >
    {icon && (
      <div
        className={`transition-transform duration-300 ${
          isActive
            ? "text-white"
            : "text-gray-500 dark:text-slate-400 group-hover:text-blue-500"
        }`}
      >
        {icon}
      </div>
    )}
    <span className="font-medium text-sm whitespace-nowrap">{label}</span>
    {count !== undefined && (
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full ${
          isActive
            ? "bg-white/20 text-white"
            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
        }`}
      >
        {count}
      </span>
    )}
  </motion.button>
);

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  isLoading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder,
  isLoading = false,
}) => {
  const t = useTranslations();
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="w-full pl-12 pr-40 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500"
        />
        <div className="absolute right-2 flex items-center space-x-2">
          {value && (
            <button
              onClick={() => onChange("")}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <PodaciumButton
            variant="gradient"
            size="sm"
            onClick={onSearch}
            disabled={isLoading}
            loading={isLoading}
            className="h-9 px-4 font-semibold"
          >
            {t("freelancers.list.searchButton")}
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
};

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  children,
  isOpen = true,
  onToggle,
}) => (
  <div className="border-b border-gray-200/50 dark:border-slate-800/50 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-gray-900 dark:text-slate-100">
        {title}
      </h3>
      {onToggle && (
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
    {isOpen && <div className="space-y-2">{children}</div>}
  </div>
);

interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
}

const FilterCheckbox: React.FC<FilterCheckboxProps> = ({
  label,
  checked,
  onChange,
  count,
}) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 focus:ring-offset-0"
      />
      <span
        className={`text-sm ${checked ? "text-blue-700 dark:text-blue-300 font-medium" : "text-gray-700 dark:text-slate-300"}`}
      >
        {label}
      </span>
    </div>
    {count !== undefined && (
      <span
        className={`text-xs px-1.5 py-0.5 rounded ${
          checked
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
        }`}
      >
        {count}
      </span>
    )}
  </label>
);

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const ProjectGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
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

const FiltersSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-4"></div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-5 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4"></div>
        <div className="space-y-1">
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-5/6"></div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ProjectsBrowsePage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // UI State Management
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    skills: [] as string[],
    status: [] as ProjectStatus[],
    budgetMin: undefined as number | undefined,
    budgetMax: undefined as number | undefined,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  // React Query hooks for data fetching
  const projectParams = {
    limit: 100,
    search: searchQuery || undefined,
    skills: filters.skills.length > 0 ? filters.skills : undefined,
    status: filters.status.length > 0 ? filters.status[0] : undefined,
  };

  const {
    data: authProjectsData,
    isLoading: authLoadingData,
    error: authError,
  } = useProjects(projectParams);
  const {
    data: publicProjectsData,
    isLoading: publicLoadingData,
    error: publicError,
  } = usePublicProjects({
    limit: 100,
    search: searchQuery || undefined,
  });

  const isLoading = isAuthenticated ? authLoadingData : publicLoadingData;
  const error = isAuthenticated ? authError : publicError;
  const projects = isAuthenticated
    ? authProjectsData?.projects || []
    : publicProjectsData?.projects || [];

  // Extract skills from URL params
  useEffect(() => {
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    if (category && category !== "undefined" && category !== "null") {
      setActiveFilters([category]);
    }

    if (search && search !== "undefined" && search !== "null") {
      setSearchQuery(search);
    }
  }, [searchParams]);

  // Calculate unique skills from projects
  const uniqueSkills = useMemo(() => {
    const skillsSet = new Set<string>();
    projects.forEach((project) => {
      project.skills?.forEach((skill) => {
        if (skill) skillsSet.add(skill);
      });
    });
    return Array.from(skillsSet).sort();
  }, [projects]);

  // Calculate project statistics
  const stats = useMemo(() => {
    return {
      total: projects.length,
      open: projects.filter((p) => p.status === "OPEN").length,
      inProgress: projects.filter((p) => p.status === "IN_PROGRESS").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
    };
  }, [projects]);

  // Filter projects based on active filters
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Apply skill filters
    if (filters.skills.length > 0) {
      filtered = filtered.filter((project) =>
        project.skills?.some((skill) => filters.skills.includes(skill)),
      );
    }

    // Apply status filters
    if (filters.status.length > 0) {
      filtered = filtered.filter((project) =>
        filters.status.includes(project.status as ProjectStatus),
      );
    }

    return filtered;
  }, [projects, filters]);

  // Project count by status
  const getStatusCount = useCallback(
    (status: ProjectStatus) => {
      return projects.filter((p) => p.status === status).length;
    },
    [projects],
  );

  // Get filtered skill count
  const getSkillCount = useCallback(
    (skill: string) => {
      return projects.filter((project) => project.skills?.includes(skill))
        .length;
    },
    [projects],
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filterType: keyof typeof filters, value: any) => {
      setFilters((prev) => ({
        ...prev,
        [filterType]: value,
      }));
    },
    [],
  );

  // Retry fetch on error
  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  }, [queryClient]);

  // Search handler - React Query auto-fetches when searchQuery changes
  const handleSearch = useCallback(() => {
    // React Query will automatically re-fetch when searchQuery changes
  }, []);

  // Handle skill filter toggle
  const handleSkillToggle = useCallback((skill: string) => {
    setFilters((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  }, []);

  // Handle status filter toggle
  const handleStatusToggle = useCallback((status: ProjectStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      skills: [],
      status: [],
      budgetMin: undefined,
      budgetMax: undefined,
    });
    setActiveFilters([]);
    setSearchQuery("");
  }, []);

  // Apply filters - just updates state, React Query will refetch
  const handleApplyFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg max-w-2xl mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg max-w-3xl mx-auto"></div>
            </div>
            <ProjectGridSkeleton />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      {/* Header Section */}
      <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid-blue-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
        <div className="relative max-w-8xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg">
              <Briefcase className="w-4 h-4 mr-2 ml-2" />
              {t("projects.list.badgeBrowse")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {t("projects.list.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("projects.list.titleHighlight")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t("projects.list.description")}
              <br />
              {t("projects.list.filterTip")}
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto pt-4">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                placeholder={t("projects.list.searchPlaceholder")}
                isLoading={isLoading}
              />
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {stats.total}
                  </span>
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("projects.list.totalProjects")}
                  </span>
                </div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {stats.open}
                  </span>
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("projects.list.open")}
                  </span>
                </div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {stats.inProgress}
                  </span>
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("projects.list.inProgress")}
                  </span>
                </div>
              </div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {stats.completed}
                  </span>
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("projects.list.completed")}
                  </span>
                </div>
              </div>
              {!isAuthenticated && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-4 py-2 border border-blue-500 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-white" />
                    <span className="font-semibold text-white">
                      {t("projects.list.signUpToApply")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-8xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar - Desktop */}
            <div className="lg:w-1/4">
              <div className="sticky top-24">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center">
                      <Filter className="w-5 h-5 mr-2 ml-2 text-blue-500 dark:text-blue-400" />
                      {t("projects.list.filtersTitle")}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleClearFilters}
                        className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium"
                      >
                        {t("projects.list.clearAll")}
                      </button>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Active Filters */}
                  {((filters.skills?.length || 0) > 0 ||
                    (filters.status?.length || 0) > 0) && (
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {(filters.skills || []).map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80"
                          >
                            {skill}
                            <button
                              onClick={() => handleSkillToggle(skill)}
                              className="mr-2 ml-2.5 text-blue-500 hover:text-blue-700 dark:text-blue-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {(filters.status || []).map((status) => (
                          <span
                            key={status}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80"
                          >
                            {status}
                            <button
                              onClick={() => handleStatusToggle(status)}
                              className="mr-2 ml-2.5 text-purple-500 hover:text-purple-700 dark:text-purple-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Filter */}
                  <FilterSection title={t("projects.list.statusFilterTitle")}>
                    <div className="space-y-2">
                      <FilterCheckbox
                        label={t("projects.list.statusOpen")}
                        checked={filters.status.includes(ProjectStatus.OPEN)}
                        onChange={() => handleStatusToggle(ProjectStatus.OPEN)}
                        count={getStatusCount(ProjectStatus.OPEN)}
                      />
                      <FilterCheckbox
                        label={t("projects.list.statusInProgress")}
                        checked={filters.status.includes(
                          ProjectStatus.IN_PROGRESS,
                        )}
                        onChange={() =>
                          handleStatusToggle(ProjectStatus.IN_PROGRESS)
                        }
                        count={getStatusCount(ProjectStatus.IN_PROGRESS)}
                      />
                      <FilterCheckbox
                        label={t("projects.list.statusCompleted")}
                        checked={filters.status.includes(
                          ProjectStatus.COMPLETED,
                        )}
                        onChange={() =>
                          handleStatusToggle(ProjectStatus.COMPLETED)
                        }
                        count={getStatusCount(ProjectStatus.COMPLETED)}
                      />
                    </div>
                  </FilterSection>

                  {/* Skills Filter */}
                  {uniqueSkills.length > 0 && (
                    <FilterSection title={t("projects.list.skillsFilterTitle")}>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {uniqueSkills.slice(0, 20).map((skill) => (
                          <FilterCheckbox
                            key={skill}
                            label={skill}
                            checked={filters.skills.includes(skill)}
                            onChange={() => handleSkillToggle(skill)}
                            count={getSkillCount(skill)}
                          />
                        ))}
                        {uniqueSkills.length > 20 && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 pt-2">
                            {t("projects.list.moreSkills", {
                              count: String(uniqueSkills.length - 20),
                            })}
                          </p>
                        )}
                      </div>
                    </FilterSection>
                  )}

                  {/* Apply Button */}
                  <PodaciumButton
                    variant="gradient"
                    fullWidth
                    onClick={handleApplyFilters}
                    className="mt-6 h-12 rounded-xl font-bold shadow-md"
                  >
                    {t("projects.list.applyFilters")}
                  </PodaciumButton>
                </div>
              </div>
            </div>

            {/* Projects Content */}
            <div className="lg:w-3/4">
              {/* Mobile Filters Toggle */}
              <div className="lg:hidden mb-6">
                <button
                  onClick={() => setShowFilters(true)}
                  className="w-full flex items-center justify-center px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl hover:shadow-md transition-all duration-300"
                >
                  <SlidersHorizontal className="w-5 h-5 mr-2 ml-2 text-blue-500 dark:text-blue-400" />
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("projects.list.showFilters")}
                  </span>
                  {(filters.skills.length > 0 || filters.status.length > 0) && (
                    <span className="mr-2 ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                      {filters.skills.length + filters.status.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Content Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("projects.list.availableProjects")}
                    <span className="mr-2 ml-2 text-blue-600 dark:text-blue-400">
                      ({filteredProjects.length})
                    </span>
                  </h2>
                  <p className="text-gray-600 dark:text-slate-400">
                    {filteredProjects.length === projects.length
                      ? t("projects.list.showingAll", {
                          count: String(projects.length),
                        })
                      : t("projects.list.showingFiltered", {
                          showing: String(filteredProjects.length),
                          total: String(projects.length),
                        })}
                  </p>
                </div>

                <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                  {/* View Toggle */}
                  <div className="flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-slate-800/50 p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded transition-all duration-300 ${
                        viewMode === "grid"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
                      }`}
                    >
                      <Grid3x3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded transition-all duration-300 ${
                        viewMode === "list"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
                      }`}
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Create Project Button (for authenticated clients) */}
                  {isAuthenticated &&
                  user &&
                  (user.role === UserRole.BUSINESS ||
                    user.role === UserRole.ADMIN) ? (
                    <Link
                      href="/hub/projects/new"
                      className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                    >
                      <Plus className="w-5 h-5 mr-2 ml-2" />
                      {t("projects.list.newProject")}
                    </Link>
                  ) : (
                    !isAuthenticated && (
                      <Link
                        href="/auth/signup"
                        className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                      >
                        <Plus className="w-5 h-5 mr-2 ml-2" />
                        {t("projects.list.signUpToCreate")}
                      </Link>
                    )
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-6 mb-8"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-800 dark:text-red-200 font-semibold">
                        {error?.message ||
                          String(error) ||
                          t("hub.errors.loadError")}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2 ml-2" />
                        {t("hub.buttons.tryAgain")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Projects Grid */}
              {isLoading ? (
                <ProjectGridSkeleton />
              ) : filteredProjects.length > 0 ? (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                      <AnimatePresence>
                        {filteredProjects.map((project) => (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ y: -8 }}
                            layout
                          >
                            <ProjectCard
                              project={project as any} // Cast to any since ProjectCard expects ProjectResponse
                              variant="grid"
                              onClick={() => {
                                if (isAuthenticated) {
                                  router.push(`/hub/projects/${project.id}`);
                                } else {
                                  // Redirect to signup for unauthenticated users
                                  router.push(
                                    "/auth/signup?redirect=/hub/projects",
                                  );
                                }
                              }}
                              compact={false}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence>
                        {filteredProjects.map((project) => (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ x: 4 }}
                            layout
                          >
                            <ProjectCard
                              project={project as any}
                              variant="list"
                              onClick={() => {
                                if (isAuthenticated) {
                                  router.push(`/hub/projects/${project.id}`);
                                } else {
                                  router.push(
                                    "/auth/signup?redirect=/hub/projects",
                                  );
                                }
                              }}
                              compact={false}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
                  <Briefcase className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                    {t("projects.list.noProjectsFound")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                    {searchQuery ||
                    filters.skills.length > 0 ||
                    filters.status.length > 0
                      ? t("projects.list.noProjectsSearch")
                      : t("projects.list.noProjectsAvailable")}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button
                      onClick={handleClearFilters}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                    >
                      {t("projects.list.clearFilters")}
                    </button>
                    {isAuthenticated &&
                      user &&
                      (user.role === UserRole.BUSINESS ||
                        user.role === UserRole.ADMIN) && (
                        <Link
                          href="/hub/projects/new"
                          className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                        >
                          {t("projects.list.createFirstProject")}
                        </Link>
                      )}
                    {!isAuthenticated && (
                      <button
                        onClick={() =>
                          router.push(`/auth/signup?redirect=${pathname}`)
                        }
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                      >
                        {t("projects.list.signUpToCreateProjects")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Refresh Button */}
              {filteredProjects.length > 0 &&
                filteredProjects.length < projects.length && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={handleRetry}
                      className="px-8 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300 inline-flex items-center"
                    >
                      <RefreshCw className="w-5 h-5 mr-2 ml-2" />
                      {t("hub.buttons.viewAll")}
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Filters Drawer */}
      <PodaciumDrawer
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        position="start"
        size="sm"
      >
        <DrawerContent
          className="w-80 lg:hidden"
          overlayClassName="bg-black/50 lg:hidden"
        >
          <DrawerHeader className="items-center border-gray-200 px-6 py-6 dark:border-slate-800">
            <DrawerTitle className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {t("projects.list.filtersTitle")}
            </DrawerTitle>
            <DrawerClose className="p-2 text-gray-400 dark:text-slate-400" />
          </DrawerHeader>

          <DrawerBody className="p-6">
            <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                  {t("projects.list.activeFiltersTitle")}
                </h3>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                >
                  {t("projects.list.clearAll")}
                </button>
              </div>

              {(filters.skills?.length || 0) === 0 &&
              (filters.status?.length || 0) === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-sm">
                  {t("projects.list.noFiltersApplied")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(filters.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80"
                    >
                      {skill}
                      <button
                        onClick={() => handleSkillToggle(skill)}
                        className="mr-2 ml-2.5 text-blue-500 hover:text-blue-700 dark:text-blue-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {(filters.status || []).map((status) => (
                    <span
                      key={status}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80"
                    >
                      {status}
                      <button
                        onClick={() => handleStatusToggle(status)}
                        className="mr-2 ml-2.5 text-purple-500 hover:text-purple-700 dark:text-purple-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.list.statusFilterTitle")}
              </h3>
              <div className="space-y-2">
                <FilterCheckbox
                  label={t("projects.list.statusOpen")}
                  checked={filters.status.includes(ProjectStatus.OPEN)}
                  onChange={() => handleStatusToggle(ProjectStatus.OPEN)}
                  count={getStatusCount(ProjectStatus.OPEN)}
                />
                <FilterCheckbox
                  label={t("projects.list.statusInProgress")}
                  checked={filters.status.includes(ProjectStatus.IN_PROGRESS)}
                  onChange={() => handleStatusToggle(ProjectStatus.IN_PROGRESS)}
                  count={getStatusCount(ProjectStatus.IN_PROGRESS)}
                />
                <FilterCheckbox
                  label={t("projects.list.statusCompleted")}
                  checked={filters.status.includes(ProjectStatus.COMPLETED)}
                  onChange={() => handleStatusToggle(ProjectStatus.COMPLETED)}
                  count={getStatusCount(ProjectStatus.COMPLETED)}
                />
              </div>
            </div>

            {/* Skills Filter */}
            {uniqueSkills.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
                  {t("projects.list.skillsFilterTitle")}
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {uniqueSkills.slice(0, 10).map((skill) => (
                    <FilterCheckbox
                      key={skill}
                      label={skill}
                      checked={filters.skills.includes(skill)}
                      onChange={() => handleSkillToggle(skill)}
                      count={getSkillCount(skill)}
                    />
                  ))}
                  {uniqueSkills.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 pt-2">
                      {t("projects.list.moreSkills", {
                        count: String(uniqueSkills.length - 10),
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Apply Button */}
            <button
              onClick={handleApplyFilters}
              className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
            >
              {t("projects.list.applyFilters")}
            </button>
          </DrawerBody>
        </DrawerContent>
      </PodaciumDrawer>

      {/* Tips Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-8xl mx-auto">
          <SectionHeader
            title={t("projects.list.tipsTitle")}
            description={t("projects.list.tipsDescription")}
            badge={t("projects.list.expertAdvice")}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 shadow-sm">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl w-fit mb-4">
                <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.list.tip1Title")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                {t("projects.list.tip1Description")}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 dark:border-purple-800/80 shadow-sm">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl w-fit mb-4">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.list.tip2Title")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                {t("projects.list.tip2Description")}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 shadow-sm">
              <div className="p-3 bg-green-100 dark:bg-emerald-950/60 rounded-xl w-fit mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.list.tip3Title")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                {t("projects.list.tip3Description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-white/20 shadow-2xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-24">
                <div className="md:w-3/4 mb-8 md:mb-0">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {t("projects.list.ctaTitle")}
                  </h2>
                  <p className="text-xl text-blue-100 mb-6">
                    {t("projects.list.ctaDescription")}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-white/90">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 ml-2" />
                      <span>{t("projects.list.ctaFeature1")}</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 ml-2" />
                      <span>{t("projects.list.ctaFeature2")}</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 ml-2" />
                      <span>{t("projects.list.ctaFeature3")}</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 ml-2" />
                      <span>{t("projects.list.ctaFeature4")}</span>
                    </div>
                  </div>
                </div>
                <div className="md:w-1/4">
                  <div className="flex flex-col space-y-4">
                    <PodaciumButton
                      variant="craft"
                      size="lg"
                      fullWidth
                      onClick={() =>
                        router.push(`/auth/signup?redirect=${pathname}`)
                      }
                      className="h-13 font-bold text-gray-900 dark:text-slate-100"
                      icon={<Briefcase className="w-5 h-5 rtl:ml-2 rtl:mr-0" />}
                    >
                      {t("projects.list.signUpFree")}
                    </PodaciumButton>
                    <PodaciumButton
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={() =>
                        router.push(`/auth/login?redirect=${pathname}`)
                      }
                      className="h-13 font-bold border-white text-white hover:bg-white/10"
                    >
                      {t("projects.list.signInToAccess")}
                    </PodaciumButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
