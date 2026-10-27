import type { UserRoleStr } from "./utils";
import type { SectionConfig } from "@/lib/api/users";

export type SectionComponentId =
  | "learning_progress"
  | "certificates"
  | "course_recommendations"
  | "recent_activities"
  | "skills"
  | "quick_actions"
  | "active_projects"
  | "proposals"
  | "active_contracts"
  | "earnings_chart"
  | "job_listings"
  | "applicants"
  | "team_overview"
  | "platform_metrics"
  | "user_growth"
  | "revenue"
  | "recent_users"
  | "system_alerts";

export interface SectionMeta {
  id: SectionComponentId;
  titleKey: string;
  descriptionKey?: string;
  grid: "main" | "sidebar" | "full";
}

export const SECTION_META: Record<SectionComponentId, SectionMeta> = {
  learning_progress: {
    id: "learning_progress",
    titleKey: "dashboard.sections.learningProgress.title",
    grid: "main",
  },
  certificates: {
    id: "certificates",
    titleKey: "dashboard.sections.certificates.title",
    grid: "main",
  },
  course_recommendations: {
    id: "course_recommendations",
    titleKey: "dashboard.sections.aiInsights.title",
    grid: "sidebar",
  },
  recent_activities: {
    id: "recent_activities",
    titleKey: "dashboard.sections.recentActivities.title",
    grid: "main",
  },
  skills: {
    id: "skills",
    titleKey: "dashboard.sections.skillsOverview.title",
    grid: "sidebar",
  },
  quick_actions: {
    id: "quick_actions",
    titleKey: "dashboard.quickActions.title",
    grid: "sidebar",
  },
  active_projects: {
    id: "active_projects",
    titleKey: "dashboard.sections.activeProjects.title",
    grid: "main",
  },
  proposals: {
    id: "proposals",
    titleKey: "dashboard.freelancerSections.proposals.title",
    grid: "main",
  },
  active_contracts: {
    id: "active_contracts",
    titleKey: "dashboard.freelancerSections.contracts.title",
    grid: "main",
  },
  earnings_chart: {
    id: "earnings_chart",
    titleKey: "dashboard.freelancerSections.earnings.title",
    grid: "main",
  },
  job_listings: {
    id: "job_listings",
    titleKey: "dashboard.businessSections.listings.title",
    grid: "main",
  },
  applicants: {
    id: "applicants",
    titleKey: "dashboard.businessSections.applicants.title",
    grid: "main",
  },
  team_overview: {
    id: "team_overview",
    titleKey: "dashboard.businessSections.team.title",
    grid: "main",
  },
  platform_metrics: {
    id: "platform_metrics",
    titleKey: "dashboard.adminSections.platform.title",
    grid: "full",
  },
  user_growth: {
    id: "user_growth",
    titleKey: "dashboard.adminSections.users.title",
    grid: "main",
  },
  revenue: {
    id: "revenue",
    titleKey: "dashboard.adminSections.revenue.title",
    grid: "main",
  },
  recent_users: {
    id: "recent_users",
    titleKey: "dashboard.adminSections.users.title",
    grid: "main",
  },
  system_alerts: {
    id: "system_alerts",
    titleKey: "dashboard.adminSections.alerts.title",
    grid: "full",
  },
};

export const QUICK_ACTIONS_MAP: Record<
  UserRoleStr,
  Array<{ key: string; href: string; gradient: string }>
