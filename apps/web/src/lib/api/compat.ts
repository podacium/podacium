/**
 * Backward compatibility types.
 * These types existed in the old monolithic api.ts and are still referenced
 * by existing components. They will be migrated to proper domain modules over time.
 */

// BI types referenced by existing components
export interface BiWidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface BiWidgetDataSource {
  type: "dataset" | "query" | "api";
  dataset_id?: string;
  query?: string;
}

export interface BiWidgetVisualization {
  type?: string;
  xAxis?: string;
  yAxis?: string;
  metrics?: string[];
  aggregation?: string;
  groupBy?: string;
  sort?: string;
  limit?: number;
  [key: string]: any;
}

export interface BiWidgetStyle {
  background_color?: string;
  border_radius?: string;
  padding?: string;
  margin?: string;
  border_width?: number;
  [key: string]: any;
}

export interface BiWidgetInteractivity {
  tooltip?: boolean;
  hover_effect?: boolean;
  clickable?: boolean;
  drilldown?: boolean;
  zoom?: boolean;
  pan?: boolean;
  export?: boolean;
  refresh?: boolean;
}

export interface BiWidget {
  id: number;
  dashboardId?: number;
  datasetId?: number;
  type: WidgetType;
  title?: string;
  name?: string;
  description?: string;
  config?: any;
  // New-style fields used by DashboardEditor / new page
  data_source?: BiWidgetDataSource;
  visualization?: BiWidgetVisualization;
  filters?: Record<string, any>;
  style?: BiWidgetStyle;
  interactivity?: BiWidgetInteractivity;
  position?: BiWidgetPosition;
  // Legacy grid fields (kept for backward compat)
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  minW?: number;
  minH?: number;
  order?: number;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiDashboardMetadata {
  id: number;
  title: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  // snake_case aliases — required as they're always present from the API
  is_public?: boolean;
  layout_type?: string;
  widget_count?: number;
  config?: any;
  layout?: any;
  theme?: any;
  tags?: string[];
  ownerId?: number;
  organizationId?: number;
  organization_id?: number;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  widgets?: BiWidget[];
}

export interface BiDashboardCreate {
  title: string;
  description?: string;
  layout_type?: string;
  dataset_id?: number;
  is_public?: boolean;
  tags?: string[];
  config?: any;
  layout?: any;
  widgets?: any[];
}

export type DashboardConfig = any;
export type DashboardLayout = any;
export type BiWidgetCreate = any;
export type DataSource = any;

export interface ColumnStatistics {
  count?: number;
  null_count?: number;
  null_percentage?: number;
  unique_count?: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  top_categories?: { value: string; count: number; percentage: number }[];
  [key: string]: any;
}

export interface ColumnMetadataEntry {
  column_name?: string;
  column_type:
    "numeric" | "categorical" | "text" | "date" | "boolean" | "unknown";
  semantic_type?: string;
  is_mixed_type?: boolean;
  statistics?: ColumnStatistics;
  [key: string]: any;
}

export interface BiDatasetMetadata {
  id: number;
  // snake_case fields used by new BI pages
  dataset_id: string;
  name: string;
  description?: string;
  status?: DatasetStatus;
  row_count?: number;
  column_count?: number;
  columns?: string[];
  file_size?: number;
  format?: string;
  domain?: string;
  quality_score?: number;
  created_at: string;
  updated_at?: string;
  uploader?: { id: number; fullName: string; profilePictureUrl?: string };
  /** Per-column type, semantic type, and statistics (mapped from schema_ on the backend). */
  column_metadata?: Record<string, ColumnMetadataEntry>;
  // camelCase aliases (legacy)
  sourceType?: string;
  processingStatus?: string;
  rowCount?: number;
  columnCount?: number;
  fileSize?: number;
  qualityScore?: number;
  schema_?: any;
  previewRows?: any;
  quality_metrics?: any;
  sample_records?: any[];
  organization?: any;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export type BiDatasetResponse = BiDatasetMetadata;

export interface BiQualityResult {
  dataset_id: number;
  overall_score: number;
  quality_score?: number;
  completeness_score?: number;
  duplicate_ratio?: number;
  outlier_ratio?: number;
  quality_level?: string;
  issues: any[];
  warnings?: string[];
  recommendations?: string[];
  summary: any;
  human_summary?: string;
  summary_keys?: any[];
  recommendation_keys?: any[];
}

// Additional BI types used by dataset detail and quality pages
export interface BiQualityIssue {
  id: string | number;
  dataset_id: string | number;
  column_name?: string;
  issue_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "ignored";
  description?: string;
  affected_rows?: number;
  created_at: string;
  updated_at?: string;
}

export interface BiValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  row_count?: number;
  column_count?: number;
}

export interface BiAnalyticsResult {
  dataset_id: string | number;
  summary?: any;
  correlations?: Array<{
    column1: string;
    column2: string;
    value: number;
    [key: string]: any;
  }>;
  distributions?: any;
  outliers?: any;
  insights?: any[];
  [key: string]: any;
}

export interface HistoryEntry {
  id: string | number;
  action: string;
  user_id?: number;
  created_at: string;
  timestamp?: string;
  details?: any;
}

export type BiDatasetListResponse = BiDatasetMetadata[];

// WidgetType as an enum so it can be used as both a type and a runtime value
export enum WidgetType {
  METRIC = "METRIC",
  KPI = "KPI",
  BAR_CHART = "BAR_CHART",
  LINE_CHART = "LINE_CHART",
  AREA_CHART = "AREA_CHART",
  PIE_CHART = "PIE_CHART",
  SCATTER_PLOT = "SCATTER_PLOT",
  BUBBLE = "BUBBLE",
  HISTOGRAM = "HISTOGRAM",
  TABLE = "TABLE",
  HEATMAP = "HEATMAP",
  SANKEY = "SANKEY",
  RADAR = "RADAR",
  FUNNEL = "FUNNEL",
  MAP = "MAP",
  TREEMAP = "TREEMAP",
  GAUGE = "GAUGE",
  CUSTOM = "CUSTOM",
}

export enum DatasetStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
}

