"use client";

import React, { useState } from "react";
import {
  PodaciumButton,
  PodaciumCard,
  PodaciumBadge,
  PodaciumInput,
  PodaciumModal,
  PodaciumTabs,
  PodaciumDrawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/design-system";
import { WorkflowBuilder } from "./workflows/WorkflowBuilder";
import { useTranslations } from "@/lib/i18n";
import {
  Key,
  Webhook,
  Workflow,
  Copy,
  Check,
  RotateCw,
  Trash2,
  Plus,
  ShieldAlert,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  RefreshCw,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  scopes: string[];
  createdAt: string;
  graceExpiresAt: string | null;
  status: "active" | "rotating" | "revoked";
}

interface WebhookDelivery {
  id: string;
  eventType: string;
  status: number;
  statusText: string;
  durationMs: number;
  timestamp: string;
  webhookId: string;
  signature: string;
  requestPayload: any;
  responseBody: string;
}

const SCOPE_GROUPS = [
  {
    domain: "Education",
    scopes: [
      {
        id: "read:courses",
        label: "Read Courses",
        desc: "Access courses, modules, and lessons",
      },
      {
        id: "write:enrollments",
        label: "Write Enrollments",
        desc: "Enroll students and verify completions",
      },
    ],
  },
  {
    domain: "Contracts",
    scopes: [
      {
        id: "read:contracts",
        label: "Read Contracts",
        desc: "View escrow contracts and deliverables",
      },
      {
        id: "write:milestones",
        label: "Write Milestones",
        desc: "Create, submit, and release milestones",
      },
    ],
  },
  {
    domain: "Billing",
    scopes: [
      {
        id: "read:invoices",
        label: "Read Invoices",
        desc: "Query ANAE tax shields and SCF invoices",
      },
      {
        id: "create:payouts",
        label: "Create Payouts",
        desc: "Initiate BaridiMob and EDAHABIA bank transfers",
      },
    ],
  },
  {
    domain: "Webhooks",
    scopes: [
      {
        id: "manage:webhooks",
        label: "Manage Webhooks",
        desc: "Configure endpoints, replay DLQ, and inspect events",
      },
    ],
  },
];

const INITIAL_API_KEYS: ApiKeyItem[] = [
  {
    id: "key_prod_01",
    name: "Production Integration Key",
    maskedKey: "sk_live_podacium_••••••••••••3x9Q",
    scopes: [
      "read:courses",
      "read:contracts",
      "write:milestones",
      "read:invoices",
    ],
    createdAt: "2026-09-15T10:00:00Z",
    graceExpiresAt: null,
    status: "active",
  },
  {
    id: "key_legacy_02",
    name: "Legacy Storefront Key (Rotating)",
    maskedKey: "sk_live_podacium_••••••••••••9v8A",
    scopes: ["read:courses", "read:invoices"],
    createdAt: "2026-08-01T12:00:00Z",
    graceExpiresAt: "2026-10-22T10:00:00Z", // 5 days left in grace
    status: "rotating",
  },
];

const INITIAL_DELIVERIES: WebhookDelivery[] = [
  {
    id: "del_89412",
    eventType: "contract.created",
    status: 200,
    statusText: "OK",
    durationMs: 84,
    timestamp: "2026-10-17T05:22:10Z",
    webhookId: "msg_2tQ9L1x49zP",
    signature:
      "v1,e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    requestPayload: {
      event_type: "contract.created",
      timestamp: "2026-10-17T05:22:10Z",
      data: {
        contract_id: "ctr_dz_oran_889",
        client_name: "Sonatrach IT Branch",
        freelancer_id: "usr_freelance_412",
        amount_dzd: 450000,
        tax_shield_art169: true,
      },
    },
    responseBody: '{"success":true,"ack_id":"ack_9012"}',
  },
  {
    id: "del_89413",
    eventType: "milestone.delivered",
    status: 504,
    statusText: "Gateway Timeout",
    durationMs: 10002,
    timestamp: "2026-10-17T05:15:00Z",
    webhookId: "msg_2tQ9L1x49zQ",
    signature: "v1,8f14e45fceea167a5a36dedd4bea2543",
    requestPayload: {
      event_type: "milestone.delivered",
      timestamp: "2026-10-17T05:15:00Z",
      data: {
        milestone_id: "ms_812",
        deliverable_url: "https://storage.podacium.dz/deliverables/rev1.zip",
      },
    },
    responseBody:
      "504 Gateway Timeout: Upstream endpoint took longer than 10.0s",
  },
  {
    id: "del_89414",
    eventType: "invoice.paid",
    status: 429,
    statusText: "Too Many Requests",
    durationMs: 45,
    timestamp: "2026-10-17T04:40:00Z",
    webhookId: "msg_2tQ9L1x49zR",
    signature: "v1,7d22b64a2f893a",
    requestPayload: {
      event_type: "invoice.paid",
      timestamp: "2026-10-17T04:40:00Z",
      data: {
        invoice_number: "ANAE-2026-0041",
        amount_dzd: 120000,
        payment_gateway: "chargily_edahabia",
      },
    },
    responseBody: '{"error":"Rate limit exceeded. Retry after 60s."}',
  },
];

