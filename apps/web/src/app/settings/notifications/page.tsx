"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Megaphone,
  Newspaper,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumSwitch from "@/components/design-system/PodaciumSwitch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  marketing_emails: boolean;
  newsletter: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const NotificationPage = () => {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();

  const [settings, setSettings] = useState<NotificationSettings>({
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false,
    marketing_emails: false,
    newsletter: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Record<string, any>>(
        "/api/v1/settings/notifications",
      );
      setSettings({
        email_notifications:
          data.email_notifications ?? data.emailNotifications ?? true,
        push_notifications:
          data.push_notifications ?? data.pushNotifications ?? true,
        sms_notifications:
          data.sms_notifications ?? data.smsNotifications ?? false,
        marketing_emails:
          data.marketing_emails ?? data.marketingEmails ?? false,
        newsletter: data.newsletter ?? false,
      });
    } catch {
      setError(tUser("settings.notifications.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tUser]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        ...settings,
        emailNotifications: settings.email_notifications,
        pushNotifications: settings.push_notifications,
        smsNotifications: settings.sms_notifications,
        marketingEmails: settings.marketing_emails,
      };
      const updated = await api.put<Record<string, any>>(
        "/api/v1/settings/notifications",
        payload,
      );
      if (updated) {
        setSettings({
          email_notifications:
            updated.email_notifications ??
            updated.emailNotifications ??
            settings.email_notifications,
          push_notifications:
            updated.push_notifications ??
            updated.pushNotifications ??
            settings.push_notifications,
          sms_notifications:
            updated.sms_notifications ??
            updated.smsNotifications ??
            settings.sms_notifications,
          marketing_emails:
            updated.marketing_emails ??
            updated.marketingEmails ??
            settings.marketing_emails,
          newsletter: updated.newsletter ?? settings.newsletter,
        });
      }
      setSuccess(tUser("settings.notifications.savedSuccess"));
    } catch {
      setError(tUser("settings.notifications.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const {
    isSupported: isPushSupported,
    isSubscribed,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    loading: pushLoading,
  } = usePushNotifications();

  const handlePushToggle = async () => {
    if (settings.push_notifications) {
      await unsubscribePush();
      setSettings((prev) => ({ ...prev, push_notifications: false }));
      toast.info(tUser("settings.notifications.pushDisabled"));
    } else {
      const success = await subscribePush();
      if (success) {
        setSettings((prev) => ({ ...prev, push_notifications: true }));
        toast.success(tUser("settings.notifications.pushEnabled"));
      } else {
        toast.error(tUser("settings.notifications.pushDenied"));
      }
    }
  };

  const toggle = (key: keyof NotificationSettings) => {
    if (key === "push_notifications") {
      handlePushToggle();
      return;
    }
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {tCommon("loading")}
        </p>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <p className="text-gray-700 dark:text-slate-300 font-medium">{error}</p>
        <PodaciumButton onClick={fetchSettings} variant="outline">
          <RefreshCw className="h-4 w-4 me-2" />
          {tCommon("retry")}
        </PodaciumButton>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      dir={dir}
    >
      <motion.div variants={itemVariants}>
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <Link
            href="/settings"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {tUser("settings.title")}
          </Link>
          <ChevronRight
            className={`h-3.5 w-3.5 ${isRTL ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {tUser("settings.tabs.notifications")}
          </span>
        </nav>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            {tUser("settings.notifications.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
            {tUser("settings.notifications.subtitle")}
          </p>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl text-red-700 dark:text-red-300"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <button
            type="button"
            aria-label={tCommon("dismiss")}
            onClick={() => setError(null)}
            className="ms-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{success}</span>
          <button
            type="button"
            aria-label={tCommon("dismiss")}
            onClick={() => setSuccess(null)}
            className="ms-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Primary Alert Channels */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Bell className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.notifications.channelsGroup")}
            </h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 mt-0.5">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                  {tUser("settings.notifications.emailNotifications")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tUser("settings.notifications.emailNotificationsDesc")}
                </p>
              </div>
            </div>
            <PodaciumSwitch
              checked={settings.email_notifications}
              onChange={() => toggle("email_notifications")}
              label={tUser("settings.notifications.emailNotifications")}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 mt-0.5">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                  {tUser("settings.notifications.pushNotifications")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tUser("settings.notifications.pushNotificationsDesc")}
                </p>
              </div>
            </div>
            <PodaciumSwitch
              checked={settings.push_notifications}
              onChange={() => toggle("push_notifications")}
              disabled={pushLoading}
              label={tUser("settings.notifications.pushNotifications")}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 mt-0.5">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                  {tUser("settings.notifications.smsNotifications")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tUser("settings.notifications.smsNotificationsDesc")}
                </p>
              </div>
            </div>
            <PodaciumSwitch
              checked={settings.sms_notifications}
              onChange={() => toggle("sms_notifications")}
              label={tUser("settings.notifications.smsNotifications")}
            />
          </div>
        </div>
      </motion.div>

      {/* Marketing & Newsletter */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.notifications.marketingGroup")}
            </h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 mt-0.5">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                  {tUser("settings.notifications.marketingEmails")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tUser("settings.notifications.marketingEmailsDesc")}
                </p>
              </div>
            </div>
            <PodaciumSwitch
              checked={settings.marketing_emails}
              onChange={() => toggle("marketing_emails")}
              label={tUser("settings.notifications.marketingEmails")}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 mt-0.5">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                  {tUser("settings.notifications.newsletter")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {tUser("settings.notifications.newsletterDesc")}
                </p>
              </div>
            </div>
            <PodaciumSwitch
              checked={settings.newsletter}
              onChange={() => toggle("newsletter")}
              label={tUser("settings.notifications.newsletter")}
            />
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex justify-end">
        <PodaciumButton onClick={handleSave} disabled={saving} glow>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin me-2" />
          ) : (
            <Save className="h-4 w-4 me-2" />
          )}
          {saving ? tCommon("saving") : tCommon("saveChanges")}
        </PodaciumButton>
      </motion.div>
    </motion.div>
  );
};

export default NotificationPage;
