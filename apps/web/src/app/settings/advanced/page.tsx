"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  Home,
  ChevronRight,
  Shield,
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle,
  Send,
  X,
  FileText,
  Globe,
  BarChart3,
  RotateCw,
  RefreshCw,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";

interface ApiKeyItem {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  ip_whitelist?: string[];
  environment: string;
  created_at: string;
}

interface WebhookItem {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  failure_count: number;
  circuit_state?: string;
  created_at: string;
}

interface WebhookDeliveryItem {
  id: number;
  event_type: string;
  response_status_code: number;
  duration_ms: number;
  status: string;
  delivered_at: string;
  payload: any;
}

const AVAILABLE_SCOPES = [
  { id: "education:courses:read", label: "EdTech: Read Courses" },
  { id: "education:courses:write", label: "EdTech: Manage Courses" },
  { id: "education:certificates:write", label: "EdTech: Issue Certificates" },
  { id: "freelance:contracts:read", label: "Freelance: Read Contracts" },
  { id: "freelance:contracts:write", label: "Freelance: Manage Milestones" },
  { id: "freelance:escrow:manage", label: "Freelance: Escrow Control" },
  { id: "bi:datasets:read", label: "BI Hub: Query Datasets" },
  { id: "bi:datasets:write", label: "BI Hub: Ingest Data" },
  { id: "bi:dashboards:manage", label: "BI Hub: Manage Dashboards" },
];