> = {
  STUDENT: [
    {
      key: "startCourse",
      href: "/learn/courses",
      gradient: "from-blue-600 to-blue-400",
    },
    {
      key: "uploadDataset",
      href: "/bi/datasets/upload",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "createReport",
      href: "/bi/reports",
      gradient: "from-orange-600 to-amber-400",
    },
  ],
  FREELANCER: [
    {
      key: "findProjects",
      href: "/hub/projects",
      gradient: "from-purple-600 to-pink-400",
    },
    {
      key: "uploadDataset",
      href: "/bi/datasets/upload",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "createReport",
      href: "/bi/reports",
      gradient: "from-orange-600 to-amber-400",
    },
  ],
  BUSINESS: [
    {
      key: "postJob",
      href: "/hub/projects/new",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "viewAnalytics",
      href: "/bi/analytics",
      gradient: "from-blue-600 to-indigo-400",
    },
    {
      key: "uploadDataset",
      href: "/bi/datasets/upload",
      gradient: "from-orange-600 to-amber-400",
    },
  ],
  ADMIN: [
    {
      key: "manageUsers",
      href: "/admin/users",
      gradient: "from-slate-600 to-gray-400",
    },
    {
      key: "viewAnalytics",
      href: "/admin/analytics",
      gradient: "from-blue-600 to-indigo-400",
    },
    {
      key: "reviewReports",
      href: "/admin/content-review",
      gradient: "from-amber-600 to-orange-400",
    },
  ],
  INSTRUCTOR: [
    {
      key: "startCourse",
      href: "/learn/courses",
      gradient: "from-blue-600 to-blue-400",
    },
    {
      key: "uploadDataset",
      href: "/bi/datasets/upload",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "createReport",
      href: "/bi/reports",
      gradient: "from-orange-600 to-amber-400",
    },
  ],
};

export const ROLE_WELCOME_KEYS: Record<UserRoleStr, string> = {
  STUDENT: "dashboard.welcome.STUDENT",
  FREELANCER: "dashboard.welcome.FREELANCER",
  BUSINESS: "dashboard.welcome.BUSINESS",
  ADMIN: "dashboard.welcome.ADMIN",
  INSTRUCTOR: "dashboard.welcome.STUDENT",
};

export const ROLE_STAT_FIELDS: Record<
  UserRoleStr,
  Array<{ key: string; field: string; icon: string; gradient: string }>
> = {
  STUDENT: [
    {
      key: "activeCourses",
      field: "total_courses",
      icon: "BookOpen",
      gradient: "from-blue-600 to-blue-400",
    },
    {
      key: "completedCourses",
      field: "completed_courses",
      icon: "CheckCircle2",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "certificates",
      field: "certifications_count",
      icon: "Award",
      gradient: "from-amber-600 to-orange-400",
    },
    {
      key: "skillLevel",
      field: "skill_level",
      icon: "Star",
      gradient: "from-purple-600 to-pink-400",
    },
  ],
  FREELANCER: [
    {
      key: "activeProjects",
      field: "active_projects",
      icon: "Briefcase",
      gradient: "from-purple-600 to-pink-400",
    },
    {
      key: "completedProjects",
      field: "completed_projects",
      icon: "CheckCircle2",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "totalEarnings",
      field: "total_earnings",
      icon: "TrendingUp",
      gradient: "from-amber-600 to-orange-400",
    },
    {
      key: "skillLevel",
      field: "skill_level",
      icon: "Star",
      gradient: "from-blue-600 to-indigo-400",
    },
  ],
  BUSINESS: [
    {
      key: "activeListings",
      field: "total_applications",
      icon: "Briefcase",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "totalHires",
      field: "total_hires",
      icon: "Users",
      gradient: "from-blue-600 to-indigo-400",
    },
    {
      key: "teamMembers",
      field: "team_members",
      icon: "Building2",
      gradient: "from-purple-600 to-pink-400",
    },
  ],
  ADMIN: [
    {
      key: "totalUsers",
      field: "total_users",
      icon: "Users",
      gradient: "from-blue-600 to-indigo-400",
    },
    {
      key: "totalRevenue",
      field: "total_revenue",
      icon: "DollarSign",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "activeProjects",
      field: "active_projects",
      icon: "Briefcase",
      gradient: "from-purple-600 to-pink-400",
    },
    {
      key: "activeCourses",
      field: "active_courses",
      icon: "BookOpen",
      gradient: "from-amber-600 to-orange-400",
    },
  ],
  INSTRUCTOR: [
    {
      key: "activeCourses",
      field: "total_courses",
      icon: "BookOpen",
      gradient: "from-blue-600 to-blue-400",
    },
    {
      key: "completedCourses",
      field: "completed_courses",
      icon: "CheckCircle2",
      gradient: "from-emerald-600 to-teal-400",
    },
    {
      key: "skillLevel",
      field: "skill_level",
      icon: "Star",
      gradient: "from-purple-600 to-pink-400",
    },
  ],
};
