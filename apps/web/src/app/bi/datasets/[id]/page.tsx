"use client";

import { useState, useEffect, useCallback, Suspense, lazy, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Home,
  ChevronRight,
  Database,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useTranslations, useLocale, useBidi } from "@/lib/i18n";
import {
  api,
  BiDatasetMetadata,
  BiValidationResult,
  BiQualityResult,
  BiAnalyticsResult,
  HistoryEntry,
} from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";

// Modularized Components
import { TabId } from "./components/types";
import { DatasetHeroBanner } from "./components/DatasetHeroBanner";
import { DatasetTabsNav } from "./components/DatasetTabsNav";
import { OverviewTab } from "./components/OverviewTab";
import { PreviewGridTab } from "./components/PreviewGridTab";
import { SchemaDictionaryTab } from "./components/SchemaDictionaryTab";
import { QualityDoctorTab } from "./components/QualityDoctorTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { LineageAuditTab } from "./components/LineageAuditTab";
import { GovernanceTab } from "./components/GovernanceTab";
import { VersioningTab } from "./components/VersioningTab";
import { SecurityPoliciesTab } from "./components/SecurityPoliciesTab";
import { QueryWorkbenchTab } from "./components/QueryWorkbenchTab";
import { WebhooksTab } from "./components/WebhooksTab";
import { ColumnProfilerDrawer } from "./components/ColumnProfilerDrawer";
import { SmartCleanModal } from "./components/SmartCleanModal";
import { EditDatasetModal } from "./components/EditDatasetModal";
import { DeleteDatasetModal } from "./components/DeleteDatasetModal";
import { DataContractModal } from "./components/DataContractModal";
import { CreateSnapshotModal } from "./components/CreateSnapshotModal";
import { CreatePolicyModal } from "./components/CreatePolicyModal";
import { CreateWebhookModal } from "./components/CreateWebhookModal";
import {
  DataContract,
  DatasetSnapshot,
  GovernanceData,
  SecurityPolicy,
  DatasetWebhook,
  WorkbenchQueryResult,
} from "./components/types";

const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

