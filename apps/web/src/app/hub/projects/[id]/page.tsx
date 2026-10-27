// apps/web/src/app/hub/projects/[id]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Clock,
  Calendar,
  MapPin,
  User,
  Award,
  Star,
  CheckCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Send,
  FileText,
  MessageSquare,
  Shield,
  Eye,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Building,
  Globe,
  Phone,
  Mail,
  Tag,
  Banknote,
  CalendarDays,
  TrendingUp,
  BarChart,
  Target,
  Rocket,
  Sparkles,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  ThumbsUp,
  Users2,
  ArrowUpRight,
  PenTool,
  Code,
  Palette,
  Megaphone,
  Database,
  Cpu,
  Cloud,
  Lock,
  Unlock,
  Zap,
  Filter,
  Search,
  Plus,
  BarChart3,
  Layers,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiHelpers,
  ProjectResponse,
  ProposalCreate,
  ProposalResponse,
  UserRole,
  ProjectStatus,
  ProposalStatus,
  api,
} from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

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

interface InfoCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "amber" | "gray";
  subtitle?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  value,
  icon,
  color,
  subtitle,
}) => {
  const colorClasses = {
    blue: "from-blue-500 to-indigo-500",
    green: "from-emerald-500 to-green-500",
    purple: "from-purple-500 to-violet-500",
    amber: "from-amber-500 to-orange-500",
    gray: "from-gray-500 to-slate-500",
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">
            {title}
          </p>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {value}
            </span>
            {subtitle && (
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div
          className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color]} bg-opacity-10`}
        >
          <div className="text-white">{icon}</div>
        </div>
      </div>
    </div>
  );
};

interface SkillBadgeProps {
  skill: string;
  size?: "sm" | "md";
}

const SkillBadge: React.FC<SkillBadgeProps> = ({ skill, size = "md" }) => (
  <span
    className={`inline-flex items-center px-3 py-1.5 rounded-full ${
      size === "sm" ? "text-xs" : "text-sm"
    } bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 font-medium`}
  >
    <Tag
      className={`${size === "sm" ? "w-3 h-3 mr-2 ml-2" : "w-4 h-4 mr-2 ml-2.5"}`}
    />
    {skill}
  </span>
);

// =============================================================================
// MODAL COMPONENTS
// =============================================================================

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProposalCreate) => Promise<void>;
  isSubmitting: boolean;
  projectTitle: string;
}

const ProposalModal: React.FC<ProposalModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  projectTitle,
}) => {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    message: "",
    amount: 0,
    estimated_days: 7,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
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
                      {t("projects.detail.proposalModal.title")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mt-1">
                      {t("projects.detail.proposalModal.applyFor", {
                        title: projectTitle,
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
                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("projects.detail.proposalModal.messageLabel")}{" "}
                      <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      placeholder={t(
                        "projects.detail.proposalModal.messagePlaceholder",
                      )}
                      className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      {t("projects.detail.proposalModal.messageHelp")}
                    </p>
                  </div>

                  {/* Budget */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("projects.detail.proposalModal.budgetLabel")}
                    </label>
                    <div className="relative">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.amount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            amount: parseInt(e.target.value) || 0,
                          }))
                        }
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                      {t("projects.detail.proposalModal.budgetHelp")}
                    </p>
                  </div>

                  {/* Timeline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t("projects.detail.proposalModal.timelineLabel")}
                    </label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        value={formData.estimated_days}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            estimated_days: parseInt(e.target.value) || 1,
                          }))
                        }
                        min="1"
                        max="365"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200/50 dark:border-slate-800/50 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t("projects.detail.proposalModal.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.message.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />
                        {t("projects.detail.proposalModal.submitting")}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2 ml-2" />
                        {t("projects.detail.proposalModal.submitProposal")}
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
// SKELETON COMPONENTS
// =============================================================================

const ProjectDetailSkeleton = () => (
  <div className="animate-pulse">
    {/* Header Skeleton */}
    <div className="mb-8">
      <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-3/4 mb-4"></div>
      <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-1/2"></div>
    </div>

    {/* Stats Skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-slate-800/50"
        >
          <div className="h-5 bg-gray-200 dark:bg-slate-800/90 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-300 rounded w-3/4"></div>
        </div>
      ))}
    </div>

    {/* Content Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-48 bg-gray-200 dark:bg-slate-800/90 rounded-2xl"></div>
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-5/6"></div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="h-40 bg-gray-200 dark:bg-slate-800/90 rounded-2xl"></div>
        <div className="h-32 bg-gray-200 dark:bg-slate-800/90 rounded-2xl"></div>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ProjectDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const projectId = parseInt(params.id as string);

  // State Management
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalResponse[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalSubmitted, setProposalSubmitted] = useState(false);

  const [userProposal, setUserProposal] = useState<ProposalResponse | null>(
    null,
  );
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);

  // Fetch project details
  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isAuthenticated) {
        // Authenticated users use the main API
        const projectData = await apiHelpers.freelancing.getProject(projectId);
        setProject(projectData);

        // Fetch user's proposals to check if they've applied to this project
        try {
          const userProposals = await apiHelpers.freelancing.getUserProposals();
          const proposalForThisProject = userProposals.find(
            (proposal) => proposal.projectId === projectId,
          );

          if (proposalForThisProject) {
            setUserProposal(proposalForThisProject);
            setProposalStatus(proposalForThisProject.status);
            // Update project's has_applied based on actual proposal status
            setProject((prev) =>
              prev
                ? {
                    ...prev,
                    has_applied: true,
                  }
                : null,
            );
          }
        } catch (err) {
          console.error("Error fetching user proposals:", err);
        }

        // If user is client, fetch project proposals
        if (
          user &&
          (user.role === UserRole.BUSINESS || user.role === UserRole.ADMIN) &&
          projectData.is_owner
        ) {
          try {
            const proposalsData = await api.getProjectProposals(projectId);
            setProposals(proposalsData || []);
          } catch (err) {
            console.error("Error fetching proposals:", err);
          }
        }
      } else {
        // Unauthenticated users use public API
        const publicProject = await api.getPublicProject(projectId);
        // Transform to ProjectResponse structure
        setProject({
          id: publicProject.id,
          title: publicProject.title,
          description: publicProject.description,
          ownerId: publicProject.owner?.id || 0,
          skills: publicProject.skills,
          status: publicProject.status,
          createdAt: publicProject.createdAt,
          updatedAt: publicProject.createdAt,
          owner: publicProject.owner
            ? {
                id: publicProject.owner.id,
                fullName: publicProject.owner.fullName,
                profilePictureUrl: publicProject.owner.profilePictureUrl,
                country: publicProject.owner.country,
                city: publicProject.owner.city,
                phoneVerified: false,
              }
            : undefined,
          has_applied: false,
          is_owner: false,
        });
      }
    } catch (err: any) {
      console.error("Error fetching project:", err);
      setError(err.message || t("projects.detail.errors.loadError"));
    } finally {
      setLoading(false);
    }
  }, [projectId, isAuthenticated, user]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading) {
      fetchProject();
    }
  }, [authLoading, fetchProject]);

  useEffect(() => {
    if (proposalStatus === ProposalStatus.PENDING) {
      // Poll for status updates every 30 seconds for pending proposals
      const interval = setInterval(async () => {
        try {
          const userProposals = await apiHelpers.freelancing.getUserProposals();
          const updatedProposal = userProposals.find(
            (proposal) => proposal.projectId === projectId,
          );
          if (updatedProposal && updatedProposal.status !== proposalStatus) {
            setProposalStatus(updatedProposal.status);
            setUserProposal(updatedProposal);
          }
        } catch (err) {
          console.error("Error polling proposal status:", err);
        }
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [proposalStatus, projectId]);

  // Handle proposal submission
  const handleSubmitProposal = useCallback(
    async (proposalData: ProposalCreate) => {
      try {
        setIsSubmittingProposal(true);
        const newProposal = await apiHelpers.freelancing.submitProposal(
          projectId,
          proposalData,
        );
        setUserProposal(newProposal);
        setProposalStatus(newProposal.status);
        setProposalSubmitted(true);
        setShowProposalModal(false);

        // Update project to reflect that user has applied
        if (project) {
          setProject({
            ...project,
            has_applied: true,
          });
        }
      } catch (err: any) {
        console.error("Error submitting proposal:", err);
        toast.error(err.message || t("projects.detail.errors.submitError"));
      } finally {
        setIsSubmittingProposal(false);
      }
    },
    [projectId, project, t],
  );

  // Check if user can apply
  const canApply = useMemo(() => {
    if (!isAuthenticated || !user || !project) return false;
    if (proposalStatus) return false; // User already has a proposal (any status)
    if (project.is_owner) return false;
    if (user.role !== UserRole.FREELANCER) return false;
    if (project.status !== ProjectStatus.OPEN) return false;
    return true;
  }, [isAuthenticated, user, project, proposalStatus]);

  // Check if user is client owner
  const isClientOwner = useMemo(() => {
    return isAuthenticated && user && project && project.is_owner;
  }, [isAuthenticated, user, project]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case ProjectStatus.OPEN:
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case ProjectStatus.IN_PROGRESS:
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case ProjectStatus.COMPLETED:
        return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case ProjectStatus.CANCELLED:
        return "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-800";
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
            <div className="mb-8">
              <button
                onClick={() => router.push("/hub/projects")}
                className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium mb-6"
              >
                <ChevronLeft className="w-4 h-4 mr-2 ml-2" />
                {t("projects.detail.buttons.backToProjects")}
              </button>
            </div>
            <ProjectDetailSkeleton />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
            <div className="mb-8">
              <button
                onClick={() => router.push("/hub/projects")}
                className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium mb-6"
              >
                <ChevronLeft className="w-4 h-4 mr-2 ml-2" />
                {t("projects.detail.buttons.backToProjects")}
              </button>
            </div>
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-8">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                    {t("projects.detail.errors.loadErrorTitle")}
                  </h3>
                  <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={fetchProject}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 rounded-xl font-medium transition-colors flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2 ml-2" />
                      {t("projects.detail.buttons.tryAgain")}
                    </button>
                    <button
                      onClick={() => router.push("/hub/projects")}
                      className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                    >
                      {t("projects.detail.buttons.browseProjects")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // No project found
  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
            <div className="mb-8">
              <button
                onClick={() => router.push("/hub/projects")}
                className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium mb-6"
              >
                <ChevronLeft className="w-4 h-4 mr-2 ml-2" />
                {t("projects.detail.buttons.backToProjects")}
              </button>
            </div>
            <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
              <Briefcase className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
                {t("projects.detail.empty.notFoundTitle")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                {t("projects.detail.empty.notFoundDescription")}
              </p>
              <button
                onClick={() => router.push("/hub/projects")}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              >
                {t("projects.detail.buttons.browseAvailableProjects")}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Back Navigation */}
        <div className="pt-28 pb-8 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <button
            onClick={() => router.push("/hub/projects")}
            className="inline-flex items-center text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-medium group"
          >
            <ChevronLeft className="w-4 h-4 mr-2 ml-2 group-hover:-translate-x-1 transition-transform duration-300" />
            {t("projects.detail.buttons.backToProjects")}
          </button>
        </div>

        {/* Main Content */}
        <div className="pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
          >
            {/* Project Header */}
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-3 mb-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(project.status)}`}
                    >
                      {t(
                        `projects.detail.status.${project.status.toLowerCase()}`,
                      )}
                    </span>
                    {project.createdAt && (
                      <span className="text-gray-500 dark:text-slate-400 text-sm">
                        {t("projects.detail.postedOn", {
                          date: new Date(
                            project.createdAt,
                          ).toLocaleDateString(),
                        })}
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                    {project.title}
                  </h1>
                  <p className="text-gray-600 dark:text-slate-400 text-lg max-w-3xl">
                    {project.description || t("projects.detail.noDescription")}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                  {canApply && (
                    <button
                      onClick={() => setShowProposalModal(true)}
                      disabled={proposalSubmitted}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Send className="w-5 h-5 mr-2 ml-2" />
                      {proposalSubmitted
                        ? t("projects.detail.proposalSubmitted")
                        : t("projects.detail.buttons.applyToProject")}
                    </button>
                  )}

                  {isClientOwner && (
                    <Link
                      href={`/hub/projects/${projectId}/proposals`}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-md flex items-center justify-center"
                    >
                      <Users2 className="w-5 h-5 mr-2 ml-2" />
                      {t("projects.detail.buttons.viewProposals", {
                        count: String(proposals.length),
                      })}
                    </Link>
                  )}

                  {!isAuthenticated && (
                    <Link
                      href="/auth/signup?redirect=/hub/projects"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md flex items-center justify-center"
                    >
                      <Briefcase className="w-5 h-5 mr-2 ml-2" />
                      {t("projects.detail.buttons.signUpToApply")}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <InfoCard
                title={t("projects.detail.stats.status")}
                value={t(
                  `projects.detail.status.${project.status.toLowerCase()}`,
                )}
                icon={<Briefcase className="w-5 h-5" />}
                color={
                  project.status === ProjectStatus.OPEN
                    ? "green"
                    : project.status === ProjectStatus.IN_PROGRESS
                      ? "amber"
                      : project.status === ProjectStatus.COMPLETED
                        ? "blue"
                        : "gray"
                }
              />

              <InfoCard
                title={t("projects.detail.stats.skillsRequired")}
                value={project.skills?.length || 0}
                icon={<Tag className="w-5 h-5" />}
                color="blue"
                subtitle={t("projects.detail.stats.skills")}
              />

              {project.createdAt && (
                <InfoCard
                  title={t("projects.detail.stats.posted")}
                  value={new Date(project.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )}
                  icon={<Calendar className="w-5 h-5" />}
                  color="purple"
                  subtitle={new Date(project.createdAt)
                    .getFullYear()
                    .toString()}
                />
              )}

              <InfoCard
                title={t("projects.detail.stats.proposals")}
                value={isClientOwner ? proposals.length : "—"}
                icon={<Users className="w-5 h-5" />}
                color="amber"
                subtitle={
                  isClientOwner
                    ? t("projects.detail.stats.received")
                    : t("projects.detail.stats.ownersOnly")
                }
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Project Details */}
              <div className="lg:col-span-2 space-y-8">
                {/* Description Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                  <SectionHeader
                    title={t("projects.detail.sections.projectDetails")}
                    icon={<FileText className="w-5 h-5" />}
                  />
                  <div className="prose prose-lg max-w-none">
                    <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {project.description ||
                        t("projects.detail.noDetailedDescription")}
                    </p>
                  </div>
                </div>

                {/* Skills Card */}
                {project.skills && project.skills.length > 0 && (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                    <SectionHeader
                      title={t("projects.detail.sections.requiredSkills")}
                      description={t(
                        "projects.detail.sections.skillsDescription",
                      )}
                      icon={<Award className="w-5 h-5" />}
                    />
                    <div className="flex flex-wrap gap-3">
                      {project.skills.map((skill, index) => (
                        <SkillBadge key={index} skill={skill} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Application Status Card */}
                {isAuthenticated && (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                    <SectionHeader
                      title={t("projects.detail.sections.applicationStatus")}
                      icon={<CheckCircle className="w-5 h-5" />}
                    />
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                      {/* Show different button based on proposal status */}
                      {proposalStatus === ProposalStatus.PENDING && (
                        <button
                          disabled
                          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold opacity-50 cursor-not-allowed flex items-center justify-center"
                        >
                          <Clock className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.proposalPending")}
                        </button>
                      )}

                      {proposalStatus === ProposalStatus.ACCEPTED && (
                        <Link
                          href={`/hub/contracts/${userProposal?.id}`}
                          className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md flex items-center justify-center"
                        >
                          <FileText className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.buttons.viewContract")}
                        </Link>
                      )}

                      {proposalStatus === ProposalStatus.REJECTED && (
                        <button
                          disabled
                          className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold opacity-50 cursor-not-allowed flex items-center justify-center"
                        >
                          <X className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.proposalRejected")}
                        </button>
                      )}

                      {canApply && !proposalStatus && (
                        <button
                          onClick={() => setShowProposalModal(true)}
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md flex items-center justify-center"
                        >
                          <Send className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.buttons.applyToProject")}
                        </button>
                      )}

                      {/* Non-freelancer authenticated users (Business/Admin) who don't own the project */}
                      {!proposalStatus &&
                        !canApply &&
                        isAuthenticated &&
                        user?.role !== UserRole.FREELANCER &&
                        !isClientOwner && (
                          <div className="text-center py-4">
                            <p className="text-gray-600 dark:text-slate-400 mb-2">
                              {t("projects.detail.notAFreelancer")}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {t("projects.detail.onlyFreelancersCanApply")}
                            </p>
                            <Link
                              href="/hub/freelancers"
                              className="inline-flex items-center mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium text-sm"
                            >
                              {t("projects.detail.buttons.browseFreelancers")}
                              <ExternalLink className="w-4 h-4 mr-2 ml-2" />
                            </Link>
                          </div>
                        )}

                      {/* Freelancer who can't apply (project not open or is owner) */}
                      {!proposalStatus &&
                        !canApply &&
                        user?.role === UserRole.FREELANCER && (
                          <div className="text-center py-4">
                            <p className="text-gray-600 dark:text-slate-400 mb-2">
                              {t("projects.detail.notEligibleToApply")}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {project.status !== ProjectStatus.OPEN &&
                                t("projects.detail.projectNotOpen")}
                              {project.is_owner &&
                                t("projects.detail.ownProject")}
                            </p>
                          </div>
                        )}

                      {isClientOwner && (
                        <Link
                          href={`/hub/projects/${projectId}/proposals`}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-md flex items-center justify-center"
                        >
                          <Users2 className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.buttons.viewProposals", {
                            count: String(proposals.length),
                          })}
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* Show signup prompt for non-authenticated users - move this outside the authenticated check */}
                {!isAuthenticated && (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                    <SectionHeader
                      title={t("projects.detail.sections.applicationStatus")}
                      icon={<Lock className="w-5 h-5" />}
                    />
                    <div className="text-center py-6">
                      <div className="mb-4">
                        <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                          {t("projects.detail.authenticationRequired")}
                        </h4>
                        <p className="text-gray-600 dark:text-slate-400 mb-4">
                          {t("projects.detail.signInToApply")}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                          href="/auth/signup?redirect=/hub/projects"
                          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md flex items-center justify-center"
                        >
                          <Briefcase className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.buttons.signUpToApply")}
                        </Link>
                        <Link
                          href="/auth/login?redirect=/hub/projects"
                          className="px-6 py-3 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 border border-gray-300 dark:border-slate-700 flex items-center justify-center"
                        >
                          <User className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.detail.buttons.signIn")}
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Client Info & Actions */}
              <div className="space-y-8">
                {/* Client Info Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                  <SectionHeader
                    title={t("projects.detail.sections.clientInfo")}
                    icon={<Building className="w-5 h-5" />}
                  />

                  {project.owner ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          {project.owner.profilePictureUrl ? (
                            <img
                              src={project.owner.profilePictureUrl}
                              alt={project.owner.fullName}
                              className="w-full h-full rounded-xl object-cover"
                            />
                          ) : (
                            <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg">
                            {project.owner.fullName}
                          </h3>
                          <p className="text-gray-600 dark:text-slate-400 text-sm">
                            {t("projects.detail.sections.projectOwner")}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-200/50 dark:border-slate-800/50">
                        {project.owner.country && (
                          <div className="flex items-center text-gray-700 dark:text-slate-300">
                            <MapPin className="w-4 h-4 mr-2 ml-2 text-gray-500 dark:text-slate-400" />
                            <span>
                              {project.owner.city}
                              {project.owner.city && project.owner.country
                                ? ", "
                                : ""}
                              {project.owner.country}
                            </span>
                          </div>
                        )}

                        {project.owner.phoneVerified && (
                          <div className="flex items-center text-gray-700 dark:text-slate-300">
                            <CheckCircle className="w-4 h-4 mr-2 ml-2 text-green-500" />
                            <span className="text-sm">
                              {t("projects.detail.phoneVerified")}
                            </span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/profile/${project.owner.id}`}
                        className="block w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-sm transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 text-center"
                      >
                        {t("projects.detail.buttons.viewClientProfile")}
                        <ExternalLink className="w-4 h-4 mr-2 ml-2 inline" />
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-slate-400">
                        {t("projects.detail.clientInfoNotAvailable")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Project Timeline Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                  <SectionHeader
                    title={t("projects.detail.sections.projectTimeline")}
                    icon={<Clock className="w-5 h-5" />}
                  />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-slate-400">
                        {t("projects.detail.statusLabel")}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}
                      >
                        {t(
                          `projects.detail.status.${project.status.toLowerCase()}`,
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-slate-400">
                        {t("projects.detail.postedLabel")}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">
                        {project.createdAt
                          ? new Date(project.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>

                    {project.updatedAt &&
                      project.updatedAt !== project.createdAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-slate-400">
                            {t("projects.detail.lastUpdatedLabel")}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-slate-100">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center">
                    <Zap className="w-5 h-5 mr-2 ml-2 text-blue-600 dark:text-blue-400" />
                    {t("projects.detail.sections.quickActions")}
                  </h3>
                  <div className="space-y-3">
                    {canApply && (
                      <button
                        onClick={() => setShowProposalModal(true)}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-sm flex items-center justify-center"
                      >
                        <Send className="w-5 h-5 mr-2 ml-2" />
                        {t("projects.detail.buttons.applyNow")}
                      </button>
                    )}

                    {isClientOwner && proposals.length > 0 && (
                      <Link
                        href={`/hub/projects/${projectId}/proposals`}
                        className="block w-full px-4 py-3 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 border border-gray-300 dark:border-slate-700 text-center"
                      >
                        {t("projects.detail.buttons.reviewProposals", {
                          count: String(proposals.length),
                        })}
                      </Link>
                    )}

                    {!isAuthenticated && (
                      <Link
                        href="/auth/signup?redirect=/hub/projects"
                        className="block w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-sm text-center"
                      >
                        {t("projects.detail.buttons.signUpToApply")}
                      </Link>
                    )}

                    <button
                      onClick={() => router.push("/hub/projects")}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 border border-gray-300 dark:border-slate-700"
                    >
                      {t("projects.detail.buttons.browseMoreProjects")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Proposals Preview (Client View) */}
            {isClientOwner && proposals.length > 0 && (
              <div className="mt-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <SectionHeader
                    title={t("projects.detail.sections.recentProposals")}
                    description={t("projects.detail.proposalsReceived", {
                      count: String(proposals.length),
                    })}
                    icon={<Users2 className="w-5 h-5" />}
                  />
                  <Link
                    href={`/hub/projects/${projectId}/proposals`}
                    className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                  >
                    {t("projects.detail.buttons.viewAll")}
                    <ChevronRight className="w-4 h-4 mr-2 ml-2" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proposals.slice(0, 2).map((proposal) => (
                    <div
                      key={proposal.id}
                      className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 dark:border-slate-800 p-4 hover:border-blue-300 dark:border-blue-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            {proposal.freelancer?.profilePictureUrl ? (
                              <img
                                src={proposal.freelancer.profilePictureUrl}
                                alt={proposal.freelancer.fullName}
                                className="w-full h-full rounded-lg object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-slate-100">
                              {proposal.freelancer?.fullName ||
                                t("projects.detail.anonymous")}
                            </h4>
                            <p className="text-gray-600 dark:text-slate-400 text-sm">
                              {proposal.amount
                                ? `${proposal.amount.toLocaleString()} DZD`
                                : t("projects.detail.noPriceSet")}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            proposal.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : proposal.status === "ACCEPTED"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {proposal.status}
                        </span>
                      </div>

                      {proposal.message && (
                        <p className="mt-3 text-gray-700 dark:text-slate-300 text-sm line-clamp-2">
                          {proposal.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Proposal Modal */}
        <ProposalModal
          isOpen={showProposalModal}
          onClose={() => setShowProposalModal(false)}
          onSubmit={handleSubmitProposal}
          isSubmitting={isSubmittingProposal}
          projectTitle={project.title}
        />
      </main>

      <Footer />
    </div>
  );
}
