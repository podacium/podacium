"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslations, useLocale, useBidi } from "@/lib/i18n";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import PodaciumLogo from "@/components/logo/podacium.png";
import PodaciumLogoWhite from "@/components/logo/podacium white png.png";
import PodaciumIcon from "@/components/logo/podacium icon.svg";
import PodaciumIconWhite from "@/components/logo/podacium icon white.svg";
import UserAvatar from "@/components/UserAvatar";
import UniversalImage from "@/components/UniversalImage";
import { motion } from "framer-motion";
import { NotificationResponse, NotificationPriority } from "@/lib/api";
import { resolveNotificationRoute } from "@/lib/notificationRoutes";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@/hooks/useNotifications";
import LanguageSwitcher from "./LanguageSwitcher";
import { WorkspaceSwitcher } from "./navigation/WorkspaceSwitcher";
import { resolveChromeMode, CHROME } from "@/lib/navigation/chrome";
import {
  useHasRootNavbar,
  useFocusChrome,
} from "@/lib/navigation/chromeContext";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { formatNotificationContent } from "@/lib/notificationFormat";
import {
  ArrowLeft,
  AlertCircle,
  X,
  ExternalLink,
  BarChart3,
  ChevronRight,
  Brain,
  LayoutDashboard,
  Building2,
  Bell,
  GraduationCap,
  Map,
  BookOpen,
  BookText,
  Handshake,
  PenSquare,
  CreditCard,
  Gem,
  CircleCheck,
  Phone,
  Shield,
  Briefcase,
  Scale,
  HelpCircle,
  RotateCcw,
  Search,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Mail,
  Key,
  Rocket,
  Globe,
  Twitter,
  Linkedin,
  Github,
  MessageCircle,
  TrendingUp,
  FileText,
  HeartHandshake,
  Database,
  Lock,
  UserCog,
  Kanban,
  Workflow,
  Smartphone,
  Sun,
  Moon,
  Monitor,
  Clock,
  Loader2,
  ArrowUpRight,
  Command as CommandIcon,
} from "lucide-react";

// Types
interface NavItem {
  name: string;
  i18nKey: string;
  i18nDescriptionKey?: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: "New" | "Popular" | "Beta" | "Coming Soon";
  children?: NavItem[];
  comingSoon?: boolean;
}

// Badge helpers: centralize color classes per badge type and variant
const getBadgeClass = (
  badge?: NavItem["badge"],
  variant?: "small" | "smallAlt" | "absolute" | "pill",
) => {
  if (!badge) return "";
  const actualVariant = variant || "small";

  const map: Record<
    NonNullable<NavItem["badge"]>,
    { bg: string; text: string; gradient?: string }
  > = {
    New: {
      bg: "bg-emerald-100 dark:bg-emerald-950/80",
      text: "text-emerald-700 dark:text-emerald-300",
      gradient: "from-emerald-600 to-teal-600",
    },
    Popular: {
      bg: "bg-indigo-100 dark:bg-indigo-950/80",
      text: "text-indigo-700 dark:text-indigo-300",
      gradient: "from-indigo-600 to-purple-600",
    },
    "Coming Soon": {
      bg: "bg-amber-100 dark:bg-amber-950/80",
      text: "text-amber-800 dark:text-amber-300",
      gradient: "from-amber-500 to-orange-500",
    },
    Beta: {
      bg: "bg-purple-100 dark:bg-purple-950/80",
      text: "text-purple-700 dark:text-purple-300",
      gradient: "from-purple-600 to-pink-600",
    },
  };

  const cfg = map[badge as NonNullable<NavItem["badge"]>] || {
    bg: "bg-gray-200 dark:bg-slate-800/90",
    text: "text-gray-800 dark:text-slate-200",
    gradient: "from-gray-200 to-gray-300",
  };

  switch (actualVariant) {
    case "small":
      return `ml-2 px-2 py-1 text-xs rounded-full ${cfg.bg} ${cfg.text}`;
    case "smallAlt":
      return `px-1.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} rounded-full border border-white/10 dark:border-slate-800/30`;
    case "absolute":
      return `absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} rounded-full shadow-sm`;
    case "pill":
      return `px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} rounded-full`;
    default:
      return `px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text} rounded-full`;
  }
};

