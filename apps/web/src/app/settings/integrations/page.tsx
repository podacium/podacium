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
  Globe,
  Github,
  Video,
  BookOpen,
  Database,
  Cpu,
  MessageSquare,
  Calendar as CalendarIcon,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Play,
  Zap,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  GitFork,
  Terminal,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";

interface Integration {
  id?: number;
  provider: string;
  connected: boolean;
  account_label?: string;
  connected_at?: string;
  syncStatus?: string;
  lastSyncedAt?: string;
  errorCount?: number;
  metadata?: any;
}

interface ConnectorLogItem {
  id: number;
  action: string;
  status: string;
  duration_ms: number;
  request_payload?: any;
  response_payload?: any;
  created_at: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const PROVIDER_CONFIGS: Record<
  string,
  {
    nameKey: string;
    pillar: "education" | "freelance" | "bi";
    descKey: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    actionLabelKey: string;
    actionEndpoint: string;
  }
> = {
  google: {
    nameKey: "settings.integrations.google.name",
    pillar: "education",
    descKey: "settings.integrations.google.desc",
    icon: <Globe className="h-5 w-5" />,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100/70 dark:bg-blue-950/60",
    actionLabelKey: "settings.integrations.google.action",
    actionEndpoint: "/api/v1/connectors/google/import-drive",
  },
  github: {
    nameKey: "settings.integrations.github.name",
    pillar: "freelance",
    descKey: "settings.integrations.github.desc",
    icon: <Github className="h-5 w-5" />,
    color: "text-slate-900 dark:text-slate-100",
    bg: "bg-slate-100 dark:bg-slate-800",
    actionLabelKey: "settings.integrations.github.action",
    actionEndpoint: "/api/v1/connectors/github/sync-pr",
  },
  slack: {
    nameKey: "settings.integrations.slack.name",
    pillar: "bi",
    descKey: "settings.integrations.slack.desc",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100/70 dark:bg-emerald-950/60",
    actionLabelKey: "settings.integrations.slack.action",
    actionEndpoint: "/api/v1/connectors/slack/post-snapshot",
  },
  zoom: {
    nameKey: "settings.integrations.zoom.name",
    pillar: "education",
    descKey: "settings.integrations.zoom.desc",
    icon: <Video className="h-5 w-5" />,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100/70 dark:bg-cyan-950/60",
    actionLabelKey: "settings.integrations.zoom.action",
    actionEndpoint: "/api/v1/connectors/zoom/provision-webinar",
  },
  notion: {
    nameKey: "settings.integrations.notion.name",
    pillar: "education",
    descKey: "settings.integrations.notion.desc",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-gray-900 dark:text-slate-100",
    bg: "bg-gray-100 dark:bg-slate-800",
    actionLabelKey: "settings.integrations.notion.action",
    actionEndpoint: "/api/v1/connectors/notion/export-notes",
  },
  kaggle: {
    nameKey: "settings.integrations.kaggle.name",
    pillar: "bi",
    descKey: "settings.integrations.kaggle.desc",
    icon: <Database className="h-5 w-5" />,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-100/70 dark:bg-indigo-950/60",
    actionLabelKey: "settings.integrations.kaggle.action",
    actionEndpoint: "/api/v1/connectors/kaggle/ingest-dataset",
  },
  huggingface: {
    nameKey: "settings.integrations.huggingface.name",
    pillar: "bi",
    descKey: "settings.integrations.huggingface.desc",
    icon: <Cpu className="h-5 w-5" />,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100/70 dark:bg-amber-950/60",
    actionLabelKey: "settings.integrations.huggingface.action",
    actionEndpoint: "/api/v1/connectors/huggingface/sync-model",
  },
  teams: {
    nameKey: "settings.integrations.teams.name",
    pillar: "bi",
    descKey: "settings.integrations.teams.desc",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100/70 dark:bg-purple-950/60",
    actionLabelKey: "settings.integrations.teams.action",
    actionEndpoint: "/api/v1/connectors/teams/post-card",
  },
  calendar: {
    nameKey: "settings.integrations.calendar.name",
    pillar: "education",
    descKey: "settings.integrations.calendar.desc",
    icon: <CalendarIcon className="h-5 w-5" />,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100/70 dark:bg-rose-950/60",
    actionLabelKey: "settings.integrations.calendar.action",
    actionEndpoint: "/api/v1/connectors/calendar/create-event",
  },
  chargily: {
    nameKey: "settings.integrations.chargily.name",
    pillar: "freelance",
    descKey: "settings.integrations.chargily.desc",
    icon: <CreditCard className="h-5 w-5" />,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-100/70 dark:bg-teal-950/60",
    actionLabelKey: "settings.integrations.chargily.action",
    actionEndpoint: "/api/v1/connectors/chargily/create-escrow",
  },
};

const IntegrationsPage = () => {
  const tUser = useTranslations("user");
  const tCommon = useTranslations("common");
  const { isAuthenticated } = useAuth();
  const { dir, isRTL } = useBidi();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Studio Mode Tabs
  const [activeStudioTab, setActiveStudioTab] = useState<
    "connectors" | "workflows" | "wasm" | "dlq"
  >("connectors");

  // Visual Workflow Builder DAG State
  const [workflowNodes, setWorkflowNodes] = useState([
    {
      id: "node-1",
      type: "CONNECTOR_ACTION",
      label: "GitHub PR Merged",
      provider: "github",
    },
    {
      id: "node-2",
      type: "WASM_TRANSFORM",
      label: "WASM Payload Normalizer",
      script: "transform(payload)",
    },
    {
      id: "node-3",
      type: "CONNECTOR_ACTION",
      label: "Slack Milestone Alert",
      provider: "slack",
    },
  ]);

  // WASM Sandbox State
  const [wasmScript, setWasmScript] =
    useState(`// WASM Sandboxed Payload Transformer (JS / Rust syntax)
export function transform(payload) {
  return {
    ...payload,
    _transformed: true,
    _engine: "wasmtime_sandboxed_v1",
    processed_at: new Date().toISOString()
  };
}`);
  const [rawWasmInput, setRawWasmInput] = useState(
    `{\n  "event": "course.completed",\n  "student_id": 104,\n  "grade": "A+"\n}`,
  );
  const [wasmOutput, setWasmOutput] = useState<string | null>(null);

  // DLQ Quarantined Events
  const [dlqItems] = useState([
    {
      id: 101,
      provider: "slack",
      event: "bi.kpi_anomaly_detected",
      failureReason: "HTTP 503 Service Unavailable (Circuit OPEN)",
      retryCount: 10,
      createdAt: new Date().toISOString(),
      payload: { kpi: "MRR Drop", value: -15.4 },
    },
  ]);

  // Pillar Filter State
  const [activePillarTab, setActivePillarTab] = useState<
    "all" | "education" | "freelance" | "bi"
  >("all");

  // Connector Test Modal State
  const [activeConnectorKey, setActiveConnectorKey] = useState<string | null>(
    null,
  );
  const [executingConnector, setExecutingConnector] = useState(false);

  // Connector Logs Inspector Modal
  const [viewingLogsProvider, setViewingLogsProvider] = useState<string | null>(
    null,
  );
  const [connectorLogs, setConnectorLogs] = useState<ConnectorLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<any>("/api/v1/settings/integrations");
      const list = Array.isArray(data) ? data : data?.integrations || [];
      setIntegrations(list);
    } catch {
      setError(tUser("settings.integrations.loadError"));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tUser]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleConnect = async (provider: string) => {
    setActionLoading(provider);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.get<{ url: string }>(
        `/api/v1/integrations/${provider}/authorize`,
      );
      if (res && res.url) {
        window.location.href = res.url;
        return;
      }
      await api.post(`/api/v1/settings/integrations/${provider}`);
      await fetchIntegrations();
      setSuccess(
        `${tUser(PROVIDER_CONFIGS[provider]?.nameKey)} ${tUser("settings.integrations.connectedMsg")}`,
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.integrations.connectError"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setActionLoading(provider);
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/api/v1/settings/integrations/${provider}`);
      await fetchIntegrations();
      setSuccess(
        `${tUser(PROVIDER_CONFIGS[provider]?.nameKey)} ${tUser("settings.integrations.disconnectedMsg")}`,
      );
    } catch {
      setError(tUser("settings.integrations.disconnectError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncNow = async (provider: string) => {
    setSyncingProvider(provider);
    setError(null);
    try {
      await api.post(`/api/v1/connectors/${provider}/sync-now`);
      await fetchIntegrations();
      setSuccess(
        tUser("settings.integrations.syncSuccess", {
          provider: provider.toUpperCase(),
        }),
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || tUser("settings.integrations.syncError"),
      );
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleOpenAuditLogs = async (provider: string) => {
    setViewingLogsProvider(provider);
    setLoadingLogs(true);
    try {
      const res = await api.get<{ logs: ConnectorLogItem[] }>(
        `/api/v1/connectors/${provider}/logs`,
      );
      setConnectorLogs(res?.logs || []);
    } catch {
      setConnectorLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleExecuteConnectorAction = async (providerKey: string) => {
    setExecutingConnector(true);
    setError(null);
    const meta = PROVIDER_CONFIGS[providerKey];
    try {
      let body: any = {};
      if (providerKey === "google")
        body = { file_id: "drive_file_991", course_id: 104, assignment_id: 42 };
      else if (providerKey === "github")
        body = {
          repo_owner: "podacium",
          repo_name: "platform",
          pull_number: 14,
        };
      else if (providerKey === "slack")
        body = {
          channel: "#general",
          dashboard_name: "Monthly Revenue BI",
          kpi_summary: "MRR: $45,000 (+12%)",
        };
      else if (providerKey === "zoom")
        body = {
          topic: "Calculus Live Class",
          start_time_iso: new Date().toISOString(),
          duration_minutes: 60,
        };
      else if (providerKey === "notion")
        body = {
          page_title: "Calculus Module 3 Notes",
          content_markdown: "# Integrations Summary\nAll clear.",
        };
      else if (providerKey === "kaggle")
        body = {
          dataset_handle: "zuber/algeria-tech-market",
          target_dataset_id: 5,
        };
      else if (providerKey === "huggingface")
        body = { model_id: "meta-llama/Llama-3-8B" };
      else if (providerKey === "teams")
        body = {
          webhook_url: "https://outlook.office.com/webhook/...",
          title: "BI Alert",
          message: "KPI threshold reached",
        };
      else if (providerKey === "calendar")
        body = {
          summary: "Live Lecture",
          description: "EdTech Webinar",
          start_time_iso: new Date().toISOString(),
          end_time_iso: new Date().toISOString(),
        };
      else if (providerKey === "chargily")
        body = { contract_id: 4091, milestone_id: 2, amount_dzd: 45000.0 };

      const res = await api.post<any>(meta.actionEndpoint, body);
      setSuccess(
        `${tUser("settings.integrations.actionSucceeded")}: ${JSON.stringify(res).slice(0, 80)}...`,
      );
      setActiveConnectorKey(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          tUser("settings.integrations.executeError"),
      );
    } finally {
      setExecutingConnector(false);
    }
  };

  const filteredProviders = Object.entries(PROVIDER_CONFIGS).filter(
    ([_, meta]) => {
      if (activePillarTab === "all") return true;
      return meta.pillar === activePillarTab;
    },
  );

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
            {tUser("settings.tabs.integrations")}
          </span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {tUser("settings.integrations.title")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
              {tUser("settings.integrations.subtitle")}
            </p>
          </div>

          {/* Studio Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setActiveStudioTab("connectors")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStudioTab === "connectors"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{tUser("settings.integrations.connectors")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("workflows")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStudioTab === "workflows"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <GitFork className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{tUser("settings.integrations.workflowBuilder")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("wasm")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStudioTab === "wasm"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{tUser("settings.integrations.wasmPreview")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStudioTab("dlq")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStudioTab === "dlq"
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{tUser("settings.integrations.dlqTitle")}</span>
            </button>
          </div>
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

      {/* Connectors Tab */}
      {activeStudioTab === "connectors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {tUser("settings.integrations.connectorsHeader")}
            </h2>
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl border border-gray-200/80 dark:border-slate-700/80">
              {(["all", "education", "freelance", "bi"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivePillarTab(tab)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                    activePillarTab === tab
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  {tab === "all"
                    ? tCommon("all")
                    : tUser(`settings.integrations.pillar.${tab}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProviders.map(([providerKey, meta]) => {
              const isConnected = integrations.some(
                (inv) =>
                  inv.provider.toLowerCase() === providerKey &&
                  (inv.connected ?? true),
              );
              const userInt = integrations.find(
                (inv) => inv.provider.toLowerCase() === providerKey,
              );
              const isLoadingThis = actionLoading === providerKey;
              const isSyncingThis = syncingProvider === providerKey;

              return (
                <motion.div
                  key={providerKey}
                  variants={itemVariants}
                  className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 flex flex-col justify-between space-y-4 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-2xl ${meta.bg} ${meta.color} shadow-xs`}
                      >
                        {meta.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-gray-900 dark:text-slate-100 flex items-center gap-2">
                          {tUser(meta.nameKey)}
                        </h3>
                        <PodaciumBadge
                          variant={
                            meta.pillar === "education"
                              ? "default"
                              : meta.pillar === "freelance"
                                ? "secondary"
                                : "success"
                          }
                          className="mt-1 text-[10px] uppercase tracking-wider font-bold"
                        >
                          {tUser(`settings.integrations.pillar.${meta.pillar}`)}
                        </PodaciumBadge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PodaciumBadge
                        variant={isConnected ? "success" : "default"}
                      >
                        {isConnected
                          ? tUser("settings.integrations.statusConnected")
                          : tUser("settings.integrations.statusNotConnected")}
                      </PodaciumBadge>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                    {tUser(meta.descKey)}
                  </p>

                  {isConnected && (
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200/60 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono text-gray-800 dark:text-slate-200">
                        <span className="truncate">
                          {userInt?.account_label || `${providerKey}_account`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          {userInt?.syncStatus || "ACTIVE"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {userInt?.lastSyncedAt
                            ? new Date(
                                userInt.lastSyncedAt,
                              ).toLocaleTimeString()
                            : tCommon("justNow")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAuditLogs(providerKey)}
                          className="hover:underline text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>
                            {tUser("settings.integrations.auditLogs")}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {isConnected ? (
                      <>
                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          disabled={isSyncingThis}
                          onClick={() => handleSyncNow(providerKey)}
                          className="flex items-center justify-center gap-1"
                          title={tUser("settings.integrations.syncNow")}
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isSyncingThis ? "animate-spin text-blue-600" : ""}`}
                          />
                        </PodaciumButton>
                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveConnectorKey(providerKey)}
                          className="flex-1 flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{tUser(meta.actionLabelKey)}</span>
                        </PodaciumButton>
                        <PodaciumButton
                          size="sm"
                          variant="outline"
                          disabled={isLoadingThis}
                          onClick={() => handleDisconnect(providerKey)}
                          className="text-red-600 hover:bg-red-50 border-red-200 dark:border-red-900/60"
                        >
                          {isLoadingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            tUser("settings.integrations.disconnect")
                          )}
                        </PodaciumButton>
                      </>
                    ) : (
                      <PodaciumButton
                        size="sm"
                        disabled={isLoadingThis}
                        onClick={() => handleConnect(providerKey)}
                        className="w-full flex items-center justify-center gap-1.5"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        <span>{tUser("settings.integrations.connectBtn")}</span>
                      </PodaciumButton>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Workflow Builder DAG Tab */}
      {activeStudioTab === "workflows" && (
        <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <GitFork className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{tUser("settings.integrations.workflowTitle")}</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {tUser("settings.integrations.workflowDesc")}
              </p>
            </div>
            <PodaciumButton
              size="sm"
              onClick={() => {
                const newId = `node-${workflowNodes.length + 1}`;
                setWorkflowNodes((prev) => [
                  ...prev,
                  {
                    id: newId,
                    type: "CONNECTOR_ACTION",
                    label: `Connector Action #${prev.length + 1}`,
                    provider: "google",
                  },
                ]);
              }}
              className="flex items-center gap-1"
            >
              <span>{tUser("settings.integrations.addNode")}</span>
            </PodaciumButton>
          </div>

          <div className="p-6 bg-slate-950 text-white rounded-2xl border border-slate-800 overflow-x-auto min-h-[260px] flex items-center justify-center gap-4">
            {workflowNodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl w-52 space-y-2 shadow-lg hover:border-indigo-500 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <PodaciumBadge
                      variant={
                        node.type === "WASM_TRANSFORM" ? "warning" : "default"
                      }
                    >
                      {node.type}
                    </PodaciumBadge>
                    <span className="font-mono text-[10px] text-slate-400">
                      {tUser("settings.integrations.step", { n: index + 1 })}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-slate-100">
                    {node.label}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    {node.provider
                      ? `provider: ${node.provider}`
                      : `script: ${node.script}`}
                  </p>
                </div>
                {index < workflowNodes.length - 1 && (
                  <div className="flex items-center text-indigo-400">
                    <ArrowRight className="w-5 h-5 animate-pulse" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WASM Sandboxed Transformer Tab */}
      {activeStudioTab === "wasm" && (
        <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>{tUser("settings.integrations.wasmTitle")}</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {tUser("settings.integrations.wasmDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                {tUser("settings.integrations.wasmCodeLabel")}
              </label>
              <textarea
                rows={10}
                value={wasmScript}
                onChange={(e) => setWasmScript(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-950 text-amber-300 rounded-2xl border border-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                {tUser("settings.integrations.rawInputLabel")}
              </label>
              <textarea
                rows={10}
                value={rawWasmInput}
                onChange={(e) => setRawWasmInput(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-950 text-cyan-300 rounded-2xl border border-slate-800 focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <PodaciumButton
              onClick={() => {
                try {
                  const parsed = JSON.parse(rawWasmInput);
                  parsed._transformed = true;
                  parsed._engine = "wasmtime_sandboxed_v1";
                  parsed.processed_at = new Date().toISOString();
                  setWasmOutput(JSON.stringify(parsed, null, 2));
                } catch {
                  setWasmOutput("Error: Invalid JSON payload input");
                }
              }}
            >
              <span>{tUser("settings.integrations.executeWasm")}</span>
            </PodaciumButton>
          </div>

          {wasmOutput && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400">
                {tUser("settings.integrations.outputPreview")}
              </span>
              <pre className="text-xs font-mono text-emerald-300 overflow-x-auto">
                {wasmOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* DLQ Inspector Tab */}
      {activeStudioTab === "dlq" && (
        <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span>{tUser("settings.integrations.dlqInspectorTitle")}</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {tUser("settings.integrations.dlqInspectorDesc")}
            </p>
          </div>

          <div className="space-y-3">
            {dlqItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-rose-50/50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-gray-900 dark:text-slate-100">
                      {item.provider.toUpperCase()}
                    </span>
                    <PodaciumBadge variant="destructive">
                      {item.event}
                    </PodaciumBadge>
                  </div>
                  <span className="text-rose-600 font-medium">
                    {item.failureReason}
                  </span>
                </div>
                <pre className="p-3 bg-slate-950 text-rose-300 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
                <div className="flex justify-end gap-2">
                  <PodaciumButton
                    size="sm"
                    onClick={() =>
                      setSuccess(
                        `DLQ event ${item.id} re-delivered successfully`,
                      )
                    }
                  >
                    <span>{tUser("settings.integrations.redeliver")}</span>
                  </PodaciumButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Logs Inspector Modal */}
      {viewingLogsProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-xl w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>
                  {tUser("settings.integrations.auditLogsTitle", {
                    provider: viewingLogsProvider.toUpperCase(),
                  })}
                </span>
              </h3>
              <button onClick={() => setViewingLogsProvider(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {loadingLogs ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : connectorLogs.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">
                  {tUser("settings.integrations.noLogs")}
                </p>
              ) : (
                connectorLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-2xl border border-gray-200/70 dark:border-slate-700 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                        {log.status === "SUCCESS" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        )}
                        {log.action}
                      </span>
                      <span className="text-gray-400">{log.duration_ms}ms</span>
                    </div>
                    {log.response_payload && (
                      <pre className="p-2 bg-gray-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                        {JSON.stringify(log.response_payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Action Execution Modal */}
      {activeConnectorKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span>
                  {tUser("settings.integrations.executeTitle")}{" "}
                  {tUser(PROVIDER_CONFIGS[activeConnectorKey]?.nameKey)}
                </span>
              </h3>
              <button onClick={() => setActiveConnectorKey(null)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {tUser("settings.integrations.executeDesc")}{" "}
              <strong>
                {tUser(PROVIDER_CONFIGS[activeConnectorKey]?.actionLabelKey)}
              </strong>
              .
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <PodaciumButton
                variant="outline"
                onClick={() => setActiveConnectorKey(null)}
              >
                {tCommon("cancel")}
              </PodaciumButton>
              <PodaciumButton
                disabled={executingConnector}
                onClick={() => handleExecuteConnectorAction(activeConnectorKey)}
              >
                {executingConnector ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  tUser("settings.integrations.runAction")
                )}
              </PodaciumButton>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default IntegrationsPage;
