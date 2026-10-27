"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";
import {
  PodaciumButton,
  PodaciumCard,
  PodaciumBadge,
  PodaciumInput,
  PodaciumSelect,
  PodaciumModal,
} from "@/components/design-system";
import {
  ShieldCheck,
  Shield,
  UserPlus,
  GraduationCap,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Search,
  Lock,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Calendar,
  User,
  Copy,
  Check,
  FileCode,
  X,
} from "lucide-react";

interface Activity {
  id?: string;
  sequenceNumber?: number;
  action?: string;
  type?: string;
  domain?: string;
  severity?: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  actor: string;
  actorId?: number | string;
  actorEmail?: string;
  impersonatorId?: number;
  resourceType?: string;
  resourceId?: string;
  detail: string;
  ipAddress?: string;
  userAgent?: string;
  geoCountry?: string;
  geoWilaya?: number;
  sessionId?: string;
  mfaVerified?: boolean;
  sha256Hash?: string;
  previousHash?: string;
  entryHash?: string;
  prevHash?: string;
  beforeState?: any;
  afterState?: any;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface VerificationResult {
  is_valid?: boolean;
  valid?: boolean;
  verified_count?: number;
  verified_records?: number;
  tampered_records?: number;
  latest_sequence?: number;
  corruptions?: any[];
  message?: string;
  algorithm?: string;
  standard?: string;
  verified_at?: string;
}

const ALGERIAN_WILAYAS = [
  { value: "", label: "All Wilayas (1–58)" },
  { value: "1", label: "01 - Adrar" },
  { value: "2", label: "02 - Chlef" },
  { value: "3", label: "03 - Laghouat" },
  { value: "4", label: "04 - Oum El Bouaghi" },
  { value: "5", label: "05 - Batna" },
  { value: "6", label: "06 - Béjaïa" },
  { value: "7", label: "07 - Biskra" },
  { value: "8", label: "08 - Béchar" },
  { value: "9", label: "09 - Blida" },
  { value: "10", label: "10 - Bouira" },
  { value: "11", label: "11 - Tamanrasset" },
  { value: "12", label: "12 - Tébessa" },
  { value: "13", label: "13 - Tlemcen" },
  { value: "14", label: "14 - Tiaret" },
  { value: "15", label: "15 - Tizi Ouzou" },
  { value: "16", label: "16 - Alger" },
  { value: "17", label: "17 - Djelfa" },
  { value: "18", label: "18 - Jijel" },
  { value: "19", label: "19 - Sétif" },
  { value: "20", label: "20 - Saïda" },
  { value: "21", label: "21 - Skikda" },
  { value: "22", label: "22 - Sidi Bel Abbès" },
  { value: "23", label: "23 - Annaba" },
  { value: "24", label: "24 - Guelma" },
  { value: "25", label: "25 - Constantine" },
  { value: "26", label: "26 - Médéa" },
  { value: "27", label: "27 - Mostaganem" },
  { value: "28", label: "28 - M'Sila" },
  { value: "29", label: "29 - Mascara" },
  { value: "30", label: "30 - Ouargla" },
  { value: "31", label: "31 - Oran" },
  { value: "32", label: "32 - El Bayadh" },
  { value: "33", label: "33 - Illizi" },
  { value: "34", label: "34 - Bordj Bou Arréridj" },
  { value: "35", label: "35 - Boumerdès" },
  { value: "36", label: "36 - El Tarf" },
  { value: "37", label: "37 - Tindouf" },
  { value: "38", label: "38 - Tissemsilt" },
  { value: "39", label: "39 - El Oued" },
  { value: "40", label: "40 - Khenchela" },
  { value: "41", label: "41 - Souk Ahras" },
  { value: "42", label: "42 - Tipaza" },
  { value: "43", label: "43 - Mila" },
  { value: "44", label: "44 - Aïn Defla" },
  { value: "45", label: "45 - Naâma" },
  { value: "46", label: "46 - Aïn Témouchent" },
  { value: "47", label: "47 - Ghardaïa" },
  { value: "48", label: "48 - Relizane" },
  { value: "49", label: "49 - Timimoun" },
  { value: "50", label: "50 - Bordj Badji Mokhtar" },
  { value: "51", label: "51 - Ouled Djellal" },
  { value: "52", label: "52 - Béni Abbès" },
  { value: "53", label: "53 - In Salah" },
  { value: "54", label: "54 - In Guezzam" },
  { value: "55", label: "55 - Touggourt" },
  { value: "56", label: "56 - Djanet" },
  { value: "57", label: "57 - El M'Ghair" },
  { value: "58", label: "58 - El Meniaa" },
];

const domainIcons: Record<string, any> = {
  SYSTEM: Sliders,
  USERS: UserPlus,
  EDUCATION: GraduationCap,
  BILLING: CreditCard,
  SUPPORT: Shield,
  SECURITY: Lock,
  RBAC: Lock,
  IAM: Lock,
  KYC: ShieldCheck,
  FREELANCING: CreditCard,
};

const severityBadgeVariants: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  INFO: "secondary",
  LOW: "outline",
  MEDIUM: "warning",
  HIGH: "destructive",
  CRITICAL: "destructive",
};

