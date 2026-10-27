"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  Settings,
  Save,
  Loader2,
  CreditCard,
  Users,
  Shield,
  Bell,
  Sliders,
  ToggleLeft,
  Percent,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Video,
  Key,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import PodaciumButton from "@/components/design-system/PodaciumButton";

// Types
interface SubscriptionTier {
  id?: number;
  plan: string;
  category: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: string;
  yearlyPrice?: number;
  maxCourses?: number;
  maxStorage?: number;
  maxStudents?: number;
  maxDatasets?: number;
  maxDashboards?: number;
  maxApiCalls?: number;
  features?: string[];
  isActive: boolean;
  sortOrder: number;
  trialDays: number;
}

interface CommissionRate {
  id?: number;
  tier: string;
  commissionPercent: number;
  minProject?: number;
  maxProject?: number;
  description?: string;
  isActive: boolean;
}

interface PaymentGateway {
  id: number;
  gateway: string;
  displayName: string;
  isEnabled: boolean;
  isDefault: boolean;
  environment: string;
  supportedCurrencies: string[];
  minAmount?: number;
  maxAmount?: number;
}

interface FeatureFlag {
  id?: number;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  category: string;
}

interface PlatformLimit {
  id?: number;
  key: string;
  name: string;
  description?: string;
  value: number;
  unit?: string;
  category: string;
}

interface NotificationChannel {
  id: number;
  channel: string;
  isEnabled: boolean;
  providerName?: string;
  rateLimitPerHour?: number;
}

interface SecuritySetting {
  id: number;
  key: string;
  name: string;
  description?: string;
  value: string;
  category: string;
}

type TabKey =
  | "general"
  | "subscriptions"
  | "commissions"
  | "payments"
  | "features"
  | "limits"
  | "notifications"
  | "security"
  | "video";

const TABS: { key: TabKey; icon: any }[] = [
  { key: "general", icon: Settings },
  { key: "subscriptions", icon: CreditCard },
  { key: "commissions", icon: Percent },
  { key: "payments", icon: CreditCard },
  { key: "features", icon: ToggleLeft },
  { key: "limits", icon: Sliders },
  { key: "notifications", icon: Bell },
  { key: "security", icon: Shield },
  { key: "video", icon: Video },
];

const EDTECH_PLANS = ["FREE", "STUDENT_STARTER", "STUDENT_PLUS", "STUDENT_PRO"];
const BI_PLANS = ["BI_GROWTH", "BI_SCALE", "BI_ELITE"];
const FREELANCER_TIERS = ["NEW", "STANDARD", "PRO", "ENTERPRISE"];

