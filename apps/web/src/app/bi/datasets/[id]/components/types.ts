import { BiDatasetMetadata, HistoryEntry } from "@/lib/api";

export type TabId = "overview" | "data" | "quality" | "analytics" | "settings";

export interface DataContract {
  id: string;
  name: string;
  status: "VERIFIED" | "VIOLATED" | "DRAFT";
  version: string;
  min_row_count: number;
  max_missing_pct: number;
  allowed_columns: string[];
  enforce_strict_types: boolean;
  quality_sla_threshold?: number;
  current_quality?: number;
  current_row_count?: number;
  last_verified_at?: string;
}

export interface DatasetSnapshot {
  snapshot_id: string;
  version_name: string;
  description?: string;
  row_count: number;
  column_count: number;
  quality_score: number;
  created_at: string;
  created_by?: string;
  is_current: boolean;
}

export interface GovernanceData {
  sensitivity_level: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  compliance_frameworks: string[];
  tags: string[];
  owner_id?: string;
  organization_id?: string;
  auto_classified_at?: string;
}

export interface SecurityPolicy {
  id: string;
  policy_type: "ROW_FILTER" | "COLUMN_MASK";
  role: "ALL" | "ANALYST" | "VIEWER" | "MANAGER";
  column_name?: string;
  filter_condition?: string;
  masking_method?: string;
  status: "ACTIVE" | "INACTIVE";
  description?: string;
  created_at?: string;
}

export interface DatasetWebhook {
  id: string;
  url: string;
  event_type: string;
  status: "ACTIVE" | "FAILED" | "PAUSED";
  last_triggered_at?: string | null;
  failure_count?: number;
  created_at?: string;
}

export interface WorkbenchQueryResult {
  sql_query: string;
  execution_time_ms: number;
  columns: string[];
  rows_returned: number;
  data: Record<string, any>[];
}

export interface ColumnMetadataInfo {
  type?: string;
  data_type?: string;
  semantic_type?: string;
  null_count?: number;
  missing_pct?: number;
  unique_count?: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  median?: number;
  q25?: number;
  q75?: number;
  is_mixed_type?: boolean;
  statistics?: Record<string, any>;
  sampleValues?: string[];
}

export const BI_DOMAINS = [
  {
    id: "sales",
    label: "Sales & E-Commerce",
    color:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    color:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: "hr",
    label: "Human Resources",
    color:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    id: "product",
    label: "Product & SaaS",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "marketing",
    label: "Marketing & Growth",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  {
    id: "other",
    label: "General & Other",
    color:
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  },
] as const;

export function getDomainLabel(
  domainId: string | undefined,
  t?: (key: string) => string,
): string {
  const targetId = domainId || "other";
  if (t) {
    const key = `bi.datasets.domains.${targetId}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  const domain = BI_DOMAINS.find((d) => d.id === targetId);
  return domain ? domain.label : targetId;
}

export const DATA_TYPES = [
  { id: "VARCHAR", label: "Text / String" },
  { id: "INTEGER", label: "Integer (Whole Number)" },
  { id: "FLOAT", label: "Float (Decimal)" },
  { id: "DATE", label: "Date / Timestamp" },
  { id: "BOOLEAN", label: "Boolean (True/False)" },
  { id: "JSON", label: "JSON Object" },
] as const;

export const SEMANTIC_TYPES = [
  { id: "STRING", label: "Generic Text" },
  { id: "ALGERIAN_WILAYA", label: "Algerian Wilaya (1-58)" },
  { id: "COMMUNE", label: "Algerian Commune / Municipality" },
  { id: "GENDER", label: "Gender / Sex (M/F)" },
  { id: "CURRENCY", label: "Currency / Price (DZD, USD, EUR)" },
  { id: "EMAIL", label: "Email Address" },
  { id: "PHONE", label: "Phone Number" },
  { id: "URL", label: "Web Address / Link" },
  { id: "IDENTIFIER", label: "Unique ID / Code / Ref" },
  { id: "POSTAL_CODE", label: "Postal Code" },
  { id: "DATETIME", label: "Date & Time" },
  { id: "DURATION", label: "Time Span / Duration" },
  { id: "LATITUDE", label: "Latitude Coordinate (-90 to 90)" },
  { id: "LONGITUDE", label: "Longitude Coordinate (-180 to 180)" },
  { id: "GEO_COORDINATES", label: "Geographic Coordinates" },
  { id: "COUNTRY", label: "Country Name / Code" },
  { id: "CITY", label: "City / Town Name" },
  { id: "STATUS", label: "Status / State Tag" },
  { id: "PERCENTAGE", label: "Percentage / Rate" },
  { id: "CREDIT_CARD", label: "Credit Card Number / PAN" },
  { id: "MAC_ADDRESS", label: "MAC Address" },
  { id: "AGE", label: "Age (Years)" },
  { id: "YEAR", label: "Calendar Year" },
  { id: "PERSON_NAME", label: "Person Name" },
  { id: "COMPANY_NAME", label: "Company / Organization Name" },
] as const;

export function getSqlTypeLabel(
  typeId: string,
  t?: (key: string) => string,
): string {
  if (t) {
    const key = `bi.datasets.detail.schema.sqlTypes.${typeId}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  const dt = DATA_TYPES.find((d) => d.id === typeId);
  return dt ? dt.label : typeId;
}

export function getSemanticTypeLabel(
  typeId: string,
  t?: (key: string) => string,
): string {
  if (t) {
    const key = `bi.datasets.detail.schema.semanticTypes.${typeId}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  const st = SEMANTIC_TYPES.find((s) => s.id === typeId);
  return st ? st.label : typeId;
}

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatNumber(num: number | undefined, locale?: string): string {
  if (num === undefined || num === null) return "—";
  return num.toLocaleString(locale);
}

export function formatDate(
  dateString: string | undefined,
  full = false,
  locale?: string,
): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (full) {
    return date.toLocaleString(locale || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(locale || undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
