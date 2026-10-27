import type { ActionConfirmationPayload, CourseWidgetPayload } from "./types";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return fallback;
}

function pick(obj: UnknownRecord, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

/** Resolve the widget type key from any of the conventions used by backend tools. */
export function resolveWidgetType(widget: UnknownRecord): string {
  const raw = pick(widget, "widgetType", "widget_type", "type");
  return str(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Unwrap `{ props: {...} }` envelopes. */
export function unwrapProps(widget: UnknownRecord): UnknownRecord {
  return isRecord(widget.props) ? { ...widget, ...widget.props } : widget;
}

/** Map a backend course row (snake_case or camelCase) to the CourseWidgetCard contract. */
export function normalizeCourse(raw: unknown): CourseWidgetPayload | null {
  if (!isRecord(raw)) return null;
  const id = pick(raw, "id", "moduleId", "module_id", "course_id");
  const title = str(pick(raw, "title", "name"));
  if (id === undefined && !title) return null;

  const instructor = raw.instructor;
  const instructorName = str(
    pick(raw, "instructorName", "instructor_name") ??
      (isRecord(instructor)
        ? pick(instructor, "name", "fullName")
        : instructor),
    "Podacium Academy",
  );

  const price = raw.price;
  const priceDzd = num(
    pick(raw, "priceDzd", "price_dzd") ??
      (isRecord(price) ? pick(price, "discounted", "original") : price),
    0,
  );
  const originalPriceDzd = isRecord(price)
    ? num(price.original, 0) || undefined
    : num(pick(raw, "originalPriceDzd", "original_price_dzd"), 0) || undefined;

  const skillsRaw = pick(raw, "skills", "tags");
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((s) => str(s)).filter(Boolean)
    : [];

  const url = str(pick(raw, "url", "href"));

  return {
    id: (id as string | number) ?? title,
    title: title || String(id),
    instructorName,
    instructorAvatar:
      str(pick(raw, "instructorAvatar", "instructor_avatar")) || undefined,
    thumbnailUrl:
      str(pick(raw, "thumbnailUrl", "thumbnail_url", "image")) || undefined,
    level: str(pick(raw, "level", "difficulty")),
    priceDzd,
    originalPriceDzd,
    rating: num(pick(raw, "rating", "averageRating", "avg_rating"), 0),
    reviewsCount: num(
      pick(raw, "reviewsCount", "reviews_count", "reviewCount"),
      0,
    ),
    skills,
    slug: str(raw.slug) || undefined,
    href: url || undefined,
    lessonsCount:
      num(pick(raw, "lessonsCount", "lessons_count", "totalLessons"), 0) ||
      undefined,
    durationMinutes:
      num(pick(raw, "durationMinutes", "duration_minutes"), 0) || undefined,
  };
}

/** Extract a list of courses from carousel/detail/single payloads. */
export function extractCourses(widget: UnknownRecord): CourseWidgetPayload[] {
  const w = unwrapProps(widget);
  const list = pick(w, "courses", "modules", "items", "results");
  if (Array.isArray(list)) {
    return list
      .map(normalizeCourse)
      .filter((c): c is CourseWidgetPayload => c !== null);
  }
  const single = pick(w, "course", "module");
  if (isRecord(single)) {
    const c = normalizeCourse(single);
    return c ? [c] : [];
  }
  const self = normalizeCourse(w);
  return self ? [self] : [];
}

/** Normalize HITL action proposals emitted by the agent router. */
export function normalizeActionConfirmation(
  widget: UnknownRecord,
): ActionConfirmationPayload | null {
  const w = unwrapProps(widget);
  const intentId = str(pick(w, "intent_id", "intentId"));
  const token = str(w.token);
  if (!intentId || !token) return null;

  const params = pick(
    w,
    "prepared_params",
    "parameters",
    "params",
    "proposed_arguments",
  );
  const toolName = str(pick(w, "tool_name", "toolName", "tool"));
  return {
    intent_id: intentId,
    token,
    tool_name: toolName,
    prepared_params: isRecord(params) ? params : {},
    risk_score: num(
      pick(w, "risk_score", "riskScore"),
      w.is_mutating ? 0.6 : 0.3,
    ),
    expires_at: num(pick(w, "expires_at"), 0) || undefined,
    expires_at_unix: num(pick(w, "expires_at_unix"), 0) || undefined,
    title: str(w.title) || toolName.replace(/_/g, " "),
    summary: str(pick(w, "summary", "description")) || undefined,
    financial_impact_dzd:
      num(pick(w, "financial_impact_dzd", "amount_dzd"), 0) || undefined,
    idempotency_key: str(w.idempotency_key) || undefined,
  };
}

/** Human-friendly label from a snake/camel/Pascal key. */
export function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b(card|widget)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