export default function AdminSettingsPage() {
  const t = useTranslations("admin");
  const { dir } = useBidi();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General settings state
  const [generalSettings, setGeneralSettings] = useState<
    Record<string, string>
  >({});

  // Subscription tiers state
  const [edtechTiers, setEdtechTiers] = useState<SubscriptionTier[]>([]);
  const [biTiers, setBiTiers] = useState<SubscriptionTier[]>([]);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [tierCategory, setTierCategory] = useState<"EDTECH" | "BI">("EDTECH");

  // Commission rates state
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);

  // Payment gateways state
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);

  // Platform limits state
  const [platformLimits, setPlatformLimits] = useState<PlatformLimit[]>([]);
  const [editingLimit, setEditingLimit] = useState<PlatformLimit | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Notification config state
  const [notificationChannels, setNotificationChannels] = useState<
    NotificationChannel[]
  >([]);

  // Security config state
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>(
    [],
  );

  // Video infrastructure state
  const [videoProvider, setVideoProvider] = useState<string>("aws");
  const [videoSettings, setVideoSettings] = useState<Record<string, string>>(
    {},
  );
  const [videoAuditLogs, setVideoAuditLogs] = useState<any[]>([]);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // === I18N MAPPING: translate DB-sourced English names/descriptions ===
  const i18nMap = {
    security: (key: string) => ({
      name: t(`admin.settings.security.items.${key}.name`, undefined, key),
      desc: t(`admin.settings.security.items.${key}.desc`, undefined, ""),
    }),
    limits: (key: string) => ({
      name: t(`admin.settings.limits.items.${key}.name`, undefined, key),
      desc: t(`admin.settings.limits.items.${key}.desc`, undefined, ""),
      unit: t(`admin.settings.limits.items.${key}.unit`, undefined, ""),
    }),
    flags: (key: string) => ({
      name: t(`admin.settings.features.items.${key}.name`, undefined, key),
      desc: t(`admin.settings.features.items.${key}.desc`, undefined, ""),
    }),
    tiers: (plan: string) => ({
      name: t(
        `admin.settings.subscriptions.plans.${plan}.name`,
        undefined,
        plan,
      ),
      desc: t(`admin.settings.subscriptions.plans.${plan}.desc`, undefined, ""),
    }),
  };
  // Load data based on active tab
  const loadTabData = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      switch (tab) {
        case "general":
          const settings = await api.get<Record<string, string>>(
            "/api/admin/settings",
          );
          setGeneralSettings(settings);
          break;
        case "subscriptions":
          const tiers = await api.get<SubscriptionTier[]>(
            "/api/admin/settings/subscription-tiers",
          );
          setEdtechTiers(tiers.filter((t) => t.category === "EDTECH"));
          setBiTiers(tiers.filter((t) => t.category === "BI"));
          break;
        case "commissions":
          const rates = await api.get<CommissionRate[]>(
            "/api/admin/settings/commission-rates",
          );
          setCommissionRates(rates);
          break;
        case "payments":
          const gw = await api.get<PaymentGateway[]>(
            "/api/admin/settings/payment-gateways",
          );
          setGateways(gw);
          break;
        case "features":
          const flags = await api.get<FeatureFlag[]>(
            "/api/admin/settings/feature-flags",
          );
          setFeatureFlags(flags);
          break;
        case "limits":
          const limits = await api.get<PlatformLimit[]>(
            "/api/admin/settings/platform-limits",
          );
          setPlatformLimits(limits);
          break;
        case "notifications":
          const channels = await api.get<NotificationChannel[]>(
            "/api/admin/settings/notification-config",
          );
          setNotificationChannels(channels);
          break;
        case "security":
          const sec = await api.get<SecuritySetting[]>(
            "/api/admin/settings/security",
          );
          setSecuritySettings(sec);
          break;
        case "video":
          const videoRes = await api.get<{
            active_provider: string;
            settings: Record<string, string>;
          }>("/api/admin/settings/video");
          if (videoRes?.active_provider) {
            setVideoProvider(videoRes.active_provider);
          }
          if (videoRes?.settings) {
            setVideoSettings(videoRes.settings);
          }
          break;
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // === GENERAL SETTINGS HANDLERS ===
  const saveGeneralSettings = async () => {
    setSaving(true);
    try {
      await api.put("/api/admin/settings", generalSettings);
      toast.success(t("admin.settings.saved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // === SUBSCRIPTION TIER HANDLERS ===
  const saveTier = async (tier: SubscriptionTier) => {
    setSaving(true);
    try {
      if (tier.id) {
        await api.put(
          `/api/admin/settings/subscription-tiers/${tier.id}`,
          tier,
        );
      } else {
        await api.post("/api/admin/settings/subscription-tiers", tier);
      }
      toast.success(t("admin.settings.saved"));
      setShowTierModal(false);
      setEditingTier(null);
      loadTabData("subscriptions");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTier = async (id: number) => {
    if (!confirm(t("admin.settings.subscriptions.deleteConfirm"))) return;
    try {
      await api.delete(`/api/admin/settings/subscription-tiers/${id}`);
      toast.success(t("admin.settings.saved"));
      loadTabData("subscriptions");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  // === COMMISSION RATE HANDLERS ===
  const saveRate = async (rate: CommissionRate) => {
    setSaving(true);
    try {
      if (rate.id) {
        await api.put(`/api/admin/settings/commission-rates/${rate.id}`, rate);
      } else {
        await api.post("/api/admin/settings/commission-rates", rate);
      }
      toast.success(t("admin.settings.saved"));
      setShowRateModal(false);
      setEditingRate(null);
      loadTabData("commissions");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // === PAYMENT GATEWAY HANDLERS ===
  const updateGateway = async (id: number, data: Partial<PaymentGateway>) => {
    try {
      await api.put(`/api/admin/settings/payment-gateways/${id}`, data);
      toast.success(t("admin.settings.saved"));
      loadTabData("payments");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  // === FEATURE FLAG HANDLERS ===
  const saveFlag = async (flag: FeatureFlag) => {
    setSaving(true);
    try {
      if (flag.id) {
        await api.put(`/api/admin/settings/feature-flags/${flag.id}`, flag);
      } else {
        await api.post("/api/admin/settings/feature-flags", flag);
      }
      toast.success(t("admin.settings.saved"));
      setShowFlagModal(false);
      setEditingFlag(null);
      loadTabData("features");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    try {
      await api.put(`/api/admin/settings/feature-flags/${flag.id}`, {
        isEnabled: !flag.isEnabled,
      });
      loadTabData("features");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  const deleteFlag = async (id: number) => {
    try {
      await api.delete(`/api/admin/settings/feature-flags/${id}`);
      toast.success(t("admin.settings.saved"));
      loadTabData("features");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  // === PLATFORM LIMIT HANDLERS ===
  const saveLimit = async (limit: PlatformLimit) => {
    setSaving(true);
    try {
      if (limit.id) {
        await api.put(`/api/admin/settings/platform-limits/${limit.id}`, limit);
      } else {
        await api.post("/api/admin/settings/platform-limits", limit);
      }
      toast.success(t("admin.settings.saved"));
      setShowLimitModal(false);
      setEditingLimit(null);
      loadTabData("limits");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // === NOTIFICATION HANDLERS ===
  const updateNotificationChannel = async (
    id: number,
    data: Partial<NotificationChannel>,
  ) => {
    try {
      await api.put(`/api/admin/settings/notification-config/${id}`, data);
      toast.success(t("admin.settings.saved"));
      loadTabData("notifications");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  // === SECURITY HANDLERS ===
  const updateSecuritySetting = async (id: number, value: string) => {
    try {
      await api.put(`/api/admin/settings/security/${id}`, { value });
      toast.success(t("admin.settings.saved"));
      loadTabData("security");
    } catch (e: any) {
      toast.error(e?.message || t("admin.settings.saveFailed"));
    }
  };

  // === HELPER: Format price ===
  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} ${t("admin.settings.subscriptions.currency")}`;
  };

  // === RENDER: General Settings Tab ===
  const renderGeneralTab = () => (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.general.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.settings.general.subtitle")}
          </p>
        </div>
        <button
          onClick={saveGeneralSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {t("admin.common.save")}
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-100">
        {/* Maintenance Mode */}
        <SettingRow
          label={t("admin.settings.general.maintenanceMode")}
          description={t("admin.settings.general.maintenanceModeDesc")}
        >
          <Toggle
            value={generalSettings.maintenance_mode === "true"}
            onChange={(v) =>
              setGeneralSettings({
                ...generalSettings,
                maintenance_mode: v ? "true" : "false",
              })
            }
          />
        </SettingRow>
        {/* Registration */}
        <SettingRow
          label={t("admin.settings.general.registrationEnabled")}
          description={t("admin.settings.general.registrationEnabledDesc")}
        >
          <Toggle
            value={generalSettings.registration_enabled === "true"}
            onChange={(v) =>
              setGeneralSettings({
                ...generalSettings,
                registration_enabled: v ? "true" : "false",
              })
            }
          />
        </SettingRow>
        {/* Language */}
        <SettingRow label={t("admin.settings.general.defaultLanguage")}>
          <select
            value={generalSettings.default_language || "en"}
            onChange={(e) =>
              setGeneralSettings({
                ...generalSettings,
                default_language: e.target.value,
              })
            }
            className="px-3 py-1.5 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
          >
            <option value="en">
              {t("admin.settings.general.languages.en")}
            </option>
            <option value="fr">
              {t("admin.settings.general.languages.fr")}
            </option>
            <option value="ar">
              {t("admin.settings.general.languages.ar")}
            </option>
            <option value="kab">
              {t("admin.settings.general.languages.kab")}
            </option>
          </select>
        </SettingRow>
        {/* Commission */}
        <SettingRow
          label={t("admin.settings.general.commissionPercent")}
          description={t("admin.settings.general.commissionPercentDesc")}
        >
          <input
            type="number"
            value={generalSettings.platform_commission_percent || ""}
            onChange={(e) =>
              setGeneralSettings({
                ...generalSettings,
                platform_commission_percent: e.target.value,
              })
            }
            className="w-24 px-3 py-1.5 border border-gray-200 dark:border-slate-800 rounded-lg text-sm text-end"
          />
        </SettingRow>
        {/* Max File Size */}
        <SettingRow
          label={t("admin.settings.general.maxFileSize")}
          description={t("admin.settings.general.maxFileSizeDesc")}
        >
          <input
            type="number"
            value={generalSettings.max_file_size_mb || ""}
            onChange={(e) =>
              setGeneralSettings({
                ...generalSettings,
                max_file_size_mb: e.target.value,
              })
            }
            className="w-24 px-3 py-1.5 border border-gray-200 dark:border-slate-800 rounded-lg text-sm text-end"
          />
        </SettingRow>
      </div>
    </div>
  );

  // === RENDER: Subscriptions Tab ===
  const renderSubscriptionsTab = () => (
    <div className="space-y-8">
      {/* EdTech Tiers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {t("admin.settings.subscriptions.edtech")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t("admin.settings.subscriptions.edtechDesc")}
            </p>
          </div>
          <button
            onClick={() => {
              setTierCategory("EDTECH");
              setEditingTier({
                plan: "FREE",
                category: "EDTECH",
                name: "",
                price: 0,
                billingCycle: "monthly",
                isActive: true,
                sortOrder: edtechTiers.length,
                trialDays: 0,
              });
              setShowTierModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            {t("admin.settings.subscriptions.addTier")}
          </button>
        </div>
        {edtechTiers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            {t("admin.settings.subscriptions.noTiers")}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {edtechTiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                onEdit={() => {
                  setEditingTier(tier);
                  setTierCategory("EDTECH");
                  setShowTierModal(true);
                }}
                onDelete={() => tier.id && deleteTier(tier.id)}
                formatPrice={formatPrice}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* BI Tiers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {t("admin.settings.subscriptions.bi")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t("admin.settings.subscriptions.biDesc")}
            </p>
          </div>
          <button
            onClick={() => {
              setTierCategory("BI");
              setEditingTier({
                plan: "BI_GROWTH",
                category: "BI",
                name: "",
                price: 0,
                billingCycle: "monthly",
                isActive: true,
                sortOrder: biTiers.length,
                trialDays: 0,
              });
              setShowTierModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            {t("admin.settings.subscriptions.addTier")}
          </button>
        </div>
        {biTiers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            {t("admin.settings.subscriptions.noTiers")}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {biTiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                onEdit={() => {
                  setEditingTier(tier);
                  setTierCategory("BI");
                  setShowTierModal(true);
                }}
                onDelete={() => tier.id && deleteTier(tier.id)}
                formatPrice={formatPrice}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // === RENDER: Commissions Tab ===
  const renderCommissionsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.commissions.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.settings.commissions.subtitle")}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRate({
              tier: "NEW",
              commissionPercent: 15,
              isActive: true,
            });
            setShowRateModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t("admin.settings.commissions.addRate")}
        </button>
      </div>
      {commissionRates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.commissions.noRates")}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.commissions.tier")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.commissions.rate")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.commissions.minProject")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.commissions.maxProject")}
                </th>
                <th className="px-6 py-3 text-end font-medium text-gray-600 dark:text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commissionRates.map((rate) => (
                <tr
                  key={rate.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                      {t(`admin.settings.commissions.tiers.${rate.tier}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-100">
                    {rate.commissionPercent}%
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
                    {rate.minProject ? formatPrice(rate.minProject) : "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
                    {rate.maxProject ? formatPrice(rate.maxProject) : "—"}
                  </td>
                  <td className="px-6 py-4 text-end">
                    <button
                      onClick={() => {
                        setEditingRate(rate);
                        setShowRateModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // === RENDER: Payments Tab ===
  const renderPaymentsTab = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t("admin.settings.payments.title")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("admin.settings.payments.subtitle")}
        </p>
      </div>
      {gateways.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.payments.noGateways")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-6 transition-all ${gw.isEnabled ? "border-green-200 dark:border-emerald-800/80 shadow-sm" : "border-gray-100 dark:border-slate-800 opacity-75"}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${gw.isEnabled ? "bg-green-50 dark:bg-emerald-950/40" : "bg-gray-50 dark:bg-slate-900/60"}`}
                  >
                    <CreditCard
                      size={20}
                      className={
                        gw.isEnabled ? "text-green-600" : "text-gray-400"
                      }
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-slate-100">
                      {gw.displayName}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {gw.gateway}
                    </p>
                  </div>
                </div>
                {gw.isDefault && (
                  <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                    {t("admin.settings.payments.default")}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {t("admin.settings.payments.enabled")}
                  </span>
                  <Toggle
                    value={gw.isEnabled}
                    onChange={(v) => updateGateway(gw.id, { isEnabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {t("admin.settings.payments.environment")}
                  </span>
                  <select
                    value={gw.environment}
                    onChange={(e) =>
                      updateGateway(gw.id, { environment: e.target.value })
                    }
                    className="px-2 py-1 border border-gray-200 dark:border-slate-800 rounded-lg text-xs bg-white dark:bg-slate-900"
                  >
                    <option value="sandbox">
                      {t("admin.settings.payments.sandbox")}
                    </option>
                    <option value="production">
                      {t("admin.settings.payments.production")}
                    </option>
                  </select>
                </div>
                {!gw.isDefault && gw.isEnabled && (
                  <button
                    onClick={() => updateGateway(gw.id, { isDefault: true })}
                    className="w-full mt-2 px-3 py-1.5 border border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                  >
                    {t("admin.settings.payments.setDefault")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // === RENDER: Features Tab ===
  const renderFeaturesTab = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.features.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.settings.features.subtitle")}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingFlag({
              key: "",
              name: "",
              isEnabled: false,
              category: "general",
            });
            setShowFlagModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t("admin.settings.features.addFlag")}
        </button>
      </div>
      {featureFlags.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.features.noFlags")}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-50">
          {featureFlags.map((flag) => {
            const localized = i18nMap.flags(flag.key);
            return (
              <div
                key={flag.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Toggle
                    value={flag.isEnabled}
                    onChange={() => toggleFlag(flag)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {localized.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {flag.key}
                      </code>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {t(
                          `admin.settings.features.categories.${flag.category}`,
                        )}
                      </span>
                    </div>
                    {localized.desc && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {localized.desc}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingFlag(flag);
                      setShowFlagModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => flag.id && deleteFlag(flag.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // === RENDER: Limits Tab ===
  const renderLimitsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.limits.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.settings.limits.subtitle")}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingLimit({
              key: "",
              name: "",
              value: 0,
              category: "general",
            });
            setShowLimitModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          {t("admin.settings.limits.addLimit")}
        </button>
      </div>
      {platformLimits.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.limits.noLimits")}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.limits.name")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.limits.value")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.limits.unit")}
                </th>
                <th className="px-6 py-3 text-start font-medium text-gray-600 dark:text-slate-400">
                  {t("admin.settings.limits.category")}
                </th>
                <th className="px-6 py-3 text-end font-medium text-gray-600 dark:text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {platformLimits.map((limit) => {
                const localized = i18nMap.limits(limit.key);
                return (
                  <tr
                    key={limit.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-slate-100">
                        {localized.name}
                      </p>
                      {localized.desc && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          {localized.desc}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-slate-100">
                      {limit.value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-slate-400">
                      {localized.unit || limit.unit || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded-full">
                        {t(
                          `admin.settings.limits.categories.${limit.category}`,
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <button
                        onClick={() => {
                          setEditingLimit(limit);
                          setShowLimitModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // === RENDER: Notifications Tab ===
  const renderNotificationsTab = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t("admin.settings.notifications.title")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("admin.settings.notifications.subtitle")}
        </p>
      </div>
      {notificationChannels.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.notifications.noChannels")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notificationChannels.map((ch) => (
            <div
              key={ch.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-6 transition-all ${ch.isEnabled ? "border-green-200 dark:border-emerald-800/80" : "border-gray-100 dark:border-slate-800 opacity-75"}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${ch.isEnabled ? "bg-green-50 dark:bg-emerald-950/40" : "bg-gray-50 dark:bg-slate-900/60"}`}
                  >
                    <Bell
                      size={20}
                      className={
                        ch.isEnabled ? "text-green-600" : "text-gray-400"
                      }
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-slate-100">
                      {t(`admin.settings.notifications.channels.${ch.channel}`)}
                    </h4>
                    {ch.providerName && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {ch.providerName}
                      </p>
                    )}
                  </div>
                </div>
                <Toggle
                  value={ch.isEnabled}
                  onChange={(v) =>
                    updateNotificationChannel(ch.id, { isEnabled: v })
                  }
                />
              </div>
              {ch.rateLimitPerHour && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">
                    {t("admin.settings.notifications.rateLimit")}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {ch.rateLimitPerHour}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // === RENDER: Security Tab ===
  const renderSecurityTab = () => (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {t("admin.settings.security.title")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("admin.settings.security.subtitle")}
        </p>
      </div>
      {securitySettings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
          {t("admin.settings.security.noConfigs")}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-50">
          {securitySettings.map((setting) => {
            const localized = i18nMap.security(setting.key);
            return (
              <div
                key={setting.id}
                className="p-5 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {localized.name}
                  </p>
                  {localized.desc && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {localized.desc}
                    </p>
                  )}
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-xs rounded-full">
                    {t(
                      `admin.settings.security.categories.${setting.category}`,
                    )}
                  </span>
                </div>
                <input
                  type="text"
                  value={setting.value}
                  onChange={(e) =>
                    setSecuritySettings(
                      securitySettings.map((s) =>
                        s.id === setting.id
                          ? { ...s, value: e.target.value }
                          : s,
                      ),
                    )
                  }
                  onBlur={(e) =>
                    updateSecuritySetting(setting.id, e.target.value)
                  }
                  className="w-40 px-3 py-1.5 border border-gray-200 dark:border-slate-800 rounded-lg text-sm text-end"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // === RENDER: Video Tab ===
  const handleSaveVideoSettings = async () => {
    setSaving(true);
    try {
      const cleanSettings = { ...videoSettings };
      delete cleanSettings["video.active_provider"];
      await api.post("/api/admin/settings/video", {
        active_provider: videoProvider,
        settings: cleanSettings,
      });
      toast.success(t("admin.settings.video.saved"));
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail || t("admin.settings.video.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestProvider = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/admin/settings/video/test?provider_name=${provider}`);
      if (res.success) {
        toast.success(
          res.message ||
            `Provider ${provider.toUpperCase()} initialized successfully!`,
        );
      } else {
        toast.error(res.error || `Failed to test ${provider} provider`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || `Error testing ${provider}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const renderVideoTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.settings.video.subtitle")}
          </p>
        </div>
        <button
          onClick={handleSaveVideoSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 text-sm"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t("admin.settings.video.save")}
        </button>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AWS Card */}
        <div
          onClick={() => setVideoProvider("aws")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "aws"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "aws" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
            <Server className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.aws.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.aws.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "AWS",
              })}
            </span>
            {videoProvider === "aws" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>

        {/* Bunny Stream Card */}
        <div
          onClick={() => setVideoProvider("bunny")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "bunny"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "bunny" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-3">
            <Cloud className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.bunny.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.bunny.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "Bunny",
              })}
            </span>
            {videoProvider === "bunny" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>

        {/* Cloudflare Stream Card */}
        <div
          onClick={() => setVideoProvider("cloudflare")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "cloudflare"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "cloudflare" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3">
            <Video className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.cloudflare.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.cloudflare.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "Cloudflare",
              })}
            </span>
            {videoProvider === "cloudflare" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>

        {/* YouTube Card */}
        <div
          onClick={() => setVideoProvider("youtube")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "youtube"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "youtube" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center mb-3">
            <Video className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.youtube.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.youtube.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "YouTube",
              })}
            </span>
            {videoProvider === "youtube" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>

        {/* Vimeo Card */}
        <div
          onClick={() => setVideoProvider("vimeo")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "vimeo"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "vimeo" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-3">
            <Video className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.vimeo.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.vimeo.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "Vimeo",
              })}
            </span>
            {videoProvider === "vimeo" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>

        {/* Dailymotion Card */}
        <div
          onClick={() => setVideoProvider("dailymotion")}
          className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative ${
            videoProvider === "dailymotion"
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md"
              : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700"
          }`}
        >
          {videoProvider === "dailymotion" && (
            <span className="absolute top-4 right-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
            <Video className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {t("admin.settings.video.dailymotion.title")}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.settings.video.dailymotion.desc")}
          </p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-mono text-gray-400 dark:text-slate-500">
              {t("admin.settings.video.strategyWithProvider", {
                strategy: t("admin.settings.video.strategy"),
                provider: "Dailymotion",
              })}
            </span>
            {videoProvider === "dailymotion" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                {t("admin.settings.video.activeProvider")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Credentials Configuration Accordion / Forms */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 space-y-6">
        <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t("admin.settings.video.encryptedCredentials")}
        </h4>

        {/* AWS Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.aws.title")}
            </span>
            <button
              onClick={() => handleTestProvider("aws")}
              disabled={testingProvider === "aws"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "aws" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.aws.s3Bucket")}
              </label>
              <input
                type="text"
                value={videoSettings["video.aws.s3_bucket"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.aws.s3_bucket": e.target.value,
                  })
                }
                placeholder="podacium-videos-2026"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.aws.region")}
              </label>
              <input
                type="text"
                value={videoSettings["video.aws.region"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.aws.region": e.target.value,
                  })
                }
                placeholder="us-east-1"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.aws.cloudfrontDomain")}
              </label>
              <input
                type="text"
                value={videoSettings["video.aws.cloudfront_domain"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.aws.cloudfront_domain": e.target.value,
                  })
                }
                placeholder="d12345.cloudfront.net"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.aws.keyPairId")}
              </label>
              <input
                type="text"
                value={videoSettings["video.aws.cloudfront_key_pair_id"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.aws.cloudfront_key_pair_id": e.target.value,
                  })
                }
                placeholder="K1234567890ABC"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {/* Bunny Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.bunny.title")}
            </span>
            <button
              onClick={() => handleTestProvider("bunny")}
              disabled={testingProvider === "bunny"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "bunny" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.bunny.libraryId")}
              </label>
              <input
                type="text"
                value={videoSettings["video.bunny.library_id"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.bunny.library_id": e.target.value,
                  })
                }
                placeholder="123456"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.bunny.apiKey")}
              </label>
              <input
                type="password"
                value={videoSettings["video.bunny.api_key"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.bunny.api_key": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.bunny.cdnHostname")}
              </label>
              <input
                type="text"
                value={videoSettings["video.bunny.cdn_hostname"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.bunny.cdn_hostname": e.target.value,
                  })
                }
                placeholder="vz-12345.b-cdn.net"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.bunny.tokenAuthKey")}
              </label>
              <input
                type="password"
                value={videoSettings["video.bunny.token_auth_key"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.bunny.token_auth_key": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Cloudflare Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.cloudflare.title")}
            </span>
            <button
              onClick={() => handleTestProvider("cloudflare")}
              disabled={testingProvider === "cloudflare"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "cloudflare" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.cloudflare.accountId")}
              </label>
              <input
                type="text"
                value={videoSettings["video.cloudflare.account_id"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.cloudflare.account_id": e.target.value,
                  })
                }
                placeholder="cf_account_hash"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.cloudflare.apiToken")}
              </label>
              <input
                type="password"
                value={videoSettings["video.cloudflare.api_token"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.cloudflare.api_token": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.cloudflare.subdomain")}
              </label>
              <input
                type="text"
                value={videoSettings["video.cloudflare.subdomain"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.cloudflare.subdomain": e.target.value,
                  })
                }
                placeholder="videodelivery.net"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {/* YouTube Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.youtube.title")}
            </span>
            <button
              onClick={() => handleTestProvider("youtube")}
              disabled={testingProvider === "youtube"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "youtube" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.youtube.accessToken")}
              </label>
              <input
                type="password"
                value={videoSettings["video.youtube.access_token"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.youtube.access_token": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.youtube.channelId")}
              </label>
              <input
                type="text"
                value={videoSettings["video.youtube.channel_id"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.youtube.channel_id": e.target.value,
                  })
                }
                placeholder="UC1234567890ABC"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {/* Vimeo Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.vimeo.title")}
            </span>
            <button
              onClick={() => handleTestProvider("vimeo")}
              disabled={testingProvider === "vimeo"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "vimeo" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.vimeo.accessToken")}
              </label>
              <input
                type="password"
                value={videoSettings["video.vimeo.access_token"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.vimeo.access_token": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Dailymotion Section */}
        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-slate-200">
              {t("admin.settings.video.dailymotion.title")}
            </span>
            <button
              onClick={() => handleTestProvider("dailymotion")}
              disabled={testingProvider === "dailymotion"}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {testingProvider === "dailymotion" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {t("admin.settings.video.testConnection")}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-slate-400 block mb-1 font-medium">
                {t("admin.settings.video.dailymotion.apiKey")}
              </label>
              <input
                type="password"
                value={videoSettings["video.dailymotion.api_key"] || ""}
                onChange={(e) =>
                  setVideoSettings({
                    ...videoSettings,
                    "video.dailymotion.api_key": e.target.value,
                  })
                }
                placeholder="••••••••••••••••"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit History Log Table */}
      {videoAuditLogs.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            {t("admin.settings.video.auditLog")}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-3 py-2">
                    {t("admin.settings.video.table.key")}
                  </th>
                  <th className="px-3 py-2">
                    {t("admin.settings.video.table.oldVal")}
                  </th>
                  <th className="px-3 py-2">
                    {t("admin.settings.video.table.newVal")}
                  </th>
                  <th className="px-3 py-2">
                    {t("admin.settings.video.table.by")}
                  </th>
                  <th className="px-3 py-2">
                    {t("admin.settings.video.table.timestamp")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                {videoAuditLogs.slice(0, 10).map((log: any) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-slate-200">
                      {log.setting_key}
                    </td>
                    <td className="px-3 py-2 text-gray-400 dark:text-slate-500">
                      {log.old_value || "—"}
                    </td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                      {log.new_value || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">
                      {log.changed_by}
                    </td>
                    <td className="px-3 py-2 text-gray-400 dark:text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // === MAIN RENDER ===
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
          {t("admin.settings.title")}
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          {t("admin.settings.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-xl min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-sm"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  size={16}
                  className={
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-400"
                  }
                />
                {t(`admin.settings.tabs.${tab.key}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {activeTab === "general" && renderGeneralTab()}
              {activeTab === "subscriptions" && renderSubscriptionsTab()}
              {activeTab === "commissions" && renderCommissionsTab()}
              {activeTab === "payments" && renderPaymentsTab()}
              {activeTab === "features" && renderFeaturesTab()}
              {activeTab === "limits" && renderLimitsTab()}
              {activeTab === "notifications" && renderNotificationsTab()}
              {activeTab === "security" && renderSecurityTab()}
              {activeTab === "video" && renderVideoTab()}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Tier Modal */}
      <AnimatePresence>
        {showTierModal && editingTier && (
          <Modal
            onClose={() => {
              setShowTierModal(false);
              setEditingTier(null);
            }}
          >
            <TierForm
              tier={editingTier}
              category={tierCategory}
              plans={tierCategory === "EDTECH" ? EDTECH_PLANS : BI_PLANS}
              onSave={saveTier}
              onCancel={() => {
                setShowTierModal(false);
                setEditingTier(null);
              }}
              saving={saving}
              t={t}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Commission Rate Modal */}
      <AnimatePresence>
        {showRateModal && editingRate && (
          <Modal
            onClose={() => {
              setShowRateModal(false);
              setEditingRate(null);
            }}
          >
            <RateForm
              rate={editingRate}
              onSave={saveRate}
              onCancel={() => {
                setShowRateModal(false);
                setEditingRate(null);
              }}
              saving={saving}
              t={t}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Feature Flag Modal */}
      <AnimatePresence>
        {showFlagModal && editingFlag && (
          <Modal
            onClose={() => {
              setShowFlagModal(false);
              setEditingFlag(null);
            }}
          >
            <FlagForm
              flag={editingFlag}
              onSave={saveFlag}
              onCancel={() => {
                setShowFlagModal(false);
                setEditingFlag(null);
              }}
              saving={saving}
              t={t}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Platform Limit Modal */}
      <AnimatePresence>
        {showLimitModal && editingLimit && (
          <Modal
            onClose={() => {
              setShowLimitModal(false);
              setEditingLimit(null);
            }}
          >
            <LimitForm
              limit={editingLimit}
              onSave={saveLimit}
              onCancel={() => {
                setShowLimitModal(false);
                setEditingLimit(null);
              }}
              saving={saving}
              t={t}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { isRTL } = useBidi();
  // In LTR: OFF=left(2px), ON=right(22px)
  // In RTL: OFF=right(2px from right), ON=left(2px from left) — knob moves left when ON
  const knobLeft = isRTL ? (value ? "2px" : "22px") : value ? "22px" : "2px";
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${value ? "bg-blue-600" : "bg-gray-300"}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className="absolute top-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm transition-all duration-200"
        style={{ left: knobLeft }}
      />
    </button>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function TierCard({
  tier,
  onEdit,
  onDelete,
  formatPrice,
  t,
}: {
  tier: SubscriptionTier;
  onEdit: () => void;
  onDelete: () => void;
  formatPrice: (c: number) => string;
  t: any;
}) {
  const localizedName = t(
    `admin.settings.subscriptions.plans.${tier.plan}.name`,
    undefined,
    tier.name,
  );
  const localizedDesc = t(
    `admin.settings.subscriptions.plans.${tier.plan}.desc`,
    undefined,
    tier.description || "",
  );
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border p-5 transition-all hover:shadow-md ${tier.isActive ? "border-gray-200 dark:border-slate-800" : "border-gray-100 dark:border-slate-800 opacity-60"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {localizedName}
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {tier.plan}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded-full ${tier.isActive ? "bg-green-50 dark:bg-emerald-950/40 text-green-700" : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"}`}
        >
          {tier.isActive
            ? t("admin.settings.subscriptions.active")
            : t("admin.settings.subscriptions.inactive")}
        </span>
      </div>
      <div className="mb-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {formatPrice(tier.price)}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          / {t(`admin.settings.subscriptions.${tier.billingCycle}`)}
        </p>
        {tier.yearlyPrice && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {formatPrice(tier.yearlyPrice)} /{" "}
            {t("admin.settings.subscriptions.yearly")}
          </p>
        )}
      </div>
      <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-400 mb-4">
        {tier.maxCourses && (
          <p>
            • {t("admin.settings.subscriptions.maxCourses")}: {tier.maxCourses}
          </p>
        )}
        {tier.maxStorage && (
          <p>
            • {t("admin.settings.subscriptions.maxStorage")}: {tier.maxStorage}
          </p>
        )}
        {tier.maxStudents && (
          <p>
            • {t("admin.settings.subscriptions.maxStudents")}:{" "}
            {tier.maxStudents}
          </p>
        )}
        {tier.maxDatasets && (
          <p>
            • {t("admin.settings.subscriptions.maxDatasets")}:{" "}
            {tier.maxDatasets}
          </p>
        )}
        {tier.maxDashboards && (
          <p>
            • {t("admin.settings.subscriptions.maxDashboards")}:{" "}
            {tier.maxDashboards}
          </p>
        )}
        {tier.maxApiCalls && (
          <p>
            • {t("admin.settings.subscriptions.maxApiCalls")}:{" "}
            {tier.maxApiCalls}
          </p>
        )}
        {tier.trialDays > 0 && (
          <p>
            • {t("admin.settings.subscriptions.trialDays")}: {tier.trialDays}
          </p>
        )}
      </div>
      {localizedDesc && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
          {localizedDesc}
        </p>
      )}
      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
        >
          <Edit2 size={13} /> {t("admin.settings.subscriptions.editTier")}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center p-1.5 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TierForm({
  tier,
  category,
  plans,
  onSave,
  onCancel,
  saving,
  t,
}: {
  tier: SubscriptionTier;
  category: "EDTECH" | "BI";
  plans: string[];
  onSave: (t: SubscriptionTier) => void;
  onCancel: () => void;
  saving: boolean;
  t: any;
}) {
  const [form, setForm] = useState<SubscriptionTier>({ ...tier, category });

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
        {tier.id
          ? t("admin.settings.subscriptions.editTier")
          : t("admin.settings.subscriptions.addTier")}
      </h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("admin.settings.subscriptions.plan")}>
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
            >
              {plans.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("admin.settings.subscriptions.name")}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
        </div>
        <FormField label={t("admin.settings.subscriptions.description")}>
          <input
            type="text"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("admin.settings.subscriptions.price")}>
            <input
              type="number"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
          <FormField label={t("admin.settings.subscriptions.yearlyPrice")}>
            <input
              type="number"
              value={form.yearlyPrice || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  yearlyPrice: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label={
              category === "EDTECH"
                ? t("admin.settings.subscriptions.maxCourses")
                : t("admin.settings.subscriptions.maxDatasets")
            }
          >
            <input
              type="number"
              value={
                category === "EDTECH"
                  ? form.maxCourses || ""
                  : form.maxDatasets || ""
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  [category === "EDTECH" ? "maxCourses" : "maxDatasets"]:
                    parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
              placeholder={t("admin.settings.subscriptions.unlimited")}
            />
          </FormField>
          <FormField label={t("admin.settings.subscriptions.maxStorage")}>
            <input
              type="number"
              value={form.maxStorage || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxStorage: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
              placeholder={t("admin.settings.subscriptions.unlimited")}
            />
          </FormField>
          <FormField label={t("admin.settings.subscriptions.trialDays")}>
            <input
              type="number"
              value={form.trialDays}
              onChange={(e) =>
                setForm({ ...form, trialDays: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
        </div>
        {category === "EDTECH" && (
          <FormField label={t("admin.settings.subscriptions.maxStudents")}>
            <input
              type="number"
              value={form.maxStudents || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxStudents: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
              placeholder={t("admin.settings.subscriptions.unlimited")}
            />
          </FormField>
        )}
        {category === "BI" && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("admin.settings.subscriptions.maxDashboards")}>
              <input
                type="number"
                value={form.maxDashboards || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxDashboards: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
                placeholder={t("admin.settings.subscriptions.unlimited")}
              />
            </FormField>
            <FormField label={t("admin.settings.subscriptions.maxApiCalls")}>
              <input
                type="number"
                value={form.maxApiCalls || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxApiCalls: parseInt(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
                placeholder={t("admin.settings.subscriptions.unlimited")}
              />
            </FormField>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Toggle
            value={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />
          <span className="text-sm text-gray-700 dark:text-slate-300">
            {t("admin.settings.subscriptions.active")}
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
        <PodaciumButton
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl text-sm font-medium"
          icon={<X size={16} />}
        >
          {t("admin.common.cancel")}
        </PodaciumButton>
        <PodaciumButton
          variant="primary"
          onClick={() => onSave(form)}
          disabled={saving || !form.name}
          loading={saving}
          className="flex-1 h-10 rounded-xl text-sm font-medium"
          icon={!saving ? <Check size={16} /> : undefined}
        >
          {t("admin.common.save")}
        </PodaciumButton>
      </div>
    </div>
  );
}

function RateForm({
  rate,
  onSave,
  onCancel,
  saving,
  t,
}: {
  rate: CommissionRate;
  onSave: (r: CommissionRate) => void;
  onCancel: () => void;
  saving: boolean;
  t: any;
}) {
  const [form, setForm] = useState<CommissionRate>(rate);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
        {rate.id
          ? t("admin.settings.commissions.editRate")
          : t("admin.settings.commissions.addRate")}
      </h3>
      <div className="space-y-4">
        <FormField label={t("admin.settings.commissions.tier")}>
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
          >
            {FREELANCER_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {t(`admin.settings.commissions.tiers.${tier}`)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={t("admin.settings.commissions.rate")}>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={form.commissionPercent}
            onChange={(e) =>
              setForm({
                ...form,
                commissionPercent: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("admin.settings.commissions.minProject")}>
            <input
              type="number"
              value={form.minProject || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  minProject: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
          <FormField label={t("admin.settings.commissions.maxProject")}>
            <input
              type="number"
              value={form.maxProject || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxProject: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
        </div>
        <FormField label={t("admin.settings.commissions.description")}>
          <input
            type="text"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
        <PodaciumButton
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl text-sm font-medium"
          icon={<X size={16} />}
        >
          {t("admin.common.cancel")}
        </PodaciumButton>
        <PodaciumButton
          variant="primary"
          onClick={() => onSave(form)}
          disabled={saving}
          loading={saving}
          className="flex-1 h-10 rounded-xl text-sm font-medium"
          icon={!saving ? <Check size={16} /> : undefined}
        >
          {t("admin.common.save")}
        </PodaciumButton>
      </div>
    </div>
  );
}

function FlagForm({
  flag,
  onSave,
  onCancel,
  saving,
  t,
}: {
  flag: FeatureFlag;
  onSave: (f: FeatureFlag) => void;
  onCancel: () => void;
  saving: boolean;
  t: any;
}) {
  const [form, setForm] = useState<FeatureFlag>(flag);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
        {flag.id
          ? t("admin.settings.features.editFlag")
          : t("admin.settings.features.addFlag")}
      </h3>
      <div className="space-y-4">
        <FormField label={t("admin.settings.features.key")}>
          <input
            type="text"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            disabled={!!flag.id}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm disabled:bg-gray-50 dark:bg-slate-900/60 disabled:text-gray-500 dark:text-slate-400"
            placeholder={t("admin.settings.features.keyPlaceholder")}
          />
        </FormField>
        <FormField label={t("admin.settings.features.name")}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <FormField label={t("admin.settings.features.description")}>
          <input
            type="text"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <FormField label={t("admin.settings.features.category")}>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
          >
            {["general", "edtech", "bi", "freelance", "experimental"].map(
              (cat) => (
                <option key={cat} value={cat}>
                  {t(`admin.settings.features.categories.${cat}`)}
                </option>
              ),
            )}
          </select>
        </FormField>
        <div className="flex items-center gap-3">
          <Toggle
            value={form.isEnabled}
            onChange={(v) => setForm({ ...form, isEnabled: v })}
          />
          <span className="text-sm text-gray-700 dark:text-slate-300">
            {t("admin.settings.features.enabled")}
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <X size={16} className="inline me-1" />
          {t("admin.common.cancel")}
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.key || !form.name}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="inline me-1 animate-spin" />
          ) : (
            <Check size={16} className="inline me-1" />
          )}
          {t("admin.common.save")}
        </button>
      </div>
    </div>
  );
}

function LimitForm({
  limit,
  onSave,
  onCancel,
  saving,
  t,
}: {
  limit: PlatformLimit;
  onSave: (l: PlatformLimit) => void;
  onCancel: () => void;
  saving: boolean;
  t: any;
}) {
  const [form, setForm] = useState<PlatformLimit>(limit);

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
        {limit.id
          ? t("admin.settings.limits.editLimit")
          : t("admin.settings.limits.addLimit")}
      </h3>
      <div className="space-y-4">
        <FormField label={t("admin.settings.limits.key")}>
          <input
            type="text"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            disabled={!!limit.id}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm disabled:bg-gray-50 dark:bg-slate-900/60 disabled:text-gray-500 dark:text-slate-400"
            placeholder={t("admin.settings.limits.keyPlaceholder")}
          />
        </FormField>
        <FormField label={t("admin.settings.limits.name")}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <FormField label={t("admin.settings.limits.description")}>
          <input
            type="text"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("admin.settings.limits.value")}>
            <input
              type="number"
              value={form.value}
              onChange={(e) =>
                setForm({ ...form, value: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </FormField>
          <FormField label={t("admin.settings.limits.unit")}>
            <input
              type="text"
              value={form.unit || ""}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm"
              placeholder={t("admin.settings.limits.unitPlaceholder")}
            />
          </FormField>
        </div>
        <FormField label={t("admin.settings.limits.category")}>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
          >
            {["general", "upload", "session", "content"].map((cat) => (
              <option key={cat} value={cat}>
                {t(`admin.settings.limits.categories.${cat}`)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <X size={16} className="inline me-1" />
          {t("admin.common.cancel")}
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.key || !form.name}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="inline me-1 animate-spin" />
          ) : (
            <Check size={16} className="inline me-1" />
          )}
          {t("admin.common.save")}
        </button>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
