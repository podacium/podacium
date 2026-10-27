"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  LayoutDashboard,
  Database,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import { CourseWidgetCard } from "./CourseWidgetCard";
import { FreelancerComparisonWidget } from "./FreelancerComparisonWidget";
import { BIChartWidget } from "./BIChartWidget";
import { WilayaDensityMap } from "@/components/bi/WilayaDensityMap";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
  PodaciumSkeleton,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import {
  resolveWidgetType,
  unwrapProps,
  extractCourses,
  normalizeActionConfirmation,
  isRecord,
} from "./normalize";
import type {
  ActionConfirmationPayload,
  CourseWidgetPayload,
  FreelancerComparisonPayload,
  BIChartWidgetPayload,
  HITLActionState,
} from "./types";

export interface WidgetErrorFallbackProps {
  widgetType?: string;
  error?: Error | null;
  className?: string;
}

export function WidgetErrorFallback({
  widgetType,
  error,
  className,
}: WidgetErrorFallbackProps) {
  const { t } = useTranslations();
  return (
    <div
      role="alert"
      className={cn(
        "my-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-foreground shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("component.generativeUi.unavailableTitle")}</span>
      </div>
      <p className="mt-1 text-muted-foreground text-[11px]">
        {t("component.generativeUi.unavailableDescription")}
        {widgetType ? ` (${widgetType})` : ""}.
      </p>
      {error?.message && (
        <p className="mt-1 font-mono text-[10px] text-destructive/80 truncate">
          {error.message}
        </p>
      )}
    </div>
  );
}

export interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  widgetType?: string;
}

export interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Widget render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <WidgetErrorFallback
            widgetType={this.props.widgetType}
            error={this.state.error}
          />
        )
      );
    }
    return this.props.children;
  }
}

export type GenericWidgetPayload =
  | ActionConfirmationPayload
  | CourseWidgetPayload
  | FreelancerComparisonPayload
  | BIChartWidgetPayload
  | {
      widgetType?: string;
      widget_type?: string;
      type?: string;
      props?: Record<string, unknown>;
      [key: string]: unknown;
    };

export interface WidgetRegistryProps {
  widget: GenericWidgetPayload;
  onActionComplete?: (result: {
    status: HITLActionState;
    data?: unknown;
  }) => void;
  className?: string;
}