export enum ViewType {
  ANALYST = "ANALYST",
  EXECUTIVE = "EXECUTIVE",
  OPERATIONAL = "OPERATIONAL",
}

export enum LayoutType {
  GRID = "GRID",
  FREEFORM = "FREEFORM",
  REPORT = "REPORT",
  PRESENTATION = "PRESENTATION",
}

// Organization types referenced by existing components
export interface OrganizationResponse {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  country: string;
  city: string;
  website?: string;
  sector: string;
  rcNumber?: string;
  nifNumber?: string;
  nisNumber?: string;
  articleImposition?: string;
  taxRegime?: string;
  ownerId?: number;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  isOwner?: boolean;
  userRole?: string;
  invitations?: InvitationResponse[];
  internalBulletin?: string | null;
  timeZone?: string | null;
  keyContacts?: any;
  hqAddress?: string | null;
  tagline?: string | null;
  brandAccentColor?: string | null;
  coverBannerUrl?: string | null;
  socialLinks?: any;
}

export interface CompanyCaseStudy {
  id: number;
  organizationId: number;
  title: string;
  slug: string;
  clientName?: string | null;
  industry?: string | null;
  problemStatement: string;
  solutionSummary: string;
  roiMetrics?:
    Array<{ label: string; value: string }> | Record<string, any> | null;
  technologies: string[];
  isFeatured?: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

export interface CompanyLeadership {
  id: number;
  organizationId: number;
  fullName: string;
  roleTitle: string;
  bio?: string | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  displayOrder?: number;
  isExecutive?: boolean;
}

export interface CompanyReview {
  id: number;
  organizationId: number;
  reviewerId: number;
  contractId?: number | null;
  reviewerType: "FREELANCER" | "CLIENT" | "CORPORATE_LEARNER" | string;
  overallRating: number;
  paymentPromptnessRating?: number | null;
  scopeClarityRating?: number | null;
  communicationRating?: number | null;
  title?: string | null;
  comment?: string | null;
  isVerifiedContract?: boolean;
  createdAt: string;
}

export interface OrgProfile {
  longDescription?: string | null;
  specialties?: string[];
  technologies?: string[];
  competitors?: string[];
  fundingRound?: string | null;
  fundingAmount?: number | null;
  revenueRange?: string | null;
  culture?: string | null;
  benefits?: string | null;
  mission?: string | null;
  certifications?: string[];
  algerianHealthScore?: number | null;
}

export interface PublicOrganizationProfileResponse {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  sector: string;
  city: string;
  country: string;
  tagline?: string | null;
  brandAccentColor?: string | null;
  coverBannerUrl?: string | null;
  socialLinks?: Record<string, string> | null;
  keyContacts?: any;
  hqAddress?: string | null;
  rcNumber?: string | null;
  nifNumber?: string | null;
  nisNumber?: string | null;
  articleImposition?: string | null;
  taxRegime?: string | null;
  kyb?: {
    legalName?: string;
    tradeName?: string | null;
    legalStructure?: string;
    rcNumber?: string;
    nifNumber?: string;
    nisNumber?: string | null;
    status: string;
    riskScore?: number;
    headquartersAddress?: string;
    verifiedAt?: string | null;
  } | null;
  isKybVerified: boolean;
  kybStatus?: string | null;
  kybRiskScore?: number | null;
  memberCount: number;
  averageRating: number;
  reviewCount: number;
  orgProfile?: OrgProfile | null;
  caseStudies: CompanyCaseStudy[];
  leadership: CompanyLeadership[];
  companyReviews: CompanyReview[];
  datasets?: Array<{
    id: number;
    name: string;
    description?: string | null;
    rowsCount?: number;
    createdAt?: string;
  }>;
  projects?: Array<{
    id: number;
    title: string;
    description?: string | null;
    status?: string;
    category?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberResponse {
  id: number;
  organizationId: number;
  userId: number;
  role?: string;
  createdAt: string;
  departmentId?: number | null;
  department?: {
    id: number;
    name: string;
    slug?: string;
    code?: string;
  } | null;
  user: {
    id: number;
    fullName: string;
    email?: string;
    profilePictureUrl?: string;
  };
}

export interface InvitationResponse {
  id: number;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  organizationId: number;
  inviterId: number;
  organization?: OrganizationResponse;
  inviter?: { id: number; fullName: string; email?: string };
  token: string;
}

export interface OrganizationCreate {
  name: string;
  description?: string;
  country: string;
  city: string;
  website?: string;
  sector: string;
}

// Freelancing types referenced by existing components
export interface ProjectResponse {
  id: number;
  title: string;
  description?: string;
  ownerId: number;
  skills: string[];
  status: string;
  createdAt: string;
  owner?: {
    id: number;
    fullName: string;
    profilePictureUrl?: string;
    country?: string;
    city?: string;
    phoneVerified?: boolean;
  };
  has_applied: boolean;
  is_owner: boolean;
}

export interface ContractResponse {
  id: number;
  projectId: number;
  freelancerId?: number;
  clientId?: number;
  terms?: string;
  amount?: number;
  status: string;
  createdAt: string;
  project?: { id: number; title: string; description?: string };
  freelancer?: { id: number; fullName: string; profilePictureUrl?: string };
  client?: { id: number; fullName: string; profilePictureUrl?: string };
  deliveries?: DeliveryResponse[];
  user_role?: "freelancer" | "client";
  startDate?: string;
  endDate?: string;
}

export interface DeliveryResponse {
  id: number;
  contractId: number;
  description?: string;
  deliveredAt: string;
  files?: any;
}

export interface DeliveryCreate {
  description: string;
  file_urls?: string[];
}

// Education types referenced by existing components
export interface LessonResponse {
  id: string;
  title: string;
  description?: string;
  moduleId: string;
  order: number;
  durationMinutes?: number;
  type: string;
  videoUrl?: string;
  hlsPath?: string;
  rawPath?: string;
  storageProvider?: string;
  transcodingStatus?: string;
  quizId?: number;
  thumbnailUrl?: string;
  learningObjectives?: string[];
  keyTakeaways?: string[];
  tags?: string[];
  createdAt?: string;
  isCompleted?: boolean;
  isLocked?: boolean;
  hasAccess?: boolean;
  isPreview?: boolean;
  is_preview?: boolean;
  attachments?: any[];
  relatedResources?: any[];
  exercises?: number;
  resources?: number;
}

export interface LessonProgressResponse {
  id: number;
  userId: number;
  lessonId: string;
  isCompleted: boolean;
  completedAt?: string;
  progress: number;
  createdAt: string;
  updatedAt?: string;
  updated_at?: string;
  deletedAt?: string;
  lesson?: LessonResponse;
}

export interface ModuleResponse {
  id: string;
  title: string;
  description?: string;
  fullDescription?: string;
  durationMinutes?: number;
  totalLessons?: number;
  level?: string;
  skills: string[];
  tags: string[];
  featured: boolean;
  createdAt: string;
  thumbnailUrl?: string;
  price?: { original?: number; discounted?: number | null };
  instructor?: any;
  lessons: LessonResponse[];
  progress: number;
  isEnrolled: boolean;
  rating?: number;
  enrolled: number;
  isNew: boolean;
  hasAccess: boolean;
}

// Notification types
export interface NotificationResponse {
  id: number;
  userId: number;
  type: string;
  title?: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
  created_at: string;
  emailSent?: boolean;
  is_read?: boolean;
  email_sent?: boolean;
}

// Helper functions referenced by existing components
import { educationApi } from "./education";
import { paymentsApi } from "./payments";
import { freelancingApi } from "./freelancing";
import { authApi } from "./auth";
import { apiClient } from "./client";

export const apiHelpers = {
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
    }).format(amount);
  },

