"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { PodaciumCard } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { Info, TrendingUp, TrendingDown } from "lucide-react";

const Sparkline = dynamic(
  () => import("./Sparkline").then((m) => m.Sparkline),
  {
    ssr: false,
    loading: () => (
      <div className="w-16 h-8 rounded bg-gray-100 dark:bg-slate-800 animate-pulse" />
    ),
  },
);

interface AnalyticsCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label: string;
  };
  sparkData?: number[];
}

export function AnalyticsCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  delay = 0,
  trend,
  sparkData,
}: AnalyticsCardProps) {
  return (
    <PodaciumCard
      variant="elevated"
      padding="lg"
      hover={true}
      className={cn(
        "flex flex-col h-[420px] backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 border-t border-white/50",
        className,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            {Icon && (
              <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-lg text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-100/50">
                <Icon className="w-4 h-4" />
              </div>
            )}
            {title}
          </h3>
          {description && (
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1.5 ml-1 flex items-center gap-1.5">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sparkData && sparkData.length > 1 && (
            <Sparkline data={sparkData} label={title} />
          )}
          {trend && (
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-inset flex items-center gap-1",
                trend.direction === "up"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : trend.direction === "down"
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : "bg-gray-50 dark:bg-slate-900/60 text-gray-600 dark:text-slate-400 ring-gray-200",
              )}
            >
              {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
              {trend.direction === "down" && (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.value} {trend.label}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative w-full">{children}</div>
    </PodaciumCard>
  );
}
