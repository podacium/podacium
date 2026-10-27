export type HITLActionType =
  | "enroll_course"
  | "submit_proposal"
  | "accept_proposal"
  | "create_dashboard"
  | "request_payout_withdrawal"
  | string;

export type HITLActionState =
  "PENDING" | "EXECUTING" | "CONFIRMED" | "REJECTED" | "EXPIRED" | "FAILED";

export interface ActionConfirmationPayload {
  intent_id: string;
  token: string;
  tool_name: string;
  prepared_params: Record<string, unknown>;
  risk_score: number;
  expires_at?: number; // Unix timestamp
  expires_at_unix?: number; // Unix timestamp alternate
  title?: string;
  summary?: string;
  financial_impact_dzd?: number;
  idempotency_key?: string;
}

export interface CourseWidgetPayload {
  id: string | number;
  title: string;
  instructorName: string;
  instructorAvatar?: string;
  thumbnailUrl?: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS" | string;
  priceDzd: number;
  originalPriceDzd?: number;
  rating: number;
  reviewsCount: number;
  skills: string[];
  slug?: string;
  href?: string;
  lessonsCount?: number;
  durationMinutes?: number;
}

export interface ProposalComparisonItem {
  id: string | number;
  freelancerId: string | number;
  freelancerName: string;
  freelancerTitle: string;
  freelancerAvatar?: string;
  badge?: "TOP_RATED" | "VERIFIED" | "RISING_TALENT" | string;
  rating: number;
  reviewCount: number;
  proposedRateDzd: number;
  deliveryDays: number;
  milestonesCount: number;
  proposalCoverSummary: string;
}

export interface FreelancerComparisonPayload {
  comparisonTitle: string;
  jobId: string | number;
  jobTitle: string;
  proposals: ProposalComparisonItem[];
}

export interface BIChartDataPoint {
  label: string;
  [key: string]: string | number;
}

export interface BIKpiBadge {
  label: string;
  value: string | number;
  delta?: {
    value: string;
    isPositive: boolean;
  };
}

export interface BIChartWidgetPayload {
  title: string;
  description?: string;
  kpis?: BIKpiBadge[];
  chartType?: "bar" | "line" | "area";
  data: BIChartDataPoint[];
  metricKey: string;
  dimensionKey: string;
  sourceQuery?: string;
}

export type GenerativeWidgetPayloadMap = {
  action_confirmation: ActionConfirmationPayload;
  course_card: CourseWidgetPayload;
  freelancer_comparison: FreelancerComparisonPayload;
  bi_chart: BIChartWidgetPayload;
};

export type WidgetType = keyof GenerativeWidgetPayloadMap | string;