export default function AdminActivityLogPage() {
  const t = useTranslations();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [actionSearch, setActionSearch] = useState<string>("");
  const [actorSearch, setActorSearch] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [wilayaFilter, setWilayaFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Verification state & live badge
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState<VerificationResult | null>(
    null,
  );
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  // Diff drawer / modal state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchChainStatus = useCallback(async () => {
    try {
      const res = await api.get<VerificationResult>(
        "/api/admin/audit/verify-chain",
      );
      setChainStatus(res);
    } catch (e) {
      console.warn("Audit chain verification check failed:", e);
    }
  }, []);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", "25");
      if (domainFilter) params.set("domain", domainFilter);
      if (actionSearch) params.set("action", actionSearch);
      if (actorSearch) params.set("actor", actorSearch);
      if (severityFilter) params.set("severity", severityFilter);
      if (wilayaFilter) params.set("geoWilaya", wilayaFilter);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());

      const res = await api.get<any>(
        `/api/admin/activity-log?${params.toString()}`,
      );
      setActivities(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (e) {
      console.error("Failed to fetch activity log:", e);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    domainFilter,
    actionSearch,
    actorSearch,
    severityFilter,
    wilayaFilter,
    startDate,
    endDate,
  ]);

  const verifyAuditTrail = async () => {
    setVerifying(true);
    try {
      const res = await api.get<VerificationResult>(
        "/api/admin/audit/verify-chain",
      );
      setVerificationResult(res);
      setChainStatus(res);
    } catch (e: any) {
      const err = {
        is_valid: false,
        valid: false,
        verified_count: 0,
        tampered_records: 1,
        latest_sequence: 0,
        message:
          e.message || "Failed to verify cryptographic audit trail integrity",
      };
      setVerificationResult(err);
      setChainStatus(err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    fetchChainStatus();
  }, [fetchChainStatus]);

  const clearAllFilters = () => {
    setDomainFilter("");
    setActionSearch("");
    setActorSearch("");
    setSeverityFilter("");
    setWilayaFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Safe CSV export with formula injection defense
  const exportSafeCSV = () => {
    if (activities.length === 0) return;
    const sanitizeCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = [
      "Sequence",
      "Timestamp",
      "Domain",
      "Action",
      "Actor",
      "ActorEmail",
      "Severity",
      "Wilaya",
      "Detail",
      "Sha256Hash",
    ];
    const rows = activities.map((a) => [
      sanitizeCell(a.sequenceNumber || ""),
      sanitizeCell(a.timestamp),
      sanitizeCell(a.domain || "SYSTEM"),
      sanitizeCell(a.action || a.type || ""),
      sanitizeCell(a.actor),
      sanitizeCell(a.actorEmail || ""),
      sanitizeCell(a.severity || "INFO"),
      sanitizeCell(a.geoWilaya || ""),
      sanitizeCell(a.detail),
      sanitizeCell(a.sha256Hash || a.entryHash || ""),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit-vault-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isChainValid = chainStatus?.is_valid ?? chainStatus?.valid;

  return (
    <div className="space-y-6">
      {/* Header with Live Chain Verification Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-600" />
              {t("admin.activityLog.title")}
            </h1>

            {/* Live Chain Verification Badge */}
            {chainStatus && (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${
                  isChainValid
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                }`}
              >
                {isChainValid ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-semibold">
                      {t("admin.activityLog.chainIntactBadge")}
                    </span>
                    <span className="opacity-75">
                      (
                      {chainStatus.verified_count ??
                        chainStatus.verified_records ??
                        0}{" "}
                      blocks)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                    <span className="font-semibold">
                      {t("admin.activityLog.chainTamperedBadge")}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.activityLog.subtitle")}
          </p>
        </div>

        {/* Cryptographic Verification Action & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={exportSafeCSV}
            disabled={activities.length === 0}
            className="text-xs"
          >
            {t("admin.common.exportCsv")}
          </PodaciumButton>
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={verifyAuditTrail}
            disabled={verifying}
            className="flex items-center gap-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs"
          >
            <ShieldCheck
              className={`h-4 w-4 ${verifying ? "animate-spin" : ""}`}
            />
            {verifying
              ? t("admin.activityLog.verifying")
              : t("admin.activityLog.verifyChain")}
          </PodaciumButton>
          <PodaciumButton
            variant="ghost"
            size="sm"
            onClick={() => fetchLog()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </PodaciumButton>
        </div>
      </div>

      {/* Verification Result Detailed Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            (verificationResult.is_valid ?? verificationResult.valid)
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-red-50/80 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200"
          }`}
        >
          {(verificationResult.is_valid ?? verificationResult.valid) ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              {(verificationResult.is_valid ?? verificationResult.valid)
                ? t("admin.activityLog.chainValidFull")
                : t("admin.activityLog.chainCompromisedFull")}
            </p>
            <p className="mt-0.5 text-xs opacity-90 font-mono">
              {t("admin.activityLog.verified")}:{" "}
              {verificationResult.verified_count ??
                verificationResult.verified_records ??
                0}{" "}
              {t("admin.activityLog.records")}
              {verificationResult.corruptions &&
                verificationResult.corruptions.length > 0 && (
                  <span className="text-red-600 font-bold ml-2">
                    | {t("admin.activityLog.corruptions")}{" "}
                    {verificationResult.corruptions.length}
                  </span>
                )}
            </p>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            {t("admin.activityLog.dismiss")}
          </button>
        </div>
      )}

      {/* Multi-Parameter Filter Card */}
      <PodaciumCard className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action / Keyword Search */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              {t("admin.activityLog.actionKeyword")}
            </label>
            <PodaciumInput
              placeholder={t("admin.activityLog.searchPlaceholder")}
              value={actionSearch}
              onChange={(e) => {
                setActionSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4 text-gray-400" />}
            />
          </div>

          {/* Actor Filter (ID or Email) */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              {t("admin.activityLog.actorIdEmail")}
            </label>
            <PodaciumInput
              placeholder={t("admin.activityLog.actorPlaceholder")}
              value={actorSearch}
              onChange={(e) => {
                setActorSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<User className="h-4 w-4 text-gray-400" />}
            />
          </div>

          {/* Domain Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              {t("admin.activityLog.domain")}
            </label>
            <PodaciumSelect
              value={domainFilter}
              onChange={(e) => {
                setDomainFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: t("admin.activityLog.allDomains"), value: "" },
                { label: "IAM", value: "IAM" },
                { label: "EDUCATION", value: "EDUCATION" },
                { label: "BILLING", value: "BILLING" },
                { label: "USERS", value: "USERS" },
                { label: "SECURITY", value: "SECURITY" },
                { label: "RBAC", value: "RBAC" },
                { label: "SUPPORT", value: "SUPPORT" },
                { label: "SYSTEM", value: "SYSTEM" },
                { label: "KYC", value: "KYC" },
                { label: "FREELANCING", value: "FREELANCING" },
              ]}
            />
          </div>

          {/* Severity Filter */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 block">
              {t("admin.activityLog.severity")}
            </label>
            <PodaciumSelect
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: t("admin.activityLog.allSeverities"), value: "" },
                { label: "INFO", value: "INFO" },
                { label: "LOW", value: "LOW" },
                { label: "MEDIUM", value: "MEDIUM" },
                { label: "HIGH", value: "HIGH" },
                { label: "CRITICAL", value: "CRITICAL" },
              ]}
            />
          </div>
        </div>

        {/* Secondary Filters: Wilaya and Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1 border-t border-gray-100 dark:border-slate-800">
          {/* Algerian Wilaya 1-58 */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {t("admin.activityLog.algerianWilaya")}
            </label>
            <PodaciumSelect
              value={wilayaFilter}
              onChange={(e) => {
                setWilayaFilter(e.target.value);
                setPage(1);
              }}
              options={ALGERIAN_WILAYAS}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {t("admin.activityLog.fromDate")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {t("admin.activityLog.toDate")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border rounded-lg border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="w-full text-xs text-gray-600 dark:text-slate-400"
            >
              {t("admin.activityLog.clearFilters")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumCard>

      {/* Activity Log Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden shadow-xs">
        {activities.map((a, i) => {
          const domain = a.domain || "SYSTEM";
          const Icon = domainIcons[domain] || Sliders;
          const severity = a.severity || "INFO";
          const badgeVariant = severityBadgeVariants[severity] || "secondary";
          const hasDiff =
            a.beforeState !== undefined || a.afterState !== undefined;

          return (
            <div
              key={a.id || i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              onClick={() => setSelectedActivity(a)}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 shrink-0 mt-0.5">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.sequenceNumber !== undefined && (
                      <span className="text-xs font-mono text-gray-400 dark:text-slate-500 font-bold">
                        #{a.sequenceNumber}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {a.action || a.type || "ACTIVITY"}
                    </span>
                    {a.domain && (
                      <PodaciumBadge variant="outline">
                        {a.domain}
                      </PodaciumBadge>
                    )}
                    {a.severity && (
                      <PodaciumBadge variant={badgeVariant}>
                        {a.severity}
                      </PodaciumBadge>
                    )}
                    {a.geoWilaya && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                        {t("admin.activityLog.wilaya")} {a.geoWilaya}
                      </span>
                    )}
                    {hasDiff && (
                      <PodaciumBadge
                        variant="secondary"
                        className="text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                      >
                        <FileCode className="h-3 w-3 inline mr-1" />
                        {t("admin.activityLog.stateDiff")}
                      </PodaciumBadge>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 dark:text-slate-400 break-words">
                    <span className="font-medium text-gray-700 dark:text-slate-300">
                      {a.actor}
                    </span>{" "}
                    {a.actorEmail && (
                      <span className="text-gray-400 font-mono">
                        ({a.actorEmail})
                      </span>
                    )}
                    {" — "}
                    {a.detail}
                  </p>

                  {/* Cryptographic hash snippet */}
                  {(a.sha256Hash || a.entryHash) && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400 dark:text-slate-500 pt-0.5">
                      <Lock className="h-3 w-3 inline text-emerald-500/70" />
                      <span
                        className="truncate max-w-xs font-mono"
                        title={t("common.uiLabels.digestTitle", {
                          hash: a.sha256Hash || a.entryHash || "",
                          prev: a.previousHash || a.prevHash || "000000",
                        })}
                      >
                        sha256:{" "}
                        {(a.sha256Hash || a.entryHash || "").slice(0, 16)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-400 dark:text-slate-500 shrink-0 sm:text-right pl-11 sm:pl-0 flex flex-col items-start sm:items-end gap-1">
                <time>{new Date(a.timestamp).toLocaleString()}</time>
                {a.resourceType && (
                  <p className="text-[11px] text-gray-400">
                    {a.resourceType} {a.resourceId ? `:${a.resourceId}` : ""}
                  </p>
                )}
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                  {t("admin.activityLog.viewDiffAndVault")}
                </span>
              </div>
            </div>
          );
        })}

        {activities.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-500 dark:text-slate-400">
            <Shield className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("admin.common.noResults")}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t("admin.activityLog.emptySubtitle")}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("admin.common.page")} {page} {t("admin.common.of")} {totalPages}{" "}
            ({total} {t("admin.activityLog.totalEntries")})
          </p>
          <div className="flex gap-2">
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </PodaciumButton>
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={16} />
            </PodaciumButton>
          </div>
        </div>
      )}

      {/* Slide-over / Modal for Side-by-Side Visual Diff & Cryptographic Verification */}
      {selectedActivity && (
        <PodaciumModal
          isOpen={true}
          onClose={() => setSelectedActivity(null)}
          title={`${t("admin.activityLog.auditRecord")} #${selectedActivity.sequenceNumber || "0"} — ${selectedActivity.action || selectedActivity.type}`}
          size="full"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 text-xs font-mono">
              <div>
                <span className="text-gray-400 block">
                  {t("admin.activityLog.actor")}
                </span>
                <span className="font-semibold text-gray-800 dark:text-slate-200">
                  {selectedActivity.actor}{" "}
                  {selectedActivity.actorEmail &&
                    `(${selectedActivity.actorEmail})`}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">
                  {t("admin.activityLog.severityDomain")}
                </span>
                <span className="font-semibold text-gray-800 dark:text-slate-200">
                  {selectedActivity.severity || "INFO"} /{" "}
                  {selectedActivity.domain || "SYSTEM"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">
                  {t("admin.activityLog.wilayaIp")}
                </span>
                <span className="font-semibold text-gray-800 dark:text-slate-200">
                  {selectedActivity.geoWilaya
                    ? `${t("admin.activityLog.wilaya")} ${selectedActivity.geoWilaya}`
                    : "N/A"}{" "}
                  ({selectedActivity.ipAddress || "127.0.0.1"})
                </span>
              </div>
              <div>
                <span className="text-gray-400 block">
                  {t("admin.activityLog.sessionId")}
                </span>
                <span className="font-semibold text-gray-800 dark:text-slate-200 truncate block">
                  {selectedActivity.sessionId || "None"}
                </span>
              </div>
            </div>

            {/* Side-by-Side State Diff */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-emerald-600" />
                {t("admin.activityLog.stateMutationDiff")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before State */}
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 overflow-hidden">
                  <div className="px-3 py-2 bg-red-100/60 dark:bg-red-900/40 text-red-900 dark:text-red-200 font-semibold text-xs border-b border-red-200 dark:border-red-900/50 flex justify-between items-center">
                    <span>{t("admin.activityLog.beforeStatePrevious")}</span>
                    <span className="text-[11px] font-mono opacity-75">
                      {selectedActivity.beforeState
                        ? t("admin.activityLog.jsonObject")
                        : t("admin.activityLog.nullCreated")}
                    </span>
                  </div>
                  <pre className="p-3 text-xs font-mono text-gray-800 dark:text-slate-200 overflow-x-auto max-h-64">
                    {selectedActivity.beforeState
                      ? JSON.stringify(selectedActivity.beforeState, null, 2)
                      : "/* No prior state (Resource Creation) */"}
                  </pre>
                </div>

                {/* After State */}
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 overflow-hidden">
                  <div className="px-3 py-2 bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-semibold text-xs border-b border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center">
                    <span>{t("admin.activityLog.afterStateMutated")}</span>
                    <span className="text-[11px] font-mono opacity-75">
                      {selectedActivity.afterState
                        ? t("admin.activityLog.jsonObject")
                        : t("admin.activityLog.nullDeleted")}
                    </span>
                  </div>
                  <pre className="p-3 text-xs font-mono text-gray-800 dark:text-slate-200 overflow-x-auto max-h-64">
                    {selectedActivity.afterState
                      ? JSON.stringify(selectedActivity.afterState, null, 2)
                      : "/* No after state (Resource Deletion) */"}
                  </pre>
                </div>
              </div>
            </div>

            {/* Metadata Payload if present */}
            {selectedActivity.metadata &&
              Object.keys(selectedActivity.metadata).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    {t("admin.activityLog.actionMetadataPayload")}
                  </h4>
                  <pre className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-xs font-mono text-gray-700 dark:text-slate-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedActivity.metadata, null, 2)}
                  </pre>
                </div>
              )}

            {/* Cryptographic Linkage Block */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  {t("admin.activityLog.vaultSignature")}
                </span>
                <PodaciumButton
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      selectedActivity.sha256Hash ||
                        selectedActivity.entryHash ||
                        "",
                    )
                  }
                  className="h-6 px-2 text-[11px]"
                >
                  {copiedHash ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedHash
                    ? t("admin.activityLog.copied")
                    : t("admin.activityLog.copyHash")}
                </PodaciumButton>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-gray-400 w-24 shrink-0">
                    {t("admin.activityLog.currentHash")}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 break-all">
                    {selectedActivity.sha256Hash ||
                      selectedActivity.entryHash ||
                      "N/A"}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-gray-400 w-24 shrink-0">
                    {t("admin.activityLog.previousHash")}
                  </span>
                  <span className="font-mono text-gray-500 dark:text-slate-400 break-all">
                    {selectedActivity.previousHash ||
                      selectedActivity.prevHash ||
                      "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedActivity(null)}
              >
                {t("admin.activityLog.closeVaultExplorer")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      )}
    </div>
  );
}
