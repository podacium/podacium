"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileSearch,
  Download,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Database,
  Users,
  Settings,
  AlertTriangle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api, OrganizationResponse } from "@/lib/api";

import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export interface OrganizationAuditTabProps {
  organization: OrganizationResponse;
  isAdminOrOwner?: boolean;
}

export interface AuditLogItem {
  id: number;
  eventType: string;
  createdAt: string;
  userId?: number;
  user?: {
    id: number;
    fullName?: string;
    email?: string;
  };
  eventData?: any;
  ipAddress?: string;
  userAgent?: string;
}

export function OrganizationAuditTab({
  organization,
  isAdminOrOwner = true,
}: OrganizationAuditTabProps) {
  const t = useTranslations();
  const locale = useLocale();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getOrganizationAuditLogs(organization.id, 100);
      if (res?.logs) {
        setLogs(res.logs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
      // Fallback empty list
      setLogs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [organization.id]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAuditLogs();
  };

  // Client-side CSV generator with UTF-8 BOM
  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.error(t("organizations.audit.noLogs"));
      return;
    }

    try {
      setIsExporting(true);
      const headers = [
        "Log ID",
        "Timestamp (UTC)",
        "Event Type",
        "Actor Email",
        "User ID",
        "IP Address",
        "Details",
      ];

      const csvRows = logs.map((log) => {
        const actor =
          log.user?.email || (log.userId ? `User #${log.userId}` : "System");
        const details =
          typeof log.eventData === "object"
            ? JSON.stringify(log.eventData).replace(/"/g, '""')
            : String(log.eventData || "").replace(/"/g, '""');

        return [
          log.id,
          log.createdAt,
          `"${log.eventType}"`,
          `"${actor}"`,
          log.userId || "",
          `"${log.ipAddress || ""}"`,
          `"${details}"`,
        ].join(",");
      });

      // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
      const csvContent =
        "\uFEFF" + [headers.join(","), ...csvRows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `audit-log-org-${organization.id}-${dateStr}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("organizations.audit.csvExportSuccess"));
    } catch (err) {
      console.error("Failed to export CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const getEventBadgeVariant = (eventType: string) => {
    const type = eventType.toUpperCase();
    if (
      type.includes("SECURITY") ||
      type.includes("RESTRICT") ||
      type.includes("FAIL")
    )
      return "destructive";
    if (
      type.includes("CLEARED") ||
      type.includes("APPROVED") ||
      type.includes("VERIFIED")
    )
      return "success";
    if (type.includes("PENDING") || type.includes("REQUEST")) return "warning";
    return "outline";
  };

  const getEventIcon = (eventType: string) => {
    const type = eventType.toUpperCase();
    if (
      type.includes("WALLET") ||
      type.includes("WIRE") ||
      type.includes("PROFORMA") ||
      type.includes("ESCROW")
    )
      return (
        <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      );
    if (
      type.includes("KYB") ||
      type.includes("SECURITY") ||
      type.includes("AUTH")
    )
      return (
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      );
    if (
      type.includes("DATASET") ||
      type.includes("REPORT") ||
      type.includes("BI")
    )
      return (
        <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      );
    if (
      type.includes("MEMBER") ||
      type.includes("USER") ||
      type.includes("INVITE")
    )
      return <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !searchQuery ||
        log.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user?.email &&
          log.user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.ipAddress && log.ipAddress.includes(searchQuery));

      if (!matchSearch) return false;

      if (selectedFilter === "FINANCIAL") {
        return ["WALLET", "WIRE", "PROFORMA", "ESCROW", "INVOICE"].some((k) =>
          log.eventType.toUpperCase().includes(k),
        );
      }
      if (selectedFilter === "SECURITY") {
        return ["KYB", "SECURITY", "AUTH", "PASSWORD", "SSO"].some((k) =>
          log.eventType.toUpperCase().includes(k),
        );
      }
      if (selectedFilter === "DATA") {
        return ["DATASET", "REPORT", "QUERY", "EXPORT"].some((k) =>
          log.eventType.toUpperCase().includes(k),
        );
      }
      return true;
    });
  }, [logs, searchQuery, selectedFilter]);

  return (
    <div className="space-y-6 pt-4" data-testid="organization-audit-tab">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {t("organizations.audit.timelineTitle")}
            </h3>
            <PodaciumBadge
              variant="outline"
              className="text-[10px] font-mono uppercase tracking-wider"
            >
              {t("organizations.audit.anpdpLawBadge")}
            </PodaciumBadge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("organizations.audit.timelineSubtitle")}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {t("organizations.audit.refresh")}
          </PodaciumButton>

          <PodaciumButton
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            loading={isExporting}
            disabled={logs.length === 0}
            icon={<Download className="w-3.5 h-3.5" />}
            data-testid="export-audit-csv-btn"
          >
            {isExporting
              ? t("organizations.audit.exportingCsv")
              : t("organizations.audit.exportCsv")}
          </PodaciumButton>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <PodaciumCard className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("organizations.searchMembersPlaceholder")}
              className="w-full h-9 ps-9 pe-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "FINANCIAL", "SECURITY", "DATA"].map((flt) => (
              <button
                key={flt}
                type="button"
                onClick={() => setSelectedFilter(flt)}
                className={cn(
                  "py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                  selectedFilter === flt
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {flt === "ALL" ? t("organizations.audit.filterAll") : flt}
              </button>
            ))}
          </div>
        </div>
      </PodaciumCard>

      {/* Timeline List */}
      <PodaciumCard className="p-6">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <FileSearch className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p
              className="text-sm text-muted-foreground"
              data-testid="no-audit-logs-text"
            >
              {t("organizations.audit.noLogs")}
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="audit-log-timeline">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/80 bg-card hover:border-primary/30 transition-colors"
                data-testid="audit-log-item"
              >
                <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                  {getEventIcon(log.eventType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground font-mono">
                        {log.eventType}
                      </span>
                      <PodaciumBadge
                        variant={getEventBadgeVariant(log.eventType)}
                        className="text-[10px] font-mono uppercase"
                      >
                        #{log.id}
                      </PodaciumBadge>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString(
                            locale === "ar" ? "ar-DZ" : "fr-DZ",
                          )
                        : "—"}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="text-foreground font-medium">
                      {log.user?.email ||
                        (log.userId ? `User #${log.userId}` : "System")}
                    </span>
                    {log.ipAddress && (
                      <span className="font-mono text-[11px]" dir="ltr">
                        IP: {log.ipAddress}
                      </span>
                    )}
                  </div>

                  {log.eventData && (
                    <div className="mt-2 p-2 rounded-lg bg-muted/40 text-[11px] font-mono text-foreground break-all">
                      {typeof log.eventData === "string"
                        ? log.eventData
                        : JSON.stringify(log.eventData)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PodaciumCard>
    </div>
  );
}

export default OrganizationAuditTab;
