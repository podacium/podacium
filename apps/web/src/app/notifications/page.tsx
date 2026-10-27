// apps/web/src/app/notifications/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  CheckCheck,
  Clock,
  Settings,
  Shield,
  Briefcase,
  BookOpen,
  TrendingUp,
  Server,
  CreditCard,
  ChevronDown,
  ChevronUp,
  X,
  Inbox,
  MessageSquare,
  HelpCircle,
  Radio,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { useTranslations, useLocale, useBidi } from "@/lib/i18n";
import { resolveNotificationRoute } from "@/lib/notificationRoutes";
import { formatNotificationContent } from "@/lib/notificationFormat";
import {
  useNotifications,
  useNotificationStats,
  useMarkAsRead,
  useMarkAllAsRead,
  useBulkMarkAsRead,
  useDeleteNotification,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotifications";
import {
  api,
  NotificationResponse,
  NotificationCategory,
  NotificationPriority,
  NotificationPreferencesUpdate,
} from "@/lib/api";

import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumTabs from "@/components/design-system/PodaciumTabs";
import PodaciumSwitch from "@/components/design-system/PodaciumSwitch";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumSkeleton from "@/components/design-system/PodaciumSkeleton";

// =============================================================================
// CATEGORY & PRIORITY HELPERS
// =============================================================================

function getCategoryIcon(category?: string | null, type?: string | null) {
  const cat = (category || "").toUpperCase();
  const t = (type || "").toUpperCase();

  if (t === "NEW_MESSAGE" || t === "CHAT" || cat === "MESSAGING") {
    return (
      <MessageSquare className="w-4 h-4 text-blue-500 dark:text-blue-400" />
    );
  }
  if (cat === "SECURITY") {
    return (
      <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
    );
  }
  if (cat === "LIVE") {
    return <Radio className="w-4 h-4 text-rose-500 dark:text-rose-400" />;
  }
  if (cat === "SUPPORT") {
    return <HelpCircle className="w-4 h-4 text-sky-500 dark:text-sky-400" />;
  }
  if (cat === "COURSE" || cat === "EDUCATION") {
    return (
      <BookOpen className="w-4 h-4 text-purple-500 dark:text-purple-400" />
    );
  }
  if (cat === "PROJECT" || cat === "FREELANCE") {
    return (
      <Briefcase className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
    );
  }
  if (cat === "BILLING") {
    return (
      <CreditCard className="w-4 h-4 text-amber-500 dark:text-amber-400" />
    );
  }
  if (cat === "MARKETING") {
    return <TrendingUp className="w-4 h-4 text-pink-500 dark:text-pink-400" />;
  }
  return <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
}

function getPriorityBadgeVariant(
  priority?: NotificationPriority | string | null,
): "destructive" | "warning" | "default" | "secondary" {
  switch (priority) {
    case NotificationPriority.URGENT:
    case "URGENT":
      return "destructive";
    case NotificationPriority.HIGH:
    case "HIGH":
      return "warning";
    case NotificationPriority.NORMAL:
    case "NORMAL":
      return "default";
    case NotificationPriority.LOW:
    case "LOW":
    default:
      return "secondary";
  }
}

function getPriorityBorder(
  priority?: NotificationPriority | string | null,
): string {
  switch (priority) {
    case NotificationPriority.URGENT:
    case "URGENT":
      return "border-s-rose-500";
    case NotificationPriority.HIGH:
    case "HIGH":
      return "border-s-amber-500";
    case NotificationPriority.NORMAL:
    case "NORMAL":
      return "border-s-blue-500";
    default:
      return "border-s-slate-300 dark:border-s-slate-700";
  }
}

// =============================================================================
// NOTIFICATION ITEM COMPONENT
// =============================================================================

interface NotificationItemProps {
  notification: NotificationResponse;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  isSelected,
  onToggleSelect,
  onMarkAsRead,
  onDelete,
}) => {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { title, body, categoryLabel } = formatNotificationContent(
    notification,
    t,
  );

  const actions = notification.data?.actions || [];

  const handleRowClick = () => {
    if (!notification.is_read && !notification.isRead) {
      onMarkAsRead(notification.id);
    }
    const targetRoute = resolveNotificationRoute(notification);
    router.push(targetRoute);
  };

  const handleActionClick = async (e: React.MouseEvent, action: any) => {
    e.stopPropagation();
    if (!action) return;

    if (!notification.is_read && !notification.isRead) {
      onMarkAsRead(notification.id);
    }

    if (action.action === "accept_invitation" && action.data?.token) {
      setActionLoading(action.label || "accept");
      try {
        await api.acceptInvitation(action.data.token);
        onDelete(notification.id);
      } catch (err) {
        console.error("Failed to accept invitation", err);
      } finally {
        setActionLoading(null);
      }
      return;
    }

    if (action.action === "decline_invitation" && action.data?.token) {
      setActionLoading(action.label || "decline");
      try {
        await api.declineInvitation(action.data.token);
        onDelete(notification.id);
      } catch (err) {
        console.error("Failed to decline invitation", err);
      } finally {
        setActionLoading(null);
      }
      return;
    }

    const route = resolveNotificationRoute({
      ...action,
      ...notification,
    });
    router.push(route);
  };

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1)
      return t("notifications.notificationItem.time.justNow");
    if (diffInHours < 24)
      return t("notifications.notificationItem.time.hoursAgo", {
        hours: String(diffInHours),
      });
    if (diffInDays < 7)
      return t("notifications.notificationItem.time.daysAgo", {
        days: String(diffInDays),
      });

    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isUnread = !notification.is_read && !notification.isRead;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={`group relative rounded-2xl border border-s-4 ${getPriorityBorder(
        notification.priority,
      )} transition-all duration-200 cursor-pointer p-4 md:p-5 ${
        isUnread
          ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-900/50 shadow-xs hover:shadow-md"
          : "bg-card dark:bg-slate-900/70 border-border/80 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 hover:shadow-xs"
      } ${isSelected ? "ring-2 ring-primary/80" : ""}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Checkbox */}
        <div
          className="flex-shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(notification.id)}
            aria-label={t("notifications.selectNotification", {
              id: notification.id,
            })}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary/40 cursor-pointer"
          />
        </div>

        {/* Category Icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-background dark:bg-slate-800 border border-border/60 flex items-center justify-center shadow-xs">
          {getCategoryIcon(notification.category, notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4
                className={`text-sm md:text-base leading-snug ${
                  isUnread
                    ? "font-semibold text-foreground dark:text-white"
                    : "font-medium text-foreground/80 dark:text-slate-200"
                }`}
              >
                {title || body}
              </h4>

              <PodaciumBadge
                variant={getPriorityBadgeVariant(notification.priority)}
                className="text-[10px] uppercase tracking-wider px-2 py-0.5"
              >
                {categoryLabel}
              </PodaciumBadge>

              {isUnread && (
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>

            {/* Timestamp & Email Indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(notification.created_at)}
              </span>
              {notification.email_sent && (
                <span
                  title={t("notifications.actions.emailSent")}
                  className="text-emerald-500"
                >
                  <Mail className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Body Text */}
          {body && body !== title && (
            <p
              className={`text-sm text-muted-foreground dark:text-slate-400 mt-1.5 leading-relaxed ${
                isExpanded ? "" : "line-clamp-2"
              }`}
            >
              {body}
            </p>
          )}

          {/* Structured Actions */}
          {actions.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {actions.map((act: any, idx: number) => (
                <PodaciumButton
                  key={idx}
                  size="sm"
                  variant={
                    act.variant === "destructive"
                      ? "destructive"
                      : act.variant === "outline"
                        ? "outline"
                        : "primary"
                  }
                  loading={actionLoading === (act.label || "action")}
                  onClick={(e) => handleActionClick(e, act)}
                  className="text-xs h-8 px-3"
                >
                  {t(act.label || "notifications.actions.view")}
                </PodaciumButton>
              ))}
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-xs">
            <div className="flex items-center gap-3">
              {body && body.length > 120 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      {t("notifications.notificationItem.showLess")}
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      {t("notifications.notificationItem.showMore")}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}

              {isUnread && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t("notifications.header.markRead")}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notification.id);
                }}
                title={
                  isUnread
                    ? t("notifications.item.markAsRead")
                    : t("notifications.item.markAsUnread")
                }
                aria-label={
                  isUnread
                    ? t("notifications.item.markAsRead")
                    : t("notifications.item.markAsUnread")
                }
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                {isUnread ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <CircleDot className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                title={t("notifications.item.delete")}
                aria-label={t("notifications.item.delete")}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// PREFERENCES MODAL COMPONENT
// =============================================================================

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const t = useTranslations();
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const [formData, setFormData] = useState<NotificationPreferencesUpdate>(
    () => ({
      email_notifications: prefs?.email_notifications ?? true,
      in_app_notifications: prefs?.in_app_notifications ?? true,
      marketing_emails: prefs?.marketing_emails ?? false,
      push_notifications: prefs?.push_notifications ?? true,
      digest_frequency: prefs?.digest_frequency ?? "weekly",
      quiet_hours_start: prefs?.quiet_hours_start,
      quiet_hours_end: prefs?.quiet_hours_end,
    }),
  );

  React.useEffect(() => {
    if (isOpen && prefs) {
      setFormData({
        email_notifications: prefs.email_notifications ?? true,
        in_app_notifications: prefs.in_app_notifications ?? true,
        marketing_emails: prefs.marketing_emails ?? false,
        push_notifications: prefs.push_notifications ?? true,
        digest_frequency: prefs.digest_frequency ?? "weekly",
        quiet_hours_start: prefs.quiet_hours_start,
        quiet_hours_end: prefs.quiet_hours_end,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync(formData);
      onClose();
    } catch (err) {
      console.error("Failed to update preferences", err);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("notifications.preferences.title")}
      size="lg"
    >
      <div className="space-y-6 py-2">
        {isLoading ? (
          <div className="space-y-4">
            <PodaciumSkeleton className="h-12 w-full" />
            <PodaciumSkeleton className="h-12 w-full" />
            <PodaciumSkeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {/* Channels */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("notifications.preferences.emailNotifications.title")}
              </h4>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("notifications.preferences.emailNotifications.inApp")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "notifications.preferences.emailNotifications.inAppDesc",
                    )}
                  </p>
                </div>
                <PodaciumSwitch
                  checked={formData.in_app_notifications ?? true}
                  onChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      in_app_notifications: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("notifications.preferences.emailNotifications.account")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "notifications.preferences.emailNotifications.accountDesc",
                    )}
                  </p>
                </div>
                <PodaciumSwitch
                  checked={formData.email_notifications ?? true}
                  onChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      email_notifications: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-background/50">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("notifications.preferences.marketing.marketing")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifications.preferences.marketing.marketingDesc")}
                  </p>
                </div>
                <PodaciumSwitch
                  checked={formData.marketing_emails ?? false}
                  onChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      marketing_emails: checked,
                    }))
                  }
                />
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("notifications.preferences.quietHours.title")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("notifications.preferences.quietHours.description")}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("notifications.preferences.quietHours.start")}
                  </label>
                  <input
                    type="time"
                    value={formData.quiet_hours_start || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quiet_hours_start: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("notifications.preferences.quietHours.end")}
                  </label>
                  <input
                    type="time"
                    value={formData.quiet_hours_end || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        quiet_hours_end: e.target.value || undefined,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
              <PodaciumButton variant="ghost" onClick={onClose}>
                {t("notifications.actions.dismiss")}
              </PodaciumButton>
              <PodaciumButton
                variant="primary"
                loading={updatePrefs.isPending}
                onClick={handleSave}
              >
                {t("notifications.preferences.save")}
              </PodaciumButton>
            </div>
          </>
        )}
      </div>
    </PodaciumModal>
  );
};

// =============================================================================
// MAIN NOTIFICATIONS PAGE
// =============================================================================

export default function NotificationsPage() {
  const { showAuthModal, handleLogin, handleSignup, handleClose } =
    useAuthGuard({ redirectTo: "/auth/login", showModal: true });

  const { dir } = useBidi();
  const t = useTranslations();

  // Filters & State
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Queries & Mutations
  const {
    data: notifData,
    isLoading,
    refetch,
    isRefetching,
  } = useNotifications();
  const { data: stats } = useNotificationStats();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const bulkMarkAsReadMutation = useBulkMarkAsRead();
  const deleteMutation = useDeleteNotification();

  const notifications = useMemo(() => {
    return notifData?.notifications || [];
  }, [notifData]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // Tab filter
      const isUnread = !notif.is_read && !notif.isRead;
      if (activeTab === "unread" && !isUnread) return false;
      if (activeTab === "read" && isUnread) return false;

      // Category filter
      if (
        filterCategory !== "all" &&
        notif.category?.toUpperCase() !== filterCategory.toUpperCase()
      ) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = notif.title?.toLowerCase().includes(query);
        const bodyMatch = notif.body?.toLowerCase().includes(query);
        const catMatch = notif.category?.toLowerCase().includes(query);
        if (!titleMatch && !bodyMatch && !catMatch) return false;
      }

      return true;
    });
  }, [notifications, activeTab, filterCategory, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  const handleBulkMarkRead = async (isRead: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await bulkMarkAsReadMutation.mutateAsync({ ids: selectedIds, isRead });
    } catch {
      // Handled by mutation callbacks
    } finally {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
    } catch {
      // Handled by mutation callbacks
    } finally {
      setSelectedIds([]);
    }
  };

  const tabItems = useMemo(
    () => [
      {
        id: "all",
        label: t("notifications.tabs.all"),
        count: notifications.length,
      },
      {
        id: "unread",
        label: t("notifications.tabs.unread"),
        count: notifications.filter((n) => !n.is_read && !n.isRead).length,
      },
      {
        id: "read",
        label: t("notifications.tabs.read"),
        count: notifications.filter((n) => n.is_read || n.isRead).length,
      },
    ],
    [notifications, t],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: t("notifications.filters.allCategories") },
      {
        value: "SECURITY",
        label: t("notifications.categories.SECURITY"),
      },
      {
        value: "PROJECT",
        label: t("notifications.categories.PROJECT"),
      },
      {
        value: "COURSE",
        label: t("notifications.categories.COURSE"),
      },
      {
        value: "BILLING",
        label: t("notifications.categories.BILLING"),
      },
      {
        value: "SYSTEM",
        label: t("notifications.categories.SYSTEM"),
      },
      {
        value: "MARKETING",
        label: t("notifications.categories.MARKETING"),
      },
    ],
    [t],
  );

  return (
    <div
      dir={dir}
      className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20"
    >
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 md:pt-32 pb-16">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Bell className="w-6 h-6" />
              </div>
              {t("notifications.page.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              {t("notifications.page.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={() => setIsPreferencesOpen(true)}
              icon={<Settings className="w-4 h-4" />}
            >
              {t("notifications.preferences.title")}
            </PodaciumButton>

            <PodaciumButton
              variant="outline"
              size="sm"
              loading={isRefetching}
              onClick={() => refetch()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {t("notifications.header.refresh")}
            </PodaciumButton>

            {notifications.some((n) => !n.is_read && !n.isRead) && (
              <PodaciumButton
                variant="primary"
                size="sm"
                loading={markAllAsReadMutation.isPending}
                onClick={() => markAllAsReadMutation.mutate()}
                icon={<CheckCheck className="w-4 h-4" />}
              >
                {t("notifications.actions.markAllRead")}
              </PodaciumButton>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <PodaciumCard variant="glass" padding="sm">
              <p className="text-xs text-muted-foreground font-medium">
                {t("notifications.stats.total")}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats.total ?? notifications.length}
              </p>
            </PodaciumCard>

            <PodaciumCard variant="glass" padding="sm">
              <p className="text-xs text-muted-foreground font-medium">
                {t("notifications.stats.unread")}
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {stats.unread ??
                  notifications.filter((n) => !n.is_read && !n.isRead).length}
              </p>
            </PodaciumCard>

            <PodaciumCard variant="glass" padding="sm">
              <p className="text-xs text-muted-foreground font-medium">
                {t("notifications.stats.read")}
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {(stats.total ?? notifications.length) -
                  (stats.unread ??
                    notifications.filter((n) => !n.is_read && !n.isRead)
                      .length)}
              </p>
            </PodaciumCard>

            <PodaciumCard variant="glass" padding="sm">
              <p className="text-xs text-muted-foreground font-medium">
                {t("notifications.priorities.URGENT")}
              </p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {notifications.filter((n) => n.priority === "URGENT").length}
              </p>
            </PodaciumCard>
          </div>
        )}

        {/* Tabs & Controls Container */}
        <PodaciumCard
          variant="elevated"
          padding="none"
          className="overflow-hidden mb-6"
        >
          <div className="p-4 border-b border-border/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Tabs */}
            <PodaciumTabs
              variant="pills"
              tabs={tabItems}
              defaultTab={activeTab}
              onChange={(tabId) => {
                setActiveTab(tabId);
                setSelectedIds([]);
              }}
            />

            {/* Search & Category Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="appearance-none ps-3 pe-8 py-1.5 text-xs font-medium rounded-lg border border-input bg-background/60 hover:bg-background focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all cursor-pointer"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("notifications.toolbar.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-input bg-background/60 focus:bg-background focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length > 0 &&
                      selectedIds.length === filteredNotifications.length
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary/40"
                  />
                  <span className="font-medium text-foreground">
                    {selectedIds.length > 0
                      ? t("notifications.header.selected", {
                          count: String(selectedIds.length),
                        })
                      : t("notifications.actions.selectAll")}
                  </span>
                </label>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                  <PodaciumButton
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBulkMarkRead(true)}
                    className="h-7 text-xs px-2.5"
                  >
                    {t("notifications.header.markRead")}
                  </PodaciumButton>
                  <PodaciumButton
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBulkMarkRead(false)}
                    className="h-7 text-xs px-2.5"
                  >
                    {t("notifications.notificationItem.markUnread")}
                  </PodaciumButton>
                  <PodaciumButton
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    className="h-7 text-xs px-2.5"
                  >
                    {t("notifications.header.delete")}
                  </PodaciumButton>
                </div>
              )}
            </div>
          )}

          {/* Notification List Content */}
          <div className="p-4 space-y-3" role="status" aria-live="polite">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <PodaciumSkeleton
                    key={idx}
                    className="h-24 w-full rounded-xl"
                  />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              /* Empty State */
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4 shadow-sm">
                  <Inbox className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {t("notifications.emptyStates.noNotifications.title")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {activeTab === "unread"
                    ? t(
                        "notifications.emptyStates.noNotifications.descriptionUnread",
                      )
                    : activeTab === "read"
                      ? t(
                          "notifications.emptyStates.noNotifications.descriptionRead",
                        )
                      : t(
                          "notifications.emptyStates.noNotifications.descriptionAll",
                        )}
                </p>
              </div>
            ) : (
              /* Notifications Stream */
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    isSelected={selectedIds.includes(notif.id)}
                    onToggleSelect={handleToggleSelect}
                    onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </PodaciumCard>
      </main>

      <Footer />

      {/* Preferences Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />

      {/* Auth Modal Guard */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    </div>
  );
}
