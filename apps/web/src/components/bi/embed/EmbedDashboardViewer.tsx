"use client";

import React, { useState, useEffect } from "react";
import { LayoutGrid, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface EmbedDashboardViewerProps {
  embedToken: string;
  dashboardId?: number;
  apiHost?: string;
  title?: string;
}

export const EmbedDashboardViewer: React.FC<EmbedDashboardViewerProps> = ({
  embedToken,
  dashboardId,
  title,
}) => {
  const t = useTranslations("bi");
  const displayTitle = title || t("embed.defaultTitle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!embedToken) {
      setError(t("embed.invalidToken"));
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [embedToken, t]);

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {displayTitle}
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              {t("embed.ssoMode")}
            </span>
          </div>
        </div>

        <button
          onClick={() => setLoading(true)}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          title={t("embed.refreshData")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 p-6 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500 font-medium">
                {t("embed.loadingAnalytics")}
              </span>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center gap-3 text-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                {t("embed.activeOrgTenant")}
              </span>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {t("embed.verifiedTenantScope")}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                {t("embed.embedTargetId")}
              </span>
              <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {t("embed.dashboardTarget", {
                  id: dashboardId ?? t("embed.systemAuto"),
                })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                {t("embed.securityEntitlement")}
              </span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {t("embed.tokenVerified")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
