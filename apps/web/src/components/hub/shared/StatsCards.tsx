"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Equal } from "lucide-react";
import { SPRING, hoverLiftScale } from "@/lib/animation-presets";

type DSColor = "blue" | "green" | "purple" | "orange" | "red";

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  color?: string;
  tooltip?: string;
}

interface StatsCardsProps {
  stats: StatItem[];
  isLoading?: boolean;
  columns?: 2 | 3 | 4;
}

const hubColorToDSColor = (color: string): DSColor => {
  if (color.includes("green") || color.includes("emerald")) return "green";
  if (color.includes("blue")) return "blue";
  if (color.includes("purple")) return "purple";
  if (color.includes("orange")) return "orange";
  if (color.includes("red")) return "red";
  return "blue";
};

const StatCardSkeleton: React.FC = () => (
  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl" />
      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
    </div>
    <div className="space-y-2">
      <div className="h-8 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4" />
    </div>
  </div>
);

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  isLoading = false,
  columns = 4,
}) => {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6`}>
        {[...Array(columns >= 4 ? 4 : columns)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6`}>
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.SMOOTH, delay: index * 0.05 }}
          {...hoverLiftScale}
          className="group relative"
        >
          {stat.tooltip && (
            <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
                {stat.tooltip}
              </div>
            </div>
          )}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color?.replace("text-", "from-") || "from-blue-500"} to-gray-100/50 dark:to-slate-800/60 flex items-center justify-center`}
                >
                  {stat.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">
                    {stat.label}
                  </div>
                </div>
              </div>
              {stat.change !== undefined && (
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                    stat.change > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : stat.change < 0
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
                  }`}
                >
                  {stat.change > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : stat.change < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Equal className="w-3 h-3" />
                  )}
                  {Math.abs(stat.change)}%
                </div>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCards;
