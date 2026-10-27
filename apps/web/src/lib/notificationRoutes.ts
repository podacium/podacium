/**
 * Canonical Next.js 15 route resolver for notifications.
 *
 * Guarantees NO empty states or dead-ends:
 * Resolves actions, URLs, legacy paths, and entity identifiers to exact destinations.
 */

export interface RouteResolutionPayload {
  action_url?: string;
  url?: string;
  target?: string;
  entity_type?: string;
  entity_id?: string | number;
  type?: string;
  category?: string;
  project_id?: string | number;
  contract_id?: string | number;
  session_id?: string | number;
  ticket_id?: string | number;
  module_id?: string | number;
  course_id?: string | number;
  certificate_id?: string | number;
  dispute_id?: string | number;
  payout_id?: string | number;
  user_id?: string | number;
  [key: string]: any;
}

/**
 * Resolves notification payload deep-links to canonical Next.js 15 routes,
 * repairing legacy backend route patterns and filling missing URLs.
 */
export function resolveNotificationRoute(
  rawPayload?: RouteResolutionPayload | null,
): string {
  if (!rawPayload) return "/notifications";

  const nestedData =
    typeof rawPayload.data === "object" && rawPayload.data !== null
      ? rawPayload.data
      : {};
  const nestedPayload =
    typeof rawPayload.payload === "object" && rawPayload.payload !== null
      ? rawPayload.payload
      : {};
  const nestedMeta =
    typeof rawPayload.metadata === "object" && rawPayload.metadata !== null
      ? rawPayload.metadata
      : {};

  const payload: RouteResolutionPayload = {
    ...rawPayload,
    ...nestedMeta,
    ...nestedPayload,
    ...nestedData,
  };

  // 1. Direct URL / action_url / target / link
  const rawUrl =
    payload.action_url || payload.url || payload.target || payload.link;

  if (rawUrl && typeof rawUrl === "string") {
    // Repair legacy /freelance routes to /hub
    if (rawUrl.startsWith("/freelance/projects/")) {
      return rawUrl.replace("/freelance/projects/", "/hub/projects/");
    }
    if (rawUrl.startsWith("/freelance/contracts/")) {
      return rawUrl.replace("/freelance/contracts/", "/hub/contracts/");
    }
    // Repair legacy /courses routes to /learn/courses
    if (rawUrl.startsWith("/courses/")) {
      return rawUrl.replace("/courses/", "/learn/courses/");
    }
    return rawUrl;
  }

  // 2. Specific entity attributes
  if (payload.course_id) return `/learn/courses/${payload.course_id}`;
  if (payload.module_id) return `/learn/modules/${payload.module_id}`;
  if (payload.certificate_id) return `/certificates/${payload.certificate_id}`;
  if (payload.session_id) return `/live/${payload.session_id}`;
  if (payload.dispute_id) return `/hub/disputes/${payload.dispute_id}`;
  if (payload.contract_id) return `/hub/contracts/${payload.contract_id}`;
  if (payload.project_id) return `/hub/projects/${payload.project_id}`;
  if (payload.ticket_id) return `/hub/support/${payload.ticket_id}`;
  if (payload.payout_id) return "/wallet/payouts";

  // 3. Fallback entity-based resolution
  const entityType = (
    payload.entity_type ||
    payload.type ||
    payload.category ||
    ""
  ).toLowerCase();
  const entityId = payload.entity_id;

  if (entityType.includes("course")) {
    return entityId ? `/learn/courses/${entityId}` : "/learn";
  }
  if (
    entityType.includes("module") ||
    entityType.includes("lesson") ||
    entityType.includes("quiz")
  ) {
    return entityId ? `/learn/modules/${entityId}` : "/learn";
  }
  if (entityType.includes("cert")) {
    return entityId ? `/certificates/${entityId}` : "/hub";
  }
  if (entityType.includes("live") || entityType.includes("session")) {
    return entityId ? `/live/${entityId}` : "/live";
  }
  if (entityType.includes("dispute")) {
    return entityId ? `/hub/disputes/${entityId}` : "/hub";
  }
  if (entityType.includes("proposal") || entityType.includes("project")) {
    return entityId ? `/hub/projects/${entityId}` : "/hub/projects";
  }
  if (entityType.includes("contract") || entityType.includes("milestone")) {
    return entityId ? `/hub/contracts/${entityId}` : "/hub/contracts";
  }
  if (entityType.includes("ticket") || entityType.includes("support")) {
    return entityId ? `/hub/support/${entityId}` : "/hub/support";
  }
  if (entityType.includes("payout")) {
    return "/wallet/payouts";
  }
  if (
    entityType.includes("wallet") ||
    entityType.includes("billing") ||
    entityType.includes("escrow") ||
    entityType.includes("payment")
  ) {
    return "/wallet";
  }
  if (entityType.includes("kyc") || entityType.includes("verification")) {
    return "/settings/verification";
  }
  if (
    entityType.includes("device") ||
    entityType.includes("login") ||
    entityType.includes("security") ||
    entityType.includes("2fa") ||
    entityType.includes("password")
  ) {
    return "/settings/security";
  }
  if (
    entityType.includes("organization") ||
    entityType.includes("org") ||
    entityType.includes("invitation")
  ) {
    return "/settings/organization";
  }
  if (entityType.includes("message") || entityType.includes("chat")) {
    return "/hub/messages";
  }

  return "/notifications";
}
