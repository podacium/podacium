// apps/web/src/app/hub/freelancers/page.tsx - INTERNATIONALIZED FREELANCERS BROWSE PAGE
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  CheckCircle,
  Search,
  Loader2,
  X,
  SlidersHorizontal,
  Sparkles,
  Star,
  Briefcase,
  Banknote,
  Shield,
  Clock,
  Award,
  Users,
  FileText,
  Globe,
  MapPin,
  Grid,
  ListIcon,
  Filter,
  FilterX,
  ChevronsLeft,
  ChevronsRight,
  Code,
  Palette,
  Database,
  Cpu,
  HardDrive,
  BarChart,
  Cloud,
  Smartphone,
  Video,
  Music,
  Edit3,
  PenTool,
  Camera,
  MessageCircle,
  Megaphone,
  BookOpen,
  Headphones,
  LifeBuoy,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Tag,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FreelancerCard } from "@/components/hub/FreelancerCard";
import { useAuth } from "@/contexts/AuthContext";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import {
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  PodaciumDrawer,
} from "@/components/design-system";
import {
  FreelancerProfileResponse,
  PublicFreelancerResponse,
  UserRole,
} from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { StatCard as DSStatCard } from "@/components/SectionComponents";
import { useFreelancers } from "@/hooks/useFreelancers";
import { usePublicStats } from "@/hooks/useDashboard";

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
              <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : actionOnClick ? (
            <button
              onClick={actionOnClick}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
  tooltip?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color,
  isLoading = false,
  tooltip,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.SMOOTH }}
      className="group relative"
    >
      {tooltip && (
        <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            {tooltip}
          </div>
        </div>
      )}
      <DSStatCard
        value={value}
        label={title}
        icon={icon}
        color={hubColorToDSColor(color)}
        trend={
          change !== undefined
            ? { value: Math.abs(change), isPositive: change >= 0 }
            : undefined
        }
      />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </motion.div>
  );
};

