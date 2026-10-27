// apps/web/src/app/hub/contracts/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Briefcase,
  Banknote,
  ChevronRight,
  Loader2,
  RefreshCw,
  Lock,
  ExternalLink,
  MessageSquare,
  FileCheck,
  XCircle,
  HelpCircle,
  UserCheck,
  ArrowUpRight,
  DownloadCloud,
  UploadCloud,
  Hash,
  Clock4,
  CalendarDays,
  CalendarCheck,
  AlertTriangle,
  X,
  Check,
  Edit,
  PackageCheck,
  PackageSearch,
  FileX,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiHelpers,
  ContractResponse,
  UserRole,
  ContractStatus,
  UserProfileResponse,
  api,
  handleApiError,
  isApiError,
  isNetworkError,
  isAuthenticationError,
  isValidationError,
  ApiError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  DeliveryResponse,
  DeliveryCreate,
} from "@/lib/api";
import { toast } from "sonner";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { useTranslations } from "@/lib/i18n";
import {
  RatingForm,
  ReviewFormData,
} from "@/components/hub/reviews/RatingForm";
import {
  ReviewList,
  ReviewResponse as DisplayReviewResponse,
} from "@/components/hub/reviews/ReviewList";
import {
  MilestoneStageTracker,
  DeliverableReviewCanvas,
  StructuredRevisionModal,
  IpAssignmentDeedCard,
  ReviewPin,
  IpAssignmentDeedData,
} from "@/components/contracts";

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
  actionOnClick?: () => void;
  isLoading?: boolean;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actionText,
  actionOnClick,
  isLoading = false,
  badge,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-64"></div>
          {description && (
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-96"></div>
          )}
        </div>
        {actionText && (
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
      {actionText && (
        <div className="mt-4 sm:mt-0">
          <button
            onClick={actionOnClick}
            className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
          >
            {actionText}
            <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      )}
    </div>
  );
};

