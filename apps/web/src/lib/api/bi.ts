/**
 * Business Intelligence API module.
 * Handles datasets, dashboards, widgets, analytics, ML models.
 */

import { apiClient } from "./client";
import type { BiWidget } from "./compat";

// =============================================================================
// BI TYPES
// =============================================================================

export interface DatasetResponse {
  id: number;
  name: string;
  description?: string;
  sourceType: string;
  processingStatus: string;
  rowCount?: number;
  columnCount?: number;
  fileSize?: number;
  format?: string;
  domain?: string;
  qualityScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardResponse {
  id: number;
  title: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
  config?: any;
  layout?: any;
  theme?: any;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  organization_id?: number;
  widgets?: BiWidget[];
  // Envelope shape returned by the backend detail endpoint
  success?: boolean;
  dashboard?: DashboardResponse;
}

export interface WidgetResponse {
  id: number;
  dashboardId?: number;
  datasetId?: number;
  type: string; // raw string from API — cast to WidgetType where needed
  name?: string;
  config: any;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: string;
}

export interface AnalyticsQuery {
  dataset_id: number;
  query_type: string;
  columns?: string[];
  filters?: any;
  group_by?: string[];
  aggregations?: any[];
  time_range?: { start: string; end: string };
}

// =============================================================================
// BI API METHODS
// =============================================================================

export const biApi = {
  // Datasets
  getDatasets(
    page?: number,
    pageSize?: number,
    search?: string,
    domain?: string,
    organizationId?: number,
  ) {
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (pageSize) params.set("page_size", String(pageSize));
    if (search) params.set("search", search);
    if (domain) params.set("domain", domain);
    if (organizationId) params.set("organization_id", String(organizationId));
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<any>(`/api/bi/datasets${query}`);
  },

  getDataset(id: number | string, locale?: string) {
    const params = locale ? `?locale=${locale}` : "";
    return apiClient.get<{
      success: boolean;
      dataset: import("./compat").BiDatasetMetadata;
      message?: string;
    }>(`/api/bi/datasets/${id}${params}`);
  },

  getDatasetById(id: number | string, locale?: string) {
    const params = locale ? `?locale=${locale}` : "";
    return apiClient
      .get<any>(`/api/bi/datasets/${id}${params}`)
      .then((res) => res.dataset || res);
  },

  getValidation(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/quality`).catch(() =>
      apiClient.post<any>(`/api/bi/datasets/${id}/quality`, {
        include_outliers: true,
        include_duplicates: true,
        outlier_threshold: 3.0,
      }),
    );
  },

  getQuality(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/quality`).catch(() =>
      apiClient.post<any>(`/api/bi/datasets/${id}/quality`, {
        include_outliers: true,
        include_duplicates: true,
        outlier_threshold: 3.0,
      }),
    );
  },

