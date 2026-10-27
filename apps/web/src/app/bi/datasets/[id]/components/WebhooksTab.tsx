"use client";

import React, { useState } from "react";
import { DatasetWebhook } from "./types";
import {
  Bell,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
  Link,
} from "lucide-react";

interface WebhooksTabProps {
  webhooks: DatasetWebhook[];
  t: (key: string, params?: any) => string;
  onOpenWebhookModal: () => void;
  onTestWebhook: (webhook: DatasetWebhook) => Promise<void>;
}

export function WebhooksTab({
  webhooks,
  t,
  onOpenWebhookModal,
  onTestWebhook,
}: WebhooksTabProps) {
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTest = async (wh: DatasetWebhook) => {
    setTestingId(wh.id);
    try {
      await onTestWebhook(wh);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Bell className="h-5 w-5 text-indigo-500" />
              {t("bi.datasets.detail.tabs.webhooks.title")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("bi.datasets.detail.tabs.webhooks.description")}
            </p>
          </div>
          <button
            onClick={onOpenWebhookModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("bi.datasets.detail.tabs.webhooks.createWebhook")}
          </button>
        </div>
      </div>

      {/* Webhooks Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Link className="h-4 w-4 text-emerald-500" />
            {t("bi.datasets.detail.tabs.webhooks.webhooksList")}
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.webhooks.targetUrl")}
                </th>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.webhooks.eventType")}
                </th>
                <th className="px-6 py-3.5 text-start">
                  {t("bi.datasets.detail.tabs.webhooks.status")}
                </th>
                <th className="px-6 py-3.5 text-end">
                  {t("bi.datasets.detail.tabs.webhooks.action")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {webhooks.map((wh) => (
                <tr
                  key={wh.id}
                  className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-900 dark:text-white">
                    {wh.url}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      {wh.event_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("bi.datasets.detail.tabs.webhooks.active")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-end">
                    <button
                      disabled={testingId === wh.id}
                      onClick={() => handleTest(wh)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Send
                        className={`h-3.5 w-3.5 ${
                          testingId === wh.id
                            ? "animate-ping text-indigo-500"
                            : ""
                        }`}
                      />
                      {testingId === wh.id
                        ? t("bi.datasets.detail.tabs.webhooks.testing")
                        : t("bi.datasets.detail.tabs.webhooks.testWebhook")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
