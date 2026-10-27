"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import { useTranslations, useBidi } from "@/lib/i18n";
import { useFormatDate } from "@/lib/date-utils";
import { ProjectCard } from "@/components/hub/ProjectCard";
import { FreelancerCard } from "@/components/hub/FreelancerCard";
import { SearchFilters } from "@/components/hub/SearchFilters";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useProjects } from "@/hooks/useProjects";
import { useFreelancers } from "@/hooks/useFreelancers";
import { useContracts } from "@/hooks/useContracts";
import { useMyProposals } from "@/hooks/useProposals";
import { StatCard as DSStatCard } from "@/components/SectionComponents";
import {
  UserRole,
  ProjectResponse,
  FreelancerProfileResponse,
  FreelanceDashboardStats,
  ProposalResponse,
  ContractResponse,
  ContractStatus,
  UserProfileResponse,
} from "@/lib/api";

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
          <ArrowUpRight className="w-4 h-4 ml-1 group-hover:ml-2 transition-all duration-300" />
        </span>
      </div>
    </motion.button>
  );
};

interface ActivityItemProps {
  type:
    | "project_created"
    | "proposal_submitted"
    | "contract_signed"
    | "delivery_submitted"
    | "payment_received"
    | "profile_updated"
    | "skill_added";
  title: string;
  description: string;
  time: string;
  projectTitle?: string;
  amount?: number;
  userAvatar?: string;
  userName?: string;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  type,
  title,
  description,
  time,
  projectTitle,
  amount,
  userAvatar,
  userName,
}) => {
  const getIcon = () => {
    switch (type) {
      case "project_created":
        return (
          <Briefcase className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        );
      case "proposal_submitted":
        return (
          <FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />
        );
      case "contract_signed":
        return <UserCheck className="w-5 h-5 text-green-500" />;
      case "delivery_submitted":
        return <CheckCircle className="w-5 h-5 text-orange-500" />;
      case "payment_received":
        return (
          <Banknote className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        );
      case "profile_updated":
        return (
          <UserCheck className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        );
      case "skill_added":
        return <Award className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
      default:
        return (
          <Briefcase className="w-5 h-5 text-gray-500 dark:text-slate-400" />
        );
    }
  };

  const getColor = () => {
    switch (type) {
      case "project_created":
        return "bg-blue-50 border-blue-200";
      case "proposal_submitted":
        return "bg-purple-50 border-purple-200";
      case "contract_signed":
        return "bg-green-50 border-green-200";
      case "delivery_submitted":
        return "bg-orange-50 border-orange-200";
      case "payment_received":
        return "bg-emerald-50 border-emerald-200";
      case "profile_updated":
        return "bg-indigo-50 border-indigo-200";
      case "skill_added":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-800";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      className="group flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-all duration-300 border border-transparent hover:border-gray-200 dark:hover:border-slate-800"
    >
      <div
        className={`p-2 rounded-lg ${getColor()} group-hover:scale-110 transition-transform duration-300`}
      >
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {userAvatar && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <img
                  src={userAvatar}
                  alt={userName || ""}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <h4 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {title}
            </h4>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap ml-2">
            {time}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
          {description}
        </p>
        {(projectTitle || amount || userName) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {projectTitle && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/80">
                <Briefcase className="w-3 h-3 mr-1.5" />
                {projectTitle}
              </span>
            )}
            {amount && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80">
                <Banknote className="w-3 h-3 mr-1.5" />
                {amount.toLocaleString()} DA
              </span>
            )}
            {userName && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800">
                <Users className="w-3 h-3 mr-1.5" />
                {userName}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

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

const ActivityListSkeleton = () => (
  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="flex items-start space-x-4 p-4 border-b border-gray-200/50 dark:border-slate-800/50 last:border-b-0"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg"></div>
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="w-32 h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
            <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="w-full h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          <div className="w-2/3 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

interface AuthenticatedDashboardProps {
  user: UserProfileResponse;
  activeTab: "freelancer" | "client";
  handleTabChange: (tab: "freelancer" | "client") => void;
}

export const AuthenticatedDashboard: React.FC<AuthenticatedDashboardProps> = ({
  user,
  activeTab,
  handleTabChange,
}) => {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();
  const { formatRelativeTime } = useFormatDate();

  const [searchFilters, setSearchFilters] = useState<any>({});
  const [projectParams, setProjectParams] = useState<Record<string, any>>({
    limit: 6,
  });
  const [freelancerParams, setFreelancerParams] = useState<Record<string, any>>(
    { limit: 6 },
  );
  const [error, setError] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: projectsResponse, isLoading: loadingProjects } =
    useProjects(projectParams);
  const { data: freelancersResponse, isLoading: loadingFreelancers } =
    useFreelancers(freelancerParams);
  const { data: contracts, isLoading: loadingContracts } = useContracts();
  const { data: proposals, isLoading: loadingProposals } = useMyProposals();

  const projects = projectsResponse?.projects || [];
  const freelancers = freelancersResponse?.freelancers || [];
  const contractsList = contracts || [];
  const proposalsList = proposals || [];
  const loadingRecentActivity = loadingContracts || loadingProposals;

  const skills = useMemo(() => {
    const allSkills = new Set<string>();
    freelancers.forEach((freelancer) => {
      freelancer.skills?.forEach((s) => allSkills.add(s));
    });
    return Array.from(allSkills);
  }, [freelancers]);
  const loadingSkills = loadingFreelancers;

  const formatTimeAgo = useCallback(
    (dateString: string) => {
      return formatRelativeTime(dateString);
    },
    [formatRelativeTime],
  );

  const calculateProfileScore = useCallback(() => {
    if (!user) return 0;
    const formData = {
      skills: user.skills || [],
      socialLinks: user.socialLinks || {},
    };
    const fields = [
      user.fullName,
      user.bio,
      user.country,
      user.city,
      user.profilePictureUrl,
      formData.skills.length > 0,
      user.role,
      formData.socialLinks && Object.keys(formData.socialLinks).length > 0,
    ];
    const completedFields = fields.filter((field) => {
      if (field === null || field === undefined) return false;
      if (typeof field === "boolean") return field;
      return Boolean(field);
    }).length;
    return Math.round((completedFields / fields.length) * 100);
  }, [user]);

  const getProfileScoreIcon = (score: number) => {
    if (score < 70)
      return (
        <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
      );
    if (score >= 70 && score < 95)
      return (
        <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
      );
    return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
  };

  const recentActivity = useMemo<ActivityItemProps[]>(() => {
    const activities: ActivityItemProps[] = [];
    contractsList.slice(0, 3).forEach((contract: any) => {
      if (contract.status === "ACTIVE" || contract.status === "COMPLETED") {
        activities.push({
          type:
            contract.status === "COMPLETED"
              ? "contract_signed"
              : "delivery_submitted",
          title:
            contract.status === "COMPLETED"
              ? t("hub.activity.contractCompleted")
              : t("hub.activity.newDelivery"),
          description:
            contract.status === "COMPLETED"
              ? t("hub.activity.contractCompletedDesc", {
                  project: contract.project?.title || t("hub.activity.project"),
                })
              : t("hub.activity.newDeliveryDesc", {
                  project: contract.project?.title || t("hub.activity.project"),
                }),
          time: formatTimeAgo(contract.createdAt),
          projectTitle: contract.project?.title,
          amount: contract.amount,
          userAvatar: contract.client?.profilePictureUrl,
          userName: contract.client?.fullName,
        });
      }
    });
    if (proposalsList.length > 0) {
      proposalsList.slice(0, 2).forEach((proposal) => {
        activities.push({
          type: "proposal_submitted",
          title: t("hub.activity.proposalSubmitted"),
          description: t("hub.activity.proposalSubmittedDesc", {
            project: proposal.project?.title || t("hub.activity.project"),
          }),
          time: formatTimeAgo(proposal.createdAt),
          projectTitle: proposal.project?.title,
          amount: proposal.amount,
        });
      });
    }
    const profileScore = calculateProfileScore();
    if (profileScore < 70) {
      activities.push({
        type: "profile_updated",
        title: t("hub.activity.completeProfile"),
        description: t("hub.activity.completeProfileDesc"),
        time: t("hub.activity.now"),
        userAvatar: user.profilePictureUrl,
        userName: user.fullName,
      });
    }
    return activities.slice(0, 5);
  }, [
    contractsList,
    proposalsList,
    calculateProfileScore,
    formatTimeAgo,
    t,
    user,
  ]);

  const handleFiltersChange = useCallback((filters: any) => {
    setSearchFilters(filters);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      const params: Record<string, any> = { limit: 6 };
      if (query) params.search = query;
      const combinedParams = { ...params, ...searchFilters };
      if (activeTab === "freelancer") {
        setProjectParams(combinedParams);
      } else {
        setFreelancerParams(combinedParams);
      }
    },
    [activeTab, searchFilters],
  );

  const handleCreateProject = useCallback(() => {
    router.push("/hub/projects/new");
  }, [router]);
  const handleBrowseProjects = useCallback(() => {
    router.push("/hub/projects");
  }, [router]);
  const handleFindFreelancers = useCallback(() => {
    router.push("/hub/freelancers");
  }, [router]);
  const handleViewProposals = useCallback(() => {
    router.push("/hub/proposals");
  }, [router]);
  const handleViewContracts = useCallback(() => {
    router.push("/hub/contracts");
  }, [router]);
  const handleCompleteProfile = useCallback(() => {
    router.push("/profile");
  }, [router]);

  return (
    <div className="max-w-8xl mx-auto" dir={dir}>
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
                onClick={() => setError(null)}
                className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("hub.buttons.tryAgain")}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {calculateProfileScore() < 70 && activeTab === "freelancer" && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-amber-800 dark:text-amber-200 font-semibold mb-1">
                {t("hub.profile.completeProfile")}
              </h3>
              <p className="text-amber-700 dark:text-amber-300 text-sm">
                {t("hub.profile.completeProfileDesc", {
                  score: String(calculateProfileScore()),
                })}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex-1 bg-amber-200 dark:bg-amber-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${calculateProfileScore()}%` }}
                  ></div>
                </div>
                <button
                  onClick={handleCompleteProfile}
                  className="ml-4 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-300 whitespace-nowrap shadow-sm"
                >
                  {t("hub.buttons.completeProfile")}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Section */}
      <div className="mb-12">
        <SectionHeader
          title={t("hub.stats.title")}
          description={t("hub.stats.description")}
          isLoading={loadingStats}
          badge={t("hub.badges.live")}
        />

        {loadingStats ? (
          <StatCardsSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeTab === "freelancer" ? (
              <>
                <StatCard
                  title={t("hub.stats.freelancer.activeProposals")}
                  value={stats?.freelancer?.pending_proposals || 0}
                  change={
                    stats?.freelancer?.pending_proposals &&
                    stats.freelancer.total_proposals
                      ? Math.round(
                          (stats.freelancer.pending_proposals /
                            stats.freelancer.total_proposals) *
                            100,
                        )
                      : 0
                  }
                  icon={
                    <FileText className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  }
                  color="text-blue-500"
                  tooltip={t("hub.stats.freelancer.activeProposalsTooltip")}
                />
                <StatCard
                  title={t("hub.stats.freelancer.activeContracts")}
                  value={stats?.freelancer?.active_contracts || 0}
                  change={
                    stats?.freelancer?.active_contracts &&
                    stats.freelancer.completed_contracts
                      ? Math.round(
                          (stats.freelancer.active_contracts /
                            (stats.freelancer.active_contracts +
                              stats.freelancer.completed_contracts)) *
                            100,
                        )
                      : 0
                  }
                  icon={<UserCheck className="w-6 h-6 text-green-500" />}
                  color="text-green-500"
                  tooltip={t("hub.stats.freelancer.activeContractsTooltip")}
                />
                <StatCard
                  title={t("hub.stats.freelancer.totalEarnings")}
                  value={`${(stats?.freelancer?.total_earnings || 0).toLocaleString()} DA`}
                  change={10}
                  icon={
                    <Banknote className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  }
                  color="text-emerald-500"
                  tooltip={t("hub.stats.freelancer.totalEarningsTooltip")}
                />
                <StatCard
                  title={t("hub.stats.freelancer.successRate")}
                  value={`${
                    stats?.freelancer?.accepted_proposals &&
                    stats.freelancer.total_proposals
                      ? Math.round(
                          (stats.freelancer.accepted_proposals /
                            stats.freelancer.total_proposals) *
                            100,
                        )
                      : 0
                  }%`}
                  change={
                    stats?.freelancer?.accepted_proposals &&
                    stats.freelancer.total_proposals
                      ? Math.round(
                          (stats.freelancer.accepted_proposals /
                            stats.freelancer.total_proposals) *
                            100,
                        ) - 5
                      : 0
                  }
                  icon={
                    <TrendingUp className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                  }
                  color="text-purple-500"
                  tooltip={t("hub.stats.freelancer.successRateTooltip")}
                />
              </>
            ) : (
              <>
                <StatCard
                  title={t("hub.stats.client.activeProjects")}
                  value={stats?.client?.active_contracts || 0}
                  change={
                    stats?.client?.active_contracts &&
                    stats.client.total_projects
                      ? Math.round(
                          (stats.client.active_contracts /
                            stats.client.total_projects) *
                            100,
                        )
                      : 0
                  }
                  icon={
                    <Briefcase className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  }
                  color="text-blue-500"
                  tooltip={t("hub.stats.client.activeProjectsTooltip")}
                />
                <StatCard
                  title={t("hub.stats.client.openProjects")}
                  value={stats?.client?.open_projects || 0}
                  change={
                    stats?.client?.open_projects && stats.client.total_projects
                      ? Math.round(
                          (stats.client.open_projects /
                            stats.client.total_projects) *
                            100,
                        )
                      : 0
                  }
                  icon={<Target className="w-6 h-6 text-orange-500" />}
                  color="text-orange-500"
                  tooltip={t("hub.stats.client.openProjectsTooltip")}
                />
                <StatCard
                  title={t("hub.stats.client.totalSpent")}
                  value={`${(stats?.client?.total_spent || 0).toLocaleString()} DA`}
                  change={15}
                  icon={
                    <Banknote className="w-6 h-6 text-red-500 dark:text-red-400" />
                  }
                  color="text-red-500"
                  tooltip={t("hub.stats.client.totalSpentTooltip")}
                />
                <StatCard
                  title={t("hub.stats.client.completionRate")}
                  value={`${
                    stats?.client?.completed_projects &&
                    stats.client.total_projects
                      ? Math.round(
                          (stats.client.completed_projects /
                            stats.client.total_projects) *
                            100,
                        )
                      : 0
                  }%`}
                  change={
                    stats?.client?.completed_projects &&
                    stats.client.total_projects
                      ? Math.round(
                          (stats.client.completed_projects /
                            stats.client.total_projects) *
                            100,
                        ) - 8
                      : 0
                  }
                  icon={<CheckCircle className="w-6 h-6 text-green-500" />}
                  color="text-green-500"
                  tooltip={t("hub.stats.client.completionRateTooltip")}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-12">
        <SectionHeader
          title={
            activeTab === "freelancer"
              ? t("hub.search.findProjects")
              : t("hub.search.findFreelancers")
          }
          description={
            activeTab === "freelancer"
              ? t("hub.search.findProjectsDesc")
              : t("hub.search.findFreelancersDesc")
          }
          isLoading={loadingSkills}
        />

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 mb-6">
          {loadingSkills ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
              <div className="h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
            </div>
          ) : (
            <SearchFilters
              onSearch={handleSearch}
              onFiltersChange={handleFiltersChange}
              skills={skills}
              isLoading={loadingProjects || loadingFreelancers}
            />
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-12">
        <SectionHeader
          title={t("hub.quickActions.title")}
          description={t("hub.quickActions.description")}
          isLoading={loadingRecentActivity}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingRecentActivity ? (
            <>
              {[...Array(3)].map((_, i) => (
                <QuickActionCard
                  key={i}
                  title=""
                  description=""
                  icon={<div className="w-6 h-6" />}
                  color="text-gray-300"
                  actionText=""
                  onClick={() => {}}
                  isLoading={true}
                />
              ))}
            </>
          ) : (
            <>
              {activeTab === "freelancer" ? (
                <>
                  <QuickActionCard
                    title={t("hub.actions.browseProjects")}
                    description={t("hub.actions.browseProjectsDesc")}
                    icon={
                      <Briefcase className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                    }
                    color="text-blue-500"
                    actionText={t("hub.actions.findWork")}
                    onClick={handleBrowseProjects}
                    badge={
                      projects.length > 0
                        ? String(
                            t("hub.badges.newProjects", {
                              count: projects.length.toString(),
                            }),
                          )
                        : undefined
                    }
                  />
                  <QuickActionCard
                    title={t("hub.actions.viewProposals")}
                    description={t("hub.actions.viewProposalsDesc")}
                    icon={
                      <FileText className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                    }
                    color="text-purple-500"
                    actionText={t("hub.actions.viewAll")}
                    onClick={handleViewProposals}
                    disabled={proposalsList.length === 0}
                    badge={
                      proposalsList.length > 0
                        ? String(
                            t("hub.badges.activeProposals", {
                              count: proposalsList.length.toString(),
                            }),
                          )
                        : undefined
                    }
                  />
                  <QuickActionCard
                    title={t("hub.actions.completeProfile")}
                    description={t("hub.actions.completeProfileDesc")}
                    icon={<UserCheck className="w-6 h-6 text-green-500" />}
                    color="text-green-500"
                    actionText={t("hub.actions.editProfile")}
                    onClick={handleCompleteProfile}
                    badge={
                      calculateProfileScore() < 70
                        ? String(
                            t("hub.badges.profileScore", {
                              score: String(calculateProfileScore()),
                            }),
                          )
                        : String(t("hub.badges.complete"))
                    }
                  />
                </>
              ) : (
                <>
                  <QuickActionCard
                    title={t("hub.actions.createProject")}
                    description={t("hub.actions.createProjectDesc")}
                    icon={
                      <Plus className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                    }
                    color="text-blue-500"
                    actionText={t("hub.actions.getStarted")}
                    onClick={handleCreateProject}
                  />
                  <QuickActionCard
                    title={t("hub.actions.findFreelancers")}
                    description={t("hub.actions.findFreelancersDesc")}
                    icon={
                      <Users className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                    }
                    color="text-purple-500"
                    actionText={t("hub.actions.browse")}
                    onClick={handleFindFreelancers}
                    badge={
                      freelancers.length > 0
                        ? String(
                            t("hub.badges.availableFreelancers", {
                              count: freelancers.length.toString(),
                            }),
                          )
                        : undefined
                    }
                  />
                  <QuickActionCard
                    title={t("hub.actions.viewContracts")}
                    description={t("hub.actions.viewContractsDesc")}
                    icon={<FileText className="w-6 h-6 text-green-500" />}
                    color="text-green-500"
                    actionText={t("hub.actions.manage")}
                    onClick={handleViewContracts}
                    disabled={contractsList.length === 0}
                    badge={
                      contractsList.length > 0
                        ? String(
                            t("hub.badges.activeContracts", {
                              count: contractsList.length.toString(),
                            }),
                          )
                        : undefined
                    }
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Featured Projects/Freelancers */}
      <div className="mb-12">
        <SectionHeader
          title={
            activeTab === "freelancer"
              ? t("hub.sections.recommendedProjects")
              : t("hub.sections.topFreelancers")
          }
          description={
            activeTab === "freelancer"
              ? t("hub.sections.recommendedProjectsDesc")
              : t("hub.sections.topFreelancersDesc")
          }
          actionText={t("hub.buttons.viewAll")}
          actionLink={
            activeTab === "freelancer" ? "/hub/projects" : "/hub/freelancers"
          }
          isLoading={
            activeTab === "freelancer" ? loadingProjects : loadingFreelancers
          }
          badge={t("hub.badges.recommended")}
        />

        {activeTab === "freelancer" ? (
          loadingProjects ? (
            <ProjectGridSkeleton />
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 6).map((project) => (
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
          ) : (
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
              <Briefcase className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("hub.empty.noProjectsFound")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                {t("hub.empty.adjustFilters")}
              </p>
              <button
                onClick={handleBrowseProjects}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                {t("hub.buttons.browseAllProjects")}
              </button>
            </div>
          )
        ) : loadingFreelancers ? (
          <FreelancerGridSkeleton />
        ) : freelancers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {freelancers.slice(0, 6).map((freelancer) => (
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
          <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl border border-purple-200 dark:border-purple-800/80">
            <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("hub.empty.noFreelancersFound")}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {t("hub.empty.adjustFreelancerFilters")}
            </p>
            <button
              onClick={handleFindFreelancers}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg"
            >
              {t("hub.buttons.browseAllFreelancers")}
            </button>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mb-12">
        <SectionHeader
          title={t("hub.sections.recentActivity")}
          description={t("hub.sections.recentActivityDesc")}
          actionText={t("hub.buttons.viewAllActivity")}
          actionOnClick={() => router.push("/hub/contracts")}
          isLoading={loadingRecentActivity}
          badge={t("hub.badges.live")}
        />

        {loadingRecentActivity ? (
          <ActivityListSkeleton />
        ) : recentActivity.length > 0 ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200/50">
              {recentActivity.map((activity, index) => (
                <ActivityItem key={index} {...activity} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("hub.empty.noRecentActivity")}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {t("hub.empty.startJourney")}
            </p>
            <button
              onClick={
                activeTab === "freelancer"
                  ? handleBrowseProjects
                  : handleCreateProject
              }
              className="px-6 py-3 bg-gradient-to-r from-gray-600 to-blue-600 text-white rounded-xl font-bold hover:from-gray-700 hover:to-blue-700 transition-all duration-300"
            >
              {activeTab === "freelancer"
                ? t("hub.buttons.browseProjects")
                : t("hub.buttons.createProject")}
            </button>
          </div>
        )}
      </div>

      {/* Tips & Resources */}
      <div className="mb-12">
        <SectionHeader
          title={
            activeTab === "freelancer"
              ? t("hub.tips.freelancerTitle")
              : t("hub.tips.clientTitle")
          }
          description={t("hub.tips.description")}
          actionText={t("hub.buttons.exploreMore")}
          actionLink="/learn/paths/freelancing"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === "freelancer" ? (
            <>
              <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.freelancer.winningProposals")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.freelancer.winningProposalsDesc")}
                </p>
                <Link
                  href="/learn/courses/free-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.freelancer.pricingStrategies")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.freelancer.pricingStrategiesDesc")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 hover:border-green-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.freelancer.securePayments")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.freelancer.securePaymentsDesc")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-green-600 hover:text-green-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.client.writingBriefs")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.client.writingBriefsDesc")}
                </p>
                <Link
                  href="/learn/courses/free-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.client.findingTalent")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.client.findingTalentDesc")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 hover:border-green-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("hub.tips.client.projectManagement")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("hub.tips.client.projectManagementDesc")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-green-600 hover:text-green-700 text-sm font-bold mt-4"
                >
                  {t("hub.buttons.learnMore")}
                  <ArrowUpRight className="w-4 h-4 ml-1 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Call to Action */}
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
              {activeTab === "freelancer"
                ? t("hub.cta.readyToEarn")
                : t("hub.cta.readyToGetStarted")}
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
              {activeTab === "freelancer"
                ? t("hub.cta.freelancerDescription")
                : t("hub.cta.clientDescription")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={
                  activeTab === "freelancer"
                    ? handleBrowseProjects
                    : handleCreateProject
                }
                className="group relative px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-3xl"
              >
                <div className="flex items-center justify-center">
                  {activeTab === "freelancer"
                    ? t("hub.buttons.browseProjects")
                    : t("hub.buttons.postProject")}
                  <Rocket className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </div>
              </button>
              <Link
                href="/learn/paths/free"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative px-8 py-3.5 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex items-center justify-center">
                  {t("hub.buttons.learnMore")}
                  <HelpCircle className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform duration-300" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
