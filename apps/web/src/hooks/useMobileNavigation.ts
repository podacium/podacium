"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/api/types";
import {
  Home,
  BookOpen,
  Briefcase,
  BarChart3,
  User,
  Plus,
  Search,
  FileText,
  Video,
  Upload,
  Layers,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Award,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: any;
  isActive: boolean;
  isFab?: boolean;
}

export interface FabAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  badge?: string;
  color?: string;
}

export function useMobileNavigation() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const t = useTranslations("nav");
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeAuth = mounted ? isAuthenticated : false;
  const activeRole = mounted ? user?.role : undefined;

  // Detect active section context from route
  const activeContext = useMemo(() => {
    if (pathname.startsWith("/learn")) return "learn";
    if (pathname.startsWith("/hub")) return "hub";
    if (pathname.startsWith("/bi")) return "bi";
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/settings")
    )
      return "portal";
    return "general";
  }, [pathname]);

  // Handle scroll direction with threshold
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;
      if (Math.abs(scrollY - lastScrollY) < 15) {
        ticking = false;
        return;
      }
      if (scrollY > 60 && scrollY > lastScrollY) {
        setIsScrolledDown(true);
      } else {
        setIsScrolledDown(false);
      }
      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Compute 5-Slot Bottom Navigation Items based on UserRole & Pathname
  const bottomNavItems = useMemo<NavItem[]>(() => {
    const role = activeRole;

    // Slot 1: Home / Feed
    const slot1: NavItem = {
      id: "home",
      name: t("home"),
      href: "/",
      icon: Home,
      isActive:
        pathname === "/" ||
        pathname === "/en" ||
        pathname === "/fr" ||
        pathname === "/ar" ||
        pathname === "/kab",
    };

    // Slot 5: Profile / Dashboard / Auth
    const slot5: NavItem = activeAuth
      ? {
          id: "profile",
          name: t("profile"),
          href: "/dashboard",
          icon: User,
          isActive:
            pathname.startsWith("/dashboard") ||
            pathname.startsWith("/profile") ||
            pathname.startsWith("/settings"),
        }
      : {
          id: "login",
          name: t("login"),
          href: "/auth/login",
          icon: User,
          isActive: pathname.startsWith("/auth/login"),
        };

    // Slot 3: CENTER PROMINENT FAB (+)
    const slot3: NavItem = {
      id: "fab",
      name: t("create"),
      href: "#create",
      icon: Plus,
      isActive: isActionSheetOpen,
      isFab: true,
    };

    // Role Specific Slot 2 & Slot 4
    let slot2: NavItem;
    let slot4: NavItem;

    if (role === UserRole.FREELANCER) {
      slot2 = {
        id: "projects",
        name: t("jobs"),
        href: "/hub/projects",
        icon: Briefcase,
        isActive: pathname.startsWith("/hub/projects"),
      };
      slot4 = {
        id: "contracts",
        name: t("contracts"),
        href: "/hub/contracts",
        icon: FileText,
        isActive: pathname.startsWith("/hub/contracts"),
      };
    } else if (role === UserRole.BUSINESS) {
      slot2 = {
        id: "contracts",
        name: t("myHires"),
        href: "/hub/contracts",
        icon: Briefcase,
        isActive: pathname.startsWith("/hub/contracts"),
      };
      slot4 = {
        id: "dashboards",
        name: t("bi"),
        href: "/bi/dashboards",
        icon: BarChart3,
        isActive: pathname.startsWith("/bi"),
      };
    } else if (role === UserRole.INSTRUCTOR) {
      slot2 = {
        id: "myCourses",
        name: t("teaching"),
        href: "/learn/manage",
        icon: GraduationCap,
        isActive: pathname.startsWith("/learn/manage"),
      };
      slot4 = {
        id: "paths",
        name: t("paths"),
        href: "/learn/paths",
        icon: Layers,
        isActive: pathname.startsWith("/learn/paths"),
      };
    } else if (role === UserRole.ADMIN) {
      slot2 = {
        id: "admin",
        name: t("admin"),
        href: "/admin",
        icon: ShieldCheck,
        isActive: pathname.startsWith("/admin"),
      };
      slot4 = {
        id: "dashboards",
        name: t("bi"),
        href: "/bi/dashboards",
        icon: BarChart3,
        isActive: pathname.startsWith("/bi"),
      };
    } else {
      // Student / Default / Guest
      slot2 = {
        id: "learn",
        name: t("learning"),
        href: "/learn",
        icon: BookOpen,
        isActive: pathname.startsWith("/learn"),
      };
      slot4 = {
        id: "hub",
        name: t("hub"),
        href: "/hub",
        icon: Briefcase,
        isActive: pathname.startsWith("/hub"),
      };
    }

    return [slot1, slot2, slot3, slot4, slot5];
  }, [activeRole, activeAuth, pathname, isActionSheetOpen, t]);

  // Compute Context-Sensitive Actions for Central FAB (+)
  const fabActions = useMemo<FabAction[]>(() => {
    const role = activeRole;

    if (role === UserRole.BUSINESS) {
      return [
        {
          id: "post_project",
          title: t("actions.postProject"),
          description: t("actions.postProjectDesc"),
          href: "/hub/projects/new",
          icon: Briefcase,
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "upload_dataset",
          title: t("actions.uploadDataset"),
          description: t("actions.uploadDatasetDesc"),
          href: "/bi/datasets/upload",
          icon: Upload,
          color: "from-indigo-600 to-purple-600",
        },
        {
          id: "new_dashboard",
          title: t("actions.createDashboard"),
          description: t("actions.createDashboardDesc"),
          href: "/bi/dashboards/new",
          icon: BarChart3,
          color: "from-purple-600 to-pink-600",
        },
      ];
    }

    if (role === UserRole.INSTRUCTOR) {
      return [
        {
          id: "create_course",
          title: t("actions.createCourse"),
          description: t("actions.createCourseDesc"),
          href: "/learn/create",
          icon: GraduationCap,
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "explore_paths",
          title: t("actions.explorePaths"),
          description: t("actions.explorePathsDesc"),
          href: "/learn/paths",
          icon: Layers,
          color: "from-emerald-600 to-teal-600",
        },
        {
          id: "add_lesson",
          title: t("actions.addLesson"),
          description: t("actions.addLessonDesc"),
          href: "/learn/create/lesson",
          icon: Layers,
          color: "from-indigo-600 to-purple-600",
        },
      ];
    }

    if (role === UserRole.FREELANCER) {
      return [
        {
          id: "browse_projects",
          title: t("actions.findWork"),
          description: t("actions.findWorkDesc"),
          href: "/hub/projects",
          icon: Briefcase,
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "my_proposals",
          title: t("actions.viewProposals"),
          description: t("actions.viewProposalsDesc"),
          href: "/hub/proposals",
          icon: FileText,
          color: "from-indigo-600 to-purple-600",
        },
        {
          id: "update_profile",
          title: t("actions.updatePortfolio"),
          description: t("actions.updatePortfolioDesc"),
          href: "/profile/me",
          icon: User,
          color: "from-purple-600 to-pink-600",
        },
      ];
    }

    if (role === UserRole.ADMIN) {
      return [
        {
          id: "manage_users",
          title: t("actions.adminUsers"),
          description: t("actions.adminUsersDesc"),
          href: "/admin/users",
          icon: ShieldCheck,
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "audit_logs",
          title: t("actions.adminAudit"),
          description: t("actions.adminAuditDesc"),
          href: "/admin/audit",
          icon: FileText,
          color: "from-indigo-600 to-purple-600",
        },
        {
          id: "platform_metrics",
          title: t("actions.adminMetrics"),
          description: t("actions.adminMetricsDesc"),
          href: "/admin/metrics",
          icon: BarChart3,
          color: "from-purple-600 to-pink-600",
        },
      ];
    }

    if (role === UserRole.STUDENT) {
      return [
        {
          id: "my_courses",
          title: t("actions.studentCourses"),
          description: t("actions.studentCoursesDesc"),
          href: "/learn/courses",
          icon: BookOpen,
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "my_paths",
          title: t("actions.studentPaths"),
          description: t("actions.studentPathsDesc"),
          href: "/learn/paths",
          icon: Layers,
          color: "from-indigo-600 to-purple-600",
        },
        {
          id: "my_certificates",
          title: t("actions.studentCertificates"),
          description: t("actions.studentCertificatesDesc"),
          href: "/dashboard/certificates",
          icon: Award,
          color: "from-purple-600 to-pink-600",
        },
      ];
    }

    // Default Actions (Guest / Unauthenticated)
    return [
      {
        id: "explore_courses",
        title: t("actions.exploreCourses"),
        description: t("actions.exploreCoursesDesc"),
        href: "/learn/courses",
        icon: BookOpen,
        badge: t("badges.popular"),
        color: "from-blue-600 to-indigo-600",
      },
      {
        id: "hire_freelancers",
        title: t("actions.hireTalent"),
        description: t("actions.hireTalentDesc"),
        href: "/hub/freelancers",
        icon: Briefcase,
        color: "from-indigo-600 to-purple-600",
      },
      {
        id: "ai_insights",
        title: t("actions.aiInsights"),
        description: t("actions.aiInsightsDesc"),
        href: "/bi",
        icon: BarChart3,
        color: "from-purple-600 to-pink-600",
      },
    ];
  }, [activeRole, t]);

  return {
    userRole: user?.role,
    activeContext,
    bottomNavItems,
    fabActions,
    isScrolledDown,
    isActionSheetOpen,
    setIsActionSheetOpen,
    toggleActionSheet: () => setIsActionSheetOpen((prev) => !prev),
    closeActionSheet: () => setIsActionSheetOpen(false),
  };
}