const hubColorToDSColor = (
  color: string,
): "blue" | "green" | "purple" | "orange" | "red" => {
  if (color.includes("green") || color.includes("emerald")) return "green";
  if (color.includes("blue")) return "blue";
  if (color.includes("purple")) return "purple";
  if (color.includes("orange")) return "orange";
  if (color.includes("red")) return "red";
  return "blue";
};

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  actionText: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  badge?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  color,
  actionText,
  onClick,
  disabled = false,
  isLoading = false,
  badge,
}) => {
  if (isLoading) {
    return (
      <div className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          <div className="w-5 h-5 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: disabled ? 1 : 1.05, y: -4 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 text-left hover:shadow-xl transition-all duration-300 overflow-hidden ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:border-blue-200/50"
      }`}
    >
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 ${color.replace("text-", "bg-")}`}
      ></div>

      {badge && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold px-2.5 py-1.5 rounded-lg shadow-lg transform translate-x-18 translate-y-8 -rotate-2">
          {badge}
        </div>
      )}

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div
          className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300 group-hover:rotate-12`}
        >
          {icon}
        </div>
        <ChevronRight
          className={`w-5 h-5 transition-all duration-300 ${
            disabled
              ? "text-gray-400"
              : "text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1"
          }`}
        />
      </div>
      <div className="space-y-2 relative z-10">
        <h3
          className={`font-semibold text-gray-900 dark:text-slate-100 transition-colors duration-300 ${
            disabled ? "" : "group-hover:text-blue-700"
          }`}
        >
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <div className="mt-4 relative z-10">
        <span
          className={`inline-flex items-center text-sm font-semibold transition-all duration-300 ${
            disabled
              ? "text-gray-500 dark:text-slate-400"
              : "text-blue-600 group-hover:text-blue-700 group-hover:gap-2"
          }`}
        >
          {actionText}
          <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover:ml-2.5 mr-2.5 transition-all duration-300" />
        </span>
      </div>
    </motion.button>
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
            {count === 1
              ? t("common.uiLabels.freelancerSingular")
              : t("common.uiLabels.freelancerPlural")}
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

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const StatCardsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
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

// =============================================================================
// SEARCH & FILTER COMPONENTS
// =============================================================================

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
  placeholder = "Search freelancers by skills, location, or name...",
  isLoading = false,
}) => {
  const t = useTranslations();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="w-full pl-12 pr-40 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 mr-2 animate-spin" />
                {t("freelancers.list.loading.searching")}
              </>
            ) : (
              <>
                {t("freelancers.list.searchButton")}
                <ArrowUpRight className="w-4 h-4 ml-2 mr-2" />
              </>
            )}
          </button>
          {value && (
            <button
              onClick={() => onChange("")}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {t("freelancers.list.searchTry")}
        </span>
        {[
          "React Developer",
          "UI/UX Designer",
          "Data Scientist",
          "Full Stack",
          "Algiers",
          "Python",
          "Graphic",
          "Mobile App",
          "Content Writer",
          "Editor",
          "Marketing",
          "Project Manager",
          "DevOps",
          "Cybersecurity",
          "Translator",
          "Social Media",
          "E-commerce",
          "Game Developer",
        ].map((tag) => (
          <button
            key={tag}
            onClick={() => {
              onChange(tag);
              setTimeout(onSearch, 100);
            }}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 rounded-md transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  skills: string[];
  onApplyFilters: () => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

interface FilterState {
  skills: string[];
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  location: string;
  verifiedOnly: boolean;
  hasCertificates: boolean;
  minCompletedProjects: number | null;
  minTrustScore: number | null;
  sortBy: "relevance" | "rating" | "projects" | "rate" | "trust" | "newest";
  viewMode: "grid" | "list";
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  skills,
  onApplyFilters,
  onResetFilters,
  isLoading = false,
}) => {
  const t = useTranslations();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  const handleSkillToggle = (skill: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleApply = () => {
    onFilterChange(localFilters);
    onApplyFilters();
  };

  const handleReset = () => {
    const resetFilters: FilterState = {
      skills: [],
      hourlyRateMin: null,
      hourlyRateMax: null,
      location: "",
      verifiedOnly: false,
      hasCertificates: false,
      minCompletedProjects: null,
      minTrustScore: null,
      sortBy: "relevance",
      viewMode: "grid",
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
    onResetFilters();
  };

  if (!isOpen) return null;

  return (
    <PodaciumDrawer isOpen={isOpen} onClose={onClose} position="end" size="md">
      <DrawerContent className="w-full max-w-md" overlayClassName="bg-black/50">
        <DrawerHeader className="items-center border-gray-200 px-6 py-6 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <SlidersHorizontal className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <DrawerTitle className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {t("freelancers.list.filtersPanel.title")}
            </DrawerTitle>
          </div>
          <DrawerClose className="rounded-lg p-2 text-gray-500 dark:text-slate-400" />
        </DrawerHeader>

        <DrawerBody className="p-6">
          {/* Sort By */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {t("freelancers.list.filtersPanel.sortBy")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: "relevance",
                  label: t("freelancers.list.sortRelevance"),
                  icon: <Sparkles className="w-4 h-4" />,
                },
                {
                  id: "rating",
                  label: t("freelancers.list.sortRating"),
                  icon: <Star className="w-4 h-4" />,
                },
                {
                  id: "projects",
                  label: t("freelancers.list.sortProjects"),
                  icon: <Briefcase className="w-4 h-4" />,
                },
                {
                  id: "rate",
                  label: t("freelancers.list.sortRate"),
                  icon: <Banknote className="w-4 h-4" />,
                },
                {
                  id: "trust",
                  label: t("freelancers.list.sortTrust"),
                  icon: <Shield className="w-4 h-4" />,
                },
                {
                  id: "newest",
                  label: t("freelancers.list.sortNewest"),
                  icon: <Clock className="w-4 h-4" />,
                },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      sortBy: option.id as any,
                    }))
                  }
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                    localFilters.sortBy === option.id
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.icon}
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skills Filter */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {t("freelancers.list.filtersPanel.skills")}
              </h3>
              {localFilters.skills.length > 0 && (
                <button
                  onClick={() =>
                    setLocalFilters((prev) => ({ ...prev, skills: [] }))
                  }
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  {t("freelancers.list.filtersPanel.clearAll")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.slice(0, 20).map((skill) => (
                <button
                  key={skill}
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
                    localFilters.skills.includes(skill)
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 border border-gray-200 dark:border-slate-800"
                  }`}
                >
                  {skill}
                  {localFilters.skills.includes(skill) && (
                    <CheckCircle className="w-3 h-3 ml-2 mr-2 inline" />
                  )}
                </button>
              ))}
            </div>
            {skills.length > 20 && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                {t("freelancers.list.filtersPanel.showingSkills", {
                  showing: "20",
                  total: skills.length.toString(),
                })}
              </p>
            )}
          </div>

          {/* Hourly Rate Filter */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {t("freelancers.list.filtersPanel.hourlyRate")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                  {t("freelancers.list.filtersPanel.minimum")}
                </label>
                <input
                  type="number"
                  value={localFilters.hourlyRateMin || ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      hourlyRateMin: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                  {t("freelancers.list.filtersPanel.maximum")}
                </label>
                <input
                  type="number"
                  value={localFilters.hourlyRateMax || ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      hourlyRateMax: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="10000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000].map((rate) => (
                <button
                  key={rate}
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      hourlyRateMin: rate,
                      hourlyRateMax: rate + 2000,
                    }))
                  }
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 rounded-md transition-colors"
                >
                  {rate.toLocaleString()} - {(rate + 2000).toLocaleString()} DA
                </button>
              ))}
            </div>
          </div>

          {/* Location Filter */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {t("freelancers.list.filtersPanel.location")}
            </h3>
            <input
              type="text"
              value={localFilters.location}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  location: e.target.value,
                }))
              }
              placeholder={t(
                "freelancers.list.filtersPanel.locationPlaceholder",
              )}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {["Algiers", "Oran", "Constantine", "Annaba", "Remote"].map(
                (loc) => (
                  <button
                    key={loc}
                    onClick={() =>
                      setLocalFilters((prev) => ({ ...prev, location: loc }))
                    }
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      localFilters.location === loc
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300"
                    }`}
                  >
                    {loc}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Verification & Requirements */}
          <div className="mb-8 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">
              {t("freelancers.list.filtersPanel.verificationRequirements")}
            </h3>

            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localFilters.verifiedOnly}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      verifiedOnly: e.target.checked,
                    }))
                  }
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border transition-colors ${
                    localFilters.verifiedOnly
                      ? "bg-blue-500 border-blue-500"
                      : "bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700"
                  }`}
                >
                  {localFilters.verifiedOnly && (
                    <CheckCircle className="w-4 h-4 text-white absolute top-0.5 left-0.5" />
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 text-green-500 ml-2 mr-2" />
                <span className="text-gray-700 dark:text-slate-300">
                  {t("freelancers.list.filtersPanel.phoneVerifiedOnly")}
                </span>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localFilters.hasCertificates}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      hasCertificates: e.target.checked,
                    }))
                  }
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border transition-colors ${
                    localFilters.hasCertificates
                      ? "bg-blue-500 border-blue-500"
                      : "bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700"
                  }`}
                >
                  {localFilters.hasCertificates && (
                    <CheckCircle className="w-4 h-4 text-white absolute top-0.5 left-0.5" />
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Award className="w-4 h-4 text-yellow-500 ml-2 mr-2" />
                <span className="text-gray-700 dark:text-slate-300">
                  {t("freelancers.list.filtersPanel.hasCertifications")}
                </span>
              </div>
            </label>

            <div>
              <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                {t("freelancers.list.filtersPanel.minCompletedProjects")}
              </label>
              <input
                type="number"
                value={localFilters.minCompletedProjects || ""}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    minCompletedProjects: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  }))
                }
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">
                {t("freelancers.list.filtersPanel.minTrustScore")}
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localFilters.minTrustScore || 0}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      minTrustScore: parseInt(e.target.value),
                    }))
                  }
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 min-w-[3ch]">
                  {localFilters.minTrustScore || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* View Mode */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {t("freelancers.list.filtersPanel.viewMode")}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() =>
                  setLocalFilters((prev) => ({ ...prev, viewMode: "grid" }))
                }
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                  localFilters.viewMode === "grid"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>{t("freelancers.list.viewGrid")}</span>
              </button>
              <button
                onClick={() =>
                  setLocalFilters((prev) => ({ ...prev, viewMode: "list" }))
                }
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                  localFilters.viewMode === "list"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                <ListIcon className="w-4 h-4" />
                <span>{t("freelancers.list.viewList")}</span>
              </button>
            </div>
          </div>
        </DrawerBody>

        {/* Action Buttons */}
        <DrawerFooter className="border-gray-200 px-6 pb-6 pt-4 dark:border-slate-800">
          <div className="flex w-full space-x-3">
            <PodaciumButton
              variant="outline"
              onClick={handleReset}
              disabled={isLoading}
              className="flex-1 h-12 rounded-xl font-semibold"
              icon={<FilterX className="w-4 h-4 rtl:ml-2 rtl:mr-0" />}
            >
              {t("freelancers.list.filtersPanel.resetAll")}
            </PodaciumButton>
            <PodaciumButton
              variant="gradient"
              onClick={handleApply}
              disabled={isLoading}
              loading={isLoading}
              className="flex-1 h-12 rounded-xl font-semibold"
              icon={
                !isLoading ? (
                  <CheckCircle className="w-4 h-4 rtl:ml-2 rtl:mr-0" />
                ) : undefined
              }
            >
              {isLoading
                ? t("freelancers.list.filtersPanel.applying")
                : t("freelancers.list.filtersPanel.applyFilters")}
            </PodaciumButton>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </PodaciumDrawer>
  );
};

interface ActiveFiltersProps {
  filters: FilterState;
  onRemoveFilter: (type: keyof FilterState, value?: any) => void;
  onClearAll: () => void;
}

const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  const t = useTranslations();

  const activeFilters = useMemo(() => {
    const active: Array<{
      type: keyof FilterState;
      label: string;
      value: any;
    }> = [];

    if (filters.skills.length > 0) {
      active.push({
        type: "skills",
        label: t("freelancers.list.filterSkills", {
          skills: filters.skills.join(", "),
        }),
        value: filters.skills,
      });
    }

    if (filters.hourlyRateMin !== null || filters.hourlyRateMax !== null) {
      const min = filters.hourlyRateMin || 0;
      const max = filters.hourlyRateMax || 10000;
      active.push({
        type: "hourlyRateMin",
        label: t("freelancers.list.filterRate", {
          min: min.toLocaleString(),
          max: max.toLocaleString(),
        }),
        value: { min, max },
      });
    }

    if (filters.location) {
      active.push({
        type: "location",
        label: t("freelancers.list.filterLocation", {
          location: filters.location,
        }),
        value: filters.location,
      });
    }

    if (filters.verifiedOnly) {
      active.push({
        type: "verifiedOnly",
        label: t("freelancers.list.filterPhoneVerified"),
        value: true,
      });
    }

    if (filters.hasCertificates) {
      active.push({
        type: "hasCertificates",
        label: t("freelancers.list.filterHasCertifications"),
        value: true,
      });
    }

    if (filters.minCompletedProjects !== null) {
      active.push({
        type: "minCompletedProjects",
        label: t("freelancers.list.filterMinProjects", {
          count: filters.minCompletedProjects.toString(),
        }),
        value: filters.minCompletedProjects,
      });
    }

    if (filters.minTrustScore !== null && filters.minTrustScore > 0) {
      active.push({
        type: "minTrustScore",
        label: t("freelancers.list.filterTrustScore", {
          score: filters.minTrustScore.toString(),
        }),
        value: filters.minTrustScore,
      });
    }

    if (filters.sortBy !== "relevance") {
      const sortLabels = {
        rating: t("freelancers.list.sortRating"),
        projects: t("freelancers.list.sortProjects"),
        rate: t("freelancers.list.sortRate"),
        trust: t("freelancers.list.sortTrust"),
        newest: t("freelancers.list.sortNewest"),
      };
      active.push({
        type: "sortBy",
        label: t("freelancers.list.sortedBy", {
          sort: sortLabels[filters.sortBy],
        }),
        value: filters.sortBy,
      });
    }

    return active;
  }, [filters, t]);

  if (activeFilters.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-4 border border-blue-200 dark:border-blue-800/80 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {t("freelancers.list.activeFilters")}
          </span>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
            {t("freelancers.list.activeFiltersCount", {
              count: activeFilters.length.toString(),
            })}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
        >
          {t("freelancers.list.clearAll")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter, index) => (
          <motion.div
            key={`${filter.type}-${index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800/80"
          >
            <span className="text-sm text-gray-700 dark:text-slate-300">
              {filter.label}
            </span>
            <button
              onClick={() => onRemoveFilter(filter.type, filter.value)}
              className="ml-2 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// PAGINATION COMPONENT
// =============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  isLoading = false,
}) => {
  const t = useTranslations();
  const maxVisiblePages = 5;
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-slate-800">
      <div className="text-sm text-gray-600 dark:text-slate-400">
        {t("freelancers.list.pagination.showing")}{" "}
        <span className="font-semibold">{startItem}</span>{" "}
        {t("freelancers.list.pagination.to")}{" "}
        <span className="font-semibold">{endItem}</span>{" "}
        {t("freelancers.list.pagination.of")}{" "}
        <span className="font-semibold">{totalItems.toLocaleString()}</span>{" "}
        {t("freelancers.list.pagination.freelancers")}
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || isLoading}
          className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={isLoading}
              className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                currentPage === page
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                  : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-700"
              }`}
            >
              {page}
            </button>
          ))}

          {totalPages > getPageNumbers()[getPageNumbers().length - 1] && (
            <>
              <span className="px-2 text-gray-400">...</span>
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={isLoading}
                className="w-10 h-10 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-300 dark:border-slate-700 transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || isLoading}
          className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm text-gray-600 dark:text-slate-400">
        {t("freelancers.list.pagination.page")}{" "}
        <span className="font-semibold">{currentPage}</span>{" "}
        {t("freelancers.list.pagination.of")}{" "}
        <span className="font-semibold">{totalPages}</span>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN FREELANCERS PAGE COMPONENT
// =============================================================================

export default function FreelancersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations();

  // State declarations (must be before hooks that reference them)
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    skills: [],
    hourlyRateMin: null,
    hourlyRateMax: null,
    location: "",
    verifiedOnly: false,
    hasCertificates: false,
    minCompletedProjects: null,
    minTrustScore: null,
    sortBy: "relevance",
    viewMode: "grid",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 6;

  // Calculate trust score
  const calculateTrustScore = useCallback((freelancer: any): number => {
    let score = 0;
    if (freelancer.phoneVerified || freelancer.phone_verified) score += 30;
    if (
      freelancer.certificates_count > 0 ||
      (freelancer.certificates && freelancer.certificates.length > 0)
    )
      score += 20;
    if (freelancer.completed_projects > 0)
      score += Math.min(freelancer.completed_projects * 10, 50);
    if (freelancer.skills && freelancer.skills.length > 0)
      score += Math.min(freelancer.skills.length * 5, 20);
    return Math.min(score, 100);
  }, []);

  // Transform freelancer data
  const transformFreelancerData = useCallback(
    (data: any): FreelancerProfileResponse => {
      const trustScore = calculateTrustScore(data);
      return {
        id: data.id,
        full_name: data.fullName || data.full_name || "",
        bio: data.bio || "",
        profile_picture_url:
          data.profilePictureUrl || data.profile_picture_url || "",
        skills: data.skills || [],
        city: data.city || "",
        country: data.country || "",
        phone_verified: data.phoneVerified || data.phone_verified || false,
        role: data.role || "FREELANCER",
        certificates_count:
          data.certificates_count ||
          (data.certificates ? data.certificates.length : 0) ||
          0,
        completed_projects: data.completed_projects || 0,
        avg_rating: data.avg_rating || 0,
        total_earnings: data.total_earnings || 0,
        certificates: data.certificates || [],
        skills_details: data.skills_details || [],
        completed_contracts: data.completed_contracts || [],
        trust_score: trustScore,
        accepted_proposals: data.accepted_proposals || 0,
      };
    },
    [calculateTrustScore],
  );

  // Build API params from current filters
  const buildApiParams = useCallback(() => {
    const params: Record<string, any> = { limit: 500 };
    if (searchQuery) params.search = searchQuery;
    if (filters.skills.length > 0) params.skills = filters.skills;
    if (filters.hourlyRateMin !== null)
      params.min_budget = filters.hourlyRateMin;
    if (filters.hourlyRateMax !== null)
      params.max_budget = filters.hourlyRateMax;
    if (filters.verifiedOnly) params.phone_verified = true;
    if (filters.hasCertificates) params.has_certificates = true;
    if (activeCategory && activeCategory !== "all")
      params.category = activeCategory;
    return params;
  }, [searchQuery, filters, activeCategory]);

  // React Query hooks for data fetching
  const { data: stats } = usePublicStats();
  const freelancerParams = useMemo(
    () => buildApiParams(),
    [searchQuery, filters, activeCategory],
  );
  const {
    data: freelancersResponse,
    isLoading,
    error: queryError,
  } = useFreelancers(
    isAuthenticated && user
      ? freelancerParams
      : { ...freelancerParams, limit: 500 },
  );

  const rawFreelancers = useMemo(() => {
    const raw = (freelancersResponse?.freelancers || [])
      .filter(
        (f) => f.role === UserRole.FREELANCER || f.role === UserRole.INSTRUCTOR,
      )
      .map(transformFreelancerData) as FreelancerProfileResponse[];
    return raw;
  }, [freelancersResponse, transformFreelancerData]);

  const skills = useMemo(() => {
    const allSkills = new Set<string>();
    rawFreelancers.forEach((freelancer) => {
      freelancer.skills?.forEach((skill) => allSkills.add(skill));
    });
    return Array.from(allSkills).sort();
  }, [rawFreelancers]);

  const categories = useMemo(() => {
    const categoryDefinitions = [
      {
        id: "all",
        label: t("freelancers.list.allFreelancers"),
        icon: <Users className="w-5 h-5" />,
        count: rawFreelancers.length,
        keywords: [],
      },
      {
        id: "web",
        label: t("freelancers.list.webDevelopment"),
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
          "typescript",
          "tailwind",
          "bootstrap",
        ],
      },
      {
        id: "design",
        label: t("freelancers.list.uiUxDesign"),
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
        id: "mobile",
        label: t("freelancers.list.mobileApps"),
        icon: <Smartphone className="w-5 h-5" />,
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
        id: "data",
        label: t("freelancers.list.dataScience"),
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
          "statistics",
          "visualization",
        ],
      },
      {
        id: "devops",
        label: t("freelancers.list.devopsCloud"),
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
          "infrastructure",
          "networking",
        ],
      },
      {
        id: "marketing",
        label: t("freelancers.list.digitalMarketing"),
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
          "growth",
        ],
      },
      {
        id: "writing",
        label: t("freelancers.list.contentWriting"),
        icon: <FileText className="w-5 h-5" />,
        count: 0,
        keywords: [
          "writing",
          "content",
          "copywriting",
          "blog",
          "article",
          "seo writing",
          "technical writing",
          "creative writing",
        ],
      },
    ];
    return categoryDefinitions.map((category) => {
      if (category.id === "all") return category;
      const count = rawFreelancers.filter((freelancer) => {
        if (!freelancer.skills || freelancer.skills.length === 0) return false;
        const freelancerSkills = freelancer.skills.map((skill: string) =>
          skill.toLowerCase(),
        );
        return freelancerSkills.some((skill) =>
          category.keywords.some(
            (keyword) =>
              skill.includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(skill),
          ),
        );
      }).length;
      return { ...category, count };
    });
  }, [rawFreelancers]);

  // Client-side filter function
  const applyClientSideFilters = useCallback(
    (
      freelancersList: FreelancerProfileResponse[],
    ): FreelancerProfileResponse[] => {
      let filtered = [...freelancersList];
      if (activeCategory !== "all") {
        const activeCat = categories.find((cat) => cat.id === activeCategory);
        if (activeCat) {
          filtered = filtered.filter((freelancer) => {
            if (!freelancer.skills || freelancer.skills.length === 0)
              return false;
            const freelancerSkills = freelancer.skills.map((skill: string) =>
              skill.toLowerCase(),
            );
            return freelancerSkills.some((skill) =>
              activeCat.keywords.some(
                (keyword) =>
                  skill.includes(keyword.toLowerCase()) ||
                  keyword.toLowerCase().includes(skill),
              ),
            );
          });
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (freelancer) =>
            freelancer.full_name.toLowerCase().includes(q) ||
            (freelancer.bio || "").toLowerCase().includes(q) ||
            (freelancer.skills || []).some((skill) =>
              skill.toLowerCase().includes(q),
            ) ||
            (freelancer.city || "").toLowerCase().includes(q) ||
            (freelancer.country || "").toLowerCase().includes(q),
        );
      }
      if (filters.skills.length > 0) {
        filtered = filtered.filter((freelancer) => {
          const freelancerSkills = (freelancer.skills || []).map((s) =>
            s.toLowerCase(),
          );
          return filters.skills.some((skill) =>
            freelancerSkills.some((fs) => fs.includes(skill.toLowerCase())),
          );
        });
      }
      if (filters.location) {
        const location = filters.location.toLowerCase();
        filtered = filtered.filter(
          (freelancer) =>
            (freelancer.city || "").toLowerCase().includes(location) ||
            (freelancer.country || "").toLowerCase().includes(location),
        );
      }
      if (filters.verifiedOnly) {
        filtered = filtered.filter((freelancer) => freelancer.phone_verified);
      }
      if (filters.hasCertificates) {
        filtered = filtered.filter(
          (freelancer) => freelancer.certificates_count > 0,
        );
      }
      if (filters.minCompletedProjects !== null) {
        filtered = filtered.filter(
          (freelancer) =>
            freelancer.completed_projects >= filters.minCompletedProjects!,
        );
      }
      if (filters.minTrustScore !== null) {
        filtered = filtered.filter(
          (freelancer) => freelancer.trust_score >= filters.minTrustScore!,
        );
      }
      switch (filters.sortBy) {
        case "rating":
          filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
          break;
        case "projects":
          filtered.sort(
            (a, b) => (b.completed_projects || 0) - (a.completed_projects || 0),
          );
          break;
        case "rate":
          filtered.sort(
            (a, b) => (b.total_earnings || 0) - (a.total_earnings || 0),
          );
          break;
        case "trust":
          filtered.sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0));
          break;
        case "newest":
          filtered.sort((a, b) => b.id - a.id);
          break;
      }
      return filtered;
    },
    [activeCategory, categories, searchQuery, filters],
  );

  // Derived filtered and paginated freelancers
  const filteredFreelancers = useMemo(() => {
    const filtered = applyClientSideFilters(rawFreelancers);
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / itemsPerPage));
    setTotalPages(pages);
    setTotalItems(total);
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [
    rawFreelancers,
    filters,
    activeCategory,
    searchQuery,
    currentPage,
    applyClientSideFilters,
  ]);

  const freelancers =
    isAuthenticated && user
      ? filteredFreelancers
      : (filteredFreelancers as any);
  const error = queryError?.message || null;

  // Handle search
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    setCurrentPage(1);
    setIsFilterPanelOpen(false);
  }, []);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    const resetFilters: FilterState = {
      skills: [],
      hourlyRateMin: null,
      hourlyRateMax: null,
      location: "",
      verifiedOnly: false,
      hasCertificates: false,
      minCompletedProjects: null,
      minTrustScore: null,
      sortBy: "relevance",
      viewMode: "grid",
    };
    setFilters(resetFilters);
    setSearchQuery("");
    setActiveCategory("all");
    setCurrentPage(1);
  }, []);

  // Handle filter removal
  const handleRemoveFilter = useCallback(
    (type: keyof FilterState, value?: any) => {
      if (type === "skills" && Array.isArray(value)) {
        setFilters((prev) => ({ ...prev, skills: [] }));
      } else if (type === "hourlyRateMin") {
        setFilters((prev) => ({
          ...prev,
          hourlyRateMin: null,
          hourlyRateMax: null,
        }));
      } else if (type === "location") {
        setFilters((prev) => ({ ...prev, location: "" }));
      } else if (type === "verifiedOnly") {
        setFilters((prev) => ({ ...prev, verifiedOnly: false }));
      } else if (type === "hasCertificates") {
        setFilters((prev) => ({ ...prev, hasCertificates: false }));
      } else if (type === "minCompletedProjects") {
        setFilters((prev) => ({ ...prev, minCompletedProjects: null }));
      } else if (type === "minTrustScore") {
        setFilters((prev) => ({ ...prev, minTrustScore: null }));
      } else if (type === "sortBy") {
        setFilters((prev) => ({ ...prev, sortBy: "relevance" }));
      }

      setCurrentPage(1);
    },
    [],
  );

  // Handle category change
  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Get current freelancers based on authentication
  const currentFreelancers = useMemo(() => {
    return isAuthenticated && user ? freelancers : (filteredFreelancers as any);
  }, [isAuthenticated, user, freelancers, filteredFreelancers]);

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
            <StatCardsSkeleton />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        skills={skills}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        isLoading={isLoading}
      />

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
              <Sparkles className="w-4 h-4 ml-2 mr-2" />
              {isAuthenticated && user
                ? t("freelancers.list.badgePremium")
                : t("freelancers.list.badgeBrowse")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {t("freelancers.list.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("freelancers.list.titleHighlight")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed whitespace-pre-line">
              {t("freelancers.list.description")}
            </p>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 pt-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {stats?.total_freelancers?.toLocaleString() ||
                    totalItems.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("freelancers.list.freelancersCount")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100">
                  {stats?.completed_contracts?.toLocaleString() || "0"}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("freelancers.list.projectsCompleted")}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-8xl mx-auto">
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
                    {error}
                  </p>
                  <button
                    onClick={() => {}}
                    className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 ml-2 mr-2" />
                    {t("freelancers.list.errors.tryAgain")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Search Section */}
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                isLoading={isLoading}
                placeholder={t("freelancers.list.searchPlaceholder")}
              />

              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setIsFilterPanelOpen(true)}
                  className="group inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
                >
                  <Filter className="w-4 h-4 ml-2 mr-2" />
                  {t("freelancers.list.filtersSorting")}
                  {Object.values(filters).some((v) =>
                    Array.isArray(v)
                      ? v.length > 0
                      : typeof v === "boolean"
                        ? v
                        : v !== null &&
                          v !== "" &&
                          v !== "relevance" &&
                          v !== "grid",
                  ) && (
                    <span className="ml-2 mr-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                      {t("freelancers.list.filtersActive")}
                    </span>
                  )}
                </button>

                <div className="flex-1 flex flex-wrap gap-2">
                  {categories.slice(0, 4).map((category) => (
                    <motion.button
                      key={category.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCategoryChange(category.id)}
                      className={`group flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                        activeCategory === category.id
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200"
                      }`}
                    >
                      {category.icon}
                      <span className="font-medium">{category.label}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeCategory === category.id
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 dark:bg-slate-800/90 text-gray-700 dark:text-slate-300"
                        }`}
                      >
                        {category.count}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          <ActiveFilters
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleResetFilters}
          />

          {/* Categories Grid */}
          <div className="mb-8">
            <SectionHeader
              title={t("freelancers.list.browseByCategory")}
              description={t("freelancers.list.browseByCategoryDesc")}
              isLoading={isLoading}
            />

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
                      onClick={() => handleCategoryChange(category.id)}
                    />
                  </motion.div>
                ))}
              </div>

              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-50 to-transparent dark:from-slate-900 dark:to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Results Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {isLoading
                    ? t("freelancers.list.loading.freelancers")
                    : `${t("freelancers.list.availableFreelancers")} (${totalItems})`}
                </h2>
                {!isLoading && (
                  <p className="text-gray-600 dark:text-slate-400 mt-1">
                    {activeCategory !== "all"
                      ? t("freelancers.list.showingCategory", {
                          count: currentFreelancers.length.toString(),
                          category:
                            categories
                              .find((c) => c.id === activeCategory)
                              ?.label.toLowerCase() || "",
                        })
                      : t("freelancers.list.showingTotal", {
                          showing: currentFreelancers.length.toString(),
                          total: totalItems.toString(),
                        })}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  {t("freelancers.list.sortBy")}{" "}
                  <select
                    value={filters.sortBy}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: e.target.value as any,
                      }));
                      setCurrentPage(1);
                    }}
                    className="ml-2 mr-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  >
                    <option value="relevance">
                      {t("freelancers.list.sortRelevance")}
                    </option>
                    <option value="rating">
                      {t("freelancers.list.sortRating")}
                    </option>
                    <option value="projects">
                      {t("freelancers.list.sortProjects")}
                    </option>
                    <option value="rate">
                      {t("freelancers.list.sortRate")}
                    </option>
                    <option value="trust">
                      {t("freelancers.list.sortTrust")}
                    </option>
                    <option value="newest">
                      {t("freelancers.list.sortNewest")}
                    </option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, viewMode: "grid" }))
                    }
                    className={`p-2 rounded-lg ${
                      filters.viewMode === "grid"
                        ? "bg-blue-100 text-blue-600"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                    }`}
                    disabled={isLoading}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, viewMode: "list" }))
                    }
                    className={`p-2 rounded-lg ${
                      filters.viewMode === "list"
                        ? "bg-blue-100 text-blue-600"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                    }`}
                    disabled={isLoading}
                  >
                    <ListIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Freelancers Grid/List */}
          {isLoading ? (
            <FreelancerGridSkeleton />
          ) : currentFreelancers.length > 0 ? (
            <>
              {filters.viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentFreelancers.map(
                    (freelancer: FreelancerProfileResponse) => (
                      <motion.div
                        key={freelancer.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -8 }}
                      >
                        <FreelancerCard
                          freelancer={freelancer}
                          variant="grid"
                          onClick={() =>
                            router.push(`/profile/${freelancer.id}`)
                          }
                          compact
                        />
                      </motion.div>
                    ),
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentFreelancers.map(
                    (freelancer: FreelancerProfileResponse) => (
                      <motion.div
                        key={freelancer.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <FreelancerCard
                          freelancer={freelancer}
                          variant="list"
                          onClick={() =>
                            router.push(`/profile/${freelancer.id}`)
                          }
                        />
                      </motion.div>
                    ),
                  )}
                </div>
              )}

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />
            </>
          ) : (
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
              <Users className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("freelancers.list.noResults.title")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                {t("freelancers.list.noResults.description")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <PodaciumButton
                  variant="gradient"
                  onClick={handleResetFilters}
                  className="h-11 px-6 rounded-xl font-bold"
                >
                  {t("freelancers.list.noResults.resetFilters")}
                </PodaciumButton>
                <PodaciumButton
                  variant="outline"
                  onClick={() => setIsFilterPanelOpen(true)}
                  className="h-11 px-6 rounded-xl font-bold"
                >
                  {t("freelancers.list.noResults.adjustFilters")}
                </PodaciumButton>
              </div>
            </div>
          )}

          {/* Top Skills Section */}
          {rawFreelancers.length > 0 && (
            <div className="mt-12">
              {/* Calculate most repeated skills from freelancers */}
              {(() => {
                const skillCounts = new Map<string, number>();
                rawFreelancers.forEach((freelancer) => {
                  freelancer.skills?.forEach((skill) => {
                    const lowerSkill = skill.toLowerCase();
                    skillCounts.set(
                      lowerSkill,
                      (skillCounts.get(lowerSkill) || 0) + 1,
                    );
                  });
                });

                const topSkills = Array.from(skillCounts.entries())
                  .map(([skill, count]) => ({ skill, count }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 12);

                if (topSkills.length === 0) return null;

                return (
                  <>
                    <SectionHeader
                      title={t("freelancers.list.mostInDemandSkills")}
                      description={t("freelancers.list.mostInDemandSkillsDesc")}
                      badge={t("hub.badges.trending")}
                    />

                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {topSkills.slice(0, 6).map((skill, index) => {
                          const isSelected = filters.skills.includes(
                            skill.skill,
                          );

                          return (
                            <motion.div
                              key={skill.skill}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="group relative"
                            >
                              <button
                                onClick={() => {
                                  setFilters((prev) => {
                                    const newSkills = prev.skills.some(
                                      (s) =>
                                        s.toLowerCase() ===
                                        skill.skill.toLowerCase(),
                                    )
                                      ? prev.skills.filter(
                                          (s) =>
                                            s.toLowerCase() !==
                                            skill.skill.toLowerCase(),
                                        )
                                      : [...prev.skills, skill.skill];
                                    return {
                                      ...prev,
                                      skills: newSkills,
                                    };
                                  });
                                  setCurrentPage(1);
                                }}
                                className={`w-full p-4 rounded-xl border transition-all duration-300 group-hover:scale-105 ${
                                  isSelected
                                    ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white border-blue-400 shadow-lg"
                                    : "bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 dark:text-slate-100 border-gray-200 dark:border-slate-800 hover:border-blue-200 hover:shadow-md"
                                }`}
                              >
                                <div className="text-center space-y-2">
                                  <div
                                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mx-auto ${
                                      isSelected
                                        ? "bg-white/20"
                                        : index < 3
                                          ? "bg-gradient-to-r from-blue-100 to-indigo-100"
                                          : "bg-gray-100 dark:bg-slate-800"
                                    }`}
                                  >
                                    {isSelected ? (
                                      <CheckCircle className="w-5 h-5" />
                                    ) : index < 3 ? (
                                      <Award
                                        className={`w-5 h-5 ${
                                          index === 0
                                            ? "text-yellow-500"
                                            : index === 1
                                              ? "text-gray-400"
                                              : "text-amber-600"
                                        }`}
                                      />
                                    ) : (
                                      <Tag
                                        className={`w-5 h-5 ${isSelected ? "text-white" : "text-gray-500 dark:text-slate-400"}`}
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <div
                                      className={`font-semibold text-sm truncate ${isSelected ? "text-white" : "text-gray-900 dark:text-slate-100"}`}
                                    >
                                      {skill.skill}
                                    </div>
                                    <div
                                      className={`text-xs ${isSelected ? "text-blue-100" : "text-gray-500 dark:text-slate-400"}`}
                                    >
                                      {t("freelancers.list.skillFreelancers", {
                                        count: skill.count.toString(),
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {index < 3 && !isSelected && (
                                  <div
                                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      index === 0
                                        ? "bg-yellow-100 text-yellow-800"
                                        : index === 1
                                          ? "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200"
                                          : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {index + 1}
                                  </div>
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>

                      {topSkills.length > 6 && (
                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            {t("freelancers.list.popularSkills", {
                              showing: "6",
                              total: topSkills.length.toString(),
                            })}
                          </div>

                          <button
                            onClick={() => setIsFilterPanelOpen(true)}
                            className="group inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-lg hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
                          >
                            <Tag className="w-4 h-4 ml-2 mr-2" />
                            {t("freelancers.list.viewAllSkills", {
                              count: topSkills.length.toString(),
                            })}
                            <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
                          </button>
                        </div>
                      )}

                      {filters.skills.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-800"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-2">
                              {filters.skills.map((skill) => (
                                <motion.div
                                  key={skill}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium"
                                >
                                  {skill}
                                  <button
                                    onClick={() => {
                                      setFilters((prev) => ({
                                        ...prev,
                                        skills: prev.skills.filter(
                                          (s) =>
                                            s.toLowerCase() !==
                                            skill.toLowerCase(),
                                        ),
                                      }));
                                      setCurrentPage(1);
                                    }}
                                    className="ml-2 mr-2 hover:opacity-75 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </motion.div>
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                setFilters((prev) => ({ ...prev, skills: [] }));
                                setCurrentPage(1);
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                            >
                              {t("freelancers.list.clearSkills")}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Why Choose Our Freelancers Section */}
          <div className="mt-12">
            <SectionHeader
              title={t("freelancers.list.whyChooseTitle")}
              description={t("freelancers.list.whyChooseDesc")}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: t(
                    "freelancers.list.benefits.culturalUnderstanding.title",
                  ),
                  description: t(
                    "freelancers.list.benefits.culturalUnderstanding.desc",
                  ),
                  icon: (
                    <Globe className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  ),
                  color: "text-blue-500",
                  bg: "bg-blue-50",
                },
                {
                  title: t("freelancers.list.benefits.timeZone.title"),
                  description: t("freelancers.list.benefits.timeZone.desc"),
                  icon: <Clock className="w-6 h-6 text-green-500" />,
                  color: "text-green-500",
                  bg: "bg-green-50",
                },
                {
                  title: t("freelancers.list.benefits.costEffective.title"),
                  description: t(
                    "freelancers.list.benefits.costEffective.desc",
                  ),
                  icon: (
                    <Banknote className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                  ),
                  color: "text-purple-500",
                  bg: "bg-purple-50",
                },
                {
                  title: t("freelancers.list.benefits.verifiedTalent.title"),
                  description: t(
                    "freelancers.list.benefits.verifiedTalent.desc",
                  ),
                  icon: (
                    <Shield className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                  ),
                  color: "text-amber-500",
                  bg: "bg-amber-50",
                },
              ].map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80"
                >
                  <div
                    className={`p-3 rounded-xl ${benefit.bg} w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <div className={benefit.color}>{benefit.icon}</div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16"
            >
              <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 md:p-12 text-white overflow-hidden">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]"></div>

                <div className="relative z-10 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">
                    {t("freelancers.list.cta.title")}
                  </h2>
                  <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
                    {t("freelancers.list.cta.description")}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <PodaciumButton
                      variant="craft"
                      size="lg"
                      onClick={() =>
                        router.push(`/auth/signup?redirect=${pathname}`)
                      }
                      className="h-13 px-8 rounded-xl font-bold text-blue-600 dark:text-blue-400"
                      icon={
                        <ArrowUpRight className="w-5 h-5 rtl:ml-2 rtl:mr-0" />
                      }
                      iconPosition="right"
                    >
                      {t("freelancers.list.cta.signUpFree")}
                    </PodaciumButton>
                    <PodaciumButton
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        router.push(`/auth/login?redirect=${pathname}`)
                      }
                      className="h-13 px-8 rounded-xl font-bold border-white text-white hover:bg-white/10"
                      icon={<Users className="w-5 h-5 rtl:ml-2 rtl:mr-0" />}
                      iconPosition="right"
                    >
                      {t("freelancers.list.cta.signInToHire")}
                    </PodaciumButton>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
