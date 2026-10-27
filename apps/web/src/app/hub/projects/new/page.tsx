// /app/hub/projects/new/page.tsx - FULLY INTERNATIONALIZED
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
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
  Upload,
  Hash,
  Banknote as BanknoteIcon,
  Calendar as CalendarIcon,
  Target as TargetIcon,
  Edit,
  Save,
  Trash2,
  ArrowLeft,
  Check,
  XCircle,
  Info,
  AlertTriangle,
  Shield as ShieldIcon,
  UserPlus,
  Clock as ClockIcon,
  Type,
  FileCode,
  Link as LinkIcon,
  CreditCard,
  Percent,
  User,
  Key,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Globe as GlobeIcon2,
  MapPin as MapPinIcon,
  Building as BuildingIcon,
  Award as AwardIcon2,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon2,
  ChevronUp,
  ChevronsUpDown,
  EyeOff,
  Eye as EyeIcon,
  Copy,
  Download,
  Printer,
  MoreVertical,
  Settings,
  LogOut,
  Bell,
  Home,
  Folder,
  PieChart,
  Users as UsersIcon,
  BookOpen,
  Wrench,
  Cpu as CpuIcon,
  Database as DatabaseIcon,
  Palette as PaletteIcon,
  Megaphone as MegaphoneIcon,
  Code as CodeIcon,
  Cloud as CloudIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  ShieldCheck as ShieldCheckIcon,
  Layers as LayersIcon,
  Zap as ZapIcon,
  Target as TargetIcon2,
  Calendar as CalendarIcon2,
  BarChart as BarChartIcon,
  MessageSquare as MessageSquareIcon,
  FileText as FileTextIcon,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiHelpers,
  ProjectCreate,
  ProjectResponse,
  UserRole,
  api,
  ApiError,
  ValidationError,
  handleApiError,
} from "@/lib/api";
import { CheckProjectPostResponse } from "@/lib/api/payments";
import { useTranslations, useTextDirection } from "@/lib/i18n";
import InsufficientPostsModal from "@/components/billing/InsufficientPostsModal";

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

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  required = false,
  icon,
  disabled = false,
  description,
}) => {
  const isTextarea = type === "textarea";

  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="block text-lg text-bold font-medium text-gray-900 dark:text-slate-100"
      >
        {label}
        {required && (
          <span className="text-red-500 dark:text-red-400 mr-2 ml-2">*</span>
        )}
      </label>
      {description && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {description}
        </p>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-3.5 text-gray-400">{icon}</div>
        )}
        {isTextarea ? (
          <textarea
            id={name}
            name={name}
            value={value as string}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className={`w-full px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border ${
              error
                ? "border-red-300"
                : "border-gray-200/50 dark:border-slate-800/50"
            } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              icon ? "pl-11" : ""
            }`}
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border ${
              error
                ? "border-red-300"
                : "border-gray-200/50 dark:border-slate-800/50"
            } rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              icon ? "pl-11" : ""
            }`}
          />
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 ml-2" />
          {error}
        </p>
      )}
    </div>
  );
};

interface SkillTagProps {
  skill: string;
  onRemove?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
}

const SkillTag: React.FC<SkillTagProps> = ({
  skill,
  onRemove,
  onClick,
  isSelected = false,
}) => {
  const t = useTranslations();

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
        isSelected
          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border border-blue-500"
          : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {skill}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`mr-2 ml-2.5 ${
            isSelected
              ? "text-white hover:text-blue-100"
              : "text-blue-500 hover:text-blue-700"
          }`}
          aria-label={t("projects.new.form.skills.removeSkill", { skill })}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </motion.span>
  );
};

interface BudgetRangeProps {
  min: number | undefined;
  max: number | undefined;
  onChange: (min: number | undefined, max: number | undefined) => void;
  error?: string;
  currency?: string;
}

const BudgetRange: React.FC<BudgetRangeProps> = ({
  min,
  max,
  onChange,
  error,
  currency = "DZD",
}) => {
  const t = useTranslations();
  const direction = useTextDirection();
  const rtl = direction === "rtl";

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : undefined;
    onChange(value, max);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : undefined;
    onChange(min, value);
  };

  return (
    <div className="space-y-2">
      <label className="block text-lg font-bold font-medium text-gray-900 dark:text-slate-100">
        {t("projects.new.budget.title")}
      </label>
      <div
        className={`flex items-center ${rtl ? "flex-row-reverse space-x-reverse" : ""} space-x-4`}
      >
        <div className="flex-1">
          <div className="relative">
            {/* Banknote icon - always on the "start" side */}
            <Banknote className="absolute start-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="number"
              min="0"
              value={min || ""}
              onChange={handleMinChange}
              placeholder={t("projects.new.budget.minPlaceholder")}
              className="w-full pstart-10 pend-12 py-3 pr-4 pl-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500"
              dir={rtl ? "rtl" : "ltr"}
            />
            {/* Currency - always on the "end" side */}
            <span className="absolute end-8 top-4 text-sm text-gray-500 dark:text-slate-400">
              {currency}
            </span>
          </div>
        </div>

        {/* Arrow - direction changes based on RTL */}
        <div className="text-gray-400">
          {rtl ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1">
          <div className="relative">
            <Banknote className="absolute start-3 top-3.5 w-4 h-4 text-gray-400" />
            <input
              type="number"
              min={min || 0}
              value={max || ""}
              onChange={handleMaxChange}
              placeholder={t("projects.new.budget.maxPlaceholder")}
              className="w-full pstart-10 pend-12 py-3 pr-4 pl-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500"
              dir={rtl ? "rtl" : "ltr"}
            />
            <span className="absolute end-8 top-4 text-sm text-gray-500 dark:text-slate-400">
              {currency}
            </span>
          </div>
        </div>
      </div>
      {error && (
        <p
          className={`text-sm text-red-600 dark:text-red-400 flex items-center ${rtl ? "flex-row-reverse" : ""}`}
        >
          <AlertCircle className="w-4 h-4 mie-1" />
          {error}
        </p>
      )}
      <p className="text-sm text-gray-500 dark:text-slate-400">
        {t("projects.new.budget.description")}
      </p>
    </div>
  );
};

interface AlertProps {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, title, message, onClose }) => {
  const t = useTranslations();
  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${colors[type]}`}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon
            className={`h-5 w-5 ${
              type === "success"
                ? "text-green-400"
                : type === "error"
                  ? "text-red-400"
                  : type === "warning"
                    ? "text-amber-400"
                    : "text-blue-400"
            }`}
          />
        </div>
        <div className="mr-2 ml-2 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="mt-2 text-sm">
            <p>{message}</p>
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex rounded-md ${
                type === "success"
                  ? "text-green-400 hover:text-green-500"
                  : type === "error"
                    ? "text-red-400 hover:text-red-500"
                    : type === "warning"
                      ? "text-amber-400 hover:text-amber-500"
                      : "text-blue-400 hover:text-blue-500"
              }`}
            >
              <span className="sr-only">{t("hub.buttons.close")}</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const FormSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-64"></div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4"></div>
      <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
    </div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4"></div>
      <div className="h-32 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
    </div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4"></div>
      <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
    </div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/4"></div>
      <div className="flex space-x-4">
        <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl flex-1"></div>
        <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-xl flex-1"></div>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CreateProjectPage() {
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations();

  // State Management
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [remainingPosts, setRemainingPosts] = useState<number | null>(null);
  const [postAvailability, setPostAvailability] = useState<
    "loading" | "available" | "none"
  >("loading");
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<ProjectCreate>({
    title: "",
    description: "",
    skills: [],
    budget_range_min: undefined,
    budget_range_max: undefined,
  });

  const [currentSkill, setCurrentSkill] = useState("");

  // Access Control Check
  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;

      if (!isAuthenticated) {
        // Redirect to signup for unauthenticated users
        router.push("/auth/signup?redirect=/hub/projects/new");
        return;
      }

      try {
        // Fetch current user to check role
        const currentUser = await apiHelpers.auth.getCurrentUser();

        // Check if user is a client (BUSINESS or ADMIN role)
        const isClient =
          currentUser.role === UserRole.BUSINESS ||
          currentUser.role === UserRole.ADMIN;

        if (!isClient) {
          // Redirect non-clients back to projects page
          router.push("/hub/projects");
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Error checking user access:", err);
        setError(t("projects.new.errors.accessFailed"));
        setLoading(false);
      }
    };

    checkAccess();
  }, [isAuthenticated, authLoading, router, t]);

  useEffect(() => {
    const checkPostAvailability = async () => {
      try {
        const res = await api.get<CheckProjectPostResponse>(
          "/api/v1/features/check/project-post",
        );
        if (res?.allowed) {
          setRemainingPosts(res.remaining ?? null);
          setPostAvailability("available");
        } else {
          setRemainingPosts(0);
          setPostAvailability("none");
        }
      } catch {
        setPostAvailability("available");
      }
    };
    if (!authLoading && isAuthenticated) {
      checkPostAvailability();
    }
  }, [isAuthenticated, authLoading]);

  // Handle form input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear field error when user starts typing
      if (fieldErrors[name]) {
        setFieldErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    },
    [fieldErrors],
  );

  // Handle skill input
  const handleSkillInputKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const skill = currentSkill.trim();
        if (skill && !formData.skills.includes(skill)) {
          setFormData((prev) => ({
            ...prev,
            skills: [...prev.skills, skill],
          }));
          setCurrentSkill("");

          // Clear skill error
          if (fieldErrors.skills) {
            setFieldErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors.skills;
              return newErrors;
            });
          }
        }
      }
    },
    [currentSkill, formData.skills, fieldErrors],
  );

  // Remove skill
  const removeSkill = useCallback((skillToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  }, []);

  // Handle budget change
  const handleBudgetChange = useCallback(
    (min: number | undefined, max: number | undefined) => {
      setFormData((prev) => ({
        ...prev,
        budget_range_min: min,
        budget_range_max: max,
      }));

      // Clear budget errors
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors.budget_range_min;
      delete newFieldErrors.budget_range_max;
      setFieldErrors(newFieldErrors);
    },
    [fieldErrors],
  );

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = t("projects.new.validation.titleRequired");
    } else if (formData.title.length < 5) {
      errors.title = t("projects.new.validation.titleMinLength");
    } else if (formData.title.length > 200) {
      errors.title = t("projects.new.validation.titleMaxLength");
    }

    if (formData.description && formData.description.length > 5000) {
      errors.description = t("projects.new.validation.descriptionMaxLength");
    }

    if (formData.skills.length === 0) {
      errors.skills = t("projects.new.validation.skillsRequired");
    } else if (formData.skills.length > 20) {
      errors.skills = t("projects.new.validation.skillsMaxLength");
    }

    if (
      formData.budget_range_min !== undefined &&
      formData.budget_range_min < 0
    ) {
      errors.budget_range_min = t("projects.new.validation.budgetMinNegative");
    }

    if (formData.budget_range_max !== undefined) {
      if (formData.budget_range_max < 0) {
        errors.budget_range_max = t(
          "projects.new.validation.budgetMaxNegative",
        );
      } else if (
        formData.budget_range_min !== undefined &&
        formData.budget_range_max < formData.budget_range_min
      ) {
        errors.budget_range_max = t(
          "projects.new.validation.budgetMaxLessThanMin",
        );
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, t]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      try {
        setCreating(true);
        setError(null);
        setSuccess(null);

        // Prepare project data
        const projectData: ProjectCreate = {
          title: formData.title.trim(),
          description: formData.description?.trim() || "",
          skills: formData.skills,
          budget_range_min: formData.budget_range_min,
          budget_range_max: formData.budget_range_max,
        };

        // Check if posting is available before submission
        if (postAvailability === "none") {
          setShowInsufficientModal(true);
          setCreating(false);
          return;
        }

        // Submit to backend
        const createdProject =
          await apiHelpers.freelancing.createProject(projectData);

        // Decrement remaining count after successful post
        if (remainingPosts !== null) {
          setRemainingPosts((prev) => (prev !== null ? prev - 1 : null));
        }

        // Show success message
        setSuccess(t("projects.new.success.created"));

        // Redirect to project page after short delay
        setTimeout(() => {
          router.push(`/hub/projects/${createdProject.id}`);
        }, 1500);
      } catch (err) {
        console.error("Error creating project:", err);

        const apiErr = err as any;
        if (
          apiErr?.status === 402 ||
          apiErr?.message?.includes("insufficient")
        ) {
          setPostAvailability("none");
          setRemainingPosts(0);
          setShowInsufficientModal(true);
        } else if (err instanceof ValidationError) {
          const validationErrors: Record<string, string> = {};
          if (err.fieldErrors) {
            Object.entries(err.fieldErrors).forEach(([field, messages]) => {
              if (messages && messages.length > 0) {
                validationErrors[field] = messages[0];
              }
            });
          }
          setFieldErrors(validationErrors);
          setError(t("projects.new.errors.validationFix"));
        } else if (err instanceof ApiError) {
          setError(err.message || t("projects.new.errors.createFailed"));
        } else {
          setError(handleApiError(err));
        }
      } finally {
        setCreating(false);
      }
    },
    [formData, router, validateForm, t],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    router.push("/hub/projects");
  }, [router]);

  // Helper function to convert numbered object to array
  const getNumberedTranslation = (translation: any): string[] => {
    // If it's already an array, return it
    if (Array.isArray(translation)) {
      return translation;
    }

    // If it's an object with numbered keys
    if (translation && typeof translation === "object") {
      // Convert to array, sort by numeric keys
      return Object.entries(translation)
        .sort(([keyA], [keyB]) => parseInt(keyA) - parseInt(keyB))
        .map(([_, value]) => value as string)
        .filter(Boolean); // Remove empty values
    }

    // If it's a string (fallback for missing translations)
    if (typeof translation === "string") {
      // Handle comma-separated strings
      if (translation.includes(",")) {
        return translation.split(",").map((item) => item.trim());
      }
      return [translation];
    }

    return [];
  };

  // Helper to get translation as array
  const getTranslationArray = (key: string): string[] => {
    const translation = t(key);
    return getNumberedTranslation(translation);
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-8">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg max-w-2xl"></div>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-8">
                <FormSkeleton />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Access denied or error state
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <Alert
              type="error"
              title={t("projects.new.errors.accessDeniedTitle")}
              message={t("projects.new.errors.accessDeniedMessage")}
            />
            <div className="mt-8">
              <Link
                href="/hub/projects"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              >
                <ArrowLeft className="w-5 h-5 mr-2 ml-2" />
                {t("projects.new.buttons.backToProjects")}
              </Link>
            </div>
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
              <Plus className="w-4 h-4 mr-2 ml-2" />
              {t("projects.new.header.badge")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {t("projects.new.header.titleLine1")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("projects.new.header.titleHighlight")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t("projects.new.header.descriptionLine1")}
              <br />
              {t("projects.new.header.descriptionLine2")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Form Section */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-8xl mx-auto">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <div className="mb-8">
              <Link
                href="/hub/projects"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="w-5 h-5 mr-2 ml-2" />
                {t("projects.new.buttons.backToProjects")}
              </Link>
            </div>

            {/* Form Container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION_CONFIGS.EASING.ENTER}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 md:p-8"
            >
              {/* Success Alert */}
              {success && (
                <div className="mb-6">
                  <Alert
                    type="success"
                    title={t("projects.new.success.title")}
                    message={success}
                  />
                </div>
              )}

              {/* Error Alert */}
              {error && !Object.keys(fieldErrors).length && (
                <div className="mb-6">
                  <Alert
                    type="error"
                    title={t("projects.new.errors.title")}
                    message={error}
                    onClose={() => setError(null)}
                  />
                </div>
              )}

              {/* Post Availability Banner */}
              {postAvailability === "none" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-6 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-200 dark:border-amber-800/80 rounded-2xl"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-1">
                        {t("projects.new.postGate.title")}
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                        {t("projects.new.postGate.description")}
                      </p>
                      <Link
                        href="/billing"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
                      >
                        <CreditCard className="w-4 h-4" />
                        {t("projects.new.postGate.buyButton")}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Post Availability Loading */}
              {postAvailability === "loading" && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 rounded-xl animate-pulse">
                  <div className="w-4 h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-48" />
                </div>
              )}

              {/* Remaining Posts Indicator */}
              {postAvailability === "available" && remainingPosts !== null && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-xl">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {remainingPosts > 0
                      ? t("projects.new.postGate.remaining", {
                          count: String(remainingPosts),
                        })
                      : t("projects.new.postGate.lastPost")}
                  </p>
                </div>
              )}

              {/* Insufficient Posts Modal */}
              <InsufficientPostsModal
                open={showInsufficientModal}
                onClose={() => setShowInsufficientModal(false)}
                remaining={remainingPosts ?? 0}
              />

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Project Title */}
                <InputField
                  label={t("projects.new.form.title.label")}
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder={t("projects.new.form.title.placeholder")}
                  error={fieldErrors.title}
                  required
                  icon={<Type className="w-5 h-5" />}
                  description={t("projects.new.form.title.description")}
                />

                {/* Project Description */}
                <InputField
                  label={t("projects.new.form.description.label")}
                  name="description"
                  type="textarea"
                  value={formData.description || ""}
                  onChange={handleInputChange}
                  placeholder={t("projects.new.form.description.placeholder")}
                  error={fieldErrors.description}
                  icon={<FileText className="w-5 h-5" />}
                  description={t("projects.new.form.description.description")}
                />

                {/* Required Skills */}
                <div className="space-y-2">
                  <label className="block text-lg font-bold font-medium text-gray-900 dark:text-slate-100">
                    {t("projects.new.form.skills.label")}
                    <span className="text-red-500 dark:text-red-400 mr-2 ml-2">
                      *
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                    {t("projects.new.form.skills.description")}
                  </p>

                  {/* Skills Input */}
                  <div className="relative">
                    <Tag className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={currentSkill}
                      onChange={(e) => setCurrentSkill(e.target.value)}
                      onKeyPress={handleSkillInputKeyPress}
                      placeholder={t("projects.new.form.skills.placeholder")}
                      className="w-full pl-11 pr-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-100 placeholder-gray-500"
                    />
                  </div>

                  {/* Skills Tags */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <AnimatePresence>
                      {formData.skills.map((skill) => (
                        <SkillTag
                          key={skill}
                          skill={skill}
                          onRemove={() => removeSkill(skill)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {fieldErrors.skills && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 ml-2" />
                      {fieldErrors.skills}
                    </p>
                  )}

                  {/* Popular Skills Suggestions */}
                  {/*
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                      {t('projects.new.form.skills.popularSkills')}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getTranslationArray('projects.new.form.skills.popularSkillsList').map((skill: string) => (
                        <SkillTag
                          key={skill}
                          skill={skill}
                          onClick={() => {
                            if (!formData.skills.includes(skill)) {
                              setFormData(prev => ({
                                ...prev,
                                skills: [...prev.skills, skill]
                              }))
                            }
                          }}
                          isSelected={formData.skills.includes(skill)}
                        />
                      ))}
                    </div>
                  </div>
                  */}
                </div>

                {/* Budget Range */}
                <BudgetRange
                  min={formData.budget_range_min}
                  max={formData.budget_range_max}
                  onChange={handleBudgetChange}
                  error={
                    fieldErrors.budget_range_min || fieldErrors.budget_range_max
                  }
                  currency="DZD"
                />

                {/* Tips Section */}
                {/*
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-6 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-2">
                        {t('projects.new.tips.title')}
                      </h3>
                      <ul className="space-y-2 text-gray-600 dark:text-slate-400">
                        {getTranslationArray('projects.new.tips.list').map((tip: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="w-4 h-4 text-green-500 mr-2 ml-2 mt-0.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                */}

                {/* Form Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300 mb-4 sm:mb-0"
                  >
                    {t("projects.new.buttons.cancel")}
                  </button>

                  <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        // Save as draft functionality
                        setSuccess(t("projects.new.success.savedDraft"));
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 dark:text-slate-300 rounded-xl font-bold hover:from-gray-200 hover:to-gray-300 transition-all duration-300 border border-gray-300/50 dark:border-slate-700/50"
                    >
                      {t("projects.new.buttons.saveDraft")}
                    </button>

                    <button
                      type="submit"
                      disabled={creating}
                      className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 ml-2 animate-spin" />
                          {t("projects.new.buttons.creating")}
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5 mr-2 ml-2" />
                          {t("projects.new.buttons.createProject")}
                          <ArrowUpRight className="w-5 h-5 mr-2 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>

            {/* Additional Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...ANIMATION_CONFIGS.EASING.ENTER, delay: 0.2 }}
              className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 shadow-sm">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl w-fit mb-4">
                  <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("projects.new.infoCards.securePlatform.title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("projects.new.infoCards.securePlatform.description")}
                </p>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 dark:border-purple-800/80 shadow-sm">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl w-fit mb-4">
                  <UsersIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("projects.new.infoCards.qualityFreelancers.title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("projects.new.infoCards.qualityFreelancers.description")}
                </p>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 shadow-sm">
                <div className="p-3 bg-green-100 dark:bg-emerald-950/60 rounded-xl w-fit mb-4">
                  <MessageSquareIcon className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3">
                  {t("projects.new.infoCards.directCommunication.title")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                  {t("projects.new.infoCards.directCommunication.description")}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              {t("projects.new.support.title")}
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto">
              {t("projects.new.support.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-8 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 shadow-sm">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl mr-4">
                  <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    {t("projects.new.support.liveSupport.title")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400">
                    {t("projects.new.support.liveSupport.description")}
                  </p>
                </div>
              </div>
              <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300">
                {t("projects.new.support.liveSupport.button")}
              </button>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-8 border border-purple-200 dark:border-purple-800/80 dark:border-purple-800/80 shadow-sm">
              <div className="flex items-center mb-6">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl mr-4">
                  <FileTextIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    {t("projects.new.support.templates.title")}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400">
                    {t("projects.new.support.templates.description")}
                  </p>
                </div>
              </div>
              <Link
                href="/hub/projects/templates"
                className="block w-full text-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
              >
                {t("projects.new.support.templates.button")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
