"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Star, Clock, User, CheckCircle2 } from "lucide-react";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatPodaciumCurrency } from "@/lib/formatDZD";
import type {
  FreelancerComparisonPayload,
  ProposalComparisonItem,
} from "./types";

export interface FreelancerComparisonWidgetProps {
  payload: FreelancerComparisonPayload;
  onSelectProposal?: (proposal: ProposalComparisonItem) => void;
  className?: string;
}

export function FreelancerComparisonWidget({
  payload,
  onSelectProposal,
  className,
}: FreelancerComparisonWidgetProps) {
  const { t } = useTranslations();
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | number>(
    payload.proposals?.[0]?.id || "",
  );

  const getBadgeVariant = (
    badge?: string,
  ): "gradient" | "success" | "default" => {
    switch (badge?.toUpperCase()) {
      case "TOP_RATED":
        return "gradient";
      case "VERIFIED":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <PodaciumCard
      className={cn(
        "my-2 w-full max-w-2xl overflow-hidden p-0 border border-border",
        className,
      )}
    >
      <div className="p-3.5 border-b border-border bg-secondary/30">
        <h4 className="font-semibold text-foreground text-sm">
          {payload.comparisonTitle}
        </h4>
        <p className="text-muted-foreground text-xs mt-0.5">
          {t("component.generativeUi.freelancerComparison.project")}:{" "}
          {payload.jobTitle}
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x rtl:md:divide-x-reverse divide-border">
        {(payload.proposals || []).map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(item.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedId(item.id);
                }
              }}
              className={cn(
                "p-4 transition-all cursor-pointer flex flex-col justify-between space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isSelected
                  ? "bg-primary/5 ring-1 ring-primary/60"
                  : "hover:bg-secondary/40",
              )}
            >
              <div className="space-y-2.5">
                {/* Profile header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.freelancerAvatar ? (
                      <Image
                        src={item.freelancerAvatar}
                        alt={item.freelancerName}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <h5 className="font-medium text-foreground text-xs leading-none">
                        {item.freelancerName}
                      </h5>
                      <span className="text-muted-foreground text-[11px]">
                        {item.freelancerTitle}
                      </span>
                    </div>
                  </div>

                  {item.badge && (
                    <PodaciumBadge
                      variant={getBadgeVariant(item.badge)}
                      className="text-[10px]"
                    >
                      {item.badge.replace(/_/g, " ")}
                    </PodaciumBadge>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="font-medium text-foreground">
                    {item.rating?.toFixed(1) || "5.0"}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    ({item.reviewCount || 0}{" "}
                    {t("component.generativeUi.freelancerComparison.reviews")})
                  </span>
                </div>

                {/* Cover Summary */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  &ldquo;{item.proposalCoverSummary}&rdquo;
                </p>

                {/* Metrics Matrix */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {t(
                        "component.generativeUi.freelancerComparison.proposedRate",
                      )}
                      :
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {formatPodaciumCurrency(item.proposedRateDzd, locale)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {t(
                        "component.generativeUi.freelancerComparison.deliveryDelay",
                      )}
                      :
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {t(
                        "component.generativeUi.freelancerComparison.deliveryDetails",
                        {
                          days: item.deliveryDays,
                          milestones: item.milestonesCount,
                        },
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <PodaciumButton
                  variant={isSelected ? "primary" : "outline"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(item.id);
                    onSelectProposal?.(item);
                  }}
                  className="w-full text-xs"
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                      {t(
                        "component.generativeUi.freelancerComparison.selected",
                      )}
                    </>
                  ) : (
                    t("component.generativeUi.freelancerComparison.reviewOffer")
                  )}
                </PodaciumButton>
              </div>
            </div>
          );
        })}
      </div>
    </PodaciumCard>
  );
}