export default function DatasetDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const id = params.id;

  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations();
  const locale = useLocale();
  const { dir } = useBidi();
  const {
    isAuthenticated,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
  } = useAuthGuard({ requireAuth: false });

  // Tab State with legacy tab fallback mapping
  const rawTab = searchParams.get("tab") || "overview";
  const mapTab = (tab: string): TabId => {
    switch (tab) {
      case "preview":
      case "schema":
      case "data":
        return "data";
      case "quality":
      case "governance":
        return "quality";
      case "analytics":
      case "query":
        return "analytics";
      case "security":
      case "webhooks":
      case "versioning":
      case "lineage":
      case "history":
      case "settings":
        return "settings";
      default:
        return "overview";
    }
  };
  const [activeTab, setActiveTab] = useState<TabId>(mapTab(rawTab));

  // Core Data States
  const [dataset, setDataset] = useState<BiDatasetMetadata | null>(null);
  const [validation, setValidation] = useState<BiValidationResult | null>(null);
  const [quality, setQuality] = useState<BiQualityResult | null>(null);
  const [analytics, setAnalytics] = useState<BiAnalyticsResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);

  // Enterprise Data States
  const [contract, setContract] = useState<DataContract | null>(null);
  const [snapshots, setSnapshots] = useState<DatasetSnapshot[]>([]);
  const [governance, setGovernance] = useState<GovernanceData | null>(null);
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [webhooks, setWebhooks] = useState<DatasetWebhook[]>([]);

  // Loading & Action States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(
    null,
  );

  // Interactive Drawers & Modals
  const [profilingColumn, setProfilingColumn] = useState<string | null>(null);
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Load All Dataset Resources
  const fetchDatasetDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        dsData,
        valData,
        qualData,
        anaData,
        histData,
        contractRes,
        snapRes,
        govRes,
        secRes,
        whRes,
        prevRes,
      ] = await Promise.allSettled([
        api.getDatasetById(id),
        api.getValidation(id),
        api.getQuality(id),
        api.getAnalytics(id),
        api.getDatasetHistory(id),
        api.getDatasetContracts(id),
        api.getDatasetSnapshots(id),
        api.getDatasetGovernance(id),
        api.getDatasetSecurityPolicies(id),
        api.getDatasetWebhooks(id),
        api.getDatasetPreview(id, 50),
      ]);

      if (dsData.status === "fulfilled") {
        setDataset(dsData.value);
      } else {
        throw new Error(t("bi.datasets.detail.errors.notFound"));
      }

      if (valData.status === "fulfilled") setValidation(valData.value);
      if (qualData.status === "fulfilled") setQuality(qualData.value);
      if (anaData.status === "fulfilled") setAnalytics(anaData.value);
      if (histData.status === "fulfilled") setHistory(histData.value);
      if (contractRes.status === "fulfilled" && contractRes.value?.contract)
        setContract(contractRes.value.contract);
      if (snapRes.status === "fulfilled" && snapRes.value?.snapshots)
        setSnapshots(snapRes.value.snapshots);
      if (govRes.status === "fulfilled") setGovernance(govRes.value);
      if (secRes.status === "fulfilled" && secRes.value?.policies)
        setPolicies(secRes.value.policies);
      if (prevRes.status === "fulfilled" && prevRes.value) {
        const val = prevRes.value;
        const rows = Array.isArray(val)
          ? val
          : Array.isArray(val?.data)
            ? val.data
            : Array.isArray(val?.records)
              ? val.records
              : [];
        setPreviewRows(rows);
      }
    } catch (err: any) {
      console.error("Error fetching dataset details:", err);
      setError(err.message || t("bi.datasets.detail.errors.loadFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchDatasetDetails();
  }, [fetchDatasetDetails]);

  // Tab Switching Handler
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  // Re-scan / Refresh Dataset Handler
  const handleRefresh = async () => {
    setRefreshing(true);
    toast.promise(fetchDatasetDetails(), {
      loading: t("bi.datasets.detail.actions.refreshing"),
      success: t("bi.datasets.detail.actions.refreshed"),
      error: t("bi.datasets.detail.errors.refreshFailed"),
    });
  };

  // Update Dataset Metadata (Name, Domain, Description)
  const handleUpdateMetadata = async (updates: {
    name?: string;
    domain?: string;
    description?: string;
  }) => {
    try {
      const updated = await api.updateDataset(id, updates);
      setDataset(updated);
      toast.success(t("bi.datasets.detail.toast.updated"));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
      throw err;
    }
  };

  // Delete Dataset Handler
  const handleDeleteDataset = async () => {
    setIsDeleting(true);
    try {
      await api.deleteDataset(id);
      toast.success(t("bi.datasets.detail.toast.deleted"));
      router.push("/bi/datasets");
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.deleteFailed"));
      setIsDeleting(false);
      throw err;
    }
  };

  // Column Schema Type Change Handler
  const handleColumnTypeChange = async (
    columnName: string,
    newType: string,
    newSemanticType?: string,
  ) => {
    try {
      await api.updateColumnType(id, columnName, newType, newSemanticType);
      toast.success(t("bi.datasets.detail.toast.typeUpdated"));
      fetchDatasetDetails();
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  // Enterprise Feature Handlers
  const handleCreateContract = async (contractData: any) => {
    try {
      const res = await api.createDatasetContract(id, contractData);
      if (res?.contract) setContract(res.contract);
      toast.success(t("bi.datasets.detail.toast.contractActivated"));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleCreateSnapshot = async (snapData: any) => {
    try {
      const res = await api.createDatasetSnapshot(id, snapData);
      if (res?.snapshot) setSnapshots((prev) => [res.snapshot, ...prev]);
      toast.success(t("bi.datasets.detail.toast.snapshotCaptured"));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    setRestoringSnapshotId(snapshotId);
    try {
      await api.restoreDatasetSnapshot(id, snapshotId);
      toast.success(
        t("bi.datasets.detail.toast.snapshotRestored", { id: snapshotId }),
      );
      fetchDatasetDetails();
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const handleAddTag = async (tag: string) => {
    try {
      const res = await api.addDatasetTag(id, tag);
      if (res?.added_tag) {
        setGovernance((prev) => ({
          ...prev!,
          tags: [...(prev?.tags || []), res.added_tag],
        }));
        toast.success(
          t("bi.datasets.detail.toast.tagAdded", { tag: res.added_tag }),
        );
      }
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await api.removeDatasetTag(id, tag);
      setGovernance((prev) => ({
        ...prev!,
        tags: (prev?.tags || []).filter((t) => t !== tag),
      }));
      toast.success(t("bi.datasets.detail.toast.tagRemoved", { tag }));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleCreatePolicy = async (policyData: any) => {
    try {
      const res = await api.createDatasetSecurityPolicy(id, policyData);
      if (res?.policy) setPolicies((prev) => [res.policy, ...prev]);
      toast.success(t("bi.datasets.detail.toast.policySaved"));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleCreateWebhook = async (whData: any) => {
    try {
      const res = await api.createDatasetWebhook(id, whData);
      if (res?.webhook) setWebhooks((prev) => [res.webhook, ...prev]);
      toast.success(t("bi.datasets.detail.toast.webhookRegistered"));
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.errors.updateFailed"));
    }
  };

  const handleTestWebhook = async (wh: DatasetWebhook) => {
    try {
      const res = await api.testDatasetWebhook(id, {
        url: wh.url,
        event_type: wh.event_type,
      });
      toast.success(
        res.message || t("bi.datasets.detail.toast.webhookTestSuccess"),
      );
    } catch (err: any) {
      toast.error(
        err.message || t("bi.datasets.detail.toast.webhookTestError"),
      );
    }
  };

  const handleExecuteQuery = async (sqlQuery: string) => {
    try {
      const res = await api.queryDatasetWorkbench(id, sqlQuery);
      return res;
    } catch (err: any) {
      toast.error(err.message || t("bi.datasets.detail.toast.queryFailed"));
      return null;
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-20 sm:pt-24"
        dir={dir}
      >
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center animate-pulse">
                <Database className="w-8 h-8 text-indigo-400" />
              </div>
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                {t("bi.datasets.detail.loading.title")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("bi.datasets.detail.loading.subtitle")}
              </p>
            </div>
          </div>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div
        className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-20 sm:pt-24"
        dir={dir}
      >
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {error || t("bi.datasets.detail.errors.notFound")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {t("bi.datasets.detail.errors.notFoundDesc")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleRefresh}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t("bi.datasets.detail.actions.retry")}
              </button>
              <Link
                href="/bi/datasets"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                {t("bi.datasets.detail.actions.backToList")}
              </Link>
            </div>
          </div>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white pt-20 sm:pt-24"
      dir={dir}
    >
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* BREADCRUMB NAVIGATION */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 flex-wrap">
          <Link
            href="/"
            className="hover:text-indigo-400 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t("bi.datasets.nav.breadcrumb.home")}</span>
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-600 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <Link href="/bi" className="hover:text-indigo-400 transition-colors">
            {t("bi.datasets.nav.breadcrumb.bi")}
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-600 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <Link
            href="/bi/datasets"
            className="hover:text-indigo-400 transition-colors"
          >
            {t("bi.datasets.nav.breadcrumb.datasets")}
          </Link>
          <ChevronRight
            className={`w-3.5 h-3.5 text-slate-600 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <span className="text-slate-200 font-bold truncate max-w-[240px]">
            {dataset.name}
          </span>
        </nav>

        {/* HERO BANNER */}
        <DatasetHeroBanner
          dataset={dataset}
          t={t}
          dir={dir}
          locale={locale}
          refreshing={refreshing}
          isDeleting={isDeleting}
          onExport={() => api.exportDataset(id)}
          onRefresh={handleRefresh}
          onOpenCleanModal={() => setIsCleanModalOpen(true)}
          onUpdateMetadata={handleUpdateMetadata}
          onDeleteDataset={() => setIsDeleteModalOpen(true)}
        />

        {/* TABS NAVIGATION */}
        <div>
          <DatasetTabsNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            t={t}
            qualityIssueCount={quality?.issues?.length || 0}
            insightCount={analytics?.insights?.length || 0}
          />
        </div>

        {/* TAB CONTENTS (Consolidated 5 Staked Views) */}
        <div className="pt-2">
          {activeTab === "overview" && (
            <OverviewTab
              dataset={dataset}
              quality={quality}
              analytics={analytics}
              t={t}
              onNavigateTab={handleTabChange}
              onOpenCleanModal={() => setIsCleanModalOpen(true)}
            />
          )}

          {activeTab === "data" && (
            <div className="space-y-8">
              <PreviewGridTab
                dataset={dataset}
                datasetId={id}
                columns={dataset.columns || []}
                sampleData={
                  previewRows.length > 0
                    ? previewRows
                    : dataset.sample_records || []
                }
                totalRows={dataset.row_count || 0}
                t={t}
              />
              <SchemaDictionaryTab
                dataset={dataset}
                datasetId={id}
                columns={dataset.columns || []}
                sampleData={
                  previewRows.length > 0
                    ? previewRows
                    : dataset.sample_records || []
                }
                t={t}
                onOpenProfiler={(columnName) => setProfilingColumn(columnName)}
                onUpdateColumnType={handleColumnTypeChange}
              />
            </div>
          )}

          {activeTab === "quality" && (
            <div className="space-y-8">
              <QualityDoctorTab
                dataset={dataset}
                quality={quality}
                t={t}
                onOpenCleanModal={() => setIsCleanModalOpen(true)}
              />
              <GovernanceTab
                dataset={dataset}
                contract={contract}
                governance={governance}
                t={t}
                onOpenContractModal={() => setIsContractModalOpen(true)}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
              />
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-8">
              <AnalyticsTab
                dataset={dataset}
                analytics={analytics}
                columns={dataset.columns || []}
                t={t}
              />
              <QueryWorkbenchTab
                datasetName={dataset.name}
                t={t}
                onExecuteQuery={handleExecuteQuery}
              />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-8">
              <SecurityPoliciesTab
                policies={policies}
                t={t}
                onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
              />
              <WebhooksTab
                webhooks={webhooks}
                t={t}
                onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
                onTestWebhook={handleTestWebhook}
              />
              <VersioningTab
                snapshots={snapshots}
                t={t}
                locale={locale}
                onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
                onRestoreSnapshot={handleRestoreSnapshot}
                restoringId={restoringSnapshotId}
              />
              <LineageAuditTab
                dataset={dataset}
                datasetId={id}
                history={history}
                t={t}
              />
            </div>
          )}
        </div>
      </main>

      {/* DRAWERS & MODALS */}
      {profilingColumn && (
        <ColumnProfilerDrawer
          datasetId={id}
          columnName={profilingColumn}
          isOpen={!!profilingColumn}
          onClose={() => setProfilingColumn(null)}
          t={t}
        />
      )}

      {isContractModalOpen && (
        <DataContractModal
          isOpen={isContractModalOpen}
          onClose={() => setIsContractModalOpen(false)}
          onSubmit={handleCreateContract}
          t={t}
        />
      )}

      {isSnapshotModalOpen && (
        <CreateSnapshotModal
          isOpen={isSnapshotModalOpen}
          onClose={() => setIsSnapshotModalOpen(false)}
          onSubmit={handleCreateSnapshot}
          t={t}
        />
      )}

      {isPolicyModalOpen && (
        <CreatePolicyModal
          isOpen={isPolicyModalOpen}
          onClose={() => setIsPolicyModalOpen(false)}
          onSubmit={handleCreatePolicy}
          columns={(dataset.columns || []).map((c: any) =>
            typeof c === "string" ? c : c.name || String(c),
          )}
          t={t}
        />
      )}

      {isWebhookModalOpen && (
        <CreateWebhookModal
          isOpen={isWebhookModalOpen}
          onClose={() => setIsWebhookModalOpen(false)}
          onSubmit={handleCreateWebhook}
          t={t}
        />
      )}

      {isCleanModalOpen && (
        <SmartCleanModal
          datasetId={id}
          datasetName={dataset.name}
          isOpen={isCleanModalOpen}
          onClose={() => setIsCleanModalOpen(false)}
          onCleanComplete={() => {
            fetchDatasetDetails();
          }}
          t={t}
        />
      )}

      {isEditModalOpen && (
        <EditDatasetModal
          dataset={dataset}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateMetadata}
          t={t}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteDatasetModal
          datasetName={dataset.name}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirmDelete={handleDeleteDataset}
          t={t}
        />
      )}

      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