interface InfoCardProps {
  title: string;
  value: string | React.ReactNode;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  value,
  icon,
  color,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.SMOOTH }}
      className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-xl transition-all duration-300 hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          {value}
        </div>
        <p className="text-gray-600 dark:text-slate-400 text-sm font-medium">
          {title}
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </motion.div>
  );
};

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success";
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  label,
  icon,
  variant = "primary",
  disabled = false,
  isLoading = false,
  fullWidth = false,
}) => {
  const t = useTranslations("common");
  const variantClasses = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 border border-blue-500",
    secondary:
      "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 hover:text-blue-700 border border-blue-200/50 hover:border-blue-300",
    danger:
      "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 border border-red-500",
    success:
      "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 border border-green-500",
  };

  if (isLoading) {
    return (
      <button
        disabled
        className={`${fullWidth ? "w-full" : ""} px-6 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center ${variantClasses.secondary}`}
      >
        <Loader2 className="w-5 h-5 ml-2 mr-2 animate-spin" />
        {t("loading")}
      </button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`${fullWidth ? "w-full" : ""} px-6 py-3.5 rounded-xl font-bold hover:shadow-md transition-all duration-300 flex items-center justify-center ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {icon}
      <span className="ml-2 mr-2">{label}</span>
    </motion.button>
  );
};

interface DeliveryCardProps {
  delivery: DeliveryResponse;
  isFreelancer: boolean;
  onApprove?: () => void;
  onRequestRevision?: () => void;
}

const DeliveryCard: React.FC<DeliveryCardProps> = ({
  delivery,
  isFreelancer,
  onApprove,
  onRequestRevision,
}) => {
  const t = useTranslations("hub");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
            <PackageCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-slate-100">
              {t("contracts.detail.delivery.delivery")}
            </h4>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t("contracts.detail.delivery.deliveredOn", {
                date: formatDate(delivery.deliveredAt),
              })}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 dark:border-emerald-800/80 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3 h-3 ml-2 mr-2.5" />
          {t("contracts.detail.delivery.delivery")}
        </div>
      </div>

      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
          {t("contracts.detail.delivery.description")}
        </h5>
        <p className="text-gray-600 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/60 rounded-lg p-4 border border-gray-200/50 dark:border-slate-800/50">
          {delivery.description || t("contracts.detail.delivery.noDescription")}
        </p>
      </div>

      {delivery.files && (
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {t("contracts.detail.delivery.attachedFiles")}
          </h5>
          <div className="space-y-2">
            {Array.isArray(delivery.files) &&
              delivery.files.map((file: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-slate-800/60 rounded-lg border border-gray-200/50 dark:border-slate-800/50"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {file.filename || `File ${index + 1}`}
                    </span>
                  </div>
                  <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-semibold flex items-center">
                    <DownloadCloud className="w-4 h-4 ml-2 mr-2" />
                    {t("contracts.detail.delivery.download")}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {!isFreelancer && (
        <div className="flex space-x-3 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
          <ActionButton
            onClick={onApprove || (() => {})}
            label={t("contracts.detail.delivery.approveDelivery")}
            icon={<Check className="w-5 h-5" />}
            variant="success"
          />
          <ActionButton
            onClick={onRequestRevision || (() => {})}
            label={t("contracts.detail.delivery.requestRevision")}
            icon={<Edit className="w-5 h-5" />}
            variant="secondary"
          />
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const ContractDetailSkeleton = () => (
  <div className="animate-pulse">
    {/* Header Skeleton */}
    <div className="mb-8">
      <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-4"></div>
      <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
    </div>

    {/* Info Cards Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
          </div>
        </div>
      ))}
    </div>

    {/* Main Content Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-8">
        {/* Project Details Skeleton */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-5/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-2/3"></div>
          </div>
        </div>

        {/* Deliveries Skeleton */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-100 dark:bg-slate-800 rounded-xl"
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-8">
        {/* Parties Skeleton */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-24"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Skeleton */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl"
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN CONTRACT DETAIL PAGE COMPONENT
// =============================================================================

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations("hub");

  const contractId = parseInt(params.id as string);

  // State Management
  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [newDelivery, setNewDelivery] = useState<DeliveryCreate>({
    description: "",
    file_urls: [],
  });
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [completingContract, setCompletingContract] = useState(false);
  const [cancellingContract, setCancellingContract] = useState(false);

  // Review System States
  const [reviews, setReviews] = useState<DisplayReviewResponse[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingReview, setEditingReview] =
    useState<DisplayReviewResponse | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "complete" | "cancel" | null
  >(null);

  // Interactive Milestone Workspace & Deliverable Review States
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [canvasPins, setCanvasPins] = useState<Record<number, ReviewPin[]>>({});
  const [selectedDeed, setSelectedDeed] = useState<IpAssignmentDeedData | null>(
    null,
  );
  const [showIpDeedModal, setShowIpDeedModal] = useState(false);

  const handleApproveMilestone = async (contractId: number) => {
    try {
      await api.put(`/contracts/${contractId}/complete`);
      toast.success(t("contracts.detail.milestoneActions.approvedSuccess"));
      fetchContractData();
    } catch (err: any) {
      toast.error(
        err?.message || t("contracts.detail.milestoneActions.approveError"),
      );
    }
  };

  const handleOpenDispute = () => {
    if (contract?.status === "COMPLETED") {
      toast.error(
        t("contracts.detail.milestoneActions.disputeBlockedCompleted"),
      );
      return;
    }
    router.push(`/hub/contracts/${contract?.id}/dispute`);
  };

  const handleSubmitStructuredRevision = async (data: {
    selectedCriteria: string[];
    detailedNotes: Record<string, string>;
    generalComment: string;
  }) => {
    toast.success(t("contracts.detail.milestoneActions.revisionSubmitted"));
    setShowRevisionModal(false);
  };

  // Format time ago for access denied countdown
  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return t("contracts.detail.milestoneActions.negotiable");
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return t("contracts.detail.project.noDescription");
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get status color and icon
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return {
          color:
            "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200",
          icon: <CheckCircle className="w-4 h-4" />,
          label: t("contracts.detail.status.active"),
        };
      case "COMPLETED":
        return {
          color:
            "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200",
          icon: <FileCheck className="w-4 h-4" />,
          label: t("contracts.detail.status.completed"),
        };
      case "CANCELLED":
        return {
          color:
            "bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200",
          icon: <XCircle className="w-4 h-4" />,
          label: t("contracts.detail.status.cancelled"),
        };
      case "PENDING":
        return {
          color:
            "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200",
          icon: <Clock className="w-4 h-4" />,
          label: t("contracts.detail.status.pending"),
        };
      case "DISPUTED":
        return {
          color:
            "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200",
          icon: <AlertTriangle className="w-4 h-4" />,
          label: t("contracts.detail.status.disputed"),
        };
      default:
        return {
          color:
            "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800",
          icon: <FileText className="w-4 h-4" />,
          label: status,
        };
    }
  };

  // Check user permission to view this contract
  const checkUserPermission = useCallback(
    (contractData: ContractResponse, currentUser: UserProfileResponse) => {
      // User is the freelancer on this contract
      if (contractData.freelancerId === currentUser.id) {
        setIsFreelancer(true);
        setIsClient(false);
        return true;
      }

      // User is the client on this contract
      if (contractData.clientId === currentUser.id) {
        setIsFreelancer(false);
        setIsClient(true);
        return true;
      }

      // User is admin (can view all contracts)
      if (currentUser.role === UserRole.ADMIN) {
        setIsFreelancer(false);
        setIsClient(false);
        return true;
      }

      return false;
    },
    [],
  );

  // Fetch contract data
  const fetchContractData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      // Fetch user profile to ensure we have latest data
      const profile = await apiHelpers.auth.getCurrentUser();
      setUserProfile(profile);

      // Fetch contract details
      const contractData = await apiHelpers.freelancing.getContract(contractId);
      setContract(contractData);

      // Check if user has permission to view this contract
      const hasPermission = checkUserPermission(contractData, profile);

      if (!hasPermission) {
        setAccessDenied(true);
        setAccessDeniedMessage(
          t("contracts.detail.errors.accessDeniedDescription"),
        );

        // Redirect after 5 seconds
        setTimeout(() => {
          router.push("/hub/projects");
        }, 5000);

        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error("Error fetching contract:", err);

      if (err instanceof AuthenticationError) {
        setError(t("contracts.detail.errors.authenticationRequired"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("contracts.detail.errors.contractNotFound"));
      } else if (err instanceof ApiError) {
        setError(err.message || t("contracts.detail.errors.unexpectedError"));
      } else if (err instanceof NetworkError) {
        setError(t("contracts.detail.errors.networkError"));
      } else {
        setError(t("contracts.detail.errors.unexpectedError"));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, contractId, checkUserPermission, router]);

  // Handle delivery submission
  const handleSubmitDelivery = async () => {
    if (!contract || !newDelivery.description.trim()) {
      setError(t("contracts.detail.validation.deliveryDescriptionRequired"));
      return;
    }

    try {
      setSubmittingDelivery(true);
      setError(null);

      const deliveryData: DeliveryCreate = {
        description: newDelivery.description,
        file_urls: newDelivery.file_urls || [],
      };

      await apiHelpers.freelancing.submitDelivery(contract.id, deliveryData);

      // Refresh contract data to show new delivery
      await fetchContractData();

      // Reset form and close modal
      setNewDelivery({ description: "", file_urls: [] });
      setShowDeliveryModal(false);
    } catch (err: any) {
      console.error("Error submitting delivery:", err);
      setError(handleApiError(err));
    } finally {
      setSubmittingDelivery(false);
    }
  };

  // Handle contract completion
  const handleCompleteContract = async () => {
    if (!contract) return;
    setConfirmAction("complete");
  };

  const executeCompleteContract = async () => {
    if (!contract) return;
    try {
      setCompletingContract(true);
      setError(null);
      await apiHelpers.freelancing.completeContract(contract.id);
      await fetchContractData();
      toast.success(t("contracts.detail.confirmation.completed"));
    } catch (err: any) {
      console.error("Error completing contract:", err);
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setCompletingContract(false);
      setConfirmAction(null);
    }
  };

  // Handle contract cancellation
  const handleCancelContract = async () => {
    if (!contract) return;
    setConfirmAction("cancel");
  };

  const executeCancelContract = async () => {
    if (!contract) return;
    try {
      setCancellingContract(true);
      setError(null);
      await apiHelpers.freelancing.cancelContract(contract.id);
      await fetchContractData();
      toast.success(t("contracts.detail.confirmation.cancelled"));
    } catch (err: any) {
      console.error("Error cancelling contract:", err);
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setCancellingContract(false);
      setConfirmAction(null);
    }
  };

  // Handle Review Submission
  const handleSubmitReview = async (data: ReviewFormData) => {
    if (!contractId) return;
    try {
      if (editingReview) {
        await api.patch(`/hub/reviews/${editingReview.id}`, data);
      } else {
        await api.post(`/hub/contracts/${contractId}/reviews`, data);
      }
      setShowReviewModal(false);
      setEditingReview(null);
      fetchReviews();
    } catch (err: any) {
      console.error(err);
      setError(err.message || t("contracts.detail.errors.unexpectedError"));
    }
  };

  // Fetch reviews logic
  const fetchReviews = useCallback(async () => {
    if (!contractId || !isAuthenticated) return;
    try {
      setLoadingReviews(true);
      const res: any = await api.get(`/hub/contracts/${contractId}/reviews`);
      setReviews(
        res.data.reviews ||
          Object.values(res.data).filter((v) => Array.isArray(v))[0] ||
          [],
      );

      try {
        const eligRes: any = await api.get(
          `/hub/contracts/${contractId}/reviews/eligibility`,
        );
        setCanReview(eligRes.data.eligible);
      } catch (e) {
        setCanReview(false);
      }
    } catch (e) {
      console.error("Failed to fetch reviews", e);
    } finally {
      setLoadingReviews(false);
    }
  }, [contractId, isAuthenticated]);

  // Initialize on mount
  useEffect(() => {
    if (!authLoading) {
      fetchContractData();
      fetchReviews();
    }
  }, [authLoading, fetchContractData, fetchReviews]);

  // Countdown for access denied redirect
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    if (accessDenied) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [accessDenied]);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg max-w-2xl mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg max-w-3xl mx-auto"></div>
            </div>
            <ContractDetailSkeleton />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full text-sm font-semibold mb-4">
                <Lock className="w-4 h-4 ml-2 mr-2" />
                {t("contracts.detail.errors.accessRestricted")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("contracts.detail.errors.accessDenied")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {accessDeniedMessage}
              </p>

              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-8 max-w-2xl mx-auto">
                <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                  {t("contracts.detail.errors.contractAccessRestricted")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6">
                  {t("contracts.detail.errors.accessDeniedDescription")}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.detail.errors.permissionRules.freelancers")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.detail.errors.permissionRules.clients")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.detail.errors.permissionRules.noAccess")}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold">
                      {t("contracts.detail.errors.redirecting")}
                    </div>
                    <div className="text-3xl font-bold font-mono">
                      {formatTimeLeft(countdown)}
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: 5, ease: "linear" }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                  <p className="text-blue-200 text-sm mt-3">
                    {t("contracts.detail.errors.redirectNotice")}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                  <button
                    onClick={() => router.push("/hub/projects")}
                    className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                  >
                    {t("contracts.detail.buttons.goToProjects")}
                  </button>
                  <button
                    onClick={() => router.push("/hub/contracts")}
                    className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                  >
                    {t("contracts.detail.buttons.viewYourContracts")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4">
                <Lock className="w-4 h-4 ml-2 mr-2" />
                {t("contracts.detail.errors.authenticationRequired")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("contracts.detail.errors.signInToView")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("contracts.detail.errors.signInDescription")}
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Link
                  href="/auth/login"
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {t("contracts.detail.buttons.signIn")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </Link>
                <Link
                  href="/auth/signup"
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                >
                  {t("contracts.detail.buttons.createAccount")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Contract not found
  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold mb-4">
                <AlertTriangle className="w-4 h-4 ml-2 mr-2" />
                {t("contracts.detail.errors.contractNotFound")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("contracts.detail.header.title", {
                  id: contractId.toString(),
                })}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("contracts.detail.errors.notFoundDescription")}
              </p>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-8 max-w-2xl mx-auto">
                <FileX className="w-16 h-16 text-amber-500 dark:text-amber-400 mx-auto mb-6" />

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                  <button
                    onClick={() => router.push("/hub/contracts")}
                    className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                  >
                    {t("contracts.detail.buttons.viewYourContracts")}
                  </button>
                  <button
                    onClick={() => router.push("/hub/projects")}
                    className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                  >
                    {t("contracts.detail.buttons.browseProjects")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const statusConfig = getStatusConfig(contract.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      {/* Delivery Modal */}
      <AnimatePresence>
        {showDeliveryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {t("contracts.detail.delivery.deliveryModal.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">
                      {t("contracts.detail.delivery.deliveryModal.description")}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeliveryModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      {t(
                        "contracts.detail.delivery.deliveryModal.deliveryDescription",
                      )}
                    </label>
                    <textarea
                      value={newDelivery.description}
                      onChange={(e) =>
                        setNewDelivery((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder={t(
                        "contracts.detail.delivery.deliveryModal.descriptionPlaceholder",
                      )}
                      className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      {t("contracts.detail.delivery.deliveryModal.fileUrls")}
                    </label>
                    <input
                      type="text"
                      value={newDelivery.file_urls?.join(", ") || ""}
                      onChange={(e) =>
                        setNewDelivery((prev) => ({
                          ...prev,
                          file_urls: e.target.value
                            .split(",")
                            .map((url) => url.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder={t(
                        "contracts.detail.delivery.deliveryModal.fileUrlsPlaceholder",
                      )}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                    />
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                      {t(
                        "contracts.detail.delivery.deliveryModal.fileUrlsHelp",
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-slate-800">
                  <button
                    onClick={() => setShowDeliveryModal(false)}
                    className="px-6 py-3 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300"
                  >
                    {t("contracts.detail.delivery.deliveryModal.cancel")}
                  </button>
                  <ActionButton
                    onClick={handleSubmitDelivery}
                    label={
                      submittingDelivery
                        ? `${t("contracts.detail.delivery.submitDelivery")}...`
                        : t("contracts.detail.delivery.submitDelivery")
                    }
                    icon={
                      submittingDelivery ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-5 h-5" />
                      )
                    }
                    variant="primary"
                    isLoading={submittingDelivery}
                    disabled={
                      !newDelivery.description.trim() || submittingDelivery
                    }
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <FileText className="w-4 h-4 ml-2 mr-2" />
              {t("contracts.detail.header.badge")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {contract.project?.title ||
                t("contracts.detail.header.title", {
                  id: contract.id.toString(),
                })}
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {contract.terms || t("contracts.detail.header.description")}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <div
                className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold shadow-sm ${statusConfig.color}`}
              >
                {statusConfig.icon}
                <span className="ml-2 mr-2">{statusConfig.label}</span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Briefcase className="w-4 h-4 ml-2 mr-2 text-blue-500 dark:text-blue-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {isFreelancer
                    ? t("contracts.detail.header.view.freelancer")
                    : isClient
                      ? t("contracts.detail.header.view.client")
                      : t("contracts.detail.header.view.admin")}
                </span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Hash className="w-4 h-4 ml-2 mr-2 text-gray-500 dark:text-slate-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {t("contracts.detail.header.contractNumber", {
                    id: contract.id.toString(),
                  })}
                </span>
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
                    onClick={fetchContractData}
                    className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 ml-2 mr-2" />
                    {t("contracts.detail.errors.refreshData")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Back Button */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/hub/contracts")}
              className="group inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
            >
              <ChevronRight className="w-5 h-5 ml-2 mr-2 transform rotate-180 group-hover:-translate-x-1 transition-transform duration-300" />
              {t("contracts.detail.buttons.backToContracts")}
            </button>
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <InfoCard
              title={t("contracts.detail.infoCards.contractValue")}
              value={formatCurrency(contract.amount)}
              icon={
                <Banknote className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
              }
              color="text-emerald-500"
            />
            <InfoCard
              title={t("contracts.detail.infoCards.status")}
              value={contract.status}
              icon={<CheckCircle className="w-6 h-6 text-green-500" />}
              color="text-green-500"
            />
            <InfoCard
              title={t("contracts.detail.infoCards.project")}
              value={
                contract.project?.title || t("contracts.detail.project.noTitle")
              }
              icon={
                <Briefcase className="w-6 h-6 text-blue-500 dark:text-blue-400" />
              }
              color="text-blue-500"
            />
            <InfoCard
              title={t("contracts.detail.infoCards.client")}
              value={
                contract.client?.fullName ||
                t("contracts.detail.parties.notAssigned")
              }
              icon={
                <Users className="w-6 h-6 text-purple-500 dark:text-purple-400" />
              }
              color="text-purple-500"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Contract Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Project Details */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("contracts.detail.sections.projectDetails")}
                  description={t(
                    "contracts.detail.sections.projectDescription",
                  )}
                />

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {contract.project?.title ||
                        t("contracts.detail.project.noTitle")}
                    </h4>
                    <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                      {(contract.project as any)?.description ||
                        t("contracts.detail.project.noDescription")}
                    </p>
                  </div>

                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                      {t("contracts.detail.project.contractTerms")}
                    </h5>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80">
                      <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                        {contract.terms ||
                          t("contracts.detail.project.noTerms")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Deliveries Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("contracts.detail.sections.deliveries")}
                  description={
                    isFreelancer
                      ? t(
                          "contracts.detail.sections.deliveriesDescriptionFreelancer",
                        )
                      : t(
                          "contracts.detail.sections.deliveriesDescriptionClient",
                        )
                  }
                  actionText={
                    isFreelancer && contract.status === "ACTIVE"
                      ? t("contracts.detail.delivery.submitDelivery")
                      : undefined
                  }
                  actionOnClick={
                    isFreelancer && contract.status === "ACTIVE"
                      ? () => setShowDeliveryModal(true)
                      : undefined
                  }
                  badge={t("contracts.detail.sections.deliveredCount", {
                    count: (contract.deliveries?.length || 0).toString(),
                  })}
                />

                {/* Upwork-Style Milestone Stage Progress Tracker & Silence = Acceptance 14-Day Clock */}
                <div className="mb-6">
                  <MilestoneStageTracker
                    milestoneId={contract.id}
                    milestoneTitle={
                      contract.project?.title ||
                      "Jalon Principal de Réalisation"
                    }
                    amountDzd={contract.amount || 50000}
                    status={
                      contract.status === "COMPLETED"
                        ? "APPROVED"
                        : contract.status === "DISPUTED"
                          ? "DISPUTED"
                          : contract.deliveries &&
                              contract.deliveries.length > 0
                            ? "DELIVERED"
                            : "PENDING"
                    }
                    deliveredAt={contract.deliveries?.[0]?.deliveredAt || null}
                    isClient={isClient}
                    onApprove={() => handleApproveMilestone(contract.id)}
                    onRequestRevisions={() => setShowRevisionModal(true)}
                    onDispute={handleOpenDispute}
                    onViewIpDeed={() => {
                      setSelectedDeed({
                        deedNumber: `IP-2026-CTR${contract.id}-MS01`,
                        contractId: contract.id,
                        milestoneId: 1,
                        milestoneTitle:
                          contract.project?.title || "Livrable de contrat",
                        amountDzd: contract.amount || 50000,
                        freelancerName:
                          contract.freelancer?.fullName || "Freelance Podacium",
                        freelancerAnae: "162400998811",
                        clientName:
                          contract.client?.fullName || "Client Podacium",
                        deliverableSha256:
                          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        documentSha256:
                          "9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
                        signatureEd25519:
                          "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
                        signedAt: new Date().toISOString(),
                        pdfUrl: `/api/v1/invoices/milestones/1/ip-deed/download`,
                      });
                      setShowIpDeedModal(true);
                    }}
                  />
                </div>

                {/* Interactive Deliverable Review Canvas */}
                {contract.deliveries && contract.deliveries.length > 0 && (
                  <div className="mb-6">
                    <DeliverableReviewCanvas
                      milestoneId={contract.id}
                      milestoneTitle={
                        contract.project?.title || "Livrable de contrat"
                      }
                      deliverableFile={
                        contract.deliveries[0].files &&
                        Array.isArray(contract.deliveries[0].files)
                          ? {
                              name:
                                contract.deliveries[0].files[0]?.filename ||
                                "Livrable_Inspection.pdf",
                              url: contract.deliveries[0].files[0]?.url || "",
                            }
                          : {
                              name: "Livrable_Inspection.pdf",
                              url: "",
                            }
                      }
                      initialPins={canvasPins[contract.id] || []}
                      isClient={isClient}
                      currentUserName={userProfile?.fullName || "Client"}
                      onSavePins={(newPins) => {
                        setCanvasPins((prev) => ({
                          ...prev,
                          [contract.id]: newPins,
                        }));
                        toast.success(
                          t(
                            "contracts.detail.milestoneActions.canvasAnnotationsSaved",
                          ),
                        );
                      }}
                      onRequestRevisions={() => setShowRevisionModal(true)}
                    />
                  </div>
                )}

                <div className="space-y-6">
                  {contract.deliveries && contract.deliveries.length > 0 ? (
                    contract.deliveries.map((delivery, index) => (
                      <DeliveryCard
                        key={delivery.id}
                        delivery={delivery}
                        isFreelancer={isFreelancer}
                        onApprove={() => handleApproveMilestone(contract.id)}
                        onRequestRevision={() => setShowRevisionModal(true)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
                      <PackageSearch className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                        {isFreelancer
                          ? t(
                              "contracts.detail.delivery.noDeliveries.freelancerTitle",
                            )
                          : t(
                              "contracts.detail.delivery.noDeliveries.clientTitle",
                            )}
                      </h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                        {isFreelancer
                          ? t(
                              "contracts.detail.delivery.noDeliveries.freelancerDescription",
                            )
                          : t(
                              "contracts.detail.delivery.noDeliveries.clientDescription",
                            )}
                      </p>
                      {isFreelancer && contract.status === "ACTIVE" && (
                        <div className="flex justify-center">
                          <ActionButton
                            onClick={() => setShowDeliveryModal(true)}
                            label={t("contracts.detail.delivery.firstDelivery")}
                            icon={<UploadCloud className="w-5 h-5" />}
                            variant="primary"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Reviews Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("hub.reviews.title")}
                  actionText={
                    canReview ? t("hub.reviews.leaveReview") : undefined
                  }
                  actionOnClick={
                    canReview
                      ? () => {
                          setEditingReview(null);
                          setShowReviewModal(true);
                        }
                      : undefined
                  }
                  badge={reviews.length.toString()}
                />
                <div className="space-y-6 mt-4">
                  {loadingReviews ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-xl"></div>
                      <div className="h-32 bg-gray-100 dark:bg-slate-800 rounded-xl"></div>
                    </div>
                  ) : (
                    <ReviewList
                      reviews={reviews}
                      currentUserId={userProfile?.id || 0}
                      onEditClick={(r) => {
                        setEditingReview(r);
                        setShowReviewModal(true);
                      }}
                      onAppealClick={(r) => {
                        const reason = prompt(
                          t("hub.reviews.appealReasonPlaceholder"),
                        );
                        if (reason) {
                          api
                            .post(`/hub/reviews/${r.id}/appeals`, {
                              reason,
                              evidence_urls: [],
                            })
                            .then(() => {
                              toast.success(t("hub.reviews.appealSubmitted"));
                              fetchReviews();
                            })
                            .catch((e) =>
                              toast.error(e.message || t("common.error")),
                            );
                        }
                      }}
                    />
                  )}
                </div>
              </motion.div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-8">
              {/* Parties Involved */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("contracts.detail.sections.partiesInvolved")}
                  description={t(
                    "contracts.detail.sections.partiesDescription",
                  )}
                />

                <div className="space-y-6">
                  {/* Client Card */}
                  <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl p-4 border border-green-200 dark:border-emerald-800/80 hover:border-green-300 transition-all duration-300">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center overflow-hidden">
                          {contract.client?.profilePictureUrl ? (
                            <img
                              src={contract.client.profilePictureUrl}
                              alt={contract.client.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <UserCheck className="w-6 h-6 text-green-500" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                          <Briefcase className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-slate-100 truncate">
                          {t("contracts.detail.parties.client")}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {contract.client?.fullName ||
                            t("contracts.detail.parties.notAssigned")}
                        </p>
                        {isClient && (
                          <div className="inline-flex items-center px-2 py-0.5 bg-green-100 dark:bg-emerald-950/60 text-green-800 text-xs rounded-full mt-1">
                            <UserCheck className="w-3 h-3 ml-2 mr-2" />
                            {t("contracts.detail.parties.you")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Freelancer Card */}
                  <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                          {contract.freelancer?.profilePictureUrl ? (
                            <img
                              src={contract.freelancer.profilePictureUrl}
                              alt={contract.freelancer.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <Users className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <Briefcase className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-slate-100 truncate">
                          {t("contracts.detail.parties.freelancer")}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {contract.freelancer?.fullName ||
                            t("contracts.detail.parties.notAssigned")}
                        </p>
                        {isFreelancer && (
                          <div className="inline-flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs rounded-full mt-1">
                            <UserCheck className="w-3 h-3 ml-2 mr-2" />
                            {t("contracts.detail.parties.you")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Contract Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("contracts.detail.sections.contractActions")}
                  description={t(
                    "contracts.detail.sections.actionsDescription",
                  )}
                />

                <div className="flex flex-col gap-3">
                  {/* Freelancer Actions */}
                  {isFreelancer && contract.status === "ACTIVE" && (
                    <>
                      <ActionButton
                        onClick={() => setShowDeliveryModal(true)}
                        label={t("contracts.detail.actions.submitDelivery")}
                        icon={<UploadCloud className="w-5 h-5" />}
                        variant="primary"
                        fullWidth
                      />

                      <ActionButton
                        onClick={handleCompleteContract}
                        label={
                          completingContract
                            ? t("contracts.detail.actions.completing")
                            : t("contracts.detail.actions.markAsCompleted")
                        }
                        icon={
                          completingContract ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )
                        }
                        variant="success"
                        isLoading={completingContract}
                        fullWidth
                      />
                    </>
                  )}

                  {/* Client Actions */}
                  {isClient && contract.status === "ACTIVE" && (
                    <>
                      <ActionButton
                        onClick={handleCompleteContract}
                        label={
                          completingContract
                            ? t("contracts.detail.actions.completing")
                            : t("contracts.detail.actions.completeContract")
                        }
                        icon={
                          completingContract ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )
                        }
                        variant="success"
                        isLoading={completingContract}
                        fullWidth
                      />

                      <ActionButton
                        onClick={() => {
                          router.push(`/hub/contracts/${contract.id}/messages`);
                        }}
                        label={t("contracts.detail.actions.messageFreelancer")}
                        icon={<MessageSquare className="w-5 h-5" />}
                        variant="secondary"
                        fullWidth
                      />
                    </>
                  )}

                  {/* Shared Actions for Active Contracts */}
                  {contract.status === "ACTIVE" &&
                    (isFreelancer || isClient) && (
                      <ActionButton
                        onClick={handleCancelContract}
                        label={
                          cancellingContract
                            ? t("contracts.detail.actions.cancelling")
                            : t("contracts.detail.actions.cancelContract")
                        }
                        icon={
                          cancellingContract ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )
                        }
                        variant="danger"
                        isLoading={cancellingContract}
                        fullWidth
                      />
                    )}

                  {/* View Project Link */}
                  {contract.projectId && (
                    <ActionButton
                      onClick={() =>
                        router.push(`/hub/projects/${contract.projectId}`)
                      }
                      label={t("contracts.detail.actions.viewProject")}
                      icon={<ExternalLink className="w-5 h-5" />}
                      variant="secondary"
                      fullWidth
                    />
                  )}

                  {/* Contract Status Info */}
                  <div className="pt-6 mt-6 border-t border-gray-200/50 dark:border-slate-800/50">
                    <div className="text-center">
                      <div
                        className={`inline-flex items-center px-4 py-2 rounded-xl ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        <span className="ml-2 mr-2 font-semibold">
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-3">
                        {contract.status === "ACTIVE" &&
                          t("contracts.detail.status.descriptions.active")}
                        {contract.status === "COMPLETED" &&
                          t("contracts.detail.status.descriptions.completed")}
                        {contract.status === "CANCELLED" &&
                          t("contracts.detail.status.descriptions.cancelled")}
                        {contract.status === "PENDING" &&
                          t("contracts.detail.status.descriptions.pending")}
                        {contract.status === "DISPUTED" &&
                          t("contracts.detail.status.descriptions.disputed")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Support & Help */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-slate-100">
                      {t("contracts.detail.sections.needHelp")}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("contracts.detail.sections.helpDescription")}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/support")}
                    className="w-full text-left px-4 py-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 hover:shadow-sm transition-all duration-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {t("contracts.detail.actions.contactSupport")}
                    </span>
                    <ExternalLink className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </button>

                  <button
                    onClick={() => router.push("/learn/paths/freelancing")}
                    className="w-full text-left px-4 py-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 hover:shadow-sm transition-all duration-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {t("contracts.detail.actions.freelancingGuide")}
                    </span>
                    <ExternalLink className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </button>

                  <button
                    onClick={() => router.push("/terms")}
                    className="w-full text-left px-4 py-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 hover:shadow-sm transition-all duration-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {t("contracts.detail.actions.legalTerms")}
                    </span>
                    <ExternalLink className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16"
          >
            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 md:p-12 text-white overflow-hidden">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]"></div>

              <div className="relative z-10 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  {t("contracts.detail.support.needHelp")}
                </h2>
                <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
                  {t("contracts.detail.support.needHelpDescription")}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => {
                      router.push(`/hub/contracts/${contract.id}/messages`);
                    }}
                    className="group relative px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-3xl"
                  >
                    <div className="flex items-center justify-center">
                      {t("contracts.detail.support.openChat")}
                      <MessageSquare className="w-5 h-5 ml-2 mr-2 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                  </button>
                  <button
                    onClick={() => router.push("/support")}
                    className="group relative px-8 py-3.5 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
                  >
                    <div className="flex items-center justify-center">
                      {t("contracts.detail.support.getSupport")}
                      <HelpCircle className="w-5 h-5 ml-2 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 dark:bg-[#0a0a0a] rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-slate-800 dark:border-gray-800 pb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 dark:text-white">
                  {editingReview
                    ? t("hub.reviews.editReview")
                    : t("hub.reviews.leaveReview")}
                </h3>
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setEditingReview(null);
                  }}
                  className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <RatingForm
                role={isClient ? "CLIENT" : "FREELANCER"}
                initialData={
                  editingReview
                    ? {
                        rating: editingReview.rating,
                        subRatings: editingReview.subRatings,
                        comment: editingReview.comment || "",
                      }
                    : undefined
                }
                onSubmit={handleSubmitReview}
                onCancel={() => {
                  setShowReviewModal(false);
                  setEditingReview(null);
                }}
                isSubmitting={false}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PodaciumModal
        isOpen={confirmAction === "complete"}
        onClose={() => setConfirmAction(null)}
        title={t("contracts.detail.confirmation.completeTitle")}
        description={t("contracts.detail.confirmation.completeContract")}
      >
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setConfirmAction(null)}
            className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={executeCompleteContract}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-300"
          >
            {t("contracts.detail.actions.confirmComplete")}
          </button>
        </div>
      </PodaciumModal>

      <PodaciumModal
        isOpen={confirmAction === "cancel"}
        onClose={() => setConfirmAction(null)}
        title={t("contracts.detail.confirmation.cancelTitle")}
        description={t("contracts.detail.confirmation.cancelContract")}
      >
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setConfirmAction(null)}
            className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white dark:text-slate-200 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={executeCancelContract}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold rounded-lg hover:from-red-600 hover:to-rose-600 transition-all duration-300"
          >
            {t("contracts.detail.actions.confirmCancel")}
          </button>
        </div>
      </PodaciumModal>

      {/* Structured Revision Request Modal */}
      <StructuredRevisionModal
        isOpen={showRevisionModal}
        onClose={() => setShowRevisionModal(false)}
        milestoneId={contract?.id || 1}
        milestoneTitle={contract?.project?.title || "Livrable Principal"}
        associatedPinCount={(canvasPins[contract?.id || 0] || []).length}
        onSubmitRevision={handleSubmitStructuredRevision}
      />

      {/* Bilateral IP Assignment Deed Modal (Ordonnance 03-05 ONDA & Loi 22-23 ANAE) */}
      {selectedDeed && (
        <PodaciumModal
          isOpen={showIpDeedModal}
          onClose={() => setShowIpDeedModal(false)}
          title={t("contracts.detail.milestoneActions.ipDeedModalTitle")}
        >
          <IpAssignmentDeedCard
            deed={selectedDeed}
            onDownloadPdf={() => {
              window.open(
                `/api/v1/invoices/milestones/${selectedDeed.milestoneId}/ip-deed/download`,
                "_blank",
              );
            }}
          />
        </PodaciumModal>
      )}

      <Footer />
    </div>
  );
}
