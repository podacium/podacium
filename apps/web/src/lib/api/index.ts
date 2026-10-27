/**
 * API Module Index
 *
 * This barrel file re-exports all domain modules and provides a unified `api` object
 * for backward compatibility with existing code that uses `api.login()`, `api.getModule()`, etc.
 *
 * New code should import directly from domain modules:
 *   import { authApi } from '@/lib/api/auth'
 *   import { educationApi } from '@/lib/api/education'
 */

// ── Purchase idempotency (audit P1: prevent double-charge on double-click) ──
// A stable key is generated per product intent and reused across retries, so
// the server's X-Idempotency-Key reservation closes the double-charge race.
// The key is cleared after a successful call, so a genuine future re-purchase
// starts a fresh intent.
const pendingPurchaseKeys = new Map<string, string>();

export interface PurchaseResponse {
  data: {
    paid_with_wallet?: boolean;
    checkout_url?: string;
    transaction_id?: string;
    [key: string]: unknown;
  };
}

function idempotencyKeyFor(productKey: string): string {
  let key = pendingPurchaseKeys.get(productKey);
  if (!key) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingPurchaseKeys.set(productKey, key);
  }
  return key;
}

async function purchaseWithIdempotency(
  product: string,
  data: Record<string, unknown>,
  path: string,
): Promise<PurchaseResponse> {
  const productKey = `${product}:${String(data?.course_id ?? data?.path_id ?? data?.session_id ?? data?.module_id ?? "")}`;
  const idempotencyKey = idempotencyKeyFor(productKey);
  try {
    // Eagerly seed the CSRF cookie before reserving the idempotency key.
    // Without this, a missing csrf_token cookie causes a 403 on the first
    // attempt, but the idempotency key is already reserved by the server —
    // so the automatic 403→retry in the API client hits the cached 403
    // response instead of a fresh request with a valid token.
    await apiClient.ensureCsrfToken();
    const result = await apiClient.post<PurchaseResponse>(path, data, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    pendingPurchaseKeys.delete(productKey);
    return result;
  } catch (err) {
    // A 409 "request in progress" means a twin request is still running —
    // keep the key so the retry resolves to the same transaction.
    const httpErr = err as { status?: number; message?: string } | undefined;
    if (
      httpErr?.status === 409 &&
      String(httpErr?.message ?? "").includes("in_progress")
    ) {
      throw err;
    }
    pendingPurchaseKeys.delete(productKey);
    throw err;
  }
}

// Re-export all types and errors
export * from "./errors";
export * from "./types";
export * from "./endpoints";
export * from "./auth";
export * from "./users";
export * from "./education";
export * from "./payments";
export * from "./freelancing";
export * from "./notifications";
export * from "./devices";
export type { DatasetResponse, WidgetResponse, AnalyticsQuery } from "./bi";
export type { DashboardResponse as BiDashboardResponse } from "./bi";
export type {
  BiWidget,
  BiWidgetPosition,
  BiWidgetDataSource,
  BiWidgetVisualization,
  BiWidgetStyle,
  BiWidgetInteractivity,
  BiDashboardMetadata,
  BiDashboardCreate,
  DashboardConfig,
  DashboardLayout,
  BiWidgetCreate,
  DataSource,
  BiDatasetMetadata,
  BiDatasetResponse,
  BiDatasetListResponse,
  BiQualityResult,
  BiQualityIssue,
  BiValidationResult,
  BiAnalyticsResult,
  HistoryEntry,
  OrganizationResponse,
  OrganizationMemberResponse,
  InvitationResponse,
  OrganizationCreate,
  LessonProgressResponse,
  PublicOrganizationProfileResponse,
  CompanyCaseStudy,
  CompanyLeadership,
  CompanyReview,
  OrgProfile,
} from "./compat";
export {
  WidgetType,
  DatasetStatus,
  ViewType,
  LayoutType,
  apiHelpers,
} from "./compat";
export { CompanySizeBracket, type PublicOrganizationSummary } from "./types";

// Re-export domain API objects
export { authApi } from "./auth";
export { usersApi } from "./users";
export { educationApi } from "./education";
export { paymentsApi } from "./payments";
export { freelancingApi } from "./freelancing";
export { notificationsApi } from "./notifications";
export { devicesApi } from "./devices";
export { biApi } from "./bi";
export { waitlistApi } from "./waitlist";
export { liveSessionsApi } from "./live-sessions";
export { trendingApi } from "./trending";
export { apiClient } from "./client";
export { uploadFileWithProgress } from "./uploader";

// =============================================================================
// BACKWARD-COMPATIBLE UNIFIED API OBJECT
// =============================================================================
// This maintains compatibility with existing code that uses `api.login()`, etc.
// Gradually migrate to direct domain imports.

import { authApi } from "./auth";
import { usersApi } from "./users";
import { educationApi } from "./education";
import { paymentsApi } from "./payments";
import {
  freelancingApi,
  ProjectResponse,
  PublicFreelancerResponse,
  PublicFreelancerSearchResponse,
} from "./freelancing";
import { notificationsApi } from "./notifications";
import { devicesApi } from "./devices";
import { biApi } from "./bi";
import { waitlistApi } from "./waitlist";
import { liveSessionsApi } from "./live-sessions";
import { trendingApi } from "./trending";
import { apiClient } from "./client";
import { uploadFileWithProgress } from "./uploader";
import type { PublicOrganizationSummary } from "./types";
import type { PublicOrganizationProfileResponse } from "./compat";

export const api = {
  // Auth
  login: authApi.login,
  register: authApi.register,
  logout: authApi.logout,
  complete2fa: authApi.complete2fa,
  refreshToken: authApi.refreshToken,
  getCurrentUserProfile: authApi.getCurrentUserProfile,
  getCurrentUserLight: authApi.getCurrentUserLight,
  getAuthenticatedUser: authApi.getCurrentUserProfile,
  verifyEmail: authApi.verifyEmail,
  resendVerification: authApi.resendVerification,
  forgotPassword: authApi.forgotPassword,
  resetPassword: authApi.resetPassword,
  checkEmail: authApi.checkEmail,
  oauthAuthorize: authApi.oauthAuthorize,
  oauthCallback: authApi.oauthCallback,

  // Users
  getUserPublicProfile: usersApi.getPublicProfile,
  updatePublicProfile: usersApi.updatePublicProfile,
  updatePrivateSettings: usersApi.updatePrivateSettings,
  getUserSkills: usersApi.getUserSkills,
  addUserSkill: usersApi.addSkill,
  deleteUserSkill: usersApi.deleteSkill,
  getUserDashboard: usersApi.getDashboard,
  getInitialData: usersApi.getInitialData,
  updateUserNotificationPreferences: usersApi.updateNotificationPreferences,
  updateUserSecuritySettings: usersApi.updateSecuritySettings,
  changePassword: usersApi.changePassword,
  requestEmailVerification: usersApi.requestEmailVerification,
  requestPhoneVerification: usersApi.requestPhoneVerification,
  deleteAccount: usersApi.deleteAccount,
  uploadFile: usersApi.uploadFile,
  submitOnboarding: usersApi.submitOnboarding,
  skipOnboarding() {
    return apiClient.post<void>("/api/onboarding/skip");
  },
  getOnboardingConfig: usersApi.getOnboardingConfig,
  getProfileProgress: usersApi.getProfileProgress,
  getUserStats(userId: number) {
    return apiClient.get<any>(`/api/users/${userId}/stats`);
  },

  // Settings
  getAccountSettings() {
    return apiClient.get<any>("/api/settings/account");
  },
  updateAccountSettings(data: any) {
    return apiClient.put<any>("/api/settings/account", data);
  },
  getSecuritySettings() {
    return apiClient.get<any>("/api/settings/security");
  },
  updateSecuritySettings(data: any) {
    return apiClient.put<any>("/api/settings/security", data);
  },
  getAppearanceSettings() {
    return apiClient.get<any>("/api/settings/appearance");
  },
  updateAppearanceSettings(data: any) {
    return apiClient.put<any>("/api/settings/appearance", data);
  },
  getPrivacySettings() {
    return apiClient.get<any>("/api/settings/privacy");
  },
  updatePrivacySettings(data: any) {
    return apiClient.put<any>("/api/settings/privacy", data);
  },
  getUsageMetrics() {
    return apiClient.get<any>("/api/settings/usage");
  },
  getNotificationPreferences() {
    return apiClient.get<any>("/api/notifications/preferences");
  },
  updateNotificationPreferences(data: any) {
    return apiClient.put<any>("/api/notifications/preferences", data);
  },

  // Education
  getPublicModules: educationApi.getPublicModules,
  getPublicModule: educationApi.getPublicModule,
  getPublicPaths: educationApi.getPublicPaths,
  getPublicPath: educationApi.getPublicPath,
  getModule: educationApi.getModule,
  getPath: educationApi.getPath,
  enrollModule: educationApi.enrollModule,
  enrollPath: educationApi.enrollPath,
  getMyEnrollments: educationApi.getMyEnrollments,
  getModuleLessons: educationApi.getModuleLessons,
  getLesson: educationApi.getLesson,
  completeLesson: educationApi.completeLesson,
  getQuiz: educationApi.getQuiz,
  startQuiz: educationApi.startQuiz,
  submitQuiz: educationApi.submitQuiz,
  getMyCertificates: educationApi.getMyCertificates,
  verifyCertificate: educationApi.verifyCertificate,
  searchCourses: educationApi.search,
  quickSearch: educationApi.quickSearch,
  getMyStats: educationApi.getMyStats,
  purchaseCourse(data: Record<string, unknown>) {
    return purchaseWithIdempotency(
      "course",
      data,
      "/api/v1/billing/payments/purchase/course",
    );
  },
  purchasePath(data: Record<string, unknown>) {
    return purchaseWithIdempotency(
      "path",
      data,
      "/api/v1/billing/payments/purchase/path",
    );
  },
  purchaseLiveSession(data: Record<string, unknown>) {
    return purchaseWithIdempotency(
      "live-session",
      data,
      "/api/v1/billing/payments/purchase/live-session",
    );
  },
  purchaseCertificate(data: Record<string, unknown>) {
    return purchaseWithIdempotency(
      "certificate",
      data,
      "/api/v1/billing/payments/purchase/certificate",
    );
  },
  verifyCheckout(data: any) {
    return apiClient.post<any>(
      "/api/v1/billing/payments/verify-checkout",
      data,
    );
  },

  // Payments
  initiatePayment: paymentsApi.initiatePayment,
  getPayment: paymentsApi.getPayment,
  getTransactions: paymentsApi.getTransactions,
  getUserTransactions: paymentsApi.getTransactions,
  getWallet: paymentsApi.getWallet,
  getUserWallet: paymentsApi.getWallet,
  getWalletTransactions: paymentsApi.getWalletTransactions,
  getPodaPointsBalance: paymentsApi.getPodaPointsBalance,
  purchasePodaPoints: paymentsApi.purchasePodaPoints,
  spendPoints: paymentsApi.spendPoints,
  getFeatures: paymentsApi.getFeatures,
  purchaseFeature: paymentsApi.purchaseFeature,
  getActiveFeatures: paymentsApi.getActiveFeatures,
  getSubscriptions: paymentsApi.getSubscriptions,
  getMySubscriptions: paymentsApi.getSubscriptions,
  getBillingOverview: paymentsApi.getBillingOverview,
  getPlans: paymentsApi.getPlans,
  changePlan: paymentsApi.changePlan,
  async subscribe(data: any) {
    await apiClient.ensureCsrfToken();
    return apiClient.post<any>("/api/v1/billing/payments/subscribe", data);
  },
  getCheckoutStatus(checkoutId: string) {
    return apiClient.get<any>(`/api/payments/checkout/${checkoutId}/status`);
  },

  // Freelancing
  getProjects: freelancingApi.getProjects,
  getProject: freelancingApi.getProject,
  createProject: freelancingApi.createProject,
  submitProposal: freelancingApi.submitProposal,
  getContracts: freelancingApi.getContracts,
  getContract: freelancingApi.getContract,
  getContractById(id: number) {
    return apiClient.get<any>(`/api/hub/contracts/${id}`);
  },
  getContractMilestones(contractId: number) {
    return apiClient.get<any>(`/api/hub/contracts/${contractId}/milestones`);
  },
  approveMilestone(contractId: number, milestoneId: number) {
    return apiClient.post<any>(
      `/api/hub/contracts/${contractId}/milestones/${milestoneId}/approve`,
    );
  },
  markMilestoneSubmitted(contractId: number, milestoneId: number) {
    return apiClient.post<any>(
      `/api/hub/contracts/${contractId}/milestones/${milestoneId}/submit`,
    );
  },
  acceptProposal: freelancingApi.acceptProposal,
  rejectProposal: freelancingApi.rejectProposal,
  withdrawProposal(proposalId: number) {
    return apiClient.post<any>(`/api/hub/proposals/${proposalId}/withdraw`);
  },
  deliverContract: freelancingApi.deliverContract,
  completeContract: freelancingApi.completeContract,
  getFreelancers: freelancingApi.getFreelancers,
  getFreelancerProfile: freelancingApi.getFreelancerProfile,
  getPublicFreelancerProfile(id: number) {
    return apiClient.get<PublicFreelancerResponse>(
      `/api/hub/public/freelancers/${id}`,
    );
  },
  searchPublicFreelancers(params?: {
    skills?: string[];
    search?: string;
    skip?: number;
    limit?: number;
    has_certificates?: boolean;
    min_budget?: number;
    max_budget?: number;
    category?: string;
    rating_min?: number;
  }) {
    const sp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) {
          if (Array.isArray(v)) {
            v.forEach((item) => sp.append(k, item));
          } else {
            sp.append(k, String(v));
          }
        }
      }
    }
    const query = sp.toString() ? "?" + sp.toString() : "";
    return apiClient.get<PublicFreelancerSearchResponse>(
      `/api/hub/public/freelancers${query}`,
    );
  },
  getFreelanceDashboardStats: freelancingApi.getDashboardStats,
  getPublicStats: freelancingApi.getPublicStats,
  getMyProjects(params?: any) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<any>(`/api/hub/projects${query}`);
  },
  getProjectProposals(projectId: number) {
    return apiClient.get<any>(`/api/hub/projects/${projectId}/proposals`);
  },
  getPublicProject(id: number) {
    return apiClient.get<ProjectResponse>(`/api/hub/public/projects/${id}`);
  },
  listPublicProjects(params?: any) {
    const clean: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (
          v !== undefined &&
          v !== null &&
          v !== "" &&
          v !== "undefined" &&
          v !== "null"
        )
          clean[k] = String(v);
      }
    }
    const query = Object.keys(clean).length
      ? "?" + new URLSearchParams(clean).toString()
      : "";
    return apiClient.get<{ projects: ProjectResponse[]; total: number }>(
      `/api/hub/public/projects${query}`,
    );
  },
  disputes: {
    create(contractId: number, data: any) {
      return apiClient.post<any>(
        `/api/hub/contracts/${contractId}/dispute`,
        data,
      );
    },
    get(id: number) {
      return apiClient.get<any>(`/api/hub/disputes/${id}`);
    },
    getList(contractId: number) {
      return apiClient.get<any>(`/api/hub/contracts/${contractId}/disputes`);
    },
    list() {
      return apiClient.get<any>("/api/hub/disputes");
    },
  },

  // Notifications
  getNotifications: notificationsApi.getAll,
  getNotificationStats: notificationsApi.getStats,
  markNotificationRead: notificationsApi.markAsRead,
  markNotificationAsRead: notificationsApi.markAsRead,
  markAllNotificationsRead: notificationsApi.markAllAsRead,

  // Device Fingerprinting
  listDevices: devicesApi.listDevices,
  listSecurityEvents: devicesApi.listSecurityEvents,
  setDeviceTrust: devicesApi.setDeviceTrust,
  getEscrowEligibility: devicesApi.getEscrowEligibility,
  bypassDeviceCooldown: devicesApi.bypassCooldown,
  deleteNotification(id: number) {
    return apiClient.delete<void>(`/api/notifications/${id}`);
  },
  broadcastNotification(data: any) {
    return apiClient.post<any>("/api/notifications/admin/broadcast", data);
  },
  broadcastNotificationToRole(data: any, role?: string) {
    return apiClient.post<any>(
      "/api/notifications/admin/broadcast-role",
      role ? { ...data, role } : data,
    );
  },

  // BI
  bi: biApi,
  getDatasets: biApi.getDatasets,
  listDatasets: biApi.getDatasets,
  getDataset: biApi.getDataset,
  getDatasetById: biApi.getDatasetById,
  getValidation: biApi.getValidation,
  getQuality: biApi.getQuality,
  getAnalytics: biApi.getAnalytics,
  getDatasetPreview(id: number | string, limit?: number) {
    return apiClient.get<any>(
      `/api/bi/datasets/${id}/preview${limit ? `?limit=${limit}` : ""}`,
    );
  },
  getDatasetAnalytics(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/analytics`, {
      timeout: 120000,
    });
  },
  getDatasetCoreAnalytics(id: number | string) {
    return apiClient.get<any>(`/api/bi/analytics/${id}/core`);
  },
  getDatasetHistory: biApi.getDatasetHistory,
  assessDatasetQuality(id: number | string) {
    return apiClient.post<any>(
      `/api/bi/datasets/${id}/quality`,
      { dataset_id: String(id) },
      { timeout: 60000 },
    );
  },
  deleteDataset: biApi.deleteDataset,
  updateColumnType: biApi.updateColumnType,
  getColumnProfile: biApi.getColumnProfile,
  cleanDataset: biApi.cleanDataset,
  getDatasetContracts: biApi.getDatasetContracts,
  createDatasetContract: biApi.createDatasetContract,
  getDatasetSnapshots: biApi.getDatasetSnapshots,
  createDatasetSnapshot: biApi.createDatasetSnapshot,
  restoreDatasetSnapshot: biApi.restoreDatasetSnapshot,
  getDatasetGovernance: biApi.getDatasetGovernance,
  addDatasetTag: biApi.addDatasetTag,
  removeDatasetTag: biApi.removeDatasetTag,
  getDatasetSecurityPolicies: biApi.getDatasetSecurityPolicies,
  createDatasetSecurityPolicy: biApi.createDatasetSecurityPolicy,
  getDatasetWebhooks: biApi.getDatasetWebhooks,
  createDatasetWebhook: biApi.createDatasetWebhook,
  testDatasetWebhook: biApi.testDatasetWebhook,
  queryDatasetWorkbench: biApi.queryDatasetWorkbench,
  updateDataset(
    id: number | string,
    data: {
      name?: string | null;
      description?: string | null;
      domain?: string | null;
    },
  ) {
    return apiClient.patch<any>(`/api/bi/datasets/${id}`, data);
  },
  exportDataset(id: number | string) {
    if (typeof document === "undefined")
      return Promise.reject(
        new Error("Export is only available in the browser"),
      );
    const baseUrl = (
      process.env.NEXT_PUBLIC_API_URL || "https://backend-api.podacium.com"
    ).replace(/\/$/, "");
    return fetch(`${baseUrl}/api/bi/datasets/${id}/export`, {
      credentials: "include",
    }).then(async (res) => {
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `dataset-${id}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    });
  },
  uploadDataset: biApi.uploadDataset,
  getDashboards: biApi.getDashboards,
  listDashboards: biApi.getDashboards,
  getDashboard: biApi.getDashboard,
  createDashboard: biApi.createDashboard,
  updateDashboard(id: number, data: any) {
    return apiClient.put<any>(`/api/bi/dashboards/${id}`, data);
  },
  updateDashboardLayout(id: number, data: any) {
    return apiClient.put<any>(`/api/bi/dashboards/${id}`, data);
  },
  deleteDashboard(id: number) {
    return apiClient.delete<void>(`/api/bi/dashboards/${id}`);
  },
  getWidgetData(id: number) {
    return apiClient.get<any>(`/api/bi/widgets/${id}/data`);
  },
  getInsights(locale?: string) {
    return apiClient.get<any>(
      `/api/bi/analytics/insights${locale ? `?locale=${locale}` : ""}`,
    );
  },
  getBusinessHealthScore(orgId?: number, locale?: string) {
    const params = new URLSearchParams();
    if (orgId) params.set("organization_id", String(orgId));
    if (locale) params.set("locale", locale);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<any>(`/api/bi/analytics/health-score${query}`);
  },

  // BI Decisions
  listDecisions(page?: any, perPage?: any, filters?: any) {
    const params: any = { ...filters };
    if (page) params.page = String(page);
    if (perPage) params.per_page = String(perPage);
    // remove undefined/null/empty values
    Object.keys(params).forEach((key) => {
      const v = params[key];
      if (
        v === undefined ||
        v === null ||
        v === "" ||
        v === "undefined" ||
        v === "null"
      ) {
        delete params[key];
      }
    });
    const query = Object.keys(params).length
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return apiClient.get<any>(`/api/bi/decisions${query}`);
  },
  createDecision(data: any) {
    return apiClient.post<any>("/api/bi/decisions", data);
  },
  updateDecisionStatus(id: string | number, data: any) {
    return apiClient.patch<any>(`/api/bi/decisions/${id}/status`, data);
  },
  listDecisionHistory(id: string | number) {
    return apiClient.get<any>(`/api/bi/decisions/${id}/history`);
  },
  listDecisionComments(id: string | number) {
    return apiClient.get<any>(`/api/bi/decisions/${id}/comments`);
  },
  addDecisionComment(id: string | number, content: string) {
    return apiClient.post<any>(`/api/bi/decisions/${id}/comments`, { content });
  },

  // BI Reports
  listReports(page?: any, perPage?: any, filters?: any) {
    const params: any = { ...filters };
    if (page) params.page = String(page);
    if (perPage) params.per_page = String(perPage);
    // remove undefined/null/empty values
    Object.keys(params).forEach((key) => {
      const v = params[key];
      if (
        v === undefined ||
        v === null ||
        v === "" ||
        v === "undefined" ||
        v === "null"
      ) {
        delete params[key];
      }
    });
    const query = Object.keys(params).length
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return apiClient.get<any>(`/api/bi/reports${query}`);
  },
  createReport(data: any) {
    return apiClient.post<any>("/api/bi/reports", data);
  },
  deleteReport(id: string | number) {
    return apiClient.delete<void>(`/api/bi/reports/${id}`);
  },
  runReport(id: string | number) {
    return apiClient.post<any>(`/api/bi/reports/${id}/run`);
  },
  toggleReportActive(id: string | number) {
    return apiClient.post<any>(`/api/bi/reports/${id}/toggle`);
  },

  // BI Database Connectors & Embed
  testConnector(data: any) {
    return apiClient.post<any>("/api/bi/connectors/test", data);
  },
  listConnectorTables(data: any) {
    return apiClient.post<any>("/api/bi/connectors/tables", data);
  },
  fetchConnectorSchema(data: any) {
    return apiClient.post<any>("/api/bi/connectors/schema", data);
  },
  generateEmbedToken(data: any) {
    return apiClient.post<any>("/api/bi/embed/token", data);
  },
  listReportRuns(id: string | number) {
    return apiClient.get<any>(`/api/bi/reports/${id}/runs`);
  },
  retryReportRun(reportId: string | number, runId: string | number) {
    return apiClient.post<any>(
      `/api/bi/reports/${reportId}/runs/${runId}/retry`,
    );
  },

  // BI Quality Issues
  listQualityIssues(datasetId: string | number, params?: any) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<any>(
      `/api/bi/datasets/${datasetId}/quality/issues${query}`,
    );
  },
  resolveQualityIssue(id: string | number) {
    return apiClient.post<any>(`/api/bi/quality/issues/${id}`, {
      action: "resolve",
    });
  },
  ignoreQualityIssue(id: string | number) {
    return apiClient.post<any>(`/api/bi/quality/issues/${id}`, {
      action: "ignore",
    });
  },

  // Organizations
  createOrganization(data: any) {
    return apiClient.post<any>("/api/organizations", data);
  },
  listOrganizations() {
    return apiClient.get<any>("/api/organizations");
  },
  getOrganizations() {
    return this.listOrganizations();
  },
  getPublicOrganizationDirectory(params?: {
    sector?: string;
    city?: string;
    search?: string;
    companySizeBracket?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.sector) query.set("sector", params.sector);
    if (params?.city) query.set("city", params.city);
    if (params?.search) query.set("search", params.search);
    if (params?.companySizeBracket)
      query.set("companySizeBracket", params.companySizeBracket);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    const qs = query.toString();
    return apiClient.get<PublicOrganizationSummary[]>(
      `/api/organizations/public/directory${qs ? `?${qs}` : ""}`,
    );
  },
  getOrganizationBySlug(slug: string) {
    return apiClient.get<PublicOrganizationProfileResponse>(
      `/api/organizations/by-slug/${slug}`,
    );
  },
  getOrganization(id: number) {
    return apiClient.get<any>(`/api/organizations/${id}`);
  },
  updateOrganization(id: number, data: any) {
    return apiClient.put<any>(`/api/organizations/${id}`, data);
  },
  deleteOrganization(id: number) {
    return apiClient.delete<void>(`/api/organizations/${id}`);
  },
  getOrganizationMembers(id: number) {
    return apiClient.get<any>(`/api/organizations/${id}/members`);
  },
  inviteMember(orgId: number, emailOrData: string | any, role?: string) {
    const data =
      typeof emailOrData === "string"
        ? { email: emailOrData, role }
        : emailOrData;
    return apiClient.post<any>(`/api/organizations/${orgId}/members`, data);
  },
  removeMember(orgId: number, memberId: number) {
    return apiClient.delete<void>(
      `/api/organizations/${orgId}/members/${memberId}`,
    );
  },
  updateMemberRole(orgId: number, memberId: number, data: any) {
    return apiClient.put<any>(
      `/api/organizations/${orgId}/members/${memberId}`,
      data,
    );
  },
  switchOrganization(orgId: number) {
    return apiClient.post<any>(`/api/organizations/${orgId}/switch`);
  },
  leaveOrganization(orgId: number) {
    return apiClient.delete<any>(`/api/organizations/${orgId}/leave`);
  },

  // Invitations
  listOrganizationInvitations(orgId: number) {
    return apiClient.get<any>(`/api/organizations/${orgId}/invitations`);
  },
  listMyInvitations() {
    return apiClient.get<any>("/api/organizations/invitations/me");
  },
  getInvitationByToken(token: string) {
    return apiClient.get<any>(`/api/organizations/invitations/${token}`);
  },
  acceptInvitation(token: string) {
    return apiClient.post<any>(
      `/api/organizations/invitations/${token}/accept`,
    );
  },
  declineInvitation(token: string) {
    return apiClient.post<any>(
      `/api/organizations/invitations/${token}/decline`,
    );
  },
  cancelInvitation(token: string) {
    return apiClient.post<any>(
      `/api/organizations/invitations/${token}/cancel`,
    );
  },
  resendInvitation(token: string) {
    return apiClient.post<any>(
      `/api/organizations/invitations/${token}/resend`,
    );
  },
  getOrganizationTreasury(orgId: number) {
    return apiClient.get<any>(`/api/organizations/${orgId}/treasury`);
  },
  getOrganizationInvoices(orgId: number) {
    return apiClient.get<any>(`/api/organizations/${orgId}/invoices`);
  },
  generateOrganizationProforma(orgId: number, data: any) {
    return apiClient.post<any>(`/api/organizations/${orgId}/proforma`, data);
  },
  getOrganizationAuditLogs(orgId: number, limit: number = 50) {
    return apiClient.get<any>(
      `/api/organizations/${orgId}/audit-logs?limit=${limit}`,
    );
  },

  // Integrations
  integrations: {
    getList() {
      return apiClient.get<any>("/api/integrations");
    },
    list() {
      return apiClient.get<any>("/api/integrations");
    },
    connect(data: any) {
      return apiClient.post<any>("/api/integrations", data);
    },
    getAuthorizeUrl(provider: string) {
      return apiClient.get<any>(`/api/integrations/${provider}/authorize`);
    },
    disconnect(provider: string) {
      return apiClient.delete<void>(`/api/integrations/${provider}`);
    },
  },

  // Waitlist
  waitlistRegister: waitlistApi.register,
  waitlistPosition: waitlistApi.getPosition,
  waitlistLeaderboard: waitlistApi.getLeaderboard,
  waitlistStats: waitlistApi.getStats,
  waitlistStatus: waitlistApi.getStatus,

  // Live Sessions
  liveSessions: liveSessionsApi,

  // Trending
  trending: trendingApi,

  // Contact
  submitContactForm(data: any) {
    return apiClient.post<any>("/api/contact", data);
  },

  // Analytics / Tracking
  trackEvent(data: any) {
    return apiClient.post<void>("/api/analytics/events", data);
  },

  // HTTP method shortcuts (for admin pages and direct API calls)
  get: apiClient.get.bind(apiClient),
  post: apiClient.post.bind(apiClient),
  put: apiClient.put.bind(apiClient),
  patch: apiClient.patch.bind(apiClient),
  delete: apiClient.delete.bind(apiClient),
  upload: apiClient.upload.bind(apiClient),
  uploadWithProgress: uploadFileWithProgress,

  // OAuth flow helper
  async startOAuthFlow(
    provider: string,
    options?: {
      redirect_uri?: string;
      frontend_redirect_uri?: string;
      use_html_redirect?: boolean;
    },
  ): Promise<{ url?: string; state?: string }> {
    if (options?.frontend_redirect_uri && typeof window !== "undefined") {
      localStorage.setItem(
        `oauth_return_${provider}`,
        options.frontend_redirect_uri,
      );
    }
    const response = await authApi.oauthAuthorize(provider);
    return { url: response.authorization_url, state: provider };
  },
};

// Default export for `import api from '@/lib/api'` pattern
export default api;
