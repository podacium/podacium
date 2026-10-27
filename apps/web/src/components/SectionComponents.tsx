"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  padding?: "sm" | "md" | "lg";
  isLoading?: boolean;
  className?: string;
  /** Remove border/background for seamless embedding */
  flush?: boolean;
}

export function SectionCard({
  children,
  title,
  icon,
  description,
  action,
  padding = "md",
  isLoading = false,
  className = "",
  flush = false,
}: SectionCardProps) {
  const paddingClass = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  }[padding];

  const content = (
    <div
      className={cn(
        !flush &&
          "group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-slate-800/80 text-gray-900 dark:text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_16px_48px_-12px_rgba(79,70,229,0.18)] hover:border-indigo-200/70 dark:hover:border-indigo-800/70",
        flush && "p-0",
        className,
      )}
    >
      {!flush && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      )}
      {(title || description || action) && (
        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
            !flush &&
              "px-6 py-4 border-b border-gray-100 dark:border-slate-800",
          )}
        >
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                {icon}
              </span>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={paddingClass}>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-gradient-to-r from-gray-100 dark:from-slate-800 via-gray-200/70 dark:via-slate-700/70 to-gray-100 dark:to-slate-800 bg-[length:200%_100%] animate-shimmer"
              />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  return content;
}

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "purple" | "orange" | "red";
  description?: string;
  className?: string;
  /** Gradient for the icon background */
  gradient?: string;
  /** Trend indicator */
  trend?: { value: number; isPositive: boolean };
  /** Animation delay for staggered entrance */
  delay?: number;
  /** Navigate to href on click */
  href?: string;
  /** Click handler */
  onClick?: () => void;
}

export function StatCard({
  value,
  label,
  icon,
  color = "blue",
  description,
  className = "",
  gradient,
  trend,
  delay = 0,
  href,
  onClick,
}: StatCardProps) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    green: "from-emerald-500 to-teal-600",
    purple: "from-purple-500 to-indigo-600",
    orange: "from-amber-500 to-orange-600",
    red: "from-red-500 to-rose-600",
  };

  const clickable = href || onClick;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
      whileHover={clickable ? { y: -6, scale: 1.02 } : undefined}
      onClick={onClick}
      className={cn(
        "group card-spotlight relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-gray-200/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] p-6 h-full flex flex-col justify-between hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.2)] dark:hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] hover:border-indigo-300 dark:hover:border-indigo-700/80 transition-all duration-300",
        clickable && "cursor-pointer",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <div
              className={cn(
                "relative w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 overflow-hidden shadow-md shadow-blue-500/10 dark:shadow-slate-950/40 transition-transform duration-300 group-hover:scale-105",
                gradient
                  ? `bg-gradient-to-br ${gradient}`
                  : `bg-gradient-to-br ${colorClasses[color]}`,
              )}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 dark:group-hover:bg-white/15 transition-colors duration-300" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-white/30 dark:bg-white/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 text-white flex items-center justify-center">
                {icon}
              </span>
            </div>
          )}
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">
              {value}
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">
              {label}
            </div>
          </div>
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
              trend.isPositive
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300",
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      {description && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {description}
          </p>
        </div>
      )}
    </motion.div>
  );

  if (href)
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  return content;
}

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Bar color */
  color?: "blue" | "green" | "purple" | "orange" | "red";
  /** Height */
  height?: "sm" | "md" | "lg";
  /** Show percentage label */
  showLabel?: boolean;
  /** Additional class */
  className?: string;
}

/**
 * Simple progress bar with solid colors.
 */
export function ProgressBar({
  value,
  color = "blue",
  height = "md",
  showLabel = false,
  className = "",
}: ProgressBarProps) {
  const t = useTranslations("common");
  const colorClasses = {
    blue: "from-blue-500 to-indigo-500",
    green: "from-emerald-500 to-teal-500",
    purple: "from-purple-500 to-indigo-500",
    orange: "from-amber-500 to-orange-500",
    red: "from-red-500 to-rose-500",
  };

  const heightClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-300 mb-1">
          <span>{t("progress")}</span>
          <span className="font-medium text-gray-900 dark:text-slate-100 tabular-nums">
            {percentage}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full bg-gray-200/70 dark:bg-slate-700/70 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner",
          heightClasses[height],
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r relative overflow-hidden",
            colorClasses[color],
          )}
        >
          <div className="absolute inset-0 bg-white/25 animate-shimmer bg-[length:200%_100%]" />
        </motion.div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionText,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("relative text-center py-14", className)}
    >
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="aurora-blob w-64 h-64 -top-10 left-1/2 -translate-x-1/2 bg-blue-100 dark:bg-blue-950/60 animate-aurora" />
      </div>
      {icon && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-800 dark:to-indigo-950 flex items-center justify-center mx-auto mb-6 overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/0 via-indigo-400/0 to-purple-400/0 group-hover:from-blue-500/10 group-hover:via-indigo-400/10 group-hover:to-purple-400/10 transition-all duration-500" />
          <div className="w-10 h-10 text-blue-600 dark:text-blue-400 relative animate-float-slow">
            {icon}
          </div>
        </motion.div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action}
      {actionText && onAction && (
        <motion.button
          onClick={onAction}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl transition-all relative overflow-hidden"
        >
          <span className="absolute inset-0 bg-white/20 animate-glow-pulse" />
          <span className="relative">{actionText}</span>
        </motion.button>
      )}
    </motion.div>
  );
}

interface LoadingStateProps {
  text?: string;
  className?: string;
}

export function LoadingState({
  text = "Loading...",
  className = "",
}: LoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="text-center">
        <div className="relative w-14 h-14 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-25 blur-md animate-glow-pulse" />
          <Loader2 className="h-14 w-14 animate-spin text-blue-600 dark:text-blue-400 relative" />
        </div>
        <p className="text-gray-600 dark:text-slate-400 font-medium">{text}</p>
      </div>
    </div>
  );
}

export default SectionCard;
