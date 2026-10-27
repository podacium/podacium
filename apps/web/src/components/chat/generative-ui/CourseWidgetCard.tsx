"use client";

import React from "react";
import Image from "next/image";
import { Star, GraduationCap, ArrowRight, User } from "lucide-react";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatPodaciumCurrency } from "@/lib/formatDZD";
import type { CourseWidgetPayload } from "./types";

export interface CourseWidgetCardProps {
  payload: CourseWidgetPayload;
  className?: string;
}

export function CourseWidgetCard({
  payload,
  className,
}: CourseWidgetCardProps) {
  const { t } = useTranslations();
  const locale = useLocale();
  const rawLevel =
    typeof payload?.level === "string" && payload.level.trim() !== ""
      ? payload.level
      : "BEGINNER";
  const getBadgeVariant = (level?: string | null) => {
    const lvl = typeof level === "string" ? level.toUpperCase() : "BEGINNER";
    switch (lvl) {
      case "BEGINNER":
        return "success";
      case "INTERMEDIATE":
        return "default";
      case "ADVANCED":
        return "warning";
      default:
        return "secondary";
    }
  };

  const courseHref =
    payload?.href ||
    (payload?.slug
      ? `/learn/${payload.slug}`
      : `/learn/courses/${payload?.id || ""}`);

  const priceVal = typeof payload?.priceDzd === "number" ? payload.priceDzd : 0;
  const instructor = payload?.instructorName || "Podacium Academy";

  return (
    <PodaciumCard
      className={cn(
        "my-2 w-full max-w-sm overflow-hidden p-0 border border-border/80 shadow-xs",
        className,
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {payload.thumbnailUrl ? (
          <Image
            src={payload.thumbnailUrl}
            alt={payload.title || "Course"}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600/10 to-indigo-600/20 text-primary">
            <GraduationCap className="h-10 w-10 opacity-70" />
          </div>
        )}
        <div className="absolute top-2.5 start-2.5">
          <PodaciumBadge
            variant={getBadgeVariant(rawLevel)}
            className="shadow-xs capitalize text-[10px]"
          >
            {rawLevel.replace(/_/g, " ").toLowerCase()}
          </PodaciumBadge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-foreground text-sm line-clamp-2 leading-snug">
            {payload.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            {payload.instructorAvatar ? (
              <Image
                src={payload.instructorAvatar}
                alt={instructor}
                width={16}
                height={16}
                className="rounded-full"
              />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
            <span>{instructor}</span>
          </div>
        </div>

        {/* Rating & Reviews */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center text-amber-500 font-semibold gap-0.5">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>
              {typeof payload.rating === "number" && payload.rating > 0
                ? payload.rating.toFixed(1)
                : "5.0"}
            </span>
          </div>
          <span className="text-muted-foreground text-[11px]">
            ({(payload.reviewsCount || 0).toLocaleString(locale)}{" "}
            {t("component.generativeUi.freelancerComparison.reviews")})
          </span>
        </div>

        {/* Skills Chips */}
        {Array.isArray(payload.skills) && payload.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {payload.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground"
              >
                {skill}
              </span>
            ))}
            {payload.skills.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{payload.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Pricing & CTA */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-bold text-foreground">
              {priceVal > 0
                ? formatPodaciumCurrency(priceVal, locale)
                : t("component.generativeUi.course.free")}
            </div>
            {payload.originalPriceDzd &&
              payload.originalPriceDzd > priceVal && (
                <div className="font-mono text-[11px] text-muted-foreground line-through">
                  {formatPodaciumCurrency(payload.originalPriceDzd, locale)}
                </div>
              )}
          </div>

          <PodaciumButton
            href={courseHref}
            variant="primary"
            size="sm"
            className="text-xs"
          >
            {t("component.generativeUi.course.viewCourse")}
            <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
          </PodaciumButton>
        </div>
      </div>
    </PodaciumCard>
  );
}