/** Render a grid / list of project opportunities from ProjectListingGrid */
function ProjectListWidget({
  projects,
  className,
}: {
  projects: Array<Record<string, unknown>>;
  className?: string;
}) {
  const { t } = useTranslations();
  return (
    <PodaciumCard
      className={cn("my-2 w-full p-4 border border-border", className)}
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">
            {t("component.generativeUi.projects.title", {
              count: projects.length,
            })}
          </h4>
        </div>
        <Link
          href="/hub/projects"
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          {t("component.generativeUi.projects.viewAll")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {projects.map((proj, idx) => {
          const id = proj.id ?? idx;
          const title = String(proj.title || "Projet Freelance");
          const budget = proj.budget_dzd ?? proj.budget;
          const skills = Array.isArray(proj.skills)
            ? (proj.skills as string[])
            : [];
          const proposalsCount = Number(proj.proposals_count ?? 0);
          const href = String(proj.url || `/hub/projects/${id}`);

          return (
            <div
              key={String(id)}
              className="p-3 rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <Link
                  href={href}
                  className="font-medium text-xs sm:text-sm text-foreground hover:text-primary transition-colors block truncate"
                >
                  {title}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {typeof budget === "number" && budget > 0 && (
                    <span className="font-mono font-bold text-primary">
                      {budget.toLocaleString()} DZD
                    </span>
                  )}
                  <span>•</span>
                  <span>
                    {t("component.generativeUi.projects.proposalsCount", {
                      count: proposalsCount,
                    })}
                  </span>
                  {skills.slice(0, 3).map((s) => (
                    <PodaciumBadge
                      key={s}
                      variant="outline"
                      className="text-[10px] py-0 px-1.5"
                    >
                      {s}
                    </PodaciumBadge>
                  ))}
                </div>
              </div>

              <PodaciumButton
                href={href}
                size="sm"
                variant="outline"
                className="shrink-0 self-end sm:self-center text-xs h-8"
              >
                {t("component.generativeUi.projects.apply")}
                <ExternalLink className="ms-1.5 h-3 w-3" />
              </PodaciumButton>
            </div>
          );
        })}
      </div>
    </PodaciumCard>
  );
}

/** Render a dashboard list widget */
function DashboardListWidget({
  dashboards,
  className,
}: {
  dashboards: Array<Record<string, unknown>>;
  className?: string;
}) {
  const { t } = useTranslations();
  return (
    <PodaciumCard
      className={cn("my-2 w-full p-4 border border-border", className)}
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">
            {t("component.generativeUi.dashboards.title", {
              count: dashboards.length,
            })}
          </h4>
        </div>
        <Link
          href="/bi/dashboards"
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          {t("component.generativeUi.dashboards.biStudio")}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {dashboards.map((dash, idx) => {
          const id = dash.id ?? idx;
          const name = String(dash.name || "Tableau de Bord");
          const desc =
            typeof dash.description === "string" ? dash.description : null;
          const isPublic = Boolean(dash.is_public ?? dash.isPublic);

          return (
            <Link
              key={String(id)}
              href={`/bi/dashboards/${id}`}
              className="p-3 rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/50 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {name}
                  </span>
                  <PodaciumBadge
                    variant={isPublic ? "success" : "outline"}
                    className="text-[9px] py-0 px-1"
                  >
                    {isPublic
                      ? t("component.generativeUi.dashboards.public")
                      : t("component.generativeUi.dashboards.private")}
                  </PodaciumBadge>
                </div>
                {desc && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {desc}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center text-[11px] text-primary font-medium">
                {t("component.generativeUi.dashboards.openInEditor")}
                <ChevronRight className="ms-1 h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </PodaciumCard>
  );
}

/** Render a dataset schema preview widget */
function DatasetSchemaWidget({
  dataset,
  className,
}: {
  dataset: Record<string, unknown>;
  className?: string;
}) {
  const { t } = useTranslations();
  const name = String(dataset.name || "Jeu de données");
  const rowCount =
    typeof dataset.rowCount === "number" ? dataset.rowCount : dataset.row_count;
  const colCount =
    typeof dataset.columnCount === "number"
      ? dataset.columnCount
      : dataset.column_count;
  const datasetId =
    dataset.datasetId !== undefined && dataset.datasetId !== null
      ? String(dataset.datasetId)
      : dataset.id !== undefined && dataset.id !== null
        ? String(dataset.id)
        : null;

  return (
    <PodaciumCard
      className={cn("my-2 w-full p-4 border border-border", className)}
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">{name}</h4>
        </div>
        <PodaciumBadge variant="gradient" className="text-[10px]">
          {t("component.generativeUi.dataset.duckdbEngine")}
        </PodaciumBadge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-secondary/30 rounded-lg p-3 mb-3">
        <div>
          <span className="text-[11px] text-muted-foreground block">
            {t("component.generativeUi.dataset.indexedRows")}
          </span>
          <span className="font-mono font-semibold text-foreground">
            {typeof rowCount === "number" ? rowCount.toLocaleString() : "—"}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground block">
            {t("component.generativeUi.dataset.columns")}
          </span>
          <span className="font-mono font-semibold text-foreground">
            {typeof colCount === "number" ? colCount : "—"}
          </span>
        </div>
      </div>

      {datasetId ? (
        <div className="flex justify-end">
          <Link href={`/bi/sql?dataset=${datasetId}`}>
            <PodaciumButton size="sm" variant="primary" className="text-xs h-8">
              <Sparkles className="me-1.5 h-3.5 w-3.5" />
              {t("component.generativeUi.dataset.queryWithSql")}
            </PodaciumButton>
          </Link>
        </div>
      ) : null}
    </PodaciumCard>
  );
}

/** Render a horizontal scrollable course carousel */
function CourseCarouselWidget({
  courses,
  className,
}: {
  courses: CourseWidgetPayload[];
  className?: string;
}) {
  const { t } = useTranslations();
  return (
    <div className={cn("my-2 w-full space-y-2", className)}>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          {t("component.generativeUi.course.recommendedCourses", {
            count: courses.length,
          })}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 snap-x snap-mandatory scrollbar-thin">
        {courses.map((course) => (
          <div
            key={String(course.id)}
            className="w-[280px] sm:w-[320px] shrink-0 snap-start"
          >
            <CourseWidgetCard payload={course} />
          </div>
        ))}
      </div>
    </div>
  );
}

function renderWidgetContent(
  typeKey: string,
  rawWidget: GenericWidgetPayload,
  t: ReturnType<typeof useTranslations>,
  onActionComplete?: (result: {
    status: HITLActionState;
    data?: unknown;
  }) => void,
  className?: string,
) {
  const w = isRecord(rawWidget) ? rawWidget : {};
  const unwrapped = unwrapProps(w);

  // 1. Action Confirmation Card (HITL Gate)
  const actionPayload = normalizeActionConfirmation(w);
  if (
    actionPayload ||
    typeKey === "action_confirmation_card" ||
    typeKey === "action_confirmation" ||
    "intent_id" in unwrapped
  ) {
    const payload = (actionPayload ||
      ("props" in w && w.props
        ? w.props
        : w)) as unknown as ActionConfirmationPayload;
    return (
      <Suspense
        fallback={<PodaciumSkeleton className="h-44 w-full rounded-xl my-2" />}
      >
        <ActionConfirmationCard
          payload={payload}
          onExecutionComplete={onActionComplete}
          className={className}
        />
      </Suspense>
    );
  }

  // 2. Course Cards / Carousel
  const courses = extractCourses(w);
  if (
    courses.length > 0 &&
    (typeKey === "course_card" ||
      typeKey === "course_carousel" ||
      typeKey === "coursecarousel" ||
      typeKey === "coursedetailcard" ||
      typeKey === "studentprogresswidget" ||
      "courses" in unwrapped ||
      "skills" in unwrapped)
  ) {
    if (courses.length === 1) {
      return (
        <Suspense
          fallback={
            <PodaciumSkeleton className="h-44 w-full rounded-xl my-2" />
          }
        >
          <CourseWidgetCard payload={courses[0]} className={className} />
        </Suspense>
      );
    }

    return (
      <Suspense
        fallback={<PodaciumSkeleton className="h-44 w-full rounded-xl my-2" />}
      >
        <CourseCarouselWidget courses={courses} className={className} />
      </Suspense>
    );
  }

  // 3. Freelancer Comparison / Proposals Matrix
  if (
    typeKey === "freelancer_comparison" ||
    typeKey === "freelancerbidmatrix" ||
    "proposals" in unwrapped
  ) {
    const payload = ("props" in w && w.props
      ? w.props
      : w) as unknown as FreelancerComparisonPayload;
    return (
      <Suspense
        fallback={<PodaciumSkeleton className="h-44 w-full rounded-xl my-2" />}
      >
        <FreelancerComparisonWidget payload={payload} className={className} />
      </Suspense>
    );
  }

  // 4. Project Listing Grid
  if (
    typeKey === "projectlistinggrid" ||
    typeKey === "project_listing_grid" ||
    typeKey === "projects_list" ||
    (Array.isArray(unwrapped.projects) && unwrapped.projects.length > 0)
  ) {
    const list = Array.isArray(unwrapped.projects)
      ? (unwrapped.projects as Array<Record<string, unknown>>)
      : [];
    return <ProjectListWidget projects={list} className={className} />;
  }

  // 5. 58-Wilaya Density & Sales Map
  if (
    typeKey === "wilaya_density_map" ||
    typeKey === "wilaya_map" ||
    typeKey === "algeria_density_map" ||
    typeKey === "58_wilaya_density" ||
    unwrapped.chartType === "wilaya_map" ||
    unwrapped.chartType === "density_map"
  ) {
    const rawData = Array.isArray(unwrapped.data) ? unwrapped.data : undefined;
    return (
      <Suspense
        fallback={<PodaciumSkeleton className="h-64 w-full rounded-2xl my-2" />}
      >
        <WilayaDensityMap data={rawData as any} className={className} />
      </Suspense>
    );
  }

  // 6. BI Analytics / Chart
  if (
    typeKey === "bi_chart" ||
    typeKey === "chart_widget_added_card" ||
    "chartType" in unwrapped
  ) {
    const payload = ("props" in w && w.props
      ? w.props
      : w) as unknown as BIChartWidgetPayload;
    return (
      <Suspense
        fallback={<PodaciumSkeleton className="h-44 w-full rounded-xl my-2" />}
      >
        <BIChartWidget payload={payload} className={className} />
      </Suspense>
    );
  }

  // 6. BI Dashboards List
  if (
    typeKey === "dashboard_list_card" ||
    typeKey === "dashboards_list" ||
    (Array.isArray(unwrapped.dashboards) && unwrapped.dashboards.length > 0)
  ) {
    const list = Array.isArray(unwrapped.dashboards)
      ? (unwrapped.dashboards as Array<Record<string, unknown>>)
      : [];
    return <DashboardListWidget dashboards={list} className={className} />;
  }

  // 7. BI Dataset Schema Preview
  if (
    typeKey === "dataset_schema_preview" ||
    typeKey === "dataset_kpi_summary_card" ||
    "datasetId" in unwrapped
  ) {
    return <DatasetSchemaWidget dataset={unwrapped} className={className} />;
  }

  return (
    <div className="my-2 rounded-lg border border-dashed border-border/80 bg-secondary/20 p-3 text-xs text-muted-foreground font-mono">
      [{t("uiLabels.widgetPrefix")}: {typeKey || "data"}]
    </div>
  );
}

export function WidgetRegistry({
  widget,
  onActionComplete,
  className,
}: WidgetRegistryProps) {
  const t = useTranslations("common");
  const w = isRecord(widget) ? widget : {};
  const typeKey = resolveWidgetType(w);

  return (
    <WidgetErrorBoundary widgetType={typeKey}>
      {renderWidgetContent(typeKey, widget, t, onActionComplete, className)}
    </WidgetErrorBoundary>
  );
}

export default WidgetRegistry;
