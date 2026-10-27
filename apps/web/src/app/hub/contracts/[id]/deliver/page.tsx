// apps/web/src/app/hub/contracts/[id]/deliver/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
  Send,
  Eye,
  Plus,
  Trash2,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";
import {
  apiHelpers,
  ContractResponse,
  UserRole,
  ContractStatus,
  UserProfileResponse,
  DeliveryCreate,
  DeliveryResponse,
  handleApiError,
  NetworkError,
  isApiError,
  isNetworkError,
  isAuthenticationError,
  ApiError,
  AuthenticationError,
} from "@/lib/api";

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
            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      )}
    </div>
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
  const t = useTranslations();
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
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        {t("common.loading")}
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
      <span className="ml-2">{label}</span>
    </motion.button>
  );
};

interface DeliverableCardProps {
  deliverable: DeliveryResponse;
  isFreelancer: boolean;
}

const DeliverableCard: React.FC<DeliverableCardProps> = ({
  deliverable,
  isFreelancer,
}) => {
  const t = useTranslations("contracts.deliver");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              {t("deliverable")}
            </h4>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t("submittedOn", { date: formatDate(deliverable.deliveredAt) })}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200 dark:border-emerald-800/80 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3 h-3 mr-1.5" />
          {t("deliveredStatus")}
        </div>
      </div>

      <div className="mb-6">
        <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
          {t("description")}
        </h5>
        <p className="text-gray-600 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/60 rounded-lg p-4 border border-gray-200/50 dark:border-slate-800/50">
          {deliverable.description || t("noDescription")}
        </p>
      </div>

      {deliverable.files && (
        <div className="mb-6">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
            {t("attachedFiles")}
          </h5>
          <div className="space-y-2">
            {Array.isArray(deliverable.files) &&
              deliverable.files.map((file: any, index: number) => (
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
                  <button
                    onClick={() =>
                      handleDownloadFile(
                        file.url || file.filename,
                        file.filename,
                      )
                    }
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-semibold flex items-center"
                  >
                    <DownloadCloud className="w-4 h-4 mr-1" />
                    {t("download")}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {!isFreelancer && (
        <div className="flex space-x-3 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
          <ActionButton
            onClick={() => {}}
            label={t("approve")}
            icon={<Check className="w-5 h-5" />}
            variant="success"
          />
          <ActionButton
            onClick={() => {}}
            label={t("requestRevision")}
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

const DeliverablesSkeleton = () => (
  <div className="animate-pulse">
    {/* Header Skeleton */}
    <div className="mb-8">
      <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-4"></div>
      <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
    </div>

    {/* Main Content Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Deliverables List */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-gray-100 dark:bg-slate-800 rounded-xl"
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Submit Form */}
      <div className="space-y-8">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-6 w-48"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
            <div className="h-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
            <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN DELIVERABLES PAGE COMPONENT
// =============================================================================

export default function ContractDeliverablesPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations("contracts.deliver");

  const contractId = parseInt(params.id as string);

  // State Management
  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Deliverable submission state
  const [newDeliverable, setNewDeliverable] = useState<DeliveryCreate>({
    description: "",
    file_urls: [],
  });
  const [fileUrlInput, setFileUrlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return "Negotiable";
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
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
        // Redirect immediately without showing UI
        router.push("/hub/projects");
        return;
      }
    } catch (err: any) {
      console.error("Error fetching contract:", err);

      if (err instanceof AuthenticationError) {
        setError(t("authError"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("notFoundError"));
      } else if (err instanceof ApiError) {
        setError(err.message || t("notFoundError"));
      } else if (err instanceof NetworkError) {
        setError(t("networkError"));
      } else {
        setError(t("unexpectedError"));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, contractId, checkUserPermission, router, t]);

  // Handle deliverable submission
  const handleSubmitDeliverable = async () => {
    if (!contract || !newDeliverable.description.trim()) {
      setError(t("descriptionRequired"));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const deliverableData: DeliveryCreate = {
        description: newDeliverable.description,
        file_urls: newDeliverable.file_urls || [],
      };

      await apiHelpers.freelancing.submitDelivery(contract.id, deliverableData);

      // Refresh contract data to show new deliverable
      await fetchContractData();

      // Reset form
      setNewDeliverable({ description: "", file_urls: [] });
      setFileUrlInput("");
    } catch (err: any) {
      console.error("Error submitting deliverable:", err);
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Add file URL to deliverable
  const addFileUrl = () => {
    if (!fileUrlInput.trim()) return;

    const url = fileUrlInput.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError(t("validUrlRequired"));
      return;
    }

    setNewDeliverable((prev) => ({
      ...prev,
      file_urls: [...(prev.file_urls || []), url],
    }));
    setFileUrlInput("");
    setError(null);
  };

  // Remove file URL from deliverable
  const removeFileUrl = (index: number) => {
    setNewDeliverable((prev) => ({
      ...prev,
      file_urls: prev.file_urls?.filter((_, i) => i !== index) || [],
    }));
  };

  // Initialize on mount
  useEffect(() => {
    if (!authLoading) {
      fetchContractData();
    }
  }, [authLoading, fetchContractData]);

  // Redirect unauthorized users immediately
  useEffect(() => {
    if (!loading && accessDenied) {
      router.push("/hub/projects");
    }
  }, [loading, accessDenied, router]);

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
            <DeliverablesSkeleton />
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
                <Lock className="w-4 h-4 mr-2" />
                {t("authRequired")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("signInTitle")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("signInDesc")}
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Link
                  href="/auth/login"
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {t("signInButton")}
                  <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </Link>
                <Link
                  href="/auth/signup"
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                >
                  {t("createAccountButton")}
                  <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
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
                <AlertTriangle className="w-4 h-4 mr-2" />
                {t("notFoundTitle")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("notFoundHeader", { id: contractId })}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("notFoundDesc")}
              </p>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-8 max-w-2xl mx-auto">
                <FileX className="w-16 h-16 text-amber-500 dark:text-amber-400 mx-auto mb-6" />

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                  <button
                    onClick={() => router.push("/hub/contracts")}
                    className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                  >
                    {t("viewContracts")}
                  </button>
                  <button
                    onClick={() => router.push("/hub/projects")}
                    className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                  >
                    {t("browseProjects")}
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

  // Check if contract is active (only active contracts can have new deliveries)
  const isContractActive = contract.status === "ACTIVE";

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
              <PackageCheck className="w-4 h-4 mr-2" />
              {t("pageTitle")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {contract.project?.title || `Contract #${contract.id}`}
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {isFreelancer ? t("freelancerSubtitle") : t("clientSubtitle")}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Briefcase className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {isFreelancer ? t("freelancerView") : t("clientView")}
                </span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Hash className="w-4 h-4 mr-2 text-gray-500 dark:text-slate-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  #{contract.id}
                </span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Banknote className="w-4 h-4 mr-2 text-emerald-500 dark:text-emerald-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {formatCurrency(contract.amount)}
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
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t("refreshData")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Back Button */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/hub/contracts/${contractId}`)}
              className="group inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
            >
              <ChevronRight className="w-5 h-5 mr-1 transform rotate-180 group-hover:-translate-x-1 transition-transform duration-300" />
              {t("backToContract")}
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Deliverables List */}
            <div className="lg:col-span-2 space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("submittedDeliverables")}
                  description={
                    isFreelancer
                      ? t("freelancerDeliverablesDesc")
                      : t("clientDeliverablesDesc")
                  }
                  badge={t("totalBadge", {
                    count: contract.deliveries?.length || 0,
                  })}
                />

                <div className="space-y-6">
                  {contract.deliveries && contract.deliveries.length > 0 ? (
                    contract.deliveries.map((delivery, index) => (
                      <DeliverableCard
                        key={delivery.id}
                        deliverable={delivery}
                        isFreelancer={isFreelancer}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
                      <PackageSearch className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                        {isFreelancer
                          ? t("noDeliveriesFreelancerTitle")
                          : t("noDeliveriesClientTitle")}
                      </h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                        {isFreelancer
                          ? t("noDeliveriesFreelancerDesc")
                          : t("noDeliveriesClientDesc")}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Right Column - Submit Form / Info Panel */}
            <div className="space-y-8">
              {/* Submit Deliverable Form (Freelancer only) */}
              {isFreelancer && isContractActive && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
                >
                  <SectionHeader
                    title={t("submitNewDeliverable")}
                    description={t("shareWorkDesc")}
                  />

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                        {t("formDescriptionLabel")}
                      </label>
                      <textarea
                        value={newDeliverable.description}
                        onChange={(e) =>
                          setNewDeliverable((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder={t("formDescriptionPlaceholder")}
                        className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                        {t("fileUrlsLabel")}
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={fileUrlInput}
                          onChange={(e) => setFileUrlInput(e.target.value)}
                          placeholder={t("fileUrlPlaceholder")}
                          className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addFileUrl();
                            }
                          }}
                        />
                        <button
                          onClick={addFileUrl}
                          className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {newDeliverable.file_urls &&
                        newDeliverable.file_urls.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {newDeliverable.file_urls.map((url, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-900/60 rounded-lg"
                              >
                                <span className="text-sm text-gray-700 dark:text-slate-300 truncate">
                                  {url}
                                </span>
                                <button
                                  onClick={() => removeFileUrl(index)}
                                  className="text-red-500 hover:text-red-700 dark:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        {t("fileUrlsHelp")}
                      </p>
                    </div>

                    <ActionButton
                      onClick={handleSubmitDeliverable}
                      label={
                        submitting ? t("submitting") : t("submitDeliverable")
                      }
                      icon={
                        submitting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )
                      }
                      variant="primary"
                      isLoading={submitting}
                      disabled={
                        !newDeliverable.description.trim() || submitting
                      }
                      fullWidth
                    />
                  </div>
                </motion.div>
              )}

              {/* Contract Status Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
              >
                <SectionHeader
                  title={t("contractStatusTitle")}
                  description={t("contractStatusDesc")}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("statusLabel")}
                    </span>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
                        contract.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : contract.status === "COMPLETED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200"
                      }`}
                    >
                      {contract.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("amountLabel")}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">
                      {formatCurrency(contract.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("roleLabel")}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">
                      {isFreelancer ? t("roleFreelancer") : t("roleClient")}
                    </span>
                  </div>

                  {!isContractActive && isFreelancer && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 mt-4">
                      <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 inline mr-2" />
                      <span className="text-amber-800 dark:text-amber-200 text-sm">
                        {t("inactiveWarning")}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Support & Help */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-slate-100">
                      {t("needHelp")}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("needHelpDesc")}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/support")}
                    className="w-full text-left px-4 py-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 hover:shadow-sm transition-all duration-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {t("contactSupport")}
                    </span>
                    <ExternalLink className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </button>

                  <button
                    onClick={() => {
                      const otherUserId = isFreelancer
                        ? contract.clientId
                        : contract.freelancerId;
                      router.push(`/hub/messages?user=${otherUserId}`);
                    }}
                    className="w-full text-left px-4 py-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 hover:shadow-sm transition-all duration-300 flex items-center justify-between"
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {t("messageParty", {
                        party: isFreelancer
                          ? t("partyClient")
                          : t("partyFreelancer"),
                      })}
                    </span>
                    <MessageSquare className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