export function DeveloperPortal() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<string>("api-keys");
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(INITIAL_API_KEYS);
  const [deliveries, setDeliveries] =
    useState<WebhookDelivery[]>(INITIAL_DELIVERIES);

  // Key Generation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "read:courses",
    "read:contracts",
  ]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Slide-Over Delivery Inspector
  const [inspectingDelivery, setInspectingDelivery] =
    useState<WebhookDelivery | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // SDK Quickstart Modal State
  const [selectedKeyForSnippets, setSelectedKeyForSnippets] =
    useState<ApiKeyItem | null>(null);
  const [snippetLanguage, setSnippetLanguage] = useState<
    "curl" | "python" | "typescript"
  >("curl");

  // Webhook Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simEventType, setSimEventType] = useState("contract.created");
  const [simUrl, setSimUrl] = useState("https://api.partner.dz/v1/webhooks");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Handle Key Creation
  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const mockFullSecret = `sk_live_podacium_${Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 36).toString(36),
    ).join("")}${randomSuffix}`;

    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      maskedKey: `sk_live_podacium_••••••••••••${randomSuffix}`,
      scopes: selectedScopes,
      createdAt: new Date().toISOString(),
      graceExpiresAt: null,
      status: "active",
    };

    setApiKeys((prev) => [newKey, ...prev]);
    setIsCreateModalOpen(false);
    setRevealedSecret(mockFullSecret);
    setNewKeyName("");
  };

  // Handle Key Rotation (Triggers 7-day grace window)
  const handleRotateKey = (keyId: string) => {
    const key = apiKeys.find((k) => k.id === keyId);
    if (!key) return;

    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() + 7);

    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const mockNewSecret = `sk_live_podacium_${Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 36).toString(36),
    ).join("")}${randomSuffix}`;

    const updatedOldKey: ApiKeyItem = {
      ...key,
      status: "rotating",
      graceExpiresAt: graceDate.toISOString(),
    };

    const successorKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: `${key.name} (Rotated Successor)`,
      maskedKey: `sk_live_podacium_••••••••••••${randomSuffix}`,
      scopes: key.scopes,
      createdAt: new Date().toISOString(),
      graceExpiresAt: null,
      status: "active",
    };

    setApiKeys((prev) => [
      successorKey,
      ...prev.map((k) => (k.id === keyId ? updatedOldKey : k)),
    ]);
    setRevealedSecret(mockNewSecret);
  };

  // Handle Key Revocation
  const handleRevokeKey = (keyId: string) => {
    setApiKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, status: "revoked" } : k)),
    );
  };

  // Handle Webhook Resend
  const handleResendDelivery = async (del: WebhookDelivery) => {
    setIsResending(true);
    setResendSuccess(false);

    // Simulate 1-click resend call
    await new Promise((res) => setTimeout(res, 800));

    const updatedDelivery: WebhookDelivery = {
      ...del,
      id: `del_${Date.now()}`,
      status: 200,
      statusText: "OK",
      durationMs: 72,
      timestamp: new Date().toISOString(),
      responseBody: '{"success":true,"replayed":true}',
    };

    setDeliveries((prev) => [updatedDelivery, ...prev]);
    setInspectingDelivery(updatedDelivery);
    setIsResending(false);
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const tabs = [
    {
      id: "api-keys",
      label: "API Keys & Scopes",
      icon: <Key className="w-4 h-4 me-1.5" />,
    },
    {
      id: "webhooks",
      label: "Standard Webhooks & Deliveries",
      icon: <Webhook className="w-4 h-4 me-1.5" />,
    },
    {
      id: "workflows",
      label: "Visual DAG Workflows",
      icon: <Workflow className="w-4 h-4 me-1.5" />,
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {t("developer.portal.badgePlatform")}
            </h1>
            <PodaciumBadge
              variant="outline"
              className="border-indigo-500/30 text-indigo-400 font-mono text-xs"
            >
              {t("developer.portal.badgeLayer13")}
            </PodaciumBadge>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Manage granular scoped API keys with zero-downtime 7-day rotation,
            inspect Standard Webhooks deliveries conforming to the Svix
            specification, and orchestrate Extism Wasm DAG workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/docs", "_blank")}
            className="text-xs"
          >
            <Code2 className="w-4 h-4 me-1.5" />
            {t("developer.portal.apiDocs")}
            <ExternalLink className="w-3 h-3 ms-1 opacity-70" />
          </PodaciumButton>
        </div>
      </div>

      {/* Navigation Tabs */}
      <PodaciumTabs
        tabs={tabs}
        defaultTab="api-keys"
        onChange={setActiveTab}
        variant="pills"
      />

      {/* Tab 1: API Keys Management */}
      {activeTab === "api-keys" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t("developer.portal.apiKeysTitle")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("developer.portal.apiKeysDesc")}
              </p>
            </div>
            <PodaciumButton
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs"
            >
              <Plus className="w-4 h-4 me-1.5" />{" "}
              {t("developer.portal.createApiKey")}
            </PodaciumButton>
          </div>

          {/* Active Keys List */}
          <div className="grid grid-cols-1 gap-4">
            {apiKeys.map((key) => {
              const isRotating = key.status === "rotating";
              const isRevoked = key.status === "revoked";

              return (
                <div
                  key={key.id}
                  className={`p-5 rounded-xl border bg-slate-900/80 backdrop-blur-sm transition-all ${
                    isRotating
                      ? "border-amber-500/40 bg-amber-950/10"
                      : isRevoked
                        ? "border-slate-800/40 opacity-60"
                        : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-100 text-sm">
                          {key.name}
                        </span>
                        {key.status === "active" && (
                          <PodaciumBadge variant="success">
                            {t("developer.portal.badgeActive")}
                          </PodaciumBadge>
                        )}
                        {key.status === "rotating" && (
                          <PodaciumBadge variant="warning">
                            {t("developer.portal.badgeRotationGrace")}
                          </PodaciumBadge>
                        )}
                        {key.status === "revoked" && (
                          <PodaciumBadge variant="destructive">
                            {t("developer.portal.badgeRevoked")}
                          </PodaciumBadge>
                        )}
                      </div>

                      {/* Masked Secret Key Display */}
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 select-all">
                          {key.maskedKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.maskedKey)}
                          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                          title={t("developer.portal.copyMaskedKey")}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Scopes Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400 me-1">
                          {t("common.uiLabels.scopesPrefix")}
                        </span>
                        {key.scopes.map((s) => (
                          <span
                            key={s}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right Action Widgets & Rotation Timer */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {isRotating && key.graceExpiresAt && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-mono">
                          <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                          <span>{t("developer.portal.graceWindow")}</span>
                        </div>
                      )}

                      {!isRevoked && (
                        <div className="flex items-center gap-2">
                          <PodaciumButton
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedKeyForSnippets(key)}
                            className="text-xs text-indigo-300 border-indigo-900/40 hover:bg-indigo-950/50"
                          >
                            <Code2 className="w-3.5 h-3.5 me-1.5" />
                            {t("developer.portal.quickstart")}
                          </PodaciumButton>
                          <PodaciumButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleRotateKey(key.id)}
                            className="text-xs text-amber-300 border-amber-900/40 hover:bg-amber-950/50"
                          >
                            <RotateCw className="w-3.5 h-3.5 me-1.5" />
                            {t("developer.portal.rotateKey")}
                          </PodaciumButton>
                          <PodaciumButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-xs text-rose-400 border-rose-900/40 hover:bg-rose-950/50"
                          >
                            <Trash2 className="w-3.5 h-3.5 me-1.5" />
                            {t("developer.portal.revokeKey")}
                          </PodaciumButton>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Standard Webhooks & Delivery Inspector */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t("developer.portal.deliveriesTitle")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("developer.portal.deliveriesDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setIsSimulatorOpen(true)}
                className="text-xs text-indigo-300 border-indigo-900/40 hover:bg-indigo-950/50"
              >
                <Send className="w-3.5 h-3.5 me-1.5" />
                {t("developer.portal.dispatchTest")}
              </PodaciumButton>
              <PodaciumBadge
                variant="outline"
                className="text-xs text-emerald-400 border-emerald-900/40 bg-emerald-950/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 me-1" />{" "}
                {t("developer.portal.svixCompliant")}
              </PodaciumBadge>
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs font-sans">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 text-start font-medium">
                      {t("developer.portal.thStatus")}
                    </th>
                    <th className="py-3 px-4 text-start font-medium">
                      {t("developer.portal.thEventType")}
                    </th>
                    <th className="py-3 px-4 text-start font-medium">
                      Message ID
                    </th>
                    <th className="py-3 px-4 text-start font-medium">
                      {t("developer.portal.thDuration")}
                    </th>
                    <th className="py-3 px-4 text-start font-medium">
                      {t("developer.portal.thTimestamp")}
                    </th>
                    <th className="py-3 px-4 text-end font-medium">
                      {t("developer.portal.thAction")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {deliveries.map((del) => (
                    <tr
                      key={del.id}
                      onClick={() => setInspectingDelivery(del)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            del.status >= 200 && del.status < 300
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                              : del.status === 429
                                ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                                : "bg-rose-950 text-rose-400 border border-rose-800/60"
                          }`}
                        >
                          {del.status} {del.statusText}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200">
                        {del.eventType}
                      </td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-[120px]">
                        {del.webhookId}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {del.durationMs}ms
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(del.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-end font-sans">
                        <PodaciumButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingDelivery(del);
                          }}
                          className="text-xs text-primary hover:text-indigo-300"
                        >
                          <Eye className="w-3.5 h-3.5 me-1" />{" "}
                          {t("developer.portal.inspectBtn")}
                        </PodaciumButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Visual Workflow Automation DAG */}
      {activeTab === "workflows" && <WorkflowBuilder />}

      {/* Create Key Modal */}
      <PodaciumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("developer.portal.createModalTitle")}
        description={t("developer.portal.createModalDesc")}
        size="lg"
      >
        <div className="space-y-5 p-2 font-sans">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {t("developer.portal.keyNameLabel")}
            </label>
            <PodaciumInput
              placeholder={t("developer.portal.keyNamePlaceholder")}
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("developer.portal.scopesLabel")}
            </label>
            <div className="space-y-4">
              {SCOPE_GROUPS.map((group) => (
                <div
                  key={group.domain}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                >
                  <span className="text-xs font-semibold text-slate-200 block">
                    {group.domain}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.scopes.map((s) => {
                      const isChecked = selectedScopes.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes((prev) => [...prev, s.id]);
                              } else {
                                setSelectedScopes((prev) =>
                                  prev.filter((id) => id !== s.id),
                                );
                              }
                            }}
                            className="mt-0.5 rounded border-slate-700 text-primary focus:ring-primary"
                          />
                          <div className="text-xs">
                            <span className="font-mono text-slate-200 block">
                              {s.id}
                            </span>
                            <span className="text-[11px] text-slate-400 leading-tight block">
                              {s.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t("developer.portal.cancelBtn")}
            </PodaciumButton>
            <PodaciumButton
              variant="primary"
              size="sm"
              onClick={handleCreateKey}
              disabled={!newKeyName.trim() || selectedScopes.length === 0}
            >
              {t("developer.portal.generateBtn")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>

      {/* One-Time Key Reveal Modal */}
      <PodaciumModal
        isOpen={Boolean(revealedSecret)}
        onClose={() => setRevealedSecret(null)}
        title={t("developer.portal.secretModalTitle")}
        description={t("developer.portal.secretModalDesc")}
        size="md"
      >
        <div className="space-y-4 p-2 font-sans">
          <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t("developer.portal.securityWarning")}
              </p>
              <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                {t("developer.portal.securityWarningText")}
              </p>
            </div>
          </div>

          <div className="relative">
            <code className="block p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 break-all select-all">
              {revealedSecret}
            </code>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {copiedKey
                ? t("developer.portal.copiedToClipboard")
                : t("developer.portal.clickCopyPrompt")}
            </span>
            <div className="flex items-center gap-2">
              <PodaciumButton
                variant="primary"
                size="sm"
                onClick={() =>
                  revealedSecret && copyToClipboard(revealedSecret)
                }
                className="text-xs"
              >
                {copiedKey ? (
                  <>
                    <Check className="w-4 h-4 me-1.5 text-emerald-400" />{" "}
                    {t("developer.portal.copiedBtn")}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 me-1.5" />{" "}
                    {t("developer.portal.copyKeyBtn")}
                  </>
                )}
              </PodaciumButton>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setRevealedSecret(null)}
                className="text-xs"
              >
                {t("developer.portal.doneBtn")}
              </PodaciumButton>
            </div>
          </div>
        </div>
      </PodaciumModal>

      {/* Slide-Over Webhook Payload Inspector Drawer */}
      {inspectingDelivery && (
        <PodaciumDrawer
          isOpen
          onClose={() => setInspectingDelivery(null)}
          position="end"
          size="lg"
          variant="persistent"
        >
          <DrawerContent className="w-full border-slate-800 bg-slate-900 text-slate-100 sm:w-[500px] dark:bg-slate-900">
            {/* Header */}
            <DrawerHeader className="items-center border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-primary" />
                <DrawerTitle className="text-sm font-semibold text-white">
                  {t("developer.portal.inspectorTitle")}
                </DrawerTitle>
              </div>
              <DrawerClose className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-800 dark:hover:text-white" />
            </DrawerHeader>

            {/* Body */}
            <DrawerBody className="space-y-5 p-4">
              {/* Delivery Status & Latency Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    {t("developer.portal.httpStatusLabel")}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono ${
                      inspectingDelivery.status === 200
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {inspectingDelivery.status} {inspectingDelivery.statusText}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    {t("developer.portal.latencyLabel")}
                  </span>
                  <span className="text-sm font-mono text-slate-200">
                    {inspectingDelivery.durationMs}ms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                    {t("developer.portal.deliveredAtLabel")}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(
                      inspectingDelivery.timestamp,
                    ).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Standard Webhooks Headers */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  {t("developer.portal.headersTitle")}
                </span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">webhook-id:</span>
                    <span className="text-slate-200">
                      {inspectingDelivery.webhookId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">webhook-timestamp:</span>
                    <span className="text-slate-200">
                      {Math.floor(
                        new Date(inspectingDelivery.timestamp).getTime() / 1000,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 shrink-0">
                      webhook-signature:
                    </span>
                    <span className="text-indigo-400 truncate text-[11px]">
                      {inspectingDelivery.signature}
                    </span>
                  </div>
                </div>
              </div>

              {/* JSON Request Payload */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  {t("developer.portal.payloadTitle")}
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-56">
                  {JSON.stringify(inspectingDelivery.requestPayload, null, 2)}
                </pre>
              </div>

              {/* Upstream Response Body */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  {t("developer.portal.upstreamResponseTitle")}
                </span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-36">
                  {inspectingDelivery.responseBody}
                </pre>
              </div>
            </DrawerBody>

            {/* Footer Actions */}
            <DrawerFooter className="justify-between border-slate-800 bg-slate-950/80 p-4">
              <span className="text-xs text-slate-400">
                {resendSuccess && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />{" "}
                    {t("developer.portal.resendSuccess")}
                  </span>
                )}
              </span>
              <PodaciumButton
                variant="primary"
                size="sm"
                disabled={isResending}
                onClick={() =>
                  inspectingDelivery && handleResendDelivery(inspectingDelivery)
                }
                className="text-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 me-1.5 ${isResending ? "animate-spin" : ""}`}
                />
                {isResending
                  ? t("developer.portal.resending")
                  : t("developer.portal.resendPayload")}
              </PodaciumButton>
            </DrawerFooter>
          </DrawerContent>
        </PodaciumDrawer>
      )}

      {/* SDK Quickstart & Code Generation Modal */}
      {selectedKeyForSnippets && (
        <PodaciumModal
          isOpen={Boolean(selectedKeyForSnippets)}
          onClose={() => setSelectedKeyForSnippets(null)}
          title={t("developer.portal.quickstartTitle", {
            name: selectedKeyForSnippets.name,
          })}
          description={t("developer.portal.quickstartDesc")}
          size="lg"
        >
          <div className="space-y-4 p-2 font-sans">
            {/* Language Selector */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              {(["curl", "python", "typescript"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSnippetLanguage(lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    snippetLanguage === lang
                      ? "bg-primary text-white font-semibold"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  {lang === "curl"
                    ? "cURL"
                    : lang === "python"
                      ? "Python (httpx)"
                      : "TypeScript"}
                </button>
              ))}
            </div>

            {/* Code Snippet Box */}
            <div className="relative">
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto max-h-72">
                {snippetLanguage === "curl" &&
                  `# 1. Fetch available courses
curl -X GET "https://api.podacium.com/api/v1/courses" \\
  -H "Authorization: Bearer ${selectedKeyForSnippets.maskedKey}" \\
  -H "Content-Type: application/json"

# 2. Release contract milestone with Idempotency Key
curl -X POST "https://api.podacium.com/api/v1/contracts/ctr_123/milestones/ms_456/release" \\
  -H "Authorization: Bearer ${selectedKeyForSnippets.maskedKey}" \\
  -H "Idempotency-Key: ${Date.now()}" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "Deliverable verified on GitHub"}'`}

                {snippetLanguage === "python" &&
                  `import httpx

API_KEY = "${selectedKeyForSnippets.maskedKey}"
BASE_URL = "https://api.podacium.com"

# Verified Client with automatic bearer authorization
client = httpx.Client(
    base_url=BASE_URL,
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Podacium-Partner-Client/1.0",
    },
    timeout=10.0,
)

response = client.get("/api/v1/courses")
response.raise_for_status()
courses = response.json()
print(f"Loaded {len(courses)} active Podacium courses")`}

                {snippetLanguage === "typescript" &&
                  `const API_KEY = "${selectedKeyForSnippets.maskedKey}";
const BASE_URL = "https://api.podacium.com";

interface Course {
  id: string;
  title: string;
  category: string;
  price_dzd: number;
}

export async function fetchCourses(): Promise<Course[]> {
  const response = await fetch(\`\${BASE_URL}/api/v1/courses\`, {
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(\`Podacium API Error \${response.status}: \${await response.text()}\`);
  }

  return response.json();
}`}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <PodaciumButton
                variant="primary"
                size="sm"
                onClick={() => setSelectedKeyForSnippets(null)}
              >
                {t("developer.portal.closeBtn")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      )}

      {/* Webhook Event Dispatch Simulator Modal */}
      {isSimulatorOpen && (
        <PodaciumModal
          isOpen={isSimulatorOpen}
          onClose={() => {
            setIsSimulatorOpen(false);
            setSimResult(null);
          }}
          title={t("developer.portal.dispatchModalTitle")}
          description={t("developer.portal.dispatchModalDesc")}
          size="lg"
        >
          <div className="space-y-4 p-2 font-sans">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t("developer.portal.eventTypeLabel")}
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                value={simEventType}
                onChange={(e) => setSimEventType(e.target.value)}
              >
                <option value="contract.created">contract.created</option>
                <option value="milestone.delivered">milestone.delivered</option>
                <option value="invoice.paid">invoice.paid</option>
                <option value="course.completed">course.completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t("developer.portal.destinationUrlLabel")}
              </label>
              <PodaciumInput
                value={simUrl}
                onChange={(e) => setSimUrl(e.target.value)}
                placeholder="https://api.partner.dz/v1/webhooks"
              />
            </div>

            {simResult && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />{" "}
                    {t("developer.portal.dispatchedSuccess")}
                  </span>
                  <span>
                    {t("common.uiLabels.latencyPrefix")} {simResult.durationMs}
                    ms
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] space-y-1">
                  <div>
                    webhook-id:{" "}
                    <span className="text-slate-200">{simResult.msgId}</span>
                  </div>
                  <div>
                    webhook-timestamp:{" "}
                    <span className="text-slate-200">
                      {simResult.timestamp}
                    </span>
                  </div>
                  <div>
                    webhook-signature:{" "}
                    <span className="text-indigo-400">
                      {simResult.signature}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSimulatorOpen(false);
                  setSimResult(null);
                }}
              >
                {t("developer.portal.cancelBtn")}
              </PodaciumButton>
              <PodaciumButton
                variant="primary"
                size="sm"
                disabled={isSimulating || !simUrl.trim()}
                onClick={async () => {
                  setIsSimulating(true);
                  await new Promise((res) => setTimeout(res, 600));
                  setSimResult({
                    durationMs: 64,
                    msgId: `msg_${Math.random().toString(36).substring(2, 12)}`,
                    timestamp: Math.floor(Date.now() / 1000),
                    signature:
                      "v1,e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                  });
                  setIsSimulating(false);
                }}
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 me-1.5 animate-spin" />{" "}
                    {t("common.uiLabels.dispatching")}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 me-1.5" />{" "}
                    {t("developer.portal.dispatchMockBtn")}
                  </>
                )}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      )}
    </div>
  );
}
