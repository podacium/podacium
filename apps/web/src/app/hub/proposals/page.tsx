// apps/web/src/app/hub/proposals/page.tsx - COMPLETE PROPOSALS MANAGEMENT PAGE (INTERNATIONALIZED)
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  Briefcase,
  User,
  Building,
  Star,
  Award,
  Banknote,
  Users,
  Target,
  Zap,
  Sparkles,
  Loader2,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  FileCheck,
  FileX,
  FileClock,
  FileSearch,
  AlertTriangle,
  Info,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { ProposalResponse, ProposalStatus, UserRole } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useFormatDate } from "@/lib/date-utils";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import { StatCard as DSStatCard } from "@/components/SectionComponents";
import { toast } from "sonner";
import { useMyProposals } from "@/hooks/useProposals";

// =============================================================================
// ANIMATION CONFIGURATION (Matching /hub/page.tsx)
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
// REUSABLE COMPONENTS (Matching /hub/page.tsx patterns)
// =============================================================================

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
  isActive: boolean;
  count?: number;
  onClick: () => void;
  icon?: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({
  label,
  isActive,
  count,
  onClick,
  icon,
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
      isActive
        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 text-gray-700 dark:text-slate-300 hover:border-blue-200 hover:shadow-md"
    }`}
  >
    {icon && (
      <div
        className={`transition-transform duration-300 ${isActive ? "text-white" : "text-gray-500 dark:text-slate-400"}`}
      >
        {icon}
      </div>
    )}
    <span
      className={`font-medium ${isActive ? "text-white" : "text-gray-900 dark:text-slate-100"}`}
    >
      {label}
    </span>
    {count !== undefined && (
      <span
        className={`px-2 py-0.5 text-xs font-bold rounded-full ${
          isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"
        }`}
      >
        {count}
      </span>
    )}
  </motion.button>
);

interface ProposalCardProps {
  proposal: ProposalResponse;
  onViewDetails: () => void;
  onWithdraw?: () => void;
  isLoading?: boolean;
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onViewDetails,
  onWithdraw,
  isLoading = false,
}) => {
  const t = useTranslations();
  const { formatDate } = useFormatDate();

  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-3/4 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
        </div>
        <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3"></div>
        <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-3 w-2/3"></div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
            <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Clock className="w-4 h-4" />,
          label: t("proposals.status.pending"),
        };
      case "ACCEPTED":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: <CheckCircle className="w-4 h-4" />,
          label: t("proposals.status.accepted"),
        };
      case "REJECTED":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: <XCircle className="w-4 h-4" />,
          label: t("proposals.status.rejected"),
        };
      default:
        return {
          color:
            "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-800",
          icon: <FileClock className="w-4 h-4" />,
          label: status,
        };
    }
  };

  const statusConfig = getStatusConfig(proposal.status);

  const formatAmount = (amount?: number) => {
    if (!amount) return t("proposals.negotiable");
    return `${amount.toLocaleString()} ${t("proposals.currency")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">
              {proposal.project?.title || t("proposals.untitledProject")}
            </h3>
            <div
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${statusConfig.color}`}
            >
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
          </div>

          <p className="text-gray-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
            {proposal.message || t("proposals.noMessage")}
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center space-x-2">
              <Banknote className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {formatAmount(proposal.amount)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {t("proposals.submittedOn")} {formatDate(proposal.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {proposal.project?.owner && (
          <div className="lg:ml-6 lg:mt-0 mt-4 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                {proposal.project.owner.profilePictureUrl ? (
                  <img
                    src={proposal.project.owner.profilePictureUrl}
                    alt={proposal.project.owner.fullName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <User className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {proposal.project.owner.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {t("proposals.projectOwner")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-slate-800/50">
        <div className="flex items-center space-x-2">
          {proposal.status === "PENDING" && onWithdraw && (
            <button
              onClick={onWithdraw}
              className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors duration-200"
            >
              {t("proposals.buttons.withdraw")}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onViewDetails}
            className="group/link inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
          >
            {t("proposals.buttons.viewProject")}
            <ArrowUpRight className="w-4 h-4 mr-2 ml-2 group-hover/link:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionText?: string;
  actionOnClick?: () => void;
  actionLink?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  actionOnClick,
  actionLink,
}) => (
  <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
    <div className="w-16 h-16 mx-auto mb-4 p-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
      {description}
    </p>
    {actionText &&
      (actionLink ? (
        <Link
          href={actionLink}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
        >
          {actionText}
          <ArrowUpRight className="w-5 h-5 mr-2 ml-2" />
        </Link>
      ) : (
        <button
          onClick={actionOnClick}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
        >
          {actionText}
          <ArrowUpRight className="w-5 h-5 mr-2 ml-2" />
        </button>
      ))}
  </div>
);

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

const ProposalListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-3/4 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3"></div>
          <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-3 w-2/3"></div>
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

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ProposalsPage() {
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations();
  const { formatDate } = useFormatDate();

  // Check if user is a freelancer
  const isFreelancer = useMemo(() => {
    if (!user) return false;
    return (
      user.role === UserRole.FREELANCER || user.role === UserRole.INSTRUCTOR
    );
  }, [user]);

  // Permission check and redirect (before data fetching)
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      router.push("/auth/login");
      return;
    }

    if (!isFreelancer) {
      router.push("/hub");
    }
  }, [isAuthenticated, user, authLoading, isFreelancer, router]);

  // UI State - MUST come before hooks that use them
  const [activeFilter, setActiveFilter] = useState<ProposalStatus | "ALL">(
    "ALL",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showPermissionError, setShowPermissionError] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawProposalId, setWithdrawProposalId] = useState<number | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // React Query hooks for data fetching
  const { data: proposalsData, isLoading, error, refetch } = useMyProposals();

  const proposals = proposalsData || [];

  // Calculate stats from proposals data
  const stats = useMemo(() => {
    const total = proposals.length;
    const pending = proposals.filter((p) => p.status === "PENDING").length;
    const accepted = proposals.filter((p) => p.status === "ACCEPTED").length;
    const rejected = proposals.filter((p) => p.status === "REJECTED").length;
    const totalAmount = proposals
      .filter((p) => p.status === "ACCEPTED" && p.amount)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return { total, pending, accepted, rejected, totalAmount };
  }, [proposals]);

  const acceptanceRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.accepted / stats.total) * 100);
  }, [stats]);

  // Client-side filtering
  const filteredProposals = useMemo(() => {
    let filtered = proposals;
    if (activeFilter !== "ALL") {
      filtered = filtered.filter((p) => p.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.project?.title?.toLowerCase().includes(searchLower) ||
          p.message?.toLowerCase().includes(searchLower) ||
          p.project?.owner?.fullName?.toLowerCase().includes(searchLower),
      );
    }
    return filtered;
  }, [proposals, activeFilter, searchQuery]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: ProposalStatus | "ALL") => {
    setActiveFilter(filter);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle proposal withdrawal
  const handleWithdrawProposal = useCallback((proposalId: number) => {
    setWithdrawProposalId(proposalId);
    setShowWithdrawModal(true);
  }, []);

  const confirmWithdraw = useCallback(async () => {
    const proposalId = withdrawProposalId;
    if (proposalId === null) return;
    setShowWithdrawModal(false);
    setWithdrawProposalId(null);

    try {
      // Call the withdraw API
      const { api } = await import("@/lib/api");
      await api.withdrawProposal(proposalId);
      toast.success(t("proposals.success.withdrawn"));
      refetch();
    } catch (err) {
      console.error("Error withdrawing proposal:", err);
      toast.error(t("proposals.errors.withdrawFailed"));
    }
  }, [withdrawProposalId, t, refetch]);

  // Handle view proposal details
  const handleViewProposalDetails = useCallback(
    (proposal: ProposalResponse) => {
      if (proposal.project?.id) {
        router.push(`/hub/projects/${proposal.project.id}`);
      }
    },
    [router],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  // Permission error state (matching /hub/page.tsx pattern)
  if (showPermissionError) {
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

  // Permission error state (matching /hub/page.tsx pattern)
  if (showPermissionError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold mb-4">
                <AlertTriangle className="w-4 h-4 mr-2 ml-2" />
                {t("proposals.permissionError.accessRestricted")}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("proposals.permissionError.title")}
              </h1>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("proposals.permissionError.description")}
              </p>
            </motion.div>

            <div className="max-w-md mx-auto bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 rounded-2xl p-6 border border-amber-200 dark:border-amber-800/80">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("proposals.permissionError.currentRole")}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 capitalize">
                    {user?.role?.toLowerCase() ||
                      t("proposals.permissionError.notSet")}
                  </p>
                </div>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t("proposals.permissionError.hint")}
              </p>
            </div>

            <div className="flex justify-center space-x-4 pt-8">
              <button
                onClick={() => router.push("/hub")}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                {t("proposals.buttons.goToHub")}
              </button>
              <button
                onClick={() => router.push("/profile")}
                className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
              >
                {t("proposals.buttons.updateProfile")}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Main content for freelancers
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
              <FileText className="w-4 h-4 mr-2 ml-2" />
              {t("proposals.header.badge")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {t("proposals.header.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("proposals.header.titleHighlight")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t("proposals.header.description")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-blue-600 dark:text-blue-400 rounded-xl font-semibold hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 shadow-sm hover:shadow-md"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />
                    {t("proposals.buttons.refreshing")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 ml-2" />
                    {t("proposals.buttons.refresh")}
                  </>
                )}
              </button>

              <Link
                href="/hub/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <Briefcase className="w-4 h-4 mr-2 ml-2" />
                {t("proposals.buttons.findMoreProjects")}
              </Link>
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
                    {error?.message || t("proposals.errors.genericError")}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2 ml-2" />
                    {t("hub.buttons.tryAgain")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("proposals.stats.title")}
              description={t("proposals.stats.description")}
              isLoading={isLoading}
              badge={t("hub.badges.live")}
            />

            {isLoading ? (
              <StatCardsSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title={t("proposals.stats.totalProposals")}
                  value={stats?.total || 0}
                  change={stats?.total ? 0 : undefined}
                  icon={
                    <FileText className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  }
                  color="text-blue-500"
                  tooltip={t("proposals.stats.tooltips.totalProposals")}
                />
                <StatCard
                  title={t("proposals.stats.pendingReview")}
                  value={stats?.pending || 0}
                  change={
                    stats?.pending && stats.total
                      ? Math.round((stats.pending / stats.total) * 100)
                      : 0
                  }
                  icon={<Clock className="w-6 h-6 text-orange-500" />}
                  color="text-orange-500"
                  tooltip={t("proposals.stats.tooltips.pendingReview")}
                />
                <StatCard
                  title={t("proposals.stats.accepted")}
                  value={stats?.accepted || 0}
                  change={acceptanceRate}
                  icon={<CheckCircle className="w-6 h-6 text-green-500" />}
                  color="text-green-500"
                  tooltip={t("proposals.stats.tooltips.accepted")}
                />
                <StatCard
                  title={t("proposals.stats.totalValue")}
                  value={`${(stats?.totalAmount || 0).toLocaleString()} ${t("proposals.currency")}`}
                  change={stats?.totalAmount ? 15 : 0}
                  icon={
                    <Banknote className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  }
                  color="text-emerald-500"
                  tooltip={t("proposals.stats.tooltips.totalValue")}
                />
              </div>
            )}
          </div>

          {/* Filters and Search Section */}
          <div className="mb-8">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t("proposals.search.placeholder")}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 whitespace-nowrap">
                    {t("proposals.filters.filterBy")}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <FilterPill
                      label={t("proposals.filters.all")}
                      isActive={activeFilter === "ALL"}
                      count={stats?.total}
                      onClick={() => handleFilterChange("ALL")}
                      icon={<FileText className="w-4 h-4" />}
                    />
                    <FilterPill
                      label={t("proposals.filters.pending")}
                      isActive={activeFilter === ProposalStatus.PENDING}
                      count={stats?.pending}
                      onClick={() => handleFilterChange(ProposalStatus.PENDING)}
                      icon={<Clock className="w-4 h-4" />}
                    />
                    <FilterPill
                      label={t("proposals.filters.accepted")}
                      isActive={activeFilter === ProposalStatus.ACCEPTED}
                      count={stats?.accepted}
                      onClick={() =>
                        handleFilterChange(ProposalStatus.ACCEPTED)
                      }
                      icon={<CheckCircle className="w-4 h-4" />}
                    />
                    <FilterPill
                      label={t("proposals.filters.rejected")}
                      isActive={activeFilter === ProposalStatus.REJECTED}
                      count={stats?.rejected}
                      onClick={() =>
                        handleFilterChange(ProposalStatus.REJECTED)
                      }
                      icon={<XCircle className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </div>

              {/* Active filter info */}
              {activeFilter !== "ALL" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-blue-200 dark:border-blue-800/80"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                      {activeFilter === "PENDING" && (
                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                      {activeFilter === "ACCEPTED" && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {activeFilter === "REJECTED" && (
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-slate-100 capitalize">
                        {t("proposals.filters.activeFilter", {
                          status: activeFilter.toLowerCase(),
                        })}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-400">
                        {t("proposals.filters.showingCount", {
                          showing: String(filteredProposals.length),
                          total: String(proposals.length),
                        })}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveFilter("ALL")}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                  >
                    {t("proposals.filters.clear")}
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          {/* Proposals List Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("proposals.sections.proposalsList.title")}
              description={t("proposals.sections.proposalsList.description")}
              actionText={t("proposals.buttons.viewAllProjects")}
              actionLink="/hub/projects"
              isLoading={isLoading}
            />

            {isLoading ? (
              <ProposalListSkeleton />
            ) : filteredProposals.length > 0 ? (
              <div className="space-y-6">
                {filteredProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onViewDetails={() => handleViewProposalDetails(proposal)}
                    onWithdraw={
                      proposal.status === "PENDING"
                        ? () => handleWithdrawProposal(proposal.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : searchQuery ? (
              <EmptyState
                title={t("proposals.emptyStates.noMatching.title")}
                description={t("proposals.emptyStates.noMatching.description", {
                  query: searchQuery,
                })}
                icon={
                  <FileSearch className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                }
                actionText={t("proposals.buttons.clearSearch")}
                actionOnClick={() => {
                  setSearchQuery("");
                  handleFilterChange(activeFilter);
                }}
              />
            ) : activeFilter !== "ALL" ? (
              <EmptyState
                title={t("proposals.emptyStates.noStatus.title", {
                  status: activeFilter.toLowerCase(),
                })}
                description={t("proposals.emptyStates.noStatus.description", {
                  status: activeFilter.toLowerCase(),
                })}
                icon={
                  activeFilter === "PENDING" ? (
                    <Clock className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                  ) : activeFilter === "ACCEPTED" ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
                  )
                }
                actionText={t("proposals.buttons.browseAllProjects")}
                actionLink="/hub/projects"
              />
            ) : (
              <EmptyState
                title={t("proposals.emptyStates.noProposals.title")}
                description={t("proposals.emptyStates.noProposals.description")}
                icon={
                  <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                }
                actionText={t("proposals.buttons.findProjects")}
                actionLink="/hub/projects"
              />
            )}
          </div>

          {/* Tips Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("proposals.sections.tips.title")}
              description={t("proposals.sections.tips.description")}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("proposals.sections.tips.personalizeMessage.title")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("proposals.sections.tips.personalizeMessage.description")}
                </p>
              </div>

              <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("proposals.sections.tips.clearPricing.title")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("proposals.sections.tips.clearPricing.description")}
                </p>
              </div>

              <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 hover:border-green-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("proposals.sections.tips.realisticTimeline.title")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("proposals.sections.tips.realisticTimeline.description")}
                </p>
              </div>
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
                  {t("proposals.cta.title")}
                </h2>
                <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
                  {t("proposals.cta.description")}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/hub/projects"
                    className="group relative px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-3xl"
                  >
                    <div className="flex items-center justify-center">
                      {t("proposals.buttons.browseProjects")}
                      <ArrowUpRight className="w-5 h-5 mr-2 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </div>
                  </Link>
                  <Link
                    href="/learn/paths/freelancing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative px-8 py-3.5 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
                  >
                    <div className="flex items-center justify-center">
                      {t("proposals.buttons.learnFreelancing")}
                      <Sparkles className="w-5 h-5 mr-2 ml-2 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <PodaciumModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          setWithdrawProposalId(null);
        }}
        title={t("proposals.confirmations.withdrawTitle")}
        description={t("proposals.confirmations.withdrawDescription")}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setShowWithdrawModal(false);
              setWithdrawProposalId(null);
            }}
            className="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t("proposals.buttons.cancel")}
          </button>
          <button
            onClick={confirmWithdraw}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
          >
            {t("proposals.buttons.confirmWithdraw")}
          </button>
        </div>
      </PodaciumModal>

      <Footer />
    </div>
  );
}
