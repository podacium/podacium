"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";
import { devicesApi, DeviceItem, SecurityEventItem } from "@/lib/api/devices";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  Monitor,
  Tablet,
  Shield,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Activity,
  Trash2,
} from "lucide-react";
import {
  SectionCard,
  StatCard,
  EmptyState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";

const deviceIcon = (device?: DeviceItem) => {
  const platform = device?.platform?.toLowerCase() || "";
  if (
    platform.includes("android") ||
    platform.includes("ios") ||
    platform.includes("phone")
  )
    return Smartphone;
  if (platform.includes("ipad") || platform.includes("tablet")) return Tablet;
  return Monitor;
};

const eventIcon = (type: string) => {
  if (type.includes("STRIKE") || type.includes("SUSPENDED"))
    return AlertTriangle;
  if (type.includes("TRUSTED") || type.includes("BYPASS")) return ShieldCheck;
  if (type.includes("REVOKED") || type.includes("COOLDOWN")) return ShieldOff;
  if (type.includes("NEW_DEVICE") || type.includes("TRAVEL"))
    return AlertTriangle;
  return Shield;
};

const eventColor = (type: string) => {
  if (type.includes("STRIKE") || type.includes("SUSPENDED")) return "red";
  if (type.includes("TRUSTED") || type.includes("BYPASS")) return "emerald";
  if (type.includes("REVOKED") || type.includes("COOLDOWN")) return "amber";
  return "blue";
};

export default function DevicesManager({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useTranslations("settings-devices.page");
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    trusted: number;
    active_today: number;
    events_7d: number;
  } | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [trustingId, setTrustingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<DeviceItem | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deviceRes, eventRes, statsRes] = await Promise.all([
        devicesApi.listDevices(),
        devicesApi.listSecurityEvents(20),
        devicesApi.getDeviceStats().catch(() => null),
      ]);
      setDevices(deviceRes.devices || []);
      setCurrentDeviceId(deviceRes.currentDeviceId ?? null);
      setEvents(eventRes || []);
      setStats(statsRes);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTrustToggle = async (device: DeviceItem) => {
    setTrustingId(device.id);
    try {
      await devicesApi.setDeviceTrust(device.id, !device.isTrusted);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === device.id ? { ...d, isTrusted: !device.isTrusted } : d,
        ),
      );
      toast.success(t("trustUpdated"));
    } catch {
      toast.error(t("trustFailed"));
    } finally {
      setTrustingId(null);
    }
  };

  const handleSetPrimary = async (device: DeviceItem) => {
    setSettingPrimaryId(device.id);
    try {
      await devicesApi.setDevicePrimary(device.id);
      setDevices((prev) =>
        prev.map((d) => ({ ...d, isPrimary: d.id === device.id })),
      );
      toast.success(t("primaryUpdated"));
    } catch {
      toast.error(t("primaryFailed"));
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleRemoveDevice = async (device: DeviceItem) => {
    if (device.isPrimary) {
      toast.error(t("cannotRemovePrimary"));
      setConfirmRemove(null);
      return;
    }
    setRemovingId(device.id);
    try {
      await devicesApi.removeDevice(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success(t("removeSuccess"));
    } catch {
      toast.error(t("removeFailed"));
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return t("time.justNow");
    if (diff < 3600000)
      return t("time.minutes", { count: String(Math.floor(diff / 60000)) });
    if (diff < 86400000)
      return t("time.hours", { count: String(Math.floor(diff / 3600000)) });
    return d.toLocaleDateString();
  };

  const formatEventType = (eventType: string): string => {
    return t(`event.${eventType}`);
  };

  const formatEventDescription = (event: SecurityEventItem): string | null => {
    const meta = (
      event.metadata && typeof event.metadata === "object" ? event.metadata : {}
    ) as Record<string, unknown>;
    if (event.eventType === "NEW_DEVICE_DETECTED") {
      const browser = String(meta.browser ?? "Browser");
      const platform = String(meta.platform ?? "Device");
      return t("eventDesc.NEW_DEVICE_DETECTED", { browser, platform });
    }
    const descKey = `eventDesc.${event.eventType}`;
    const translated = t(descKey);
    if (translated && !translated.includes("{")) return translated;
    return (
      event.description ??
      (translated ? translated.replace(/\{[^}]+\}/g, "") : null)
    );
  };

  const groupEventsByDate = (
    events: SecurityEventItem[],
  ): { label: string; events: SecurityEventItem[] }[] => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    const groups: { label: string; events: SecurityEventItem[] }[] = [];
    const todayEvents = events.filter(
      (e) => new Date(e.createdAt).getTime() >= startOfToday,
    );
    const yesterdayEvents = events.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= startOfYesterday && t < startOfToday;
    });
    const weekEvents = events.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= startOfWeek && t < startOfYesterday;
    });
    const older = events.filter(
      (e) => new Date(e.createdAt).getTime() < startOfWeek,
    );

    if (todayEvents.length)
      groups.push({
        label: t("group.today"),
        events: todayEvents,
      });
    if (yesterdayEvents.length)
      groups.push({
        label: t("group.yesterday"),
        events: yesterdayEvents,
      });
    if (weekEvents.length)
      groups.push({
        label: t("group.week"),
        events: weekEvents,
      });
    if (older.length) groups.push({ label: t("group.older"), events: older });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!compact && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Monitor className="w-5 h-5" />}
            label={t("totalDevices")}
            value={String(stats.total)}
            gradient="from-blue-600 to-blue-400"
            delay={0.1}
          />
          <StatCard
            icon={<ShieldCheck className="w-5 h-5" />}
            label={t("trustedDevices")}
            value={String(stats.trusted)}
            gradient="from-emerald-600 to-teal-400"
            delay={0.2}
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label={t("activeToday")}
            value={String(stats.active_today)}
            gradient="from-purple-600 to-pink-400"
            delay={0.3}
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label={t("events7d")}
            value={String(stats.events_7d)}
            gradient="from-amber-600 to-orange-400"
            delay={0.4}
          />
        </div>
      )}

      <SectionCard
        title={t("deviceListTitle")}
        icon={<Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        padding="sm"
      >
        {devices.length === 0 ? (
          <EmptyState
            icon={<Smartphone className="w-10 h-10" />}
            title={t("noDevices")}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            <AnimatePresence mode="popLayout">
              {devices.map((device, idx) => {
                const Icon = deviceIcon(device);
                const isCurrent = device.id === currentDeviceId;
                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`flex items-start justify-between p-4 transition-colors ${
                      isCurrent
                        ? "bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800/80"
                        : "hover:bg-gray-50/50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isCurrent
                            ? "bg-gradient-to-br from-blue-500 to-indigo-500"
                            : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-950/60"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${isCurrent ? "text-white" : "text-blue-600 dark:text-blue-400"}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-medium text-sm ${isCurrent ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-slate-100"}`}
                          >
                            {device.browserName ||
                              device.platform ||
                              t("unknownDevice")}
                            {device.osVersion ? ` — ${device.osVersion}` : ""}
                          </span>
                          {isCurrent && (
                            <PodaciumBadge variant="default">
                              {t("currentDevice")}
                            </PodaciumBadge>
                          )}
                          {device.isPrimary && (
                            <PodaciumBadge variant="default">
                              {t("primaryDevice")}
                            </PodaciumBadge>
                          )}
                          {device.isTrusted && !device.isPrimary && (
                            <PodaciumBadge variant="success">
                              {t("trusted")}
                            </PodaciumBadge>
                          )}
                        </div>
                        {device.deviceModel && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {device.deviceModel}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("lastActive")}: {formatTime(device.lastActiveAt)}
                          </span>
                          <span>
                            {t("logins")}: {device.loginCount}
                          </span>
                          {device.browserVersion && (
                            <span>v{device.browserVersion}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center gap-1 flex-shrink-0">
                      {!device.isPrimary && !isCurrent && (
                        <PodaciumButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRemove(device)}
                          disabled={removingId === device.id}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60"
                          aria-label={t("removeDevice")}
                        >
                          {removingId === device.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </PodaciumButton>
                      )}
                      {!device.isPrimary && (
                        <PodaciumButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimary(device)}
                          disabled={settingPrimaryId === device.id}
                          className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/60"
                        >
                          {settingPrimaryId === device.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          {t("makePrimary")}
                        </PodaciumButton>
                      )}
                      <PodaciumButton
                        variant={device.isTrusted ? "outline" : "primary"}
                        size="sm"
                        onClick={() => handleTrustToggle(device)}
                        disabled={trustingId === device.id}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {trustingId === device.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : device.isTrusted ? (
                          <ShieldOff className="w-3 h-3" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        {device.isTrusted ? t("revokeTrust") : t("trustToggle")}
                      </PodaciumButton>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>

      {!compact && (
        <SectionCard
          title={t("securityEvents")}
          icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          padding="sm"
        >
          {events.length === 0 ? (
            <EmptyState
              icon={<Shield className="w-10 h-10" />}
              title={t("noEvents")}
            />
          ) : (
            <div className="p-4">
              {groupEventsByDate(events).map((group) => (
                <div key={group.label} className="mb-6 last:mb-0">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {group.label}
                  </h4>
                  <div className="relative">
                    <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-800/90 rounded" />
                    <div className="space-y-4">
                      {group.events.map((event) => {
                        const Icon = eventIcon(event.eventType);
                        const color = eventColor(event.eventType);
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-4 relative pl-0"
                          >
                            <div
                              className={`relative z-10 p-1.5 rounded-full ${
                                color === "red"
                                  ? "bg-red-100"
                                  : color === "emerald"
                                    ? "bg-emerald-100"
                                    : color === "amber"
                                      ? "bg-amber-100"
                                      : "bg-blue-100"
                              }`}
                            >
                              <Icon
                                className={`w-3.5 h-3.5 ${
                                  color === "red"
                                    ? "text-red-500"
                                    : color === "emerald"
                                      ? "text-emerald-500"
                                      : color === "amber"
                                        ? "text-amber-500"
                                        : "text-blue-500"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {formatEventType(event.eventType)}
                              </p>
                              {formatEventDescription(event) && (
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                  {formatEventDescription(event)}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatTime(event.createdAt)}
                              </p>
                            </div>
                            {event.wilaya && (
                              <PodaciumBadge
                                variant="outline"
                                className="text-xs"
                              >
                                {event.wilaya}
                              </PodaciumBadge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
      <PodaciumModal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmDesc")}
        size="sm"
      >
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/60 rounded-lg mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {confirmRemove?.browserName ||
              confirmRemove?.platform ||
              t("unknownDevice")}
            {confirmRemove?.osVersion ? ` — ${confirmRemove.osVersion}` : ""}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <PodaciumButton
            variant="outline"
            onClick={() => setConfirmRemove(null)}
          >
            {t("cancel")}
          </PodaciumButton>
          <PodaciumButton
            variant="destructive"
            onClick={() => confirmRemove && handleRemoveDevice(confirmRemove)}
            disabled={removingId === confirmRemove?.id}
            className="flex items-center gap-2"
          >
            {removingId === confirmRemove?.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {t("removeButton")}
          </PodaciumButton>
        </div>
      </PodaciumModal>
    </div>
  );
}