  getAnalytics(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/analytics`, {
      timeout: 120000,
    });
  },

  getDatasetHistory(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/quality/history`);
  },

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

  uploadDataset(
    file: File,
    datasetName: string,
    description?: string,
    domain?: string,
    organizationId?: number,
    onProgress?: (percent: number) => void,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams();
    params.set("name", datasetName);
    if (description) params.set("description", description);
    if (domain) params.set("domain", domain);
    if (organizationId) params.set("organization_id", String(organizationId));
    const path = `/api/bi/datasets/upload?${params.toString()}`;
    if (onProgress) {
      return apiClient.uploadWithProgress<DatasetResponse>(path, formData, {
        onProgress,
        timeout: 120000,
      });
    }
    return apiClient.upload<DatasetResponse>(path, formData);
  },

  getDatasetPreview(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/preview`);
  },

  queryDataset(id: number | string, query: string) {
    return apiClient.post<any>(`/api/bi/datasets/${id}/query`, { query });
  },

  getDatasetQuality(id: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${id}/quality`);
  },

  deleteDataset(id: number | string) {
    return apiClient.delete<void>(`/api/bi/datasets/${id}`);
  },

  updateColumnType(
    datasetId: number | string,
    columnName: string,
    data: { data_type?: string; semantic_type?: string } | string,
    semanticType?: string,
  ) {
    const payload =
      typeof data === "string"
        ? { data_type: data, semantic_type: semanticType }
        : data;
    return apiClient.put<any>(
      `/api/bi/datasets/${datasetId}/columns/${encodeURIComponent(columnName)}/type`,
      payload,
    );
  },

  getColumnProfile(datasetId: number | string, columnName: string) {
    return apiClient.get<any>(
      `/api/bi/datasets/${datasetId}/columns/${encodeURIComponent(columnName)}/profile`,
    );
  },

  cleanDataset(
    datasetId: number | string,
    options: {
      fill_missing?: boolean;
      missing_strategy?: string;
      drop_duplicates?: boolean;
      trim_whitespace?: boolean;
    },
  ) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/clean`, options);
  },

  ingestJsonDataset(data: {
    records: Record<string, any>[];
    name: string;
    description?: string;
    domain?: string;
    organization_id?: number;
  }) {
    return apiClient.post<any>("/api/bi/datasets/ingest-json", data);
  },

  parseWhatsAppMessages(
    rawText: string,
    save = false,
    name?: string,
    domain?: string,
  ) {
    const params = save ? "?save=true" : "";
    return apiClient.post<any>(`/api/bi/datasets/parse-whatsapp${params}`, {
      raw_text: rawText,
      name,
      domain,
    });
  },

  quickManualEntry(data: {
    name: string;
    description?: string;
    domain?: string;
    records: {
      date: string;
      description: string;
      category: string;
      type: string;
      amount: number;
      quantity?: number;
    }[];
  }) {
    return apiClient.post<any>("/api/bi/datasets/quick-entry", data);
  },

  validateDataset(datasetId: number | string, strictMode = false) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/validate`, {
      strict_mode: strictMode,
    });
  },

  assessDatasetQuality(
    datasetId: number | string,
    includeOutliers = true,
    includeDuplicates = true,
  ) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/quality`, {
      include_outliers: includeOutliers,
      include_duplicates: includeDuplicates,
    });
  },

  exportDataset(id: number | string) {
    if (typeof document === "undefined")
      return Promise.reject(new Error("Browser only"));
    const baseUrl = (
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
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

  evaluateQualityRules(datasetId: number | string, rules: any[]) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/rules`, {
      rules,
    });
  },

  maskDatasetPii(
    datasetId: number | string,
    columns: string[],
    method = "hash",
  ) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/mask`, {
      columns,
      method,
    });
  },

  getDatasetDrift(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/drift`);
  },

  generateSyntheticData(datasetId: number | string, rowCount = 10) {
    return apiClient.post<any>(
      `/api/bi/datasets/${datasetId}/generate-synthetic`,
      { row_count: rowCount },
    );
  },

  getDatasetLineage(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/lineage`);
  },

  // Enterprise Extensions: Contracts, Snapshots, Governance, Security, Webhooks & Workbench
  getDatasetContracts(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/contracts`);
  },

  createDatasetContract(datasetId: number | string, data: any) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/contracts`, data);
  },

  getDatasetSnapshots(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/snapshots`);
  },

  createDatasetSnapshot(datasetId: number | string, data: any) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/snapshots`, data);
  },

  restoreDatasetSnapshot(datasetId: number | string, snapshotId: string) {
    return apiClient.post<any>(
      `/api/bi/datasets/${datasetId}/snapshots/${snapshotId}/restore`,
    );
  },

  getDatasetGovernance(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/governance`);
  },

  addDatasetTag(datasetId: number | string, tag: string, category = "custom") {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/tags`, {
      tag,
      category,
    });
  },

  removeDatasetTag(datasetId: number | string, tagName: string) {
    return apiClient.delete<any>(
      `/api/bi/datasets/${datasetId}/tags/${encodeURIComponent(tagName)}`,
    );
  },

  getDatasetSecurityPolicies(datasetId: number | string) {
    return apiClient.get<any>(
      `/api/bi/datasets/${datasetId}/security-policies`,
    );
  },

  createDatasetSecurityPolicy(datasetId: number | string, policy: any) {
    return apiClient.post<any>(
      `/api/bi/datasets/${datasetId}/security-policies`,
      policy,
    );
  },

  getDatasetWebhooks(datasetId: number | string) {
    return apiClient.get<any>(`/api/bi/datasets/${datasetId}/webhooks`);
  },

  createDatasetWebhook(datasetId: number | string, data: any) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/webhooks`, data);
  },

  testDatasetWebhook(datasetId: number | string, data: any) {
    return apiClient.post<any>(
      `/api/bi/datasets/${datasetId}/webhooks/test`,
      data,
    );
  },

  queryDatasetWorkbench(
    datasetId: number | string,
    sqlQuery: string,
    limit = 50,
  ) {
    return apiClient.post<any>(`/api/bi/datasets/${datasetId}/query`, {
      sql_query: sqlQuery,
      limit,
    });
  },

  // Dashboards
  getDashboards() {
    return apiClient.get<DashboardResponse[]>("/api/bi/dashboards");
  },

  getDashboard(id: number, includeWidgets?: boolean, viewType?: string) {
    const params = new URLSearchParams();
    if (includeWidgets !== undefined)
      params.set("include_widgets", String(includeWidgets));
    if (viewType) params.set("view_type", viewType);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<DashboardResponse>(`/api/bi/dashboards/${id}${query}`);
  },

  createDashboard(data: { title: string; description?: string }) {
    return apiClient.post<DashboardResponse>("/api/bi/dashboards", data);
  },

  updateDashboard(id: number, data: Partial<DashboardResponse>) {
    return apiClient.put<DashboardResponse>(`/api/bi/dashboards/${id}`, data);
  },

  deleteDashboard(id: number) {
    return apiClient.delete<void>(`/api/bi/dashboards/${id}`);
  },

  // Widgets
  createWidget(data: any) {
    return apiClient.post<WidgetResponse>("/api/bi/widgets", data);
  },

  updateWidget(id: number, data: any) {
    return apiClient.put<WidgetResponse>(`/api/bi/widgets/${id}`, data);
  },

  deleteWidget(id: number) {
    return apiClient.delete<void>(`/api/bi/widgets/${id}`);
  },

  getWidgetData(id: number) {
    return apiClient.get<any>(`/api/bi/widgets/${id}/data`);
  },

  updateWidgetPosition(
    id: number,
    position: {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      order?: number;
    },
  ) {
    return apiClient.patch<WidgetResponse>(
      `/api/bi/widgets/${id}/position`,
      position,
    );
  },

  reorderWidgets(
    dashboardId: number,
    widgets: Array<{
      id: number;
      order: number;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    }>,
  ) {
    return apiClient.post<{ success: boolean; message: string }>(
      `/api/bi/dashboards/${dashboardId}/widgets/reorder`,
      { widgets },
    );
  },

  // Analytics
  getKPIs(datasetId: number) {
    return apiClient.get<any>(`/api/bi/analytics/kpi?dataset_id=${datasetId}`);
  },

  getTimeseries(datasetId: number, params: any) {
    return apiClient.post<any>("/api/bi/analytics/timeseries", {
      dataset_id: datasetId,
      ...params,
    });
  },

  getBreakdown(datasetId: number, params: any) {
    return apiClient.post<any>("/api/bi/analytics/breakdown", {
      dataset_id: datasetId,
      ...params,
    });
  },

  // Cockpit Tier 2 Driver Decomposition
  getDriverDecomposition(data: {
    metric: string;
    baseline: number;
    current: number;
    factor_deltas: Array<{
      name: string;
      impact: number;
      [key: string]: unknown;
    }>;
    z_threshold?: number;
  }) {
    return apiClient.post<WaterfallDecomposition>(
      "/api/bi/analytics/driver-decomposition",
      data,
    );
  },

  // Cockpit Tier 3 Real-Time What-If Simulation
  evaluateSimulation(params: SimulationEvaluateRequest) {
    return apiClient.post<SimulationResult>(
      "/api/bi/simulations/evaluate",
      params,
    );
  },

  // Health
  getHealth() {
    return apiClient.get<any>("/api/bi/health");
  },
};

