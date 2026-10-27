import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Briefcase,
  BarChart3,
  Settings,
  Shield,
  Users,
  KeyRound,
  Activity,
  FileText,
  TrendingUp,
  Radio,
  CreditCard,
  Smartphone,
  Bell,
  Lock,
  FolderTree,
  Video,
  Layers,
  Building2,
  CheckSquare,
  User,
  Palette,
  Link2,
  Database,
  PlusCircle,
  Search,
  Mail,
} from "lucide-react";
import type { NavSection } from "./chrome";

// ── Admin Navigation Sections ────────────────────────────────────────────────
export const ADMIN_SECTIONS: readonly NavSection[] = [
  {
    id: "overview",
    labelKey: "admin.sections.overview",
    items: [
      {
        id: "admin-dashboard",
        labelKey: "admin.sidebar.dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "admin-mail",
        labelKey: "admin.sidebar.mail",
        href: "/admin/mail",
        icon: Mail,
        match: "prefix",
      },
      {
        id: "admin-analytics",
        labelKey: "admin.sidebar.analytics",
        href: "/admin/analytics",
        icon: TrendingUp,
        match: "prefix",
      },
    ],
  },
  {
    id: "content",
    labelKey: "admin.sections.content",
    items: [
      {
        id: "admin-content-review",
        labelKey: "admin.sidebar.contentReview",
        href: "/admin/content-review",
        icon: CheckSquare,
        match: "prefix",
      },
      {
        id: "admin-paths",
        labelKey: "admin.sidebar.paths",
        href: "/admin/paths",
        icon: FolderTree,
        match: "prefix",
      },
      {
        id: "admin-courses",
        labelKey: "admin.sidebar.courses",
        href: "/admin/courses",
        icon: GraduationCap,
        match: "prefix",
      },
      {
        id: "admin-lessons",
        labelKey: "admin.sidebar.lessons",
        href: "/admin/lessons",
        icon: BookOpen,
        match: "prefix",
      },
      {
        id: "admin-quizzes",
        labelKey: "admin.sidebar.quizzes",
        href: "/admin/quizzes",
        icon: Layers,
        match: "prefix",
      },
    ],
  },
  {
    id: "people",
    labelKey: "admin.sections.people",
    items: [
      {
        id: "admin-users",
        labelKey: "admin.sidebar.users",
        href: "/admin/users",
        icon: Users,
        match: "prefix",
      },
      {
        id: "admin-iam",
        labelKey: "admin.sidebar.iam",
        href: "/admin/iam",
        icon: KeyRound,
        match: "prefix",
      },
      {
        id: "admin-orgs",
        labelKey: "admin.sidebar.organizations",
        href: "/admin/organizations",
        icon: Building2,
        match: "prefix",
      },
      {
        id: "admin-enrollments",
        labelKey: "admin.sidebar.enrollments",
        href: "/admin/enrollments",
        icon: CheckSquare,
        match: "prefix",
      },
    ],
  },
  {
    id: "trust",
    labelKey: "admin.sections.trust",
    items: [
      {
        id: "admin-appeals",
        labelKey: "admin.sidebar.appeals",
        href: "/admin/appeals",
        icon: Shield,
        match: "prefix",
      },
      {
        id: "admin-activity",
        labelKey: "admin.sidebar.activityLog",
        href: "/admin/activity-log",
        icon: Activity,
        match: "prefix",
      },
    ],
  },
  {
    id: "growth",
    labelKey: "admin.sections.growth",
    items: [
      {
        id: "admin-waitlist",
        labelKey: "admin.sidebar.waitlist",
        href: "/admin/waitlist",
        icon: Users,
        match: "prefix",
      },
      {
        id: "admin-live",
        labelKey: "admin.sidebar.liveSessions",
        href: "/admin/live-sessions",
        icon: Radio,
        match: "prefix",
      },
    ],
  },
  {
    id: "finance",
    labelKey: "admin.sections.finance",
    items: [
      {
        id: "admin-billing",
        labelKey: "admin.sidebar.billing",
        href: "/admin/billing",
        icon: CreditCard,
        match: "prefix",
      },
    ],
  },
  {
    id: "system",
    labelKey: "admin.sections.system",
    items: [
      {
        id: "admin-settings",
        labelKey: "admin.sidebar.settings",
        href: "/admin/settings",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];

// ── Workspace Navigation Sections (Executive Dashboard) ──────────────────────
// ── Student Workspace Navigation Sections ────────────────────────────────────
export const STUDENT_WORKSPACE_SECTIONS: readonly NavSection[] = [
  {
    id: "student-learning",
    labelKey: "nav.myLearning",
    items: [
      {
        id: "st-dashboard",
        labelKey: "nav.dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "st-courses",
        labelKey: "nav.courses",
        href: "/learn/courses",
        icon: BookOpen,
        match: "prefix",
      },
      {
        id: "st-paths",
        labelKey: "nav.learningPaths",
        href: "/learn/paths",
        icon: GraduationCap,
        match: "prefix",
      },
      {
        id: "st-certificates",
        labelKey: "nav.certificates",
        href: "/learn/certificates",
        icon: Shield,
        match: "prefix",
      },
    ],
  },
  {
    id: "student-live",
    labelKey: "nav.liveSessions",
    items: [
      {
        id: "st-live-sessions",
        labelKey: "nav.liveSessions",
        href: "/live",
        icon: Radio,
        match: "prefix",
      },
    ],
  },
  {
    id: "student-system",
    labelKey: "nav.settings",
    items: [
      {
        id: "st-notifications",
        labelKey: "nav.notifications",
        href: "/notifications",
        icon: Bell,
        match: "prefix",
      },
      {
        id: "st-settings",
        labelKey: "nav.settings",
        href: "/settings/account",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];

// ── Instructor Workspace Navigation Sections ──────────────────────────────────
export const INSTRUCTOR_WORKSPACE_SECTIONS: readonly NavSection[] = [
  {
    id: "instructor-teaching",
    labelKey: "nav.courseAuthoring",
    items: [
      {
        id: "inst-dashboard",
        labelKey: "nav.dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "inst-manage",
        labelKey: "nav.myCourses",
        href: "/learn/manage",
        icon: GraduationCap,
        match: "exact",
      },
      {
        id: "inst-create-course",
        labelKey: "nav.createCourse",
        href: "/learn/create",
        icon: BookOpen,
        match: "exact",
      },
      {
        id: "inst-create-module",
        labelKey: "nav.createModule",
        href: "/learn/create/module",
        icon: Layers,
        match: "prefix",
      },
      {
        id: "inst-create-lesson",
        labelKey: "nav.createLesson",
        href: "/learn/create/lesson",
        icon: Video,
        match: "prefix",
      },
    ],
  },
  {
    id: "instructor-live",
    labelKey: "nav.liveSessions",
    items: [
      {
        id: "inst-live-sessions",
        labelKey: "nav.mySessions",
        href: "/live/my-sessions",
        icon: Radio,
        match: "prefix",
      },
      {
        id: "inst-payouts",
        labelKey: "nav.payouts",
        href: "/live/payouts",
        icon: CreditCard,
        match: "prefix",
      },
    ],
  },
  {
    id: "instructor-system",
    labelKey: "nav.settings",
    items: [
      {
        id: "inst-notifications",
        labelKey: "nav.notifications",
        href: "/notifications",
        icon: Bell,
        match: "prefix",
      },
      {
        id: "inst-settings",
        labelKey: "nav.settings",
        href: "/settings/account",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];

// ── Freelancer Workspace Navigation Sections ─────────────────────────────────
export const FREELANCER_WORKSPACE_SECTIONS: readonly NavSection[] = [
  {
    id: "freelancer-work",
    labelKey: "nav.clientWork",
    items: [
      {
        id: "fl-dashboard",
        labelKey: "nav.dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "fl-contracts",
        labelKey: "nav.contracts",
        href: "/hub/contracts",
        icon: Briefcase,
        match: "prefix",
      },
      {
        id: "fl-proposals",
        labelKey: "nav.proposals",
        href: "/hub/proposals",
        icon: FileText,
        match: "prefix",
      },
      {
        id: "fl-messages",
        labelKey: "nav.messages",
        href: "/hub/messages",
        icon: Bell,
        match: "prefix",
      },
    ],
  },
  {
    id: "freelancer-explore",
    labelKey: "nav.projects",
    items: [
      {
        id: "fl-projects",
        labelKey: "nav.browseProjects",
        href: "/hub/projects",
        icon: Search,
        match: "prefix",
      },
    ],
  },
  {
    id: "freelancer-system",
    labelKey: "nav.settings",
    items: [
      {
        id: "fl-notifications",
        labelKey: "nav.notifications",
        href: "/notifications",
        icon: Bell,
        match: "prefix",
      },
      {
        id: "fl-settings",
        labelKey: "nav.settings",
        href: "/settings/account",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];

// ── Business Workspace Navigation Sections ───────────────────────────────────
export const BUSINESS_WORKSPACE_SECTIONS: readonly NavSection[] = [
  {
    id: "business-hiring",
    labelKey: "nav.hiring",
    items: [
      {
        id: "biz-dashboard",
        labelKey: "nav.dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        id: "biz-contracts",
        labelKey: "nav.contracts",
        href: "/hub/contracts",
        icon: Briefcase,
        match: "prefix",
      },
      {
        id: "biz-proposals",
        labelKey: "nav.proposals",
        href: "/hub/proposals",
        icon: FileText,
        match: "prefix",
      },
      {
        id: "biz-post",
        labelKey: "nav.postProject",
        href: "/hub/projects/new",
        icon: PlusCircle,
        match: "prefix",
      },
    ],
  },
  {
    id: "business-bi",
    labelKey: "nav.biGovernance",
    items: [
      {
        id: "biz-dashboards",
        labelKey: "nav.dashboards",
        href: "/bi/dashboards",
        icon: BarChart3,
        match: "prefix",
      },
      {
        id: "biz-datasets",
        labelKey: "nav.datasets",
        href: "/bi/datasets",
        icon: Database,
        match: "prefix",
      },
      {
        id: "biz-orgs",
        labelKey: "nav.organizations",
        href: "/bi/organizations",
        icon: Building2,
        match: "prefix",
      },
    ],
  },
  {
    id: "business-system",
    labelKey: "nav.settings",
    items: [
      {
        id: "biz-billing",
        labelKey: "nav.pricing",
        href: "/settings/billing",
        icon: CreditCard,
        match: "prefix",
      },
      {
        id: "biz-notifications",
        labelKey: "nav.notifications",
        href: "/notifications",
        icon: Bell,
        match: "prefix",
      },
    ],
  },
];

// Default backward-compatible fallback
export const WORKSPACE_SECTIONS = STUDENT_WORKSPACE_SECTIONS;

export function getWorkspaceSectionsForRole(
  role?: string,
): readonly NavSection[] {
  switch (role?.toUpperCase()) {
    case "INSTRUCTOR":
      return INSTRUCTOR_WORKSPACE_SECTIONS;
    case "FREELANCER":
      return FREELANCER_WORKSPACE_SECTIONS;
    case "BUSINESS":
      return BUSINESS_WORKSPACE_SECTIONS;
    case "ADMIN":
    case "MODERATOR":
      return ADMIN_SECTIONS;
    case "STUDENT":
    default:
      return STUDENT_WORKSPACE_SECTIONS;
  }
}

// ── Studio Navigation Sections (Instructor Studio) ───────────────────────────
export const STUDIO_SECTIONS: readonly NavSection[] = [
  {
    id: "studio-courses",
    labelKey: "nav.courseAuthoring",
    items: [
      {
        id: "st-manage",
        labelKey: "nav.myCourses",
        href: "/learn/manage",
        icon: GraduationCap,
        match: "exact",
      },
      {
        id: "st-create-course",
        labelKey: "nav.createCourse",
        href: "/learn/create",
        icon: BookOpen,
        match: "exact",
      },
      {
        id: "st-create-module",
        labelKey: "nav.createModule",
        href: "/learn/create/module",
        icon: Layers,
        match: "prefix",
      },
      {
        id: "st-create-lesson",
        labelKey: "nav.createLesson",
        href: "/learn/create/lesson",
        icon: Video,
        match: "prefix",
      },
    ],
  },
  {
    id: "studio-live",
    labelKey: "nav.liveSessions",
    items: [
      {
        id: "st-live-sessions",
        labelKey: "nav.mySessions",
        href: "/live/my-sessions",
        icon: Radio,
        match: "prefix",
      },
      {
        id: "st-payouts",
        labelKey: "nav.payouts",
        href: "/live/payouts",
        icon: CreditCard,
        match: "prefix",
      },
    ],
  },
];

// ── Account Settings Sections (Master-Detail) ────────────────────────────────
export const ACCOUNT_SECTIONS: readonly NavSection[] = [
  {
    id: "account-security",
    labelKey: "settings.groups.accountSecurity",
    items: [
      {
        id: "acc-account",
        labelKey: "settings.tabs.account",
        href: "/settings/account",
        icon: User,
        match: "prefix",
      },
      {
        id: "acc-security",
        labelKey: "settings.tabs.security",
        href: "/settings/security",
        icon: Lock,
        match: "prefix",
      },
      {
        id: "acc-privacy",
        labelKey: "settings.tabs.privacy",
        href: "/settings/privacy",
        icon: Shield,
        match: "prefix",
      },
      {
        id: "acc-devices",
        labelKey: "settings.tabs.devices",
        href: "/settings/devices",
        icon: Smartphone,
        match: "prefix",
      },
    ],
  },
  {
    id: "account-preferences",
    labelKey: "settings.groups.preferences",
    items: [
      {
        id: "acc-notifications",
        labelKey: "settings.tabs.notifications",
        href: "/settings/notifications",
        icon: Bell,
        match: "prefix",
      },
      {
        id: "acc-appearance",
        labelKey: "settings.tabs.appearance",
        href: "/settings/appearance",
        icon: Palette,
        match: "prefix",
      },
      {
        id: "acc-integrations",
        labelKey: "settings.tabs.integrations",
        href: "/settings/integrations",
        icon: Link2,
        match: "prefix",
      },
    ],
  },
  {
    id: "account-billing",
    labelKey: "settings.groups.billingUsage",
    items: [
      {
        id: "acc-billing",
        labelKey: "settings.tabs.billing",
        href: "/settings/billing",
        icon: CreditCard,
        match: "prefix",
      },
      {
        id: "acc-usage",
        labelKey: "settings.tabs.usage",
        href: "/settings/usage",
        icon: BarChart3,
        match: "prefix",
      },
      {
        id: "acc-data",
        labelKey: "settings.tabs.data",
        href: "/settings/data",
        icon: Database,
        match: "prefix",
      },
    ],
  },
  {
    id: "account-system",
    labelKey: "settings.groups.system",
    items: [
      {
        id: "acc-advanced",
        labelKey: "settings.tabs.advanced",
        href: "/settings/advanced",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];
