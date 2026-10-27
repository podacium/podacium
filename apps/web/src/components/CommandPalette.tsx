"use client";

import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  MessageSquare,
  CreditCard,
  Shield,
  Upload,
  Download,
  Settings,
  UserPlus,
  Search,
  Keyboard,
  Moon,
  Sun,
  Globe,
  LogOut,
  BarChart3,
  DollarSign,
  HelpCircle,
  Briefcase,
  KeyRound,
  History,
  Video,
  ShieldAlert,
  LifeBuoy,
  Building,
  CheckSquare,
  Layers,
  ListOrdered,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "@/lib/i18n";
import { handleLanguageChange } from "@/components/LanguageSwitcher";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const { user, logout } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (typeof window !== "undefined" && window.innerWidth >= 1280) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("toggle-navbar-search"));
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const items = useMemo<CommandItem[]>(() => {
    const navGroup = t("common.navigation");
    const actionsGroup = t("common.actionsTitle");

    const nav: CommandItem[] = [
      {
        id: "dashboard",
        label: t("auth.dashboard"),
        icon: LayoutDashboard,
        action: () => router.push("/dashboard"),
        group: navGroup,
      },
      {
        id: "learn",
        label: t("nav.learning"),
        icon: BookOpen,
        action: () => router.push("/learn"),
        group: navGroup,
        keywords: "courses education",
      },
      {
        id: "hub",
        label: t("nav.hub"),
        icon: Briefcase,
        action: () => router.push("/hub"),
        group: navGroup,
        keywords: "freelancing projects",
      },
      {
        id: "bi",
        label: t("nav.analytics"),
        icon: BarChart3,
        action: () => router.push("/bi"),
        group: navGroup,
        keywords: "bi dashboards",
      },
      {
        id: "live",
        label: t("live.title"),
        icon: Calendar,
        action: () => router.push("/live"),
        group: navGroup,
        keywords: "meetings streaming",
      },
      {
        id: "messaging",
        label: t("messaging.title"),
        icon: MessageSquare,
        action: () => router.push("/messaging"),
        group: navGroup,
        keywords: "chat inbox",
      },
      {
        id: "billing",
        label: t("auth.billing"),
        icon: DollarSign,
        action: () => router.push("/billing"),
        group: navGroup,
        keywords: "payments subscription",
      },
      {
        id: "settings",
        label: t("settings.title"),
        icon: Settings,
        action: () => router.push("/settings"),
        group: navGroup,
      },
    ];

    if (user?.role === "ADMIN") {
      nav.push(
        {
          id: "admin-overview",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.dashboard", "Overview")}`,
          icon: Shield,
          action: () => router.push("/admin"),
          group: navGroup,
          keywords: "admin dashboard overview metrics kpi",
        },
        {
          id: "admin-iam",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.iam", "Staff IAM & RBAC")}`,
          icon: KeyRound,
          action: () => router.push("/admin/iam"),
          group: navGroup,
          keywords:
            "iam rbac subadmin permissions roles clearance provision security",
        },
        {
          id: "admin-activity-log",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.activityLog", "Activity Log & Audit Trail")}`,
          icon: History,
          action: () => router.push("/admin/activity-log"),
          group: navGroup,
          keywords: "audit trail activity log tamper proof hmac compliance",
        },
        {
          id: "admin-users",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.users", "Users")}`,
          icon: Users,
          action: () => router.push("/admin/users"),
          group: navGroup,
          keywords: "admin users accounts moderation bans roles",
        },
        {
          id: "admin-analytics",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.analytics", "Analytics")}`,
          icon: BarChart3,
          action: () => router.push("/admin/analytics"),
          group: navGroup,
          keywords: "analytics revenue growth platform stats charts",
        },
        {
          id: "admin-courses",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.courses", "Courses")}`,
          icon: BookOpen,
          action: () => router.push("/admin/courses"),
          group: navGroup,
          keywords: "courses curriculum modules education catalog",
        },
        {
          id: "admin-lessons",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.lessons", "Lessons")}`,
          icon: ListOrdered,
          action: () => router.push("/admin/lessons"),
          group: navGroup,
          keywords: "lessons chapters video content",
        },
        {
          id: "admin-paths",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.paths", "Learning Paths")}`,
          icon: Layers,
          action: () => router.push("/admin/paths"),
          group: navGroup,
          keywords: "learning paths tracks roadmaps",
        },
        {
          id: "admin-quizzes",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.quizzes", "Quizzes")}`,
          icon: CheckSquare,
          action: () => router.push("/admin/quizzes"),
          group: navGroup,
          keywords: "quizzes tests exams assessments grading",
        },
        {
          id: "admin-enrollments",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.enrollments", "Enrollments")}`,
          icon: GraduationCap,
          action: () => router.push("/admin/enrollments"),
          group: navGroup,
          keywords: "enrollments students registrations progress",
        },
        {
          id: "admin-content-review",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.contentReview", "Content Review")}`,
          icon: FileCheck,
          action: () => router.push("/admin/content-review"),
          group: navGroup,
          keywords: "content review moderation approval submissions",
        },
        {
          id: "admin-appeals",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.appeals", "Appeals")}`,
          icon: ShieldAlert,
          action: () => router.push("/admin/appeals"),
          group: navGroup,
          keywords: "appeals review disputes claims moderation",
        },
        {
          id: "admin-tickets",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.tickets", "Support Tickets")}`,
          icon: LifeBuoy,
          action: () => router.push("/admin/tickets"),
          group: navGroup,
          keywords: "support crm tickets inquiries customer service",
        },
        {
          id: "admin-organizations",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.organizations", "Organizations")}`,
          icon: Building,
          action: () => router.push("/admin/organizations"),
          group: navGroup,
          keywords: "organizations b2b enterprise teams universities",
        },
        {
          id: "admin-video-settings",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.videoSettings", "Video & CDN Settings")}`,
          icon: Video,
          action: () => router.push("/admin/video-settings"),
          group: navGroup,
          keywords: "video cdn streaming bunny mux cloudflare transcoding",
        },
        {
          id: "admin-settings",
          label: `${t("auth.adminPanel")} — ${t("admin.sidebar.settings", "Settings")}`,
          icon: Settings,
          action: () => router.push("/admin/settings"),
          group: navGroup,
          keywords: "platform settings maintenance fees commissions flags",
        },
      );
    }

    const actions: CommandItem[] = [
      {
        id: "lang-en",
        label: "English",
        icon: Globe,
        action: () => handleLanguageChange("en"),
        group: actionsGroup,
        keywords: "language english",
      },
      {
        id: "lang-fr",
        label: "Français",
        icon: Globe,
        action: () => handleLanguageChange("fr"),
        group: actionsGroup,
        keywords: "language langue francais",
      },
      {
        id: "lang-ar",
        label: "العربية",
        icon: Globe,
        action: () => handleLanguageChange("ar"),
        group: actionsGroup,
        keywords: "language langue arabic",
      },
      {
        id: "lang-kab",
        label: "Taqbaylit",
        icon: Globe,
        action: () => handleLanguageChange("kab"),
        group: actionsGroup,
        keywords: "language langue kabyle taqbaylit",
      },
      {
        id: "help",
        label: t("auth.helpSupport"),
        icon: HelpCircle,
        action: () => router.push("/help"),
        group: actionsGroup,
      },
      {
        id: "logout",
        label: t("auth.signOut"),
        icon: LogOut,
        action: () => {
          logout();
          router.push("/");
        },
        group: actionsGroup,
        keywords: "sign out deconnexion",
      },
    ];

    const copilotGroup = "⚡ PoDalil Studio (بودليل)";
    const copilotActions: CommandItem[] = [
      {
        id: "copilot-open",
        label: "Ouvrir PoDalil Studio (بودليل • Live Canvas)",
        icon: Sparkles,
        action: () => router.push("/copilot"),
        group: copilotGroup,
        keywords:
          "podalil boudalil dalil copilot assistant ai studio split canvas",
      },
      {
        id: "copilot-tax",
        label: "Calculer déductions fiscales (Art. 169 & 224 CIDTA)",
        icon: Sparkles,
        action: () =>
          router.push(
            "/copilot?prompt=" +
              encodeURIComponent(
                "Calculer mes déductions fiscales sous l'Article 169 et 224 CIDTA",
              ),
          ),
        group: copilotGroup,
        keywords: "tax fiscal impot impots cidta daf deduc",
      },
      {
        id: "copilot-proposals",
        label: "Comparer les offres freelance du projet",
        icon: Sparkles,
        action: () =>
          router.push(
            "/copilot?prompt=" +
              encodeURIComponent(
                "Comparer les devis et propositions reçues pour mes projets",
              ),
          ),
        group: copilotGroup,
        keywords: "freelance proposals devis offres compare",
      },
      {
        id: "copilot-duckdb",
        label: "Créer un tableau de bord DuckDB depuis mes données",
        icon: Sparkles,
        action: () =>
          router.push(
            "/copilot?prompt=" +
              encodeURIComponent(
                "Générer une analyse DuckDB et un tableau de bord interactif",
              ),
          ),
        group: copilotGroup,
        keywords: "bi duckdb analytics dashboard dataset sql",
      },
    ];

    return [...copilotActions, ...nav, ...actions];
  }, [router, user, resolvedTheme, setTheme, logout, t]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const existing = map.get(item.group) || [];
      existing.push(item);
      map.set(item.group, existing);
    }
    return map;
  }, [items]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-0 top-[20%] z-[101] mx-auto w-full max-w-lg"
          >
            <Command
              className="rounded-xl border bg-card shadow-2xl overflow-hidden"
              loop
            >
              <div className="flex items-center border-b px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  placeholder={t("search.placeholder")}
                  className="flex h-12 w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  autoFocus
                />
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                  ESC
                </kbd>
              </div>
              <Command.List className="max-h-[320px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {t("search.noResults")}
                </Command.Empty>
                {Array.from(groups.entries()).map(([group, groupItems]) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {groupItems.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.keywords || ""}`}
                        onSelect={() => {
                          item.action();
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">
                    ↑↓
                  </kbd>
                  <span>{t("common.navigate")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">
                    ↵
                  </kbd>
                  <span>{t("common.select")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Keyboard className="h-3 w-3" />
                  <span>?</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