export interface SimulationEvaluateRequest {
  retention_rate_target?: number;
  ad_budget_dzd?: number;
  freelance_commission_rate?: number;
  pricing_discount?: number;
  horizon_months?: number;
  base_monthly_revenue?: number;
  base_active_users?: number;
  target_revenue_goal?: number;
}

export interface MonthlyProjection {
  month: number;
  month_name: string;
  projected_revenue_dzd: number;
  lower_95_dzd: number;
  upper_95_dzd: number;
  projected_users: number;
  freelance_volume_dzd: number;
}

export interface TargetGoalZone {
  min_target_dzd: number;
  max_target_dzd: number;
  expected_dzd: number;
  target_achieved: boolean;
}

export interface SensitivityFactor {
  factor_name: string;
  current_value: number;
  elasticity_coefficient: number;
  impact_description: string;
}

export interface SimulationResult {
  execution_time_ms: number;
  horizon_months: number;
  base_revenue_dzd: number;
  final_projected_revenue_dzd: number;
  revenue_delta_percent: number;
  projections: MonthlyProjection[];
  target_goal_zone: TargetGoalZone;
  sensitivity_factors: SensitivityFactor[];
}

export interface DriverImpact {
  name: string;
  impact: number;
  direction: "positive" | "negative";
  is_anomaly: boolean;
  contribution_percent?: number;
  dimension?: string;
  baseline_value?: number;
  current_value?: number;
}

export interface WaterfallDecomposition {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  delta_percent: number;
  drivers: DriverImpact[];
  unexplained_residual: number;
}