  auth: {
    getCurrentUser: authApi.getCurrentUserProfile,
  },

  education: {
    // Catalog
    getPublicModules: educationApi.getPublicModules,
    getPublicModule: educationApi.getPublicModule,
    getPublicPaths: educationApi.getPublicPaths,
    getModule(courseId: string, _includeProgress?: boolean) {
      return educationApi.getModule(courseId);
    },
    getPath: educationApi.getPath,
    getPaths(params?: any) {
      return apiClient.get<any[]>("/api/education/paths/public");
    },
    getModuleLessons: educationApi.getModuleLessons,
    getLesson: educationApi.getLesson,

    // Enrollment
    enrollInModule: educationApi.enrollModule,
    enrollInPath: educationApi.enrollPath,
    getMyEnrollments: educationApi.getMyEnrollments,

    // Progress
    completeLesson: educationApi.completeLesson,
    updateLessonProgress(lessonId: string, progress: number) {
      return educationApi.updateLessonProgress(lessonId, {
        progress,
        completed: progress >= 100,
      });
    },
    getMyLessonProgresses() {
      return apiClient.get<any[]>("/api/education/me/lesson-progresses");
    },

    // Stats
    getStats: educationApi.getStats,
    getMyLearningStats: educationApi.getMyStats,

    // Quizzes
    getQuiz: educationApi.getQuiz,
    startQuizAttempt: educationApi.startQuiz,
    submitQuizAttempt: educationApi.submitQuiz,
    getQuizAttempts(lessonId: string) {
      return apiClient.get<any>(`/api/education/quizzes/${lessonId}/attempts`);
    },

    // Certificates
    generateCertificate(moduleId: string) {
      return educationApi.generateModuleCertificate(moduleId);
    },
    autoGenerateCertificate(moduleId?: string) {
      return apiClient.post<any>(
        "/api/education/certificates/auto-generate",
        moduleId ? { module_id: moduleId } : {},
      );
    },
    getMyCertificates: educationApi.getMyCertificates,

    // Reviews
    getCourseReviews(moduleId: string, page?: number, pageSize?: number) {
      return educationApi.getModuleReviews(moduleId, page, pageSize);
    },
    submitCourseReview(moduleId: string, data: any) {
      return educationApi.createReview(moduleId, data);
    },
    deleteCourseReview(moduleId: string, reviewId: number) {
      return apiClient.delete<void>(
        `/api/education/modules/${moduleId}/reviews/${reviewId}`,
      );
    },
  },

  freelancing: {
    // Projects
    createProject: freelancingApi.createProject,
    getProject: freelancingApi.getProject,
    listProjects: freelancingApi.getProjects,
    getProjectProposals: freelancingApi.getProjectProposals,

    // Proposals
    submitProposal: freelancingApi.submitProposal,
    acceptProposal: freelancingApi.acceptProposal,
    rejectProposal: freelancingApi.rejectProposal,
    getUserProposals: freelancingApi.getMyProposals,

    // Contracts
    getContract: freelancingApi.getContract,
    getUserContracts(params?: any) {
      return freelancingApi.getContracts();
    },
    completeContract: freelancingApi.completeContract,
    cancelContract: freelancingApi.cancelContract,
    submitDelivery(contractId: number, data: any) {
      return freelancingApi.deliverContract(contractId, data);
    },

    // Freelancers
    searchFreelancers: freelancingApi.getFreelancers,
    getFreelanceDashboardStats: freelancingApi.getDashboardStats,
  },

  payments: paymentsApi,
};