const AVAILABLE_WEBHOOK_EVENTS = [
  "course.completed",
  "contract.milestone_submitted",
  "escrow.funded",
  "bi.kpi_anomaly_detected",
  "dataset.ingested",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AdvancedPage = () => {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();
  const locale = useLocale();

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Key Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyEnv, setKeyEnv] = useState("production");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "education:courses:read",
  ]);
  const [ipWhitelistText, setIpWhitelistText] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Key Analytics Modal
  const [analyticsKeyId, setAnalyticsKeyId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Webhook Modal State
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "course.completed",
  ]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(
    null,
  );

  // Webhook Logs Inspector
  const [inspectingWebhookId, setInspectingWebhookId] = useState<number | null>(
    null,
  );
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [replayingDeliveryId, setReplayingDeliveryId] = useState<number | null>(
    null,
  );

  const [copiedText, setCopiedText] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        api.get<any>("/api/v1/api-keys"),
        api.get<any>("/api/v1/dev-webhooks"),
      ]);
      setApiKeys(keysRes?.api_keys || []);
      setWebhooks(webhooksRes?.endpoints || []);
    } catch {
      setError(tUser("settings.advanced.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingKey(true);
    setError(null);
    try {
      const ipList = ipWhitelistText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.post<any>("/api/v1/api-keys", {
        name: keyName,
        environment: keyEnv,
        scopes: selectedScopes,
        ip_whitelist: ipList,
      });
      setNewlyCreatedKey(res.raw_key);
      await fetchData();
      setKeyName("");
      setIpWhitelistText("");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.generateKeyError"),
      );
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: number) => {
    try {
      await api.delete(`/api/v1/api-keys/${id}`);
      setSuccess(tUser("settings.advanced.keyRevokedSuccess"));
      await fetchData();
    } catch {
      setError(tUser("settings.advanced.revokeKeyError"));
    }
  };

  const handleRotateApiKey = async (id: number) => {
    try {
      const res = await api.post<any>(`/api/v1/api-keys/${id}/rotate`);
      setNewlyCreatedKey(res.new_raw_key);
      setSuccess(tUser("settings.advanced.keyRotatedSuccess"));
      await fetchData();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.rotateKeyError"),
      );
    }
  };

  const handleOpenAnalytics = async (id: number) => {
    setAnalyticsKeyId(id);
    setLoadingAnalytics(true);
    try {
      const res = await api.get<any>(`/api/v1/api-keys/${id}/analytics`);
      setAnalyticsData(res);
    } catch {
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingWebhook(true);
    setError(null);
    try {
      const res = await api.post<any>("/api/v1/dev-webhooks", {
        name: webhookName,
        url: webhookUrl,
        events: selectedEvents,
      });
      setNewlyCreatedSecret(res.signing_secret);
      await fetchData();
      setWebhookName("");
      setWebhookUrl("");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.registerWebhookError"),
      );
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleRemoveWebhook = async (id: number) => {
    try {
      await api.delete(`/api/v1/dev-webhooks/${id}`);
      setSuccess(tUser("settings.advanced.webhookRemovedSuccess"));
      await fetchData();
    } catch {
      setError(tUser("settings.advanced.removeWebhookError"));
    }
  };

  const handleTestWebhook = async (id: number) => {
    setTestingWebhookId(id);
    try {
      await api.post<any>(`/api/v1/dev-webhooks/${id}/test`);
      setSuccess(tUser("settings.advanced.webhookTestSuccess"));
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.testWebhookError"),
      );
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleResetCircuitBreaker = async (id: number) => {
    try {
      await api.post(`/api/v1/dev-webhooks/${id}/reset-circuit`);
      setSuccess(tUser("settings.advanced.circuitResetSuccess"));
      await fetchData();
    } catch {
      setError(tUser("settings.advanced.resetCircuitError"));
    }
  };

  const handleRotateSecret = async (id: number) => {
    try {
      const res = await api.post<any>(
        `/api/v1/dev-webhooks/${id}/rotate-secret`,
      );
      setNewlyCreatedSecret(res.new_secret);
      setIsWebhookModalOpen(true);
      await fetchData();
      setSuccess(tUser("settings.advanced.secretRotatedSuccess"));
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.rotateSecretError"),
      );
    }
  };

  const handleReplayDelivery = async (deliveryId: number) => {
    setReplayingDeliveryId(deliveryId);
    try {
      await api.post<any>(
        `/api/v1/dev-webhooks/deliveries/${deliveryId}/resend`,
      );
      setSuccess(tUser("settings.advanced.deliveryReplayedSuccess"));
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.advanced.replayDeliveryError"),
      );
    } finally {
      setReplayingDeliveryId(null);
    }
  };

  const handleInspectDeliveries = async (id: number) => {
    setInspectingWebhookId(id);
    setLoadingDeliveries(true);
    try {
      const res = await api.get<any>(`/api/v1/dev-webhooks/${id}/deliveries`);
      setDeliveries(res?.deliveries || []);
    } catch {
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
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
            {tUser("settings.tabs.advanced")}
          </span>
        </nav>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
            {tUser("settings.advanced.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
            {tUser("settings.advanced.subtitle")}
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
            onClick={() => setSuccess(null)}
            className="ms-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* API Keys Card */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
              <Key className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.advanced.apiKeysGroup")}
            </h2>
          </div>
          <PodaciumButton
            size="sm"
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4 me-1" />
            {tUser("settings.advanced.generateKey")}
          </PodaciumButton>
        </div>
        <div className="p-6">
          {apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">
                        {apiKey.name}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {new Date(apiKey.created_at).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono font-bold text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 px-2.5 py-1 rounded-xl">
                        {apiKey.key_prefix}••••••••••••
                      </code>
                      <PodaciumBadge variant="secondary">
                        {apiKey.environment}
                      </PodaciumBadge>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {(apiKey.scopes || []).map((s) => (
                        <span
                          key={s}
                          className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PodaciumButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenAnalytics(apiKey.id)}
                      className="py-1 px-2 text-xs flex items-center gap-1"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{tUser("settings.advanced.metrics")}</span>
                    </PodaciumButton>
                    <PodaciumButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleRotateApiKey(apiKey.id)}
                      className="py-1 px-2 text-xs flex items-center gap-1"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                      <span>{tUser("settings.advanced.rotate")}</span>
                    </PodaciumButton>
                    <button
                      type="button"
                      onClick={() => handleRevokeApiKey(apiKey.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-950/60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Key className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {tUser("settings.advanced.noApiKeys")}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Webhooks Card */}
      <motion.div
        variants={itemVariants}
        className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400">
              <Webhook className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {tUser("settings.advanced.webhooksGroup")}
            </h2>
          </div>
          <PodaciumButton
            size="sm"
            onClick={() => setIsWebhookModalOpen(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4 me-1" />
            {tUser("settings.advanced.addWebhook")}
          </PodaciumButton>
        </div>
        <div className="p-6">
          {webhooks.length > 0 ? (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="p-4 bg-gray-50 dark:bg-slate-900/70 rounded-2xl border border-gray-200/80 dark:border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-bold text-sm text-gray-900 dark:text-slate-100 me-2">
                        {webhook.name}
                      </span>
                      <code className="text-xs font-mono text-gray-800 dark:text-slate-200 truncate max-w-md bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-gray-200/60 dark:border-slate-800/80">
                        {webhook.url}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {webhook.circuit_state === "OPEN" && (
                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetCircuitBreaker(webhook.id)}
                          className="py-1 px-2 text-xs flex items-center gap-1 border-amber-300 text-amber-600"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{tUser("settings.advanced.resetCircuit")}</span>
                        </PodaciumButton>
                      )}
                      <PodaciumButton
                        size="sm"
                        variant="outline"
                        onClick={() => handleInspectDeliveries(webhook.id)}
                        className="py-1 px-2 text-xs flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3 text-purple-600" />
                        <span>{tUser("settings.advanced.logs")}</span>
                      </PodaciumButton>
                      <PodaciumButton
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotateSecret(webhook.id)}
                        className="py-1 px-2 text-xs flex items-center gap-1"
                      >
                        <RotateCw className="w-3 h-3 text-cyan-600" />
                        <span>{tUser("settings.advanced.rotateSecret")}</span>
                      </PodaciumButton>
                      <PodaciumButton
                        size="sm"
                        variant="outline"
                        disabled={testingWebhookId === webhook.id}
                        onClick={() => handleTestWebhook(webhook.id)}
                        className="py-1 px-2 text-xs flex items-center gap-1"
                      >
                        {testingWebhookId === webhook.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>{tUser("settings.advanced.test")}</span>
                      </PodaciumButton>
                      <button
                        type="button"
                        onClick={() => handleRemoveWebhook(webhook.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PodaciumBadge
                      variant={
                        webhook.circuit_state === "OPEN"
                          ? "destructive"
                          : "success"
                      }
                    >
                      {tCommon("uiLabels.circuitPrefix")}{" "}
                      {webhook.circuit_state || "CLOSED"}
                    </PodaciumBadge>
                    {(webhook.events || []).map((event) => (
                      <PodaciumBadge key={event} variant="secondary">
                        {event}
                      </PodaciumBadge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Webhook className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {tUser("settings.advanced.noWebhooks")}
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Key Analytics Modal */}
      {analyticsKeyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>{tUser("settings.advanced.analyticsTitle")}</span>
              </h3>
              <button onClick={() => setAnalyticsKeyId(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            {loadingAnalytics ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : analyticsData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold text-gray-400">
                      {tUser("settings.advanced.totalCalls")}
                    </p>
                    <p className="text-lg font-black text-gray-900 dark:text-slate-100">
                      {analyticsData.total_requests}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold text-gray-400">
                      {tUser("settings.advanced.errorRate")}
                    </p>
                    <p className="text-lg font-black text-rose-600">
                      {analyticsData.error_rate_percentage}%
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold text-gray-400">
                      {tUser("settings.advanced.avgLatency")}
                    </p>
                    <p className="text-lg font-black text-emerald-600">
                      {analyticsData.avg_response_time_ms}ms
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {tUser("settings.advanced.noAnalytics")}
              </p>
            )}
          </motion.div>
        </div>
      )}

      {/* Key Generation / Rotation Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-600" />
                <span>{tUser("settings.advanced.generateModalTitle")}</span>
              </h3>
              <button
                onClick={() => {
                  setIsKeyModalOpen(false);
                  setNewlyCreatedKey(null);
                }}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {newlyCreatedKey ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 text-xs">
                  <strong className="block font-bold mb-1">
                    {tUser("settings.advanced.saveSecretAlert")}
                  </strong>
                  {tUser("settings.advanced.saveSecretDesc")}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-gray-900 text-emerald-400 font-mono text-sm rounded-xl overflow-x-auto">
                    {newlyCreatedKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                    className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 text-gray-700 dark:text-slate-200"
                  >
                    {copiedText ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <PodaciumButton
                  className="w-full"
                  onClick={() => {
                    setIsKeyModalOpen(false);
                    setNewlyCreatedKey(null);
                  }}
                >
                  {tUser("settings.advanced.done")}
                </PodaciumButton>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.keyNameLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tUser("settings.advanced.keyNamePlaceholder")}
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.environmentLabel")}
                  </label>
                  <select
                    value={keyEnv}
                    onChange={(e) => setKeyEnv(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-slate-100"
                  >
                    <option value="production">
                      {tUser("settings.advanced.envProduction")}
                    </option>
                    <option value="sandbox">
                      {tUser("settings.advanced.envSandbox")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.rbacLabel")}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope.id)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedScopes((prev) => [...prev, scope.id]);
                            else
                              setSelectedScopes((prev) =>
                                prev.filter((x) => x !== scope.id),
                              );
                          }}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span>{scope.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.ipWhitelistLabel")}
                  </label>
                  <input
                    type="text"
                    placeholder="192.168.1.1, 10.0.0.0/24"
                    value={ipWhitelistText}
                    onChange={(e) => setIpWhitelistText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <PodaciumButton
                    variant="outline"
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                  >
                    {tCommon("cancel")}
                  </PodaciumButton>
                  <PodaciumButton type="submit" disabled={creatingKey}>
                    {creatingKey ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      tUser("settings.advanced.generateKey")
                    )}
                  </PodaciumButton>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* Webhook Logs Modal */}
      {inspectingWebhookId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" />
                <span>{tUser("settings.advanced.deliveryLogsTitle")}</span>
              </h3>
              <button onClick={() => setInspectingWebhookId(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {loadingDeliveries ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : deliveries.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">
                  {tUser("settings.advanced.noDeliveryLogs")}
                </p>
              ) : (
                deliveries.map((deliv) => (
                  <div
                    key={deliv.id}
                    className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-2xl border border-gray-200/70 dark:border-slate-700 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-gray-900 dark:text-slate-100">
                        {deliv.event_type}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${deliv.response_status_code < 400 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          HTTP {deliv.response_status_code}
                        </span>
                        <span className="text-gray-400">
                          {deliv.duration_ms}ms
                        </span>
                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          disabled={replayingDeliveryId === deliv.id}
                          onClick={() => handleReplayDelivery(deliv.id)}
                          className="py-0.5 px-1.5 text-[10px]"
                        >
                          {replayingDeliveryId === deliv.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            tUser("settings.advanced.replay")
                          )}
                        </PodaciumButton>
                      </div>
                    </div>
                    {deliv.payload && (
                      <pre className="p-2 bg-gray-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                        {JSON.stringify(deliv.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Webhook Endpoint Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Webhook className="w-5 h-5 text-cyan-600" />
                <span>{tUser("settings.advanced.registerWebhookTitle")}</span>
              </h3>
              <button
                onClick={() => {
                  setIsWebhookModalOpen(false);
                  setNewlyCreatedSecret(null);
                }}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {newlyCreatedSecret ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 text-xs">
                  <strong className="block font-bold mb-1">
                    {tUser("settings.advanced.saveSigningSecretAlert")}
                  </strong>
                  {tUser("settings.advanced.saveSigningSecretDesc")}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-gray-900 text-cyan-400 font-mono text-sm rounded-xl overflow-x-auto">
                    {newlyCreatedSecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newlyCreatedSecret)}
                    className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 text-gray-700 dark:text-slate-200"
                  >
                    {copiedText ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <PodaciumButton
                  className="w-full"
                  onClick={() => {
                    setIsWebhookModalOpen(false);
                    setNewlyCreatedSecret(null);
                  }}
                >
                  {tUser("settings.advanced.done")}
                </PodaciumButton>
              </div>
            ) : (
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.endpointLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tUser("settings.advanced.endpointPlaceholder")}
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.payloadUrlLabel")}
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://api.mycompany.com/webhooks"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {tUser("settings.advanced.subscribedEventsLabel")}
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                    {AVAILABLE_WEBHOOK_EVENTS.map((evt) => (
                      <label
                        key={evt}
                        className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(evt)}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedEvents((prev) => [...prev, evt]);
                            else
                              setSelectedEvents((prev) =>
                                prev.filter((x) => x !== evt),
                              );
                          }}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span>{evt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <PodaciumButton
                    variant="outline"
                    type="button"
                    onClick={() => setIsWebhookModalOpen(false)}
                  >
                    {tCommon("cancel")}
                  </PodaciumButton>
                  <PodaciumButton type="submit" disabled={creatingWebhook}>
                    {creatingWebhook ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      tUser("settings.advanced.saveWebhook")
                    )}
                  </PodaciumButton>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdvancedPage;