const MegaMenu: React.FC<{ item: NavItem; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const t = useTranslations("common");
  return (
    <div
      className="absolute left-0 top-full mt-0 w-screen max-w-4xl bg-white dark:bg-slate-900/95 backdrop-blur-2xl rounded-xl shadow-2xl border border-border z-50"
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {item.children?.map((child, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 flex-shrink-0">
                {child.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                  {t(child.i18nKey)}
                  {child.badge && (
                    <span className={getBadgeClass(child.badge, "small")}>
                      {child.badge === "Popular"
                        ? t("nav.badges.popular")
                        : child.badge === "New"
                          ? t("nav.badges.new")
                          : child.badge === "Coming Soon"
                            ? t("nav.badges.comingSoon")
                            : child.badge === "Beta"
                              ? t("nav.badges.beta")
                              : child.badge}
                    </span>
                  )}
                </h3>
                {child.i18nDescriptionKey && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(child.i18nDescriptionKey)}
                  </p>
                )}
              </div>
            </div>

            {child.children && (
              <div className="space-y-2">
                {child.children.map((grandchild, grandIndex) => (
                  <Link
                    key={grandIndex}
                    href={grandchild.href}
                    className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={onClose}
                  >
                    {t(grandchild.i18nKey)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-secondary rounded-b-xl px-8 py-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-foreground">
              {t("nav.mega.helpTitle")}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t("nav.mega.helpSubtitle")}
            </p>
          </div>
          <PodaciumButton variant="primary" size="sm" href="/docs">
            {t("docs.view")}
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
};

// Navigation Items with i18n keys
const navigation: NavItem[] = [
  {
    name: "Learning",
    i18nKey: "nav.learning",
    href: "/learn",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Educational Resources & Documentation",
    children: [
      {
        name: "Learning Center",
        i18nKey: "nav.learningCenter",
        i18nDescriptionKey: "nav.learningCenterDesc",
        href: "/learn",
        icon: <GraduationCap className="h-5 w-5" />,
        description: "Interactive learning experiences",
        children: [],
        badge: "Popular",
      },
      {
        name: "Paths",
        i18nKey: "nav.paths",
        i18nDescriptionKey: "nav.pathsDesc",
        href: "/learn/paths",
        icon: <Map className="h-5 w-5" />,
        description: "Guided learning paths",
        children: [],
      },
      {
        name: "Courses",
        i18nKey: "nav.courses",
        i18nDescriptionKey: "nav.coursesDesc",
        href: "/learn/courses",
        icon: <BookText className="h-5 w-5" />,
        description: "In-depth courses on tech",
        children: [],
      },
      {
        name: "Documentation",
        i18nKey: "nav.documentation",
        i18nDescriptionKey: "nav.documentationDesc",
        href: "/docs",
        icon: <FileText className="h-5 w-5" />,
        description: "Comprehensive technical docs",
        children: [],
      },
    ],
  },
  {
    name: "Hub",
    i18nKey: "nav.hub",
    href: "/hub",
    icon: <Globe className="h-5 w-5" />,
    description: "Tools & Resources for Freelancers",
    children: [
      {
        name: "Hub Center",
        i18nKey: "nav.hubCenter",
        i18nDescriptionKey: "nav.hubCenterDesc",
        href: "/hub",
        icon: <HeartHandshake className="h-5 w-5" />,
        badge: "New",
        description: "The heart of Podacium's Hub",
        children: [],
      },
      {
        name: "Freelancer",
        i18nKey: "nav.freelancer",
        i18nDescriptionKey: "nav.freelancerDesc",
        href: "/hub/freelancers",
        icon: <UserCog className="h-5 w-5" />,
        description: "Find and hire top freelancers",
        badge: "New",
        children: [],
      },
      {
        name: "Projects",
        i18nKey: "nav.projects",
        i18nDescriptionKey: "nav.projectsDesc",
        href: "/hub/projects",
        icon: <Workflow className="h-5 w-5" />,
        badge: "New",
        description: "Find or Create freelance projects",
        children: [],
      },
      {
        name: "For Companies",
        i18nKey: "nav.forCompanies",
        i18nDescriptionKey: "nav.forCompaniesDesc",
        href: "/hub/projects",
        icon: <Building2 className="h-5 w-5" />,
        badge: "Beta",
        description: "Hire talent & post projects",
        children: [],
      },
    ],
  },
  {
    name: "BI",
    i18nKey: "nav.bi",
    href: "/bi",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Business Intelligence & Analytics",
    children: [
      {
        name: "Business Intelligence",
        i18nKey: "nav.businessIntelligence",
        i18nDescriptionKey: "nav.businessIntelligenceDesc",
        href: "/bi",
        icon: <LayoutDashboard className="h-5 w-5" />,
        description: "Main BI overview",
        children: [],
      },
      {
        name: "Organizations",
        i18nKey: "nav.organizations",
        i18nDescriptionKey: "nav.organizationsDesc",
        href: "/organizations",
        icon: <Building2 className="h-5 w-5" />,
        description: "Manage your organizations",
        children: [
          {
            name: "Datasets",
            i18nKey: "nav.datasets",
            i18nDescriptionKey: "nav.datasetsDesc",
            href: "/bi/datasets",
            icon: <Database className="h-5 w-5" />,
            description: "Manage and analyze datasets",
            children: [],
          },
          {
            name: "Quality",
            i18nKey: "nav.quality",
            i18nDescriptionKey: "nav.qualityDesc",
            href: "/bi/quality",
            icon: <Shield className="h-5 w-5" />,
            description: "Data quality management",
            children: [],
          },
          {
            name: "Analytics",
            i18nKey: "nav.analytics",
            i18nDescriptionKey: "nav.analyticsDesc",
            href: "/bi/analytics",
            icon: <TrendingUp className="h-5 w-5" />,
            description: "Deep dive analysis tools",
            children: [],
          },
          {
            name: "Decisions",
            i18nKey: "nav.decisions",
            i18nDescriptionKey: "nav.decisionsDesc",
            href: "/bi/decisions",
            icon: <Kanban className="h-5 w-5" />,
            description: "Decision tracking & management",
            children: [],
          },
          {
            name: "Reports",
            i18nKey: "nav.reports",
            i18nDescriptionKey: "nav.reportsDesc",
            href: "/bi/reports",
            icon: <FileText className="h-5 w-5" />,
            description: "Generate and view reports",
            children: [],
          },
        ],
      },
      {
        name: "Dashboards",
        i18nKey: "nav.dashboards",
        i18nDescriptionKey: "nav.dashboardsDesc",
        href: "/bi/dashboards",
        icon: <BarChart3 className="h-5 w-5" />,
        description: "View and create dashboards",
        children: [],
      },
      {
        name: "AI Analytics",
        i18nKey: "nav.aiAnalytics",
        i18nDescriptionKey: "nav.aiAnalyticsDesc",
        href: "/ai-analytics",
        icon: <Brain className="h-5 w-5" />,
        description: "AI-powered insights and predictions",
        badge: "Coming Soon",
        comingSoon: true,
        children: [],
      },
    ],
  },
  {
    name: "Pricing",
    i18nKey: "nav.pricing",
    href: "/pricing",
    icon: <Gem className="h-5 w-5" />,
    description: "Choose the right plan for you",
    children: [],
  },
  {
    name: "Company",
    i18nKey: "nav.company",
    href: "/about",
    icon: <Building2 className="h-5 w-5" />,
    description: "About Us, Support & Careers",
    children: [
      {
        name: "About Us",
        i18nKey: "nav.aboutUs",
        i18nDescriptionKey: "nav.aboutUsDesc",
        href: "/about",
        icon: <Building2 className="h-5 w-5" />,
        description: "Learn about our company",
        children: [],
      },
      {
        name: "Help & Support",
        i18nKey: "nav.helpSupport",
        i18nDescriptionKey: "nav.helpSupportDesc",
        href: "/help",
        icon: <HelpCircle className="h-5 w-5" />,
        description: "Get help when you need it",
        children: [],
      },
      {
        name: "Partners",
        i18nKey: "nav.partners",
        i18nDescriptionKey: "nav.partnersDesc",
        href: "/partners",
        icon: <Handshake className="h-5 w-5" />,
        description: "Partner programs and resources",
        children: [],
      },
      {
        name: "Careers",
        i18nKey: "nav.careers",
        i18nDescriptionKey: "nav.careersDesc",
        href: "/careers",
        icon: <Briefcase className="h-5 w-5" />,
        description: "Join our team",
        children: [],
      },
      {
        name: "Contact",
        i18nKey: "nav.contact",
        i18nDescriptionKey: "nav.contactDesc",
        href: "/contact",
        icon: <Phone className="h-5 w-5" />,
        description: "Get in touch with us",
        children: [],
      },
    ],
  },
];

const NotificationDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationResponse[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  loading,
  error,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const t = useTranslations("common");
  const router = useRouter();

  const handleNotificationClick = (notification: NotificationResponse) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    onClose();
    const targetRoute = resolveNotificationRoute(notification);
    router.push(targetRoute);
  };

  const locale = useLocale();
  const formatTime = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 1) return t("notifications.justNow");
    if (diffInHours < 24)
      return t("notifications.hoursAgo", { n: String(diffInHours) });

    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPriorityIcon = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return (
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200/80 dark:border-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
      case NotificationPriority.HIGH:
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Bell className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <div className="absolute end-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-max min-w-[20rem] max-w-md bg-white dark:bg-slate-900/95 backdrop-blur-2xl rounded-xl shadow-2xl border border-gray-100 dark:border-slate-800 z-50 animate-in fade-in-0 zoom-in-95">
      <div className="p-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center">
            <Bell className="h-5 w-5 me-2 text-indigo-600 dark:text-indigo-400" />
            {t("notifications.title")}
            {unreadCount > 0 && (
              <span className="ms-2 px-2 py-1 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full">
                {unreadCount} {t("notifications.new")}
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <PodaciumButton
                variant="ghost"
                size="sm"
                onClick={onMarkAllAsRead}
                className="h-7 text-xs font-medium px-2"
              >
                {t("notifications.markAllRead")}
              </PodaciumButton>
            )}
            <PodaciumButton
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("notifications.closeNotifications")}
              className="h-7 w-7 text-muted-foreground/70 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </PodaciumButton>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("notifications.loading")}
            </p>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400 mx-auto" />
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-primary hover:text-blue-800 dark:text-blue-200"
            >
              {t("notifications.retry")}
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/70 mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("notifications.noNotifications")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t("notifications.allCaughtUp")}
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const { title, body, categoryLabel } = formatNotificationContent(
              notification,
              t,
            );

            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
                className={`p-4 border-b border-gray-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                  !notification.is_read
                    ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                    : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {getPriorityIcon(notification.priority)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-sm ${!notification.is_read ? "text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-700 dark:text-slate-300 font-medium"}`}
                      >
                        {title || body}
                      </h4>
                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notification.id);
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-semibold ms-2 flex-shrink-0"
                        >
                          {t("notifications.markRead")}
                        </button>
                      )}
                    </div>

                    {body && body !== title && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {body}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                          {categoryLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>

                      {notification.email_sent && (
                        <Mail className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block w-full text-center text-sm text-primary hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
        >
          {t("notifications.viewAll")}
        </Link>
      </div>
    </div>
  );
};

export interface NavbarProps {
  isRootInstance?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ isRootInstance = false }) => {
  const hasRootNavbar = useHasRootNavbar();
  const { focusState } = useFocusChrome();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { dir, isRTL } = useBidi();
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const navbarRef = useRef<HTMLElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [notificationDropdown, setNotificationDropdown] = useState(false);

  // Desktop in-place expanding search states
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    modules: any[];
    freelancers: any[];
    projects: any[];
    commands: any[];
  }>({ modules: [], freelancers: [], projects: [], commands: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const openDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Notification data from TanStack Query ──────────────────────────────────
  const {
    data: notifData,
    isLoading: loadingNotifications,
    error: notifError,
  } = useNotifications(undefined, { enabled: !!isAuthenticated });
  const { data: unreadCount = 0 } = useUnreadCount({
    enabled: !!isAuthenticated,
  });
  const { mutate: markAsReadMutate } = useMarkAsRead();
  const { mutate: markAllAsReadMutate } = useMarkAllAsRead();

  const notifications = notifData?.notifications ?? [];
  const notificationError = notifError ? t("notifications.failedToLoad") : null;

  // Focus trap for mega menus — traps Tab cycling within the open dropdown
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!activeDropdown) return;
    const el = dropdownRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'a, button, input, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener("keydown", handleTab);
    // Focus the first element when dropdown opens
    setTimeout(() => first?.focus(), 50);

    return () => el.removeEventListener("keydown", handleTab);
  }, [activeDropdown]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 20);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Desktop In-Place Search: Commands & Navigation Items ──────────────────
  const allCommands = useMemo(
    () => [
      {
        id: "cmd-dashboard",
        title: t("auth.dashboard"),
        icon: LayoutDashboard,
        href: "/dashboard",
        type: "command" as const,
        keywords: ["dashboard", "home", "stats"],
      },
      {
        id: "cmd-learn",
        title: t("nav.learning"),
        icon: BookOpen,
        href: "/learn",
        type: "command" as const,
        keywords: ["courses", "education", "paths", "lessons"],
      },
      {
        id: "cmd-hub",
        title: t("nav.hub"),
        icon: Briefcase,
        href: "/hub",
        type: "command" as const,
        keywords: ["freelance", "projects", "contracts", "jobs"],
      },
      {
        id: "cmd-bi",
        title: t("nav.bi"),
        icon: BarChart3,
        href: "/bi",
        type: "command" as const,
        keywords: ["analytics", "datasets", "bi", "reports"],
      },
      {
        id: "cmd-settings",
        title: t("auth.profile"),
        icon: Settings,
        href: "/profile",
        type: "command" as const,
        keywords: ["settings", "profile", "account"],
      },
    ],
    [t],
  );

  // Flattened items for combobox ArrowUp / ArrowDown navigation
  const flattenedResults = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      href?: string;
      action?: () => void;
      type: string;
    }> = [];
    if (desktopSearchQuery.trim().length >= 2) {
      searchResults.modules.forEach((m) =>
        list.push({
          id: `module-${m.id}`,
          title: m.title,
          href: `/learn/modules/${m.id}`,
          type: "module",
        }),
      );
      searchResults.freelancers.forEach((f) =>
        list.push({
          id: `user-${f.id}`,
          title: f.title,
          href: `/freelancers/${f.id}`,
          type: "user",
        }),
      );
      searchResults.projects.forEach((p) =>
        list.push({
          id: `project-${p.id}`,
          title: p.title,
          href: `/hub/projects/${p.id}`,
          type: "project",
        }),
      );
      searchResults.commands.forEach((c) =>
        list.push({
          id: c.id,
          title: c.title,
          href: c.href,
          action: c.action,
          type: "command",
        }),
      );
    } else {
      recentSearches.forEach((s, idx) =>
        list.push({
          id: `recent-${idx}`,
          title: s,
          action: () => {
            setDesktopSearchQuery(s);
          },
          type: "recent",
        }),
      );
    }
    return list;
  }, [desktopSearchQuery, searchResults, recentSearches]);

  // Debounced search to /api/v1/search (250ms)
  useEffect(() => {
    const q = desktopSearchQuery.trim();
    if (q.length < 2) {
      setSearchResults({
        modules: [],
        freelancers: [],
        projects: [],
        commands: [],
      });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(q)}&limit=10`,
        );
        if (res.ok) {
          const data = await res.json();
          const items: any[] = data.results || [];
          const modules = items.filter((x) => x.type === "module");
          const freelancers = items.filter((x) => x.type === "user");
          const projects = items.filter((x) => x.type === "project");

          const qLower = q.toLowerCase();
          const matchedCommands = allCommands.filter(
            (c) =>
              c.title.toLowerCase().includes(qLower) ||
              c.keywords.some((k) => k.includes(qLower)),
          );

          setSearchResults({
            modules,
            freelancers,
            projects,
            commands: matchedCommands,
          });
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [desktopSearchQuery, allCommands]);

  // When desktop search opens: load recents and auto-focus input
  useEffect(() => {
    if (isDesktopSearchOpen) {
      try {
        const stored = localStorage.getItem("podacium_recent_searches");
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch {}
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setActiveDropdown(null);
      setNotificationDropdown(false);
    } else {
      setActiveResultIndex(-1);
    }
  }, [isDesktopSearchOpen]);

  const handleRemoveRecentSearch = useCallback(
    (e: React.MouseEvent, termToRemove: string) => {
      e.stopPropagation();
      try {
        const updated = recentSearches.filter((t) => t !== termToRemove);
        localStorage.setItem(
          "podacium_recent_searches",
          JSON.stringify(updated),
        );
        setRecentSearches(updated);
      } catch {}
    },
    [recentSearches],
  );

  const handleClearAllRecent = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem("podacium_recent_searches");
      setRecentSearches([]);
    } catch {}
  }, []);

  const handleExecuteSearch = useCallback(
    (term?: string) => {
      const finalQuery = (term || desktopSearchQuery).trim();
      if (!finalQuery) return;
      try {
        const updated = [
          finalQuery,
          ...recentSearches.filter(
            (s) => s.toLowerCase() !== finalQuery.toLowerCase(),
          ),
        ].slice(0, 5);
        localStorage.setItem(
          "podacium_recent_searches",
          JSON.stringify(updated),
        );
        setRecentSearches(updated);
      } catch {}

      setIsDesktopSearchOpen(false);
      router.push(`/search/?q=${encodeURIComponent(finalQuery)}`);
    },
    [desktopSearchQuery, recentSearches, router],
  );

  const handleSelectItem = useCallback(
    (item: { href?: string; action?: () => void; title: string }) => {
      if (item.action) {
        item.action();
        return;
      }
      if (item.href) {
        try {
          const updated = [
            item.title,
            ...recentSearches.filter(
              (s) => s.toLowerCase() !== item.title.toLowerCase(),
            ),
          ].slice(0, 5);
          localStorage.setItem(
            "podacium_recent_searches",
            JSON.stringify(updated),
          );
        } catch {}
        setIsDesktopSearchOpen(false);
        router.push(item.href);
      }
    },
    [recentSearches, router],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flattenedResults.length > 0) {
        setActiveResultIndex((prev) => (prev + 1) % flattenedResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flattenedResults.length > 0) {
        setActiveResultIndex(
          (prev) =>
            (prev - 1 + flattenedResults.length) % flattenedResults.length,
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        activeResultIndex >= 0 &&
        activeResultIndex < flattenedResults.length
      ) {
        handleSelectItem(flattenedResults[activeResultIndex]);
      } else {
        handleExecuteSearch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (desktopSearchQuery) {
        setDesktopSearchQuery("");
      } else {
        setIsDesktopSearchOpen(false);
        searchTriggerRef.current?.focus();
      }
    }
  };

  // Outside click & global shortcut listeners
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setSearchOpen(false);
        setNotificationDropdown(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node) &&
        searchTriggerRef.current &&
        !searchTriggerRef.current.contains(e.target as Node)
      ) {
        setIsDesktopSearchOpen(false);
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
        setSearchOpen(false);
        setIsMenuOpen(false);
        setNotificationDropdown(false);
        if (isDesktopSearchOpen) {
          if (desktopSearchQuery) {
            setDesktopSearchQuery("");
          } else {
            setIsDesktopSearchOpen(false);
            searchTriggerRef.current?.focus();
          }
        }
      }
    };

    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "/" && !isInput) {
        if (typeof window !== "undefined" && window.innerWidth >= 1280) {
          e.preventDefault();
          setIsDesktopSearchOpen(true);
        }
      }
    };

    const handleToggleNavbarSearch = () => {
      setIsDesktopSearchOpen((prev) => !prev);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);
    window.addEventListener("keydown", handleGlobalShortcuts);
    window.addEventListener("toggle-navbar-search", handleToggleNavbarSearch);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
      window.removeEventListener("keydown", handleGlobalShortcuts);
      window.removeEventListener(
        "toggle-navbar-search",
        handleToggleNavbarSearch,
      );
    };
  }, [isDesktopSearchOpen, desktopSearchQuery]);

  // Enhanced active path matching — highlights parent nav items
  // when any child route is active (e.g. /learn/courses/123 highlights "Learning")
  const isActivePath = (href: string, item?: NavItem) => {
    if (pathname === href) return true;
    if (pathname?.startsWith(href + "/")) return true;
    // Check if any child/grandchild route matches
    if (item?.children) {
      for (const child of item.children) {
        if (pathname?.startsWith(child.href + "/") || pathname === child.href)
          return true;
        if (child.children) {
          for (const grandchild of child.children) {
            if (
              pathname?.startsWith(grandchild.href + "/") ||
              pathname === grandchild.href
            )
              return true;
          }
        }
      }
    }
    return false;
  };

  // Enhanced dropdown handlers with hover-intent (300ms open intent, 400ms leave grace)
  const closeDropdown = useCallback(() => {
    if (openDropdownTimeoutRef.current) {
      clearTimeout(openDropdownTimeoutRef.current);
      openDropdownTimeoutRef.current = null;
    }
    if (closeDropdownTimeoutRef.current) {
      clearTimeout(closeDropdownTimeoutRef.current);
    }
    closeDropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 400);
  }, []);

  const openDropdown = useCallback(
    (name: string) => {
      if (closeDropdownTimeoutRef.current) {
        clearTimeout(closeDropdownTimeoutRef.current);
        closeDropdownTimeoutRef.current = null;
      }
      const delay = activeDropdown ? 100 : 300;
      if (openDropdownTimeoutRef.current) {
        clearTimeout(openDropdownTimeoutRef.current);
      }
      openDropdownTimeoutRef.current = setTimeout(() => {
        setActiveDropdown(name);
        setSearchOpen(false);
      }, delay);
    },
    [activeDropdown],
  );

  useEffect(() => {
    return () => {
      if (openDropdownTimeoutRef.current)
        clearTimeout(openDropdownTimeoutRef.current);
      if (closeDropdownTimeoutRef.current)
        clearTimeout(closeDropdownTimeoutRef.current);
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    };
  }, []);

  const toggleSearch = () => {
    setIsDesktopSearchOpen((prev) => !prev);
    setActiveDropdown(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const chromeMode = resolveChromeMode(pathname);
  const chromeSpec = CHROME[chromeMode];
  const isDocked = chromeSpec.hasSpine;

  if (hasRootNavbar && !isRootInstance) {
    return null;
  }

  return (
    <>
      {/* Dimmed backdrop scrim when desktop search is active */}
      {isDesktopSearchOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40"
          onClick={() => setIsDesktopSearchOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        ref={navbarRef}
        dir={dir}
        data-testid="main-navbar"
        data-chrome={chromeSpec.navbar}
        className={`fixed top-[max(1rem,env(safe-area-inset-top))] z-50 transition-[inset-inline-start,max-width,box-shadow,border-color] duration-300 ease-(--ease-spring) print:hidden ${
          isDocked
            ? "inset-x-3 sm:inset-x-4 mx-auto max-w-5xl"
            : `inset-x-3 sm:inset-x-4 mx-auto ${
                isDesktopSearchOpen ? "max-w-4xl" : "max-w-7xl"
              }`
        } rounded-[2rem] border border-white/40 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl ${
          scrolled
            ? "shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-white/60 dark:border-slate-800"
            : "shadow-[0_8px_16px_rgba(0,0,0,0.06)]"
        }`}
        aria-label={t("nav.primaryNav")}
      >
        {/* Premium top hairline */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 inset-x-10 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent rounded-full"
        />
        {/* Main Navbar Container */}
        {chromeSpec.navbar === "focus" ? (
          <div
            className="w-full mx-auto px-4 sm:px-6 py-2 flex items-center justify-between"
            data-testid="focus-navbar-container"
          >
            {/* Exit/Back button */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={focusState.backHref || "/learn"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/70 dark:hover:bg-slate-700/70 transition-colors shrink-0"
                aria-label={t("exit")}
              >
                <span
                  data-testid="focus-exit-btn"
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  <span>{t("exit")}</span>
                </span>
              </Link>
              <div className="h-4 w-px bg-border/60 shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">
                {focusState.title || t("nav.learning")}
              </span>
            </div>

            {/* Right utilities: Command Palette trigger & User Avatar */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="focus-search-trigger"
                onClick={() => {
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                  );
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border/40 hover:bg-muted/40 transition-colors"
                aria-label={t("search.title")}
              >
                <Search className="w-3.5 h-3.5" />
                <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              </button>
              {isAuthenticated && user && (
                <div data-testid="focus-user-avatar">
                  {user.profilePictureUrl ? (
                    <UserAvatar
                      src={user.profilePictureUrl}
                      alt={user.fullName || "User"}
                      size={32}
                      className="shadow-sm ring-1 ring-border/60"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm ring-1 ring-border/60">
                      {user.fullName?.[0] || user.email?.[0] || "U"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-2 xl:gap-3">
            {/* Logo */}
            <Link
              href="/"
              aria-label={t("common.home")}
              className="flex items-center group relative ms-1 shrink-0 z-10"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000 group-hover:duration-200 animate-tilt"></div>

                {isAuthenticated && user ? (
                  /* Authenticated Member: Compact Icon-Only Logo across all viewports to maximize nav width */
                  <div
                    className="relative w-9 h-9"
                    data-testid="compact-auth-logo"
                  >
                    <Image
                      src={
                        resolvedTheme === "dark"
                          ? PodaciumIconWhite
                          : PodaciumIcon
                      }
                      alt={t("common.podaciumLogo")}
                      fill
                      className="object-contain"
                      priority
                      sizes="36px"
                    />
                  </div>
                ) : (
                  /* Guest / Visitor: Responsive Logo (Icon on mobile, Full brand logo on sm+) */
                  <>
                    <div
                      className="relative w-9 h-9 sm:hidden"
                      data-testid="guest-mobile-logo"
                    >
                      <Image
                        src={
                          resolvedTheme === "dark"
                            ? PodaciumIconWhite
                            : PodaciumIcon
                        }
                        alt={t("common.podaciumLogo")}
                        fill
                        className="object-contain"
                        priority
                        sizes="36px"
                      />
                    </div>
                    <div
                      className="relative hidden sm:block w-36 md:w-40 h-9 md:h-10"
                      data-testid="guest-full-logo"
                    >
                      <Image
                        src={
                          resolvedTheme === "dark"
                            ? PodaciumLogoWhite
                            : PodaciumLogo
                        }
                        alt={t("common.podaciumLogo")}
                        fill
                        className="object-contain"
                        priority
                        sizes="(max-width: 768px) 50vw, 160px"
                      />
                    </div>
                  </>
                )}
              </div>
            </Link>

            {/* Desktop Navigation vs In-Place Search */}
            <div className="hidden xl:flex items-center flex-1 justify-center mx-1 2xl:mx-3 relative min-w-0">
              {isDesktopSearchOpen ? (
                <motion.div
                  ref={searchContainerRef}
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="w-full max-w-2xl relative"
                >
                  <div className="relative flex items-center w-full">
                    <Search className="absolute start-4 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      role="combobox"
                      data-testid="desktop-search-input"
                      aria-expanded="true"
                      aria-autocomplete="list"
                      aria-controls="navbar-search-results"
                      aria-activedescendant={
                        activeResultIndex >= 0 &&
                        activeResultIndex < flattenedResults.length
                          ? flattenedResults[activeResultIndex].id
                          : undefined
                      }
                      value={desktopSearchQuery}
                      onChange={(e) => setDesktopSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={t("search.openSearch")}
                      className="w-full ps-11 pe-24 py-2.5 bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-indigo-300 dark:border-indigo-700/80 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm text-foreground placeholder:text-muted-foreground transition-all"
                    />
                    <div className="absolute end-3 flex items-center gap-1.5">
                      {isSearching && (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      )}
                      {desktopSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => setDesktopSearchQuery("")}
                          aria-label={t("search.clearRecent")}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-xs">
                          ⌘K
                        </kbd>
                      )}
                      <button
                        type="button"
                        data-testid="desktop-search-close"
                        onClick={() => {
                          setIsDesktopSearchOpen(false);
                          searchTriggerRef.current?.focus();
                        }}
                        aria-label={t("search.closeSearch")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Combobox Results Dropdown */}
                  <div
                    id="navbar-search-results"
                    role="listbox"
                    className="absolute top-full mt-2 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/60 dark:border-slate-800/80 p-3 z-50 overflow-hidden text-sm max-h-[460px] overflow-y-auto"
                  >
                    {/* 1. Empty Query State: Recent Searches & Quick Jump */}
                    {desktopSearchQuery.trim().length < 2 && (
                      <div className="space-y-4 py-1">
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between px-2 pb-1.5 border-b border-border/40">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("search.recentSearches")}
                              </span>
                              <button
                                type="button"
                                onClick={handleClearAllRecent}
                                className="text-[11px] font-semibold text-muted-foreground hover:text-rose-500 transition-colors"
                              >
                                {t("search.clearRecent")}
                              </button>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {recentSearches.map((term, idx) => {
                                const isSelected = activeResultIndex === idx;
                                return (
                                  <div
                                    key={term}
                                    id={`recent-${idx}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                      setDesktopSearchQuery(term);
                                      handleExecuteSearch(term);
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-foreground/80"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                      <span className="truncate">{term}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        handleRemoveRecentSearch(e, term)
                                      }
                                      className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Quick Jump */}
                        <div>
                          <div className="px-2 pb-1.5 border-b border-border/40">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              {t("search.quickJump")}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {[
                              {
                                title: t("nav.learning"),
                                desc: t("nav.learningCenterDesc"),
                                href: "/learn",
                                icon: BookOpen,
                                color:
                                  "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/50",
                              },
                              {
                                title: t("nav.hub"),
                                desc: t("nav.hubCenterDesc"),
                                href: "/hub",
                                icon: Briefcase,
                                color:
                                  "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900/50",
                              },
                              {
                                title: t("nav.bi"),
                                desc: t("nav.businessIntelligenceDesc"),
                                href: "/bi",
                                icon: BarChart3,
                                color:
                                  "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-900/50",
                              },
                              {
                                title: t("auth.dashboard"),
                                desc: t("nav.workspace"),
                                href: "/dashboard",
                                icon: LayoutDashboard,
                                color:
                                  "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-100 dark:border-purple-900/50",
                              },
                            ].map((jump) => (
                              <Link
                                key={jump.href}
                                href={jump.href}
                                onClick={() => setIsDesktopSearchOpen(false)}
                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors border border-transparent hover:border-border/60"
                              >
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${jump.color}`}
                                >
                                  <jump.icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-foreground truncate">
                                    {jump.title}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {jump.desc}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Populated Query State: Results List */}
                    {desktopSearchQuery.trim().length >= 2 && (
                      <div className="space-y-3">
                        {/* Courses */}
                        {searchResults.modules.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 border-b border-border/40">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("search.courses")}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {searchResults.modules.map((m) => {
                                const itemKey = `module-${m.id}`;
                                const flatIdx = flattenedResults.findIndex(
                                  (x) => x.id === itemKey,
                                );
                                const isSelected =
                                  activeResultIndex === flatIdx;
                                return (
                                  <div
                                    key={m.id}
                                    id={itemKey}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() =>
                                      handleSelectItem({
                                        title: m.title,
                                        href: `/learn/modules/${m.id}`,
                                      })
                                    }
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                                        <BookOpen className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-xs truncate">
                                          {m.title}
                                        </p>
                                        {m.metadata?.level && (
                                          <p className="text-[10px] text-muted-foreground">
                                            {m.metadata.level}{" "}
                                            {m.metadata.durationMinutes
                                              ? `· ${m.metadata.durationMinutes} min`
                                              : ""}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Freelancers */}
                        {searchResults.freelancers.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 border-b border-border/40">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("search.freelancers")}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {searchResults.freelancers.map((f) => {
                                const itemKey = `user-${f.id}`;
                                const flatIdx = flattenedResults.findIndex(
                                  (x) => x.id === itemKey,
                                );
                                const isSelected =
                                  activeResultIndex === flatIdx;
                                return (
                                  <div
                                    key={f.id}
                                    id={itemKey}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() =>
                                      handleSelectItem({
                                        title: f.title,
                                        href: `/freelancers/${f.id}`,
                                      })
                                    }
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                                        <User className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-xs truncate">
                                          {f.title}
                                        </p>
                                        {f.metadata?.role && (
                                          <p className="text-[10px] text-muted-foreground">
                                            {f.metadata.role}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Projects */}
                        {searchResults.projects.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 border-b border-border/40">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("search.projects")}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {searchResults.projects.map((p) => {
                                const itemKey = `project-${p.id}`;
                                const flatIdx = flattenedResults.findIndex(
                                  (x) => x.id === itemKey,
                                );
                                const isSelected =
                                  activeResultIndex === flatIdx;
                                return (
                                  <div
                                    key={p.id}
                                    id={itemKey}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() =>
                                      handleSelectItem({
                                        title: p.title,
                                        href: `/hub/projects/${p.id}`,
                                      })
                                    }
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                                        <Briefcase className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-semibold text-xs truncate">
                                          {p.title}
                                        </p>
                                        {p.description && (
                                          <p className="text-[10px] text-muted-foreground truncate">
                                            {p.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Commands */}
                        {searchResults.commands.length > 0 && (
                          <div>
                            <div className="px-2 pb-1 border-b border-border/40">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("search.commands")}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {searchResults.commands.map((c) => {
                                const flatIdx = flattenedResults.findIndex(
                                  (x) => x.id === c.id,
                                );
                                const isSelected =
                                  activeResultIndex === flatIdx;
                                const IconComponent = c.icon;
                                return (
                                  <div
                                    key={c.id}
                                    id={c.id}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() =>
                                      handleSelectItem({
                                        title: c.title,
                                        href: c.href,
                                        action: c.action,
                                      })
                                    }
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-muted-foreground">
                                        <IconComponent className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="font-medium text-xs truncate">
                                        {c.title}
                                      </span>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Zero Results State */}
                        {!isSearching &&
                          searchResults.modules.length === 0 &&
                          searchResults.freelancers.length === 0 &&
                          searchResults.projects.length === 0 &&
                          searchResults.commands.length === 0 && (
                            <div className="py-6 px-4 text-center">
                              <p className="text-muted-foreground text-xs">
                                {t("search.noResults")} &quot;
                                {desktopSearchQuery}&quot;
                              </p>
                              <button
                                type="button"
                                data-testid="ask-team-btn"
                                onClick={() => {
                                  const q = desktopSearchQuery;
                                  setIsDesktopSearchOpen(false);
                                  window.dispatchEvent(
                                    new CustomEvent("open-help-launcher", {
                                      detail: {
                                        view: "ticket",
                                        subject: `Need help finding: ${q}`,
                                      },
                                    }),
                                  );
                                }}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus:outline-none"
                              >
                                <span>{t("search.askTeam")}</span>
                                <span
                                  aria-hidden="true"
                                  className="rtl:rotate-180"
                                >
                                  →
                                </span>
                              </button>
                            </div>
                          )}

                        {/* View all results footer */}
                        <div className="pt-2 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => handleExecuteSearch()}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <span>
                              {t("search.viewAll")} &quot;
                              {desktopSearchQuery}&quot;
                            </span>
                            <kbd
                              aria-hidden="true"
                              className="text-[10px] text-muted-foreground font-normal"
                            >
                              ↵
                            </kbd>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : chromeSpec.navbar === "compact" ? (
                /* Operating Mode (Workspace / Studio / Admin / Canvas): Streamlined Command & Quick Search pill */
                <div className="w-full max-w-md lg:max-w-xl mx-auto flex-1 min-w-0 px-2">
                  <button
                    type="button"
                    data-testid="compact-search-trigger"
                    onClick={() => {
                      setIsDesktopSearchOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-full border border-border/50 bg-slate-100/70 dark:bg-slate-800/70 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-muted-foreground text-xs transition-colors"
                    aria-label={t("search.openSearch")}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 me-2">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-xs whitespace-nowrap truncate text-start">
                        {t("search.openSearch")}
                      </span>
                    </div>
                    <kbd className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-border/40 px-1.5 py-0.5 rounded shadow-xs shrink-0">
                      ⌘K
                    </kbd>
                  </button>
                </div>
              ) : (
                <ul
                  className="flex items-center justify-center gap-0.5 2xl:gap-1 min-w-0 max-w-full"
                  role="menubar"
                  aria-label="Main menu"
                >
                  {navigation.map((item) => (
                    <li
                      key={item.name}
                      className="relative shrink-0"
                      onMouseEnter={() =>
                        item.children && openDropdown(item.name)
                      }
                      onMouseLeave={() => item.children && closeDropdown()}
                      role="none"
                    >
                      {item.children && item.children.length > 0 ? (
                        <>
                          <Link
                            href={item.href}
                            aria-haspopup="true"
                            aria-expanded={activeDropdown === item.name}
                            onMouseEnter={() => openDropdown(item.name)}
                            className={`group relative flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 2xl:py-2 rounded-xl font-semibold text-xs 2xl:text-sm whitespace-nowrap shrink-0 transition-all duration-300 ${
                              isActivePath(item.href, item)
                                ? "text-white bg-indigo-600 shadow-sm"
                                : "text-foreground/80 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                            } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                          >
                            <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 2xl:[&>svg]:w-5 2xl:[&>svg]:h-5 text-foreground/80 dark:text-slate-300 group-hover:text-indigo-700 dark:text-indigo-300 dark:group-hover:text-white">
                              {item.icon}
                            </span>
                            <span className="whitespace-nowrap">
                              {t(item.i18nKey, {}, item.name)}
                            </span>
                            {item.badge && (
                              <span
                                className={getBadgeClass(
                                  item.badge,
                                  "absolute",
                                )}
                              >
                                {item.badge === "Popular"
                                  ? t("nav.badges.popular")
                                  : item.badge === "New"
                                    ? t("nav.badges.new")
                                    : item.badge === "Coming Soon"
                                      ? t("nav.badges.comingSoon")
                                      : item.badge === "Beta"
                                        ? t("nav.badges.beta")
                                        : item.badge}
                              </span>
                            )}
                            {item.children && item.children.length > 0 && (
                              <ChevronDown
                                className={`w-3.5 h-3.5 2xl:w-4 2xl:h-4 shrink-0 transition-transform duration-200 ${
                                  activeDropdown === item.name
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            )}
                          </Link>

                          {activeDropdown === item.name && (
                            <div
                              ref={dropdownRef}
                              role="dialog"
                              aria-modal="true"
                              aria-label={item.name}
                              className="absolute left-1/2 transform -translate-x-1/2 mt-2 min-w-[20rem] w-max max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/40 dark:border-slate-800/80 p-2 z-50 animate-in fade-in-0 zoom-in-95"
                              onMouseEnter={() => openDropdown(item.name)}
                              onMouseLeave={closeDropdown}
                            >
                              <div className="grid gap-1">
                                {item.children.map((child) => {
                                  const isComingSoon = child.comingSoon;

                                  if (isComingSoon) {
                                    return (
                                      <div
                                        key={`${t(child.i18nKey)}-${child.href}`}
                                        className="group flex items-start gap-3.5 p-3 rounded-xl bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-slate-50/80 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-slate-900/80 border border-purple-200/70 dark:border-purple-800/50 relative cursor-not-allowed select-none transition-all shadow-xs"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        title={t("nav.comingSoonTitle")}
                                      >
                                        <div className="relative flex-shrink-0 mt-0.5">
                                          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-xl flex items-center justify-center shadow-xs">
                                            {child.icon}
                                          </div>
                                          <div className="absolute -bottom-1 -end-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
                                            <Lock className="h-2.5 w-2.5 text-white" />
                                          </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                              {t(child.i18nKey)}
                                            </p>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/30 flex-shrink-0">
                                              <span className="relative flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                              </span>
                                              {t("nav.comingSoonBadge")}
                                            </span>
                                          </div>
                                          {child.i18nDescriptionKey && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                              {t(child.i18nDescriptionKey)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={`${t(child.i18nKey)}-${child.href}`}
                                      className="relative group/item"
                                    >
                                      <Link
                                        href={child.href}
                                        className="group flex items-start space-x-4 p-3 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 dark:hover:from-slate-800/80 dark:hover:to-slate-800/50 transition-all duration-200 border border-transparent hover:border-indigo-100 dark:border-indigo-900/50 justify-between"
                                        onClick={closeDropdown}
                                      >
                                        <div className="flex items-start gap-3.5">
                                          <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center border border-indigo-100/80 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-300 group-hover:scale-110 transition-transform duration-200">
                                            {child.icon}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                                {t(child.i18nKey)}
                                              </p>
                                              {child.badge && (
                                                <span
                                                  className={getBadgeClass(
                                                    child.badge,
                                                    "pill",
                                                  )}
                                                >
                                                  {child.badge === "Popular"
                                                    ? t("nav.badges.popular")
                                                    : child.badge === "New"
                                                      ? t("nav.badges.new")
                                                      : child.badge ===
                                                          "Coming Soon"
                                                        ? t(
                                                            "nav.badges.comingSoon",
                                                          )
                                                        : child.badge === "Beta"
                                                          ? t("nav.badges.beta")
                                                          : child.badge}
                                                </span>
                                              )}
                                            </div>
                                            {child.i18nDescriptionKey && (
                                              <p className="text-sm text-muted-foreground mt-1">
                                                {t(child.i18nDescriptionKey)}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        {child.children &&
                                          child.children.length > 0 && (
                                            <ChevronRight className="w-5 h-5 text-muted-foreground/70 group-hover/item:text-indigo-600 dark:text-indigo-400 self-center rtl:rotate-180 transition-colors" />
                                          )}
                                      </Link>

                                      {child.children &&
                                        child.children.length > 0 && (
                                          <div className="hidden group-hover/item:block absolute left-full top-0 ml-2 rtl:right-full rtl:left-auto rtl:mr-2 rtl:ml-0 min-w-[16rem] w-max bg-white dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/40 dark:border-slate-800/80 p-2 z-50 animate-in fade-in-0 slide-in-from-left-2 rtl:slide-in-from-right-2">
                                            {/* Invisible bridge to prevent menu closing on gap hover */}
                                            <div className="absolute top-0 -left-2 w-2 h-full rtl:left-auto rtl:-right-2" />

                                            <div className="grid gap-1">
                                              {child.children.map(
                                                (grandchild) => (
                                                  <Link
                                                    key={`${t(grandchild.i18nKey)}-${grandchild.href}`}
                                                    href={grandchild.href}
                                                    className="group/child flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 transition-all duration-200"
                                                    onClick={closeDropdown}
                                                  >
                                                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center border border-indigo-100/60 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-300 group-hover/child:scale-110 transition-transform">
                                                      {grandchild.icon}
                                                    </div>
                                                    <div>
                                                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover/child:text-indigo-600 dark:group-hover/child:text-indigo-300 transition-colors">
                                                        {t(grandchild.i18nKey)}
                                                      </p>
                                                      {grandchild.i18nDescriptionKey && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                          {t(
                                                            grandchild.i18nDescriptionKey,
                                                          )}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </Link>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          className={`group relative flex items-center gap-1.5 px-2.5 2xl:px-3 py-1.5 2xl:py-2 rounded-xl font-semibold text-xs 2xl:text-sm whitespace-nowrap shrink-0 transition-all duration-300 ${
                            isActivePath(item.href, item)
                              ? "text-white bg-indigo-600 shadow-sm"
                              : "text-foreground/80 hover:text-indigo-700 hover:bg-white/50 dark:hover:bg-slate-800/50"
                          } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                          role="menuitem"
                        >
                          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 2xl:[&>svg]:w-5 2xl:[&>svg]:h-5 text-foreground/80 group-hover:text-indigo-700 dark:text-indigo-300">
                            {item.icon}
                          </span>
                          <span className="whitespace-nowrap">
                            {t(item.i18nKey, {}, item.name)}
                          </span>
                          {item.badge && (
                            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full shadow-sm">
                              {item.badge === "Popular"
                                ? t("nav.badges.popular")
                                : item.badge === "New"
                                  ? t("nav.badges.new")
                                  : item.badge === "Coming Soon"
                                    ? t("nav.badges.comingSoon")
                                    : item.badge === "Beta"
                                      ? t("nav.badges.beta")
                                      : item.badge}
                            </span>
                          )}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Desktop Auth & Search */}
            <div className="hidden xl:flex items-center gap-1.5 2xl:gap-2 shrink-0 z-10">
              {/* Desktop Search Trigger Button (shown only when not in compact pill mode) */}
              {chromeSpec.navbar !== "compact" && (
                <button
                  ref={searchTriggerRef}
                  type="button"
                  data-testid="desktop-search-trigger"
                  onClick={() => setIsDesktopSearchOpen(true)}
                  aria-label={t("search.openSearch") || "Search"}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-border hover:border-indigo-200 dark:border-indigo-800/80 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Search className="h-4 w-4 text-foreground/80 group-hover:scale-110 transition-transform" />
                </button>
              )}

              <LanguageSwitcher />
              {authLoading ? (
                /* Skeleton placeholder while auth state is being verified */
                <div className="flex items-center gap-2 animate-pulse">
                  <div className="w-20 h-9 bg-gray-200 dark:bg-slate-800/90 rounded-xl" />
                  <div className="w-10 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
                </div>
              ) : isAuthenticated && user ? (
                <>
                  {/* Notifications with Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      aria-label={t("notifications.bellLabel")}
                      onClick={() => {
                        if (isAuthenticated) {
                          setNotificationDropdown(!notificationDropdown);
                          setActiveDropdown(null);
                          setSearchOpen(false);
                        }
                      }}
                      className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-border hover:border-indigo-200 dark:border-indigo-800/80 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-200 group"
                    >
                      <Bell className="h-4 w-4 text-foreground/80 group-hover:scale-110 transition-transform" />

                      {/* Animated notification badge */}
                      {unreadCount > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-[5px] end-[6px] flex items-center justify-center"
                        >
                          <span
                            className="absolute w-3 h-3 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full
                      shadow-[0_8px_16px_rgba(0,0,0,0.06)]
                      animate-pulse"
                          ></span>
                          <span className="relative text-[10px] font-bold text-white px-1 min-w-[16px] h-4 bg-gradient-to-r from-rose-600 to-pink-600 rounded-full flex items-center justify-center shadow-xs">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        </motion.div>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {notificationDropdown && (
                      <NotificationDropdown
                        isOpen={notificationDropdown}
                        onClose={() => setNotificationDropdown(false)}
                        notifications={notifications}
                        unreadCount={unreadCount}
                        loading={loadingNotifications}
                        error={notificationError}
                        onMarkAsRead={(id) => markAsReadMutate(id)}
                        onMarkAllAsRead={() => markAllAsReadMutate()}
                      />
                    )}
                  </div>

                  {/* Workspace Switcher */}
                  <WorkspaceSwitcher className="hidden sm:inline-block" />

                  {/* User Menu */}
                  <div
                    className="relative shrink-0"
                    onMouseEnter={() => openDropdown("user")}
                    onMouseLeave={closeDropdown}
                  >
                    <Link
                      href="/profile/me"
                      aria-haspopup="true"
                      aria-expanded={activeDropdown === "user"}
                      className="flex items-center justify-center gap-1.5 p-1 ps-2 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-slate-800 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 group"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0" />
                      <div className="relative shrink-0">
                        {user.profilePictureUrl ? (
                          <div className="w-9 h-9">
                            <UserAvatar
                              src={user.profilePictureUrl}
                              alt={user.fullName || "User"}
                              size={36}
                              className="shadow-sm ring-2 ring-white dark:ring-slate-900"
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm ring-2 ring-white dark:ring-slate-900 transition-transform duration-200 group-hover:scale-105">
                            {user.fullName?.[0] || user.email?.[0] || "U"}
                          </div>
                        )}
                        <div className="absolute bottom-0 end-0 w-2.5 h-2.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full border-2 border-white shadow-sm"></div>
                      </div>
                    </Link>

                    {activeDropdown === "user" && (
                      <div
                        role="menu"
                        aria-label={t("auth.userMenu")}
                        onMouseEnter={() => openDropdown("user")}
                        onMouseLeave={closeDropdown}
                        className="
                      absolute end-0 mt-2 min-w-[18rem] w-max max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl
                      rounded-2xl border border-white/40 shadow-xl
                      z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden
                    "
                      >
                        {/* Header */}
                        <div className="flex items-center p-4 pb-3 border-b border-gray-100 dark:border-slate-800/70">
                          {user.profilePictureUrl ? (
                            <div className="w-12 h-12 flex-shrink-0">
                              <UniversalImage
                                src={user.profilePictureUrl}
                                alt={user.fullName || "User"}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-xl object-cover shadow-sm"
                                fallback={
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-sm text-lg">
                                    {user.fullName?.[0] ||
                                      user.email?.[0] ||
                                      "U"}
                                  </div>
                                }
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-sm flex-shrink-0 text-lg">
                              {user.fullName?.[0] || user.email?.[0] || "U"}
                            </div>
                          )}
                          <div className="ms-3 flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                              {user.fullName || "User"}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                            <div className="flex items-center space-x-1.5 mt-1">
                              <span className="px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white capitalize">
                                {t(`auth.roles.${user.role?.toLowerCase()}`)}
                              </span>
                              <span className="text-muted-foreground/70 text-[10px]">
                                •
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {t("auth.statusActive")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Links */}
                        <nav className="py-1">
                          {[
                            {
                              icon: <LayoutDashboard className="h-4 w-4" />,
                              label: t("auth.dashboard"),
                              href: "/dashboard",
                            },
                            {
                              icon: <User className="h-4 w-4" />,
                              label: t("auth.profile"),
                              href: "/profile",
                            },
                            {
                              icon: <Settings className="h-4 w-4" />,
                              label: t("auth.accountSettings"),
                              href: "/settings",
                            },
                            {
                              icon: <Smartphone className="h-4 w-4" />,
                              label: t("auth.devicesSecurity"),
                              href: "/settings/devices",
                            },
                            {
                              icon: <CreditCard className="h-4 w-4" />,
                              label: t("auth.billing"),
                              href: "/billing",
                            },
                            {
                              icon: <HelpCircle className="h-4 w-4" />,
                              label: t("auth.helpSupport"),
                              href: "/help",
                            },
                            ...(user?.role === "ADMIN"
                              ? [
                                  {
                                    icon: <Shield className="h-4 w-4" />,
                                    label: t("auth.adminPanel"),
                                    href: "/admin",
                                  },
                                ]
                              : []),
                            ...(user?.role === "INSTRUCTOR"
                              ? [
                                  {
                                    icon: <GraduationCap className="h-4 w-4" />,
                                    label: t("auth.instructorDashboard"),
                                    href: "/learn/manage",
                                  },
                                ]
                              : []),
                          ].map((item, i, arr) => (
                            <Link
                              key={item.label}
                              href={item.href}
                              onClick={closeDropdown}
                              className={`
                            group flex items-center gap-3 px-4 py-2
                            text-[13px] font-medium text-slate-700 dark:text-slate-200
                            hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 transition-all duration-150
                            ${i !== arr.length - 1 ? "border-b border-gray-100/60 dark:border-slate-800/60 last:border-none" : ""}
                          `}
                            >
                              <span className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </Link>
                          ))}

                          <div className="px-4 py-2.5 border-t border-gray-100/60 dark:border-slate-800/60 flex items-center justify-center gap-4 text-center">
                            <span className="text-xs font-medium text-muted-foreground shrink-0">
                              {t("auth.theme.title")}
                            </span>
                            <div
                              role="radiogroup"
                              aria-label={t("auth.theme.title")}
                              className="inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200/50 dark:border-slate-700/50"
                            >
                              <button
                                type="button"
                                role="radio"
                                aria-checked={theme === "light"}
                                onClick={() => setTheme("light")}
                                className={`p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                                  theme === "light"
                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={t("auth.theme.light")}
                              >
                                <Sun className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={theme === "system"}
                                onClick={() => setTheme("system")}
                                className={`p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                                  theme === "system"
                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={t("auth.theme.system")}
                              >
                                <Monitor className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                role="radio"
                                aria-checked={theme === "dark"}
                                onClick={() => setTheme("dark")}
                                className={`p-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                                  theme === "dark"
                                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={t("auth.theme.dark")}
                              >
                                <Moon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </nav>

                        {/* Footer */}
                        <div className="p-2.5 bg-slate-50/80 dark:bg-slate-900/80 border-t border-gray-100 dark:border-slate-800">
                          <PodaciumButton
                            variant="ghost"
                            fullWidth
                            onClick={handleLogout}
                            className="h-8 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700"
                            icon={
                              <LogOut className="h-4 w-4 rtl:scale-x-[-1] text-rose-600 dark:text-rose-400" />
                            }
                          >
                            <span>{t("auth.signOut")}</span>
                          </PodaciumButton>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-white/80 dark:hover:bg-slate-800/80 border border-transparent hover:border-gray-200 dark:hover:border-slate-800 hover:shadow-sm transition-all duration-200 whitespace-nowrap"
                  >
                    {t("auth.signIn")}
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_0_6px_rgba(255,255,255,0.9),0_0_0_8px_rgba(255,255,255,0.4)] dark:shadow-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                  >
                    {t("auth.getStarted")}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Action Controls & Hamburger */}
            <div className="xl:hidden flex items-center gap-2">
              {/* Mobile Notifications Bell */}
              {isAuthenticated && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label={t("notifications.bellLabel")}
                    onClick={() =>
                      setNotificationDropdown(!notificationDropdown)
                    }
                    className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 border border-border text-foreground/80 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 end-1 flex items-center justify-center min-w-[14px] h-3.5 text-[9px] font-bold text-white px-1 bg-red-600 rounded-full shadow-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Mobile */}
                  {notificationDropdown && (
                    <NotificationDropdown
                      isOpen={notificationDropdown}
                      onClose={() => setNotificationDropdown(false)}
                      notifications={notifications}
                      unreadCount={unreadCount}
                      loading={loadingNotifications}
                      error={notificationError}
                      onMarkAsRead={(id) => markAsReadMutate(id)}
                      onMarkAllAsRead={() => markAllAsReadMutate()}
                    />
                  )}
                </div>
              )}

              {/* Mobile Sign In for Guests */}
              {!isAuthenticated && (
                <Link
                  href="/auth/login"
                  className="px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl hover:bg-indigo-100 transition-colors min-h-[44px] flex items-center justify-center"
                >
                  {t("auth.signIn")}
                </Link>
              )}

              {/* Mobile Hamburger Toggle */}
              <button
                className="w-11 h-11 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-border rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={t("nav.toggleMenu")}
                aria-expanded={isMenuOpen}
                onClick={() => {
                  if (chromeSpec.hasSpine) {
                    window.dispatchEvent(
                      new CustomEvent("toggle-workspace-drawer"),
                    );
                  } else {
                    setIsMenuOpen(!isMenuOpen);
                  }
                }}
              >
                <div className="relative w-5 h-5">
                  <span
                    className={`absolute top-1/2 left-1/2 w-5 h-0.5 bg-gray-700 dark:bg-slate-200 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                      isMenuOpen ? "rotate-45" : "-translate-y-1.5"
                    }`}
                  ></span>
                  <span
                    className={`absolute top-1/2 left-1/2 w-5 h-0.5 bg-gray-700 dark:bg-slate-200 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                      isMenuOpen ? "opacity-0" : "opacity-100"
                    }`}
                  ></span>
                  <span
                    className={`absolute top-1/2 left-1/2 w-5 h-0.5 bg-gray-700 dark:bg-slate-200 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                      isMenuOpen ? "-rotate-45" : "translate-y-1.5"
                    }`}
                  ></span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Mobile Menu Drawer */}
        {isMenuOpen && chromeSpec.navbar !== "focus" && (
          <div className="xl:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-100 dark:border-slate-800 rounded-b-[2rem] max-h-[75vh] overflow-y-auto overscroll-contain animate-in slide-in-from-top-4 duration-300 shadow-2xl">
            <nav
              className="max-w-8xl mx-auto px-6 py-6"
              aria-label="Mobile Navigation"
            >
              {/* Mobile Search */}
              <div className="relative mb-6">
                <input
                  type="text"
                  placeholder={t("search.placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      router.push(
                        `/search/?q=${encodeURIComponent(searchQuery.trim())}`,
                      );
                      setIsMenuOpen(false);
                    }
                  }}
                  className="w-full ps-12 pe-4 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-indigo-200 dark:border-indigo-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-lg"
                />
                <div className="absolute start-4 top-1/2 transform -translate-y-1/2">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {/* Mobile language selector */}
              <div className="mb-6">
                <LanguageSwitcher />
              </div>

              <ul className="space-y-2">
                {navigation.map((item) => (
                  <li
                    key={item.name}
                    className="border-b border-gray-100 dark:border-slate-800 last:border-b-0"
                  >
                    {item.children ? (
                      <div className="group">
                        <div className="flex items-center justify-between">
                          <Link
                            href={item.href}
                            className="flex-1 flex items-center space-x-3 py-4 text-foreground font-semibold text-base hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <span className="text-foreground/80">
                              {item.icon}
                            </span>
                            <span>{t(item.i18nKey)}</span>
                            {item.badge && (
                              <span
                                className={getBadgeClass(item.badge, "pill")}
                              >
                                {item.badge === "Popular"
                                  ? t("nav.badges.popular")
                                  : item.badge === "New"
                                    ? t("nav.badges.new")
                                    : item.badge === "Coming Soon"
                                      ? t("nav.badges.comingSoon")
                                      : item.badge === "Beta"
                                        ? t("nav.badges.beta")
                                        : item.badge}
                              </span>
                            )}
                          </Link>
                          {item.children && item.children.length > 0 && (
                            <button
                              onClick={() =>
                                setActiveDropdown(
                                  activeDropdown === item.name
                                    ? null
                                    : item.name,
                                )
                              }
                              className="p-2 rounded-lg hover:bg-secondary/80 transition-colors duration-200"
                              aria-label={t("toggleSubmenu", {
                                name: t(item.i18nKey) || item.name,
                              })}
                            >
                              <ChevronDown
                                className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${activeDropdown === item.name ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </div>

                        {activeDropdown === item.name && (
                          <ul className="mt-1 ps-11 space-y-3 pb-3">
                            {item.children.map((child) => {
                              const isComingSoon = child.comingSoon;

                              if (isComingSoon) {
                                return (
                                  <li key={t(child.i18nKey)}>
                                    <div
                                      className="flex items-start gap-3.5 p-3 rounded-xl bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-slate-50/80 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-slate-900/80 border border-purple-200/70 dark:border-purple-800/50 relative cursor-not-allowed select-none transition-all shadow-xs"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      title={t("nav.comingSoonTitle")}
                                    >
                                      <div className="relative flex-shrink-0 mt-0.5">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-xl flex items-center justify-center shadow-xs">
                                          {child.icon}
                                        </div>
                                        <div className="absolute -bottom-1 -end-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-xs">
                                          <Lock className="h-2.5 w-2.5 text-white" />
                                        </div>
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                            {t(child.i18nKey)}
                                          </span>
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/30 flex-shrink-0">
                                            <span className="relative flex h-1.5 w-1.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                            </span>
                                            {t("nav.comingSoonBadge")}
                                          </span>
                                        </div>
                                        {child.i18nDescriptionKey && (
                                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                            {t(child.i18nDescriptionKey)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                );
                              }

                              return (
                                <li key={t(child.i18nKey)}>
                                  <Link
                                    href={child.href}
                                    className="flex items-center gap-3 py-2 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors duration-200 group"
                                    onClick={() => setIsMenuOpen(false)}
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100/60 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 group-hover:scale-105 transition-transform flex-shrink-0">
                                      {child.icon}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                          {t(child.i18nKey)}
                                        </span>
                                        {child.badge && (
                                          <span
                                            className={getBadgeClass(
                                              child.badge,
                                              "pill",
                                            )}
                                          >
                                            {child.badge === "Popular"
                                              ? t("nav.badges.popular")
                                              : child.badge === "New"
                                                ? t("nav.badges.new")
                                                : child.badge === "Coming Soon"
                                                  ? t("nav.badges.comingSoon")
                                                  : child.badge === "Beta"
                                                    ? t("nav.badges.beta")
                                                    : child.badge}
                                          </span>
                                        )}
                                      </div>
                                      {child.i18nDescriptionKey && (
                                        <p className="text-sm text-muted-foreground">
                                          {t(child.i18nDescriptionKey)}
                                        </p>
                                      )}
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 py-4 text-foreground font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-200 group"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <span className="text-foreground/80 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                          {item.icon}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span>{t(item.i18nKey)}</span>
                          {item.badge && (
                            <span className={getBadgeClass(item.badge, "pill")}>
                              {item.badge === "Popular"
                                ? t("nav.badges.popular")
                                : item.badge === "New"
                                  ? t("nav.badges.new")
                                  : item.badge === "Coming Soon"
                                    ? t("nav.badges.comingSoon")
                                    : item.badge === "Beta"
                                      ? t("nav.badges.beta")
                                      : item.badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>

              {/* Mobile Auth Section */}
              <div className="mt-8 border-t border-border pt-8">
                {authLoading ? (
                  /* Skeleton placeholder while auth state is being verified (mobile) */
                  <div className="space-y-3 animate-pulse">
                    <div className="flex items-center space-x-4 p-4 bg-gray-100 dark:bg-slate-800/60 rounded-2xl">
                      <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-slate-800/80" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-slate-800/80 rounded w-32" />
                        <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded w-48" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-2xl" />
                      <div className="h-12 bg-gray-200 dark:bg-slate-800/90 rounded-2xl" />
                    </div>
                  </div>
                ) : isAuthenticated && user ? (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                      <div className="relative">
                        {user.profilePictureUrl ? (
                          <div className="w-14 h-14">
                            <UniversalImage
                              src={user.profilePictureUrl}
                              alt={user.fullName || "User"}
                              width={56}
                              height={56}
                              className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                              fallback={
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                  {user.fullName?.[0] || user.email?.[0] || "U"}
                                </div>
                              }
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {user.fullName?.[0] || user.email?.[0] || "U"}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full border-2 border-white shadow-sm"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-lg truncate">
                          {user.fullName || "User"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full capitalize">
                            {t(
                              `auth.roles.${user.role?.toLowerCase()}`,
                              undefined,
                              user.role?.toLowerCase() || "member",
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href="/dashboard"
                        className="flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/40 hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <LayoutDashboard className="h-5 w-5" />
                        <span>{t("auth.dashboard")}</span>
                      </Link>
                      <Link
                        href="/profile/me"
                        className="flex items-center justify-center space-x-2 py-3 bg-background border border-border text-foreground/80 font-semibold rounded-2xl hover:border-border/80 hover:shadow-lg transition-all duration-300"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <User className="h-5 w-5" />
                        <span>{t("auth.profile")}</span>
                      </Link>
                      <Link
                        href="/settings"
                        className="flex items-center justify-center space-x-2 py-3 bg-background border border-border text-foreground/80 font-semibold rounded-2xl hover:border-border/80 hover:shadow-lg transition-all duration-300"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Settings className="h-5 w-5" />
                        <span>{t("auth.accountSettings")}</span>
                      </Link>
                      <Link
                        href="/billing"
                        className="flex items-center justify-center space-x-2 py-3 bg-background border border-border text-foreground/80 font-semibold rounded-2xl hover:border-border/80 hover:shadow-lg transition-all duration-300"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span>{t("auth.billing")}</span>
                      </Link>
                      <div className="col-span-2 flex items-center justify-center gap-4 px-4 py-2.5 bg-background border border-border rounded-2xl text-center">
                        <span className="text-xs font-semibold text-foreground shrink-0">
                          {t("auth.theme.title")}
                        </span>
                        <div
                          role="radiogroup"
                          aria-label={t("auth.theme.title")}
                          className="inline-flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200/50 dark:border-slate-700/50"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={theme === "light"}
                            onClick={() => setTheme("light")}
                            className={`p-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${
                              theme === "light"
                                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Sun className="h-4 w-4" />
                            <span>{t("auth.theme.light")}</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={theme === "system"}
                            onClick={() => setTheme("system")}
                            className={`p-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${
                              theme === "system"
                                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Monitor className="h-4 w-4" />
                            <span>{t("auth.theme.system")}</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={theme === "dark"}
                            onClick={() => setTheme("dark")}
                            className={`p-2 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${
                              theme === "dark"
                                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Moon className="h-4 w-4" />
                            <span>{t("auth.theme.dark")}</span>
                          </button>
                        </div>
                      </div>
                      {user?.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          className="col-span-2 flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white font-semibold rounded-2xl shadow-lg hover:bg-gray-700 transition-all duration-300"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <Shield className="h-5 w-5 text-white/90" />
                          <span>{t("auth.adminPanel")}</span>
                        </Link>
                      )}
                      {user?.role === "INSTRUCTOR" && (
                        <Link
                          href="/learn/manage"
                          className="col-span-2 flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-semibold rounded-2xl shadow-lg hover:opacity-90 transition-all duration-300"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <GraduationCap className="h-5 w-5 text-white/90" />
                          <span>{t("auth.instructorDashboard")}</span>
                        </Link>
                      )}
                      <PodaciumButton
                        variant="destructive"
                        fullWidth
                        className="col-span-2 h-12 rounded-2xl font-semibold"
                        onClick={() => {
                          handleLogout();
                          setIsMenuOpen(false);
                        }}
                        icon={<LogOut className="h-5 w-5 rtl:scale-x-[-1]" />}
                      >
                        <span>{t("auth.signOut")}</span>
                      </PodaciumButton>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/auth/login"
                      className="flex items-center justify-center space-x-2 py-4 bg-background border border-border text-foreground/80 font-semibold rounded-2xl hover:border-border/80 hover:shadow-lg transition-all duration-300 text-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Key className="h-5 w-5" />
                      <span>{t("auth.signIn")}</span>
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="flex items-center justify-center space-x-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/40 hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-center"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Rocket className="h-5 w-5" />
                      <span>{t("auth.getStarted")}</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Additional Links */}
              <div className="mt-8 border-t border-border pt-8">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground text-sm">
                  {[
                    {
                      icon: <HelpCircle className="h-4 w-4" />,
                      label: t("auth.helpSupport"),
                      href: "/help",
                    },
                    {
                      icon: <FileText className="h-4 w-4" />,
                      label: t("footer.sections.userSupport.documentation"),
                      href: "/docs",
                    },
                    {
                      icon: <PenSquare className="h-4 w-4" />,
                      label: t("footer.sections.companyInfo.blog"),
                      href: "/blog",
                    },
                    {
                      icon: <CircleCheck className="h-4 w-4" />,
                      label: t("footer.sections.userSupport.status"),
                      href: "/status",
                    },
                    {
                      icon: <Building2 className="h-4 w-4" />,
                      label: t("footer.sections.companyInfo.about"),
                      href: "/about",
                    },
                    {
                      icon: <Phone className="h-4 w-4" />,
                      label: t("nav.contact"),
                      href: "/contact",
                    },
                    {
                      icon: <Shield className="h-4 w-4" />,
                      label: t("footer.links.privacy"),
                      href: "/privacy",
                    },
                    {
                      icon: <Scale className="h-4 w-4" />,
                      label: t("footer.links.terms"),
                      href: "/terms",
                    },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center space-x-2 py-2 hover:text-indigo-700 dark:text-indigo-300 transition-colors duration-200 group"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="text-muted-foreground group-hover:text-indigo-700 dark:text-indigo-300">
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-8 border-t border-border pt-8">
                <div className="flex items-center justify-center space-x-6">
                  {[
                    { icon: <Twitter className="h-5 w-5" />, label: "Twitter" },
                    {
                      icon: <Linkedin className="h-5 w-5" />,
                      label: "LinkedIn",
                    },
                    { icon: <Github className="h-5 w-5" />, label: "GitHub" },
                    {
                      icon: <MessageCircle className="h-5 w-5" />,
                      label: "Discord",
                    },
                  ].map((social) => (
                    <button
                      key={social.label}
                      className="w-12 h-12 flex items-center justify-center bg-background border border-border rounded-2xl hover:border-indigo-300 dark:border-indigo-700 hover:shadow-lg transition-all duration-300 group"
                      aria-label={social.label}
                    >
                      <span className="text-foreground/80 group-hover:text-indigo-700 dark:text-indigo-300 group-hover:scale-110 transition-transform duration-200">
                        {social.icon}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
