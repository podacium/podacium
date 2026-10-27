// apps/web/src/app/hub/projects/[id]/proposals/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Shield,
  Award,
  Star,
  FileText,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Zap,
  Target,
  Rocket,
  Sparkles,
  ArrowUpRight,
  Building,
  Globe,
  Tag,
  Filter,
  Search,
  MoreVertical,
  Check,
  X,
  Send,
  Download,
  File,
  Link as LinkIcon,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Equal,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  Users2,
  CalendarDays,
  Clock as ClockIcon,
  Banknote,
  Percent,
  Lock,
  Unlock,
  Award as AwardIcon,
  Briefcase as BriefcaseIcon,
  AlertTriangle,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiHelpers,
  ProposalResponse,
  ProjectResponse,
  ContractCreate,
  UserRole,
  ProposalStatus,
  api,
} from "@/lib/api";
import { useTranslations, useTextDirection } from "@/lib/i18n";
import { toast } from "sonner";

// =============================================================================
// ANIMATION CONFIGURATION (Match existing pattern)
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
// FILTER TYPES
// =============================================================================

type ProposalFilter = "all" | "pending" | "accepted" | "rejected";

// =============================================================================
// REUSABLE COMPONENTS (Match existing pattern)
// =============================================================================

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  icon,
  badge,
}) => (
  <div className="mb-6">
    <div className="flex items-center space-x-3 mb-3">
      {icon && (
        <div className="p-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
          <div className="text-blue-600 dark:text-blue-400">{icon}</div>
        </div>
      )}
      <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
        {title}
      </h2>
      {badge && (
        <span className="px-2.5 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
    </div>
    {description && (
      <p className="text-gray-600 dark:text-slate-400 max-w-3xl">
        {description}
      </p>
    )}
  </div>
);

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const t = useTranslations();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case ProposalStatus.PENDING:
        return {
          bg: "bg-amber-100",
          text: "text-amber-800",
          border: "border-amber-200",
          icon: <Clock className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
          label: t("projects.proposals.status.pending"),
        };
      case ProposalStatus.ACCEPTED:
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-200",
          icon: (
            <CheckCircle className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
          ),
          label: t("projects.proposals.status.accepted"),
        };
      case ProposalStatus.REJECTED:
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
          icon: <XCircle className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />,
          label: t("projects.proposals.status.rejected"),
        };
      default:
        return {
          bg: "bg-gray-100 dark:bg-slate-800",
          text: "text-gray-800 dark:text-slate-200",
          border: "border-gray-200 dark:border-slate-800",
          icon: null,
          label: status,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full ${config.bg} ${config.text} border ${config.border} ${size === "sm" ? "text-xs" : "text-sm"} font-medium`}
    >
      {config.icon && (
        <span className="mr-3 rtl:mr-2 rtl:ml-3">{config.icon}</span>
      )}
      {config.label}
    </span>
  );
};

interface ActionButtonProps {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  variant: "primary" | "secondary" | "danger" | "success";
  disabled?: boolean;
  loading?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  label,
  icon,
  variant,
  disabled = false,
  loading = false,
}) => {
  const variantClasses = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white",
    secondary:
      "bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60",
    danger:
      "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white",
    success:
      "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 animate-spin" />
      ) : (
        <span className="mr-3 rtl:mr-2 rtl:ml-3">{icon}</span>
      )}
      {label}
    </button>
  );
};

interface ProposalCardProps {
  proposal: ProposalResponse;
  onAccept: (proposalId: number) => void;
  onReject: (proposalId: number) => void;
  isProcessing: boolean;
  processingId: number | null;
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onAccept,
  onReject,
  isProcessing,
  processingId,
}) => {
  const t = useTranslations();
  const isProcessingThis = isProcessing && processingId === proposal.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200/50 dark:border-slate-800/50">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start space-x-4 rtl:space-x-reverse">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
              {proposal.freelancer?.profilePictureUrl ? (
                <img
                  src={proposal.freelancer.profilePictureUrl}
                  alt={proposal.freelancer.fullName}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-3 rtl:space-x-reverse mb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                  {proposal.freelancer?.fullName ||
                    t("projects.proposals.anonymousFreelancer")}
                </h3>
                <StatusBadge status={proposal.status} />
              </div>
              <p className="text-gray-600 dark:text-slate-400 text-sm mb-3">
                {proposal.freelancer?.bio ||
                  t("projects.proposals.noBioProvided")}
              </p>
              <div className="flex flex-wrap gap-2">
                {proposal.freelancer?.skills
                  ?.slice(0, 4)
                  .map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80"
                    >
                      <Tag className="w-3 h-3 mr-3 rtl:mr-2 rtl:ml-3" />
                      {skill}
                    </span>
                  ))}
                {proposal.freelancer?.skills &&
                  proposal.freelancer.skills.length > 4 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-50 dark:bg-slate-900/60 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800">
                      {t("projects.proposals.moreSkills", {
                        count: String(proposal.freelancer.skills.length - 4),
                      })}
                    </span>
                  )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end rtl:items-start">
            {proposal.amount && (
              <div className="text-right mb-3 rtl:text-left">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {t("projects.proposals.proposedBudget")}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {t("projects.proposals.currencyDZD", {
                    amount: proposal.amount.toLocaleString(),
                  })}
                </p>
              </div>
            )}
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {t("projects.proposals.submittedOn", {
                date: new Date(proposal.createdAt).toLocaleDateString(),
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {proposal.message && (
        <div className="p-6 border-b border-gray-200/50 dark:border-slate-800/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
          <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-2 flex items-center">
            <MessageSquare className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 text-blue-500 dark:text-blue-400" />
            {t("projects.proposals.proposalMessage")}
          </h4>
          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {proposal.message}
          </p>
        </div>
      )}

      {/* Freelancer Info */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
              {t("projects.proposals.freelancerDetails")}
            </h4>
            <div className="space-y-2">
              {proposal.freelancer?.phoneVerified && (
                <div className="flex items-center text-gray-700 dark:text-slate-300">
                  <CheckCircle className="w-4 h-4 mr-3 rtl:mr-1 rtl:ml-3 text-green-500" />
                  <span className="text-sm">
                    {t("projects.proposals.phoneVerified")}
                  </span>
                </div>
              )}
              {proposal.freelancer?.certificates &&
                proposal.freelancer.certificates.length > 0 && (
                  <div className="flex items-center text-gray-700 dark:text-slate-300">
                    <Award className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 text-amber-500 dark:text-amber-400" />
                    <span className="text-sm">
                      {t("projects.proposals.certificatesCount", {
                        count: String(proposal.freelancer.certificates.length),
                        plural:
                          proposal.freelancer.certificates.length !== 1
                            ? "s"
                            : "",
                      })}
                    </span>
                  </div>
                )}
              <Link
                href={`/profile/${proposal.freelancer?.id}`}
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium"
              >
                {t("projects.proposals.viewFullProfile")}
                <ExternalLink className="w-3 h-3 ml-2 rtl:ml-1 rtl:mr-2" />
              </Link>
            </div>
          </div>

          {/* Actions */}
          {proposal.status === ProposalStatus.PENDING && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.proposals.actions")}
              </h4>
              <div className="flex flex-wrap gap-3">
                <ActionButton
                  onClick={() => onAccept(proposal.id)}
                  label={t("projects.proposals.buttons.acceptProposal")}
                  icon={<ThumbsUp className="w-4 h-4" />}
                  variant="success"
                  disabled={isProcessing}
                  loading={isProcessingThis}
                />
                <ActionButton
                  onClick={() => onReject(proposal.id)}
                  label={t("projects.proposals.buttons.reject")}
                  icon={<ThumbsDown className="w-4 h-4" />}
                  variant="danger"
                  disabled={isProcessing}
                  loading={isProcessingThis && !isProcessing}
                />
              </div>
            </div>
          )}

          {proposal.status === ProposalStatus.ACCEPTED && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl p-4 border border-green-200 dark:border-emerald-800/80">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-800">
                  {t("projects.proposals.status.accepted")}
                </h4>
              </div>
              <p className="text-green-700 text-sm">
                {t("projects.proposals.acceptedMessage")}
              </p>
            </div>
          )}

          {proposal.status === ProposalStatus.REJECTED && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-200 dark:border-red-800/80">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h4 className="font-semibold text-red-800 dark:text-red-200">
                  {t("projects.proposals.status.rejected")}
                </h4>
              </div>
              <p className="text-red-700 dark:text-red-300 text-sm">
                {t("projects.proposals.rejectedMessage")}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const ProposalsSkeleton = () => (
  <div className="animate-pulse space-y-6">
    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6"
      >
        <div className="flex items-start space-x-4 mb-4">
          <div className="w-16 h-16 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4 mb-3"></div>
            <div className="flex flex-wrap gap-2">
              <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
              <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
            </div>
          </div>
          <div className="w-32 h-24 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
        </div>
        <div className="h-20 bg-gray-200 dark:bg-slate-800/90 rounded-lg mb-4"></div>
        <div className="flex gap-3">
          <div className="w-32 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
          <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

interface AcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (contractData?: ContractCreate) => Promise<void>;
  freelancerName: string;
  amount?: number;
  isSubmitting: boolean;
}

const AcceptModal: React.FC<AcceptModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  freelancerName,
  amount,
  isSubmitting,
}) => {
  const t = useTranslations();
  const direction = useTextDirection();
  const [contractData, setContractData] = useState<ContractCreate>({
    amount: amount,
    terms: t("projects.proposals.modals.accept.defaultTerms"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAccept(contractData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-4"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200/50 dark:border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      {t("projects.proposals.modals.accept.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">
                      {t("projects.proposals.modals.accept.description", {
                        name: freelancerName,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-6">
                  {/* Terms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("projects.proposals.modals.accept.contractTerms")}{" "}
                      <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <textarea
                      value={contractData.terms}
                      onChange={(e) =>
                        setContractData((prev) => ({
                          ...prev,
                          terms: e.target.value,
                        }))
                      }
                      placeholder={t(
                        "projects.proposals.modals.accept.termsPlaceholder",
                      )}
                      className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      {t("projects.proposals.modals.accept.termsHelp")}
                    </p>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("projects.proposals.modals.accept.contractAmount")}
                    </label>
                    <div className="relative">
                      <Banknote
                        className={`absolute ${direction === "rtl" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`}
                      />
                      <input
                        type="number"
                        value={contractData.amount || ""}
                        onChange={(e) =>
                          setContractData((prev) => ({
                            ...prev,
                            amount: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          }))
                        }
                        placeholder={t(
                          "projects.proposals.modals.accept.amountPlaceholder",
                        )}
                        className={`w-full ${direction === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      {t("projects.proposals.modals.accept.amountHelp")}
                    </p>
                  </div>

                  {/* Timeline */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                        {t("projects.proposals.modals.accept.startDate")}
                      </label>
                      <div className="relative">
                        <Calendar
                          className={`absolute ${direction === "rtl" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`}
                        />
                        <input
                          type="date"
                          value={contractData.start_date || ""}
                          onChange={(e) =>
                            setContractData((prev) => ({
                              ...prev,
                              start_date: e.target.value,
                            }))
                          }
                          className={`w-full ${direction === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                        {t("projects.proposals.modals.accept.endDate")}
                      </label>
                      <div className="relative">
                        <Calendar
                          className={`absolute ${direction === "rtl" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`}
                        />
                        <input
                          type="date"
                          value={contractData.end_date || ""}
                          onChange={(e) =>
                            setContractData((prev) => ({
                              ...prev,
                              end_date: e.target.value,
                            }))
                          }
                          className={`w-full ${direction === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 rtl:space-x-reverse pt-6 border-t border-gray-200/50 dark:border-slate-800/50 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t("projects.proposals.modals.buttons.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !contractData.terms?.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 animate-spin" />
                        {t("projects.proposals.modals.accept.creatingContract")}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
                        {t("projects.proposals.modals.accept.acceptAndCreate")}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  freelancerName: string;
  isSubmitting: boolean;
}

const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  freelancerName,
  isSubmitting,
}) => {
  const t = useTranslations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200/50 dark:border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      {t("projects.proposals.modals.reject.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">
                      {t("projects.proposals.modals.reject.description", {
                        name: freelancerName,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("projects.proposals.modals.reject.confirmTitle")}
                  </h4>
                  <p className="text-gray-600 dark:text-slate-400">
                    {t("projects.proposals.modals.reject.confirmDescription")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 rtl:space-x-reverse pt-6 border-t border-gray-200/50 dark:border-slate-800/50 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t("projects.proposals.modals.buttons.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 animate-spin" />
                        {t("projects.proposals.modals.reject.rejecting")}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
                        {t("projects.proposals.modals.reject.yesReject")}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ProjectProposalsPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations();

  const projectId = parseInt(params.id as string);

  // State Management
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [proposals, setProposals] = useState<ProposalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Filter state
  const [activeFilter, setActiveFilter] = useState<ProposalFilter>("all");

  // Modal states
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedProposal, setSelectedProposal] =
    useState<ProposalResponse | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });

  // Calculate stats
  useEffect(() => {
    const stats = {
      total: proposals.length,
      pending: proposals.filter((p) => p.status === ProposalStatus.PENDING)
        .length,
      accepted: proposals.filter((p) => p.status === ProposalStatus.ACCEPTED)
        .length,
      rejected: proposals.filter((p) => p.status === ProposalStatus.REJECTED)
        .length,
    };
    setStats(stats);
  }, [proposals]);

  // Filter proposals based on active filter
  const filteredProposals = useMemo(() => {
    if (activeFilter === "all") return proposals;
    if (activeFilter === "pending")
      return proposals.filter((p) => p.status === ProposalStatus.PENDING);
    if (activeFilter === "accepted")
      return proposals.filter((p) => p.status === ProposalStatus.ACCEPTED);
    if (activeFilter === "rejected")
      return proposals.filter((p) => p.status === ProposalStatus.REJECTED);
    return proposals;
  }, [proposals, activeFilter]);

  // Fetch project and proposals
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch project to verify ownership
      const projectData = await apiHelpers.freelancing.getProject(projectId);
      setProject(projectData);

      // 2. Check if user is the owner
      if (!projectData.is_owner) {
        // Redirect to project details page if not owner
        router.push(`/hub/projects/${projectId}`);
        return;
      }

      // 3. Fetch proposals for this project
      const proposalsData =
        await apiHelpers.freelancing.getProjectProposals(projectId);
      setProposals(proposalsData || []);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || t("projects.proposals.errors.loadError"));
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        // Redirect to signup if not authenticated
        router.push(
          `/auth/signup?redirect=/hub/projects/${projectId}/proposals`,
        );
        return;
      }

      // Check if user is client or admin (only clients/admins can view proposals)
      if (
        user &&
        (user.role === UserRole.BUSINESS || user.role === UserRole.ADMIN)
      ) {
        fetchData();
      } else {
        // Redirect if user is not a client/admin
        router.push(`/hub/projects/${projectId}`);
      }
    }
  }, [authLoading, isAuthenticated, user, projectId, router, fetchData]);

  // Handle accept proposal
  const handleAcceptProposal = useCallback(
    async (proposalId: number) => {
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal) return;

      setSelectedProposal(proposal);
      setShowAcceptModal(true);
    },
    [proposals],
  );

  // Handle reject proposal
  const handleRejectProposal = useCallback(
    async (proposalId: number) => {
      const proposal = proposals.find((p) => p.id === proposalId);
      if (!proposal) return;

      setSelectedProposal(proposal);
      setShowRejectModal(true);
    },
    [proposals],
  );

  // Handle confirm accept (from modal)
  const handleConfirmAccept = useCallback(
    async (contractData?: ContractCreate) => {
      if (!selectedProposal) return;

      try {
        setIsProcessing(true);
        setProcessingId(selectedProposal.id);

        await apiHelpers.freelancing.acceptProposal(
          selectedProposal.id,
          contractData,
        );

        // Refresh proposals list
        await fetchData();

        // Close modal
        setShowAcceptModal(false);
        setSelectedProposal(null);
      } catch (err: any) {
        console.error("Error accepting proposal:", err);
        toast.error(err.message || t("projects.proposals.errors.acceptError"));
      } finally {
        setIsProcessing(false);
        setProcessingId(null);
      }
    },
    [selectedProposal, fetchData, t],
  );

  // Handle confirm reject (from modal)
  const handleConfirmReject = useCallback(async () => {
    if (!selectedProposal) return;

    try {
      setIsProcessing(true);
      setProcessingId(selectedProposal.id);

      await apiHelpers.freelancing.rejectProposal(selectedProposal.id);

      // Refresh proposals list
      await fetchData();

      // Close modal
      setShowRejectModal(false);
      setSelectedProposal(null);
    } catch (err: any) {
      console.error("Error rejecting proposal:", err);
      toast.error(err.message || t("projects.proposals.errors.rejectError"));
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  }, [selectedProposal, fetchData, t]);

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.push(`/hub/projects/${projectId}`)}
              className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium mb-6"
            >
              <ChevronLeft className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
              {t("projects.proposals.navigation.backToProject")}
            </button>
          </div>
          <div className="animate-pulse">
            <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-1/2 mb-8"></div>
            <ProposalsSkeleton />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.push(`/hub/projects/${projectId}`)}
              className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium mb-6"
            >
              <ChevronLeft className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
              {t("projects.proposals.navigation.backToProject")}
            </button>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-8">
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                  {t("projects.proposals.errors.failedToLoad")}
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
                <div className="flex space-x-3 rtl:space-x-reverse">
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 rounded-xl font-medium transition-colors flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
                    {t("projects.proposals.buttons.tryAgain")}
                  </button>
                  <button
                    onClick={() => router.push(`/hub/projects/${projectId}`)}
                    className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  >
                    {t("projects.proposals.buttons.backToProject")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // No project found or not owner (should have redirected already)
  if (!project || !project.is_owner) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
            <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
              {t("projects.proposals.errors.accessDenied")}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
              {t("projects.proposals.errors.accessDeniedDescription")}
            </p>
            <button
              onClick={() => router.push(`/hub/projects/${projectId}`)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
            >
              {t("projects.proposals.buttons.backToProject")}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Filter button component
  const FilterButton = ({
    filter,
    label,
    count,
    icon,
  }: {
    filter: ProposalFilter;
    label: string;
    count: number;
    icon?: React.ReactNode;
  }) => {
    const isActive = activeFilter === filter;

    const getFilterConfig = (filter: ProposalFilter) => {
      switch (filter) {
        case "all":
          return {
            bg: "from-blue-600 to-indigo-600",
            hover: "from-blue-700 to-indigo-700",
            text: isActive ? "text-white" : "text-black",
            border: "border-transparent",
          };
        case "pending":
          return {
            bg: "from-amber-600 to-orange-600",
            hover: "from-amber-700 to-orange-700",
            text: isActive ? "text-white" : "text-amber-700",
            border: isActive ? "border-transparent" : "border-amber-300",
          };
        case "accepted":
          return {
            bg: "from-green-600 to-emerald-600",
            hover: "from-green-700 to-emerald-700",
            text: isActive ? "text-white" : "text-green-700",
            border: isActive ? "border-transparent" : "border-green-300",
          };
        case "rejected":
          return {
            bg: "from-red-600 to-rose-600",
            hover: "from-red-700 to-rose-700",
            text: isActive ? "text-white" : "text-red-700",
            border: isActive ? "border-transparent" : "border-red-300",
          };
        default:
          return {
            bg: "",
            hover: "",
            text: "text-gray-700 dark:text-slate-300",
            border: "border-gray-300 dark:border-slate-700",
          };
      }
    };

    const config = getFilterConfig(filter);

    return (
      <button
        onClick={() => setActiveFilter(filter)}
        className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 rtl:space-x-reverse ${
          isActive
            ? `bg-gradient-to-r ${config.bg} ${config.text} border ${config.border} shadow-sm`
            : `bg-white dark:bg-slate-900 ${config.text} border ${config.border} hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:shadow-sm`
        }`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
            isActive
              ? "bg-white/20 text-white"
              : filter === "all"
                ? "bg-blue-100 text-blue-700"
                : filter === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : filter === "accepted"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      {/* Back Navigation */}
      <div className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
        <button
          onClick={() => router.push(`/hub/projects/${projectId}`)}
          className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium group"
        >
          <ChevronLeft className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 group-hover:-translate-x-1 rtl:group-hover:translate-x-1 transition-transform duration-300" />
          {t("projects.proposals.navigation.backToProject")}
        </button>
      </div>

      {/* Main Content */}
      <div className="pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={ANIMATION_CONFIGS.EASING.ENTER}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                  {t("projects.proposals.title", { title: project.title })}
                </h1>
                <p className="text-gray-600 dark:text-slate-400">
                  {t("projects.proposals.description")}
                </p>
              </div>

              <div className="flex items-center space-x-4 rtl:space-x-reverse">
                <button
                  onClick={fetchData}
                  className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-sm transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80"
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3 ${loading ? "animate-spin" : ""}`}
                  />
                  {t("projects.proposals.buttons.refresh")}
                </button>
                <Link
                  href={`/hub/projects/${projectId}`}
                  className="inline-flex items-center px-4 py-2.5 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-semibold rounded-xl hover:shadow-sm transition-all duration-300 border border-gray-300 dark:border-slate-700"
                >
                  <Eye className="w-4 h-4 mr-3 rtl:mr-2 rtl:ml-3" />
                  {t("projects.proposals.buttons.viewProject")}
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-blue-200 dark:border-blue-800/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                      {t("projects.proposals.stats.totalProposals")}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {stats.total}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                      {t("projects.proposals.stats.pending")}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {stats.pending}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl border border-green-200 dark:border-emerald-800/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 mb-1">
                      {t("projects.proposals.stats.accepted")}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {stats.accepted}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-200 dark:border-red-800/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                      {t("projects.proposals.stats.rejected")}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {stats.rejected}
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mb-8">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  filter="all"
                  label={t("projects.proposals.filters.all")}
                  count={stats.total}
                  icon={<Users className="w-4 h-4" />}
                />
                <FilterButton
                  filter="pending"
                  label={t("projects.proposals.filters.pending")}
                  count={stats.pending}
                  icon={<Clock className="w-4 h-4" />}
                />
                <FilterButton
                  filter="accepted"
                  label={t("projects.proposals.filters.accepted")}
                  count={stats.accepted}
                  icon={<CheckCircle className="w-4 h-4" />}
                />
                <FilterButton
                  filter="rejected"
                  label={t("projects.proposals.filters.rejected")}
                  count={stats.rejected}
                  icon={<XCircle className="w-4 h-4" />}
                />
              </div>
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-6">
            {filteredProposals.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
                {proposals.length === 0 ? (
                  <>
                    <Briefcase className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                      {t("projects.proposals.empty.noProposals")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                      {t("projects.proposals.empty.noProposalsDescription")}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                      <button
                        onClick={() =>
                          router.push(`/hub/projects/${projectId}`)
                        }
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                      >
                        {t("projects.proposals.buttons.viewProject")}
                      </button>
                      <button
                        onClick={() => router.push("/hub/projects")}
                        className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                      >
                        {t("projects.proposals.buttons.browseAllProjects")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Filter className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                      {t("projects.proposals.empty.noFilteredProposals")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                      {t(
                        "projects.proposals.empty.noFilteredProposalsDescription",
                      )}
                    </p>
                    <button
                      onClick={() => setActiveFilter("all")}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                    >
                      {t("projects.proposals.buttons.showAll")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {filteredProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onAccept={handleAcceptProposal}
                    onReject={handleRejectProposal}
                    isProcessing={isProcessing}
                    processingId={processingId}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Tips Section */}
          {filteredProposals.length > 0 && (
            <div className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 p-6">
              <SectionHeader
                title={t("projects.proposals.tips.title")}
                icon={<Target className="w-5 h-5" />}
                badge={t("projects.proposals.tips.badge")}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg w-fit mb-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("projects.proposals.tips.reviewMessages.title")}
                  </h4>
                  <p className="text-gray-600 dark:text-slate-400 text-sm">
                    {t("projects.proposals.tips.reviewMessages.description")}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-green-200 dark:border-emerald-800/80">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg w-fit mb-3">
                    <Award className="w-5 h-5 text-green-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("projects.proposals.tips.checkExperience.title")}
                  </h4>
                  <p className="text-gray-600 dark:text-slate-400 text-sm">
                    {t("projects.proposals.tips.checkExperience.description")}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-purple-200 dark:border-purple-800/80 dark:border-purple-800/80">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg w-fit mb-3">
                    <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("projects.proposals.tips.respondPromptly.title")}
                  </h4>
                  <p className="text-gray-600 dark:text-slate-400 text-sm">
                    {t("projects.proposals.tips.respondPromptly.description")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Accept Proposal Modal */}
      <AcceptModal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setSelectedProposal(null);
        }}
        onAccept={handleConfirmAccept}
        freelancerName={
          selectedProposal?.freelancer?.fullName ||
          t("projects.proposals.freelancer")
        }
        amount={selectedProposal?.amount}
        isSubmitting={isProcessing && processingId === selectedProposal?.id}
      />

      {/* Reject Proposal Modal */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedProposal(null);
        }}
        onConfirm={handleConfirmReject}
        freelancerName={
          selectedProposal?.freelancer?.fullName ||
          t("projects.proposals.freelancer")
        }
        isSubmitting={isProcessing && processingId === selectedProposal?.id}
      />

      <Footer />
    </div>
  );
}
