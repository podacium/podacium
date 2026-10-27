"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight, ArrowUpRight } from "lucide-react";
import { hoverLiftScale } from "@/lib/animation-presets";
import { useTranslations } from "@/lib/i18n";

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  color?: string;
  disabled?: boolean;
  badge?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  isLoading?: boolean;
  columns?: 2 | 3;
}

const QuickActionSkeleton: React.FC = () => (
  <div className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl" />
      <div className="w-5 h-5 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
    <div className="space-y-2">
      <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
  </div>
);

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  isLoading = false,
  columns = 3,
}) => {
  const t = useTranslations("common");
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
  };

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6`}>
        {[...Array(columns >= 3 ? 3 : columns)].map((_, i) => (
          <QuickActionSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6`}>
      {actions.map((action, index) => (
        <motion.button
          key={index}
          onClick={action.onClick}
          disabled={action.disabled}
          {...hoverLiftScale}
          className={`p-6 rounded-2xl border text-start transition-all duration-300 relative overflow-hidden group flex flex-col justify-between ${
            action.disabled
              ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800"
              : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-gray-200/50 dark:border-slate-800/50 hover:border-blue-500/50 hover:shadow-xl dark:hover:shadow-blue-500/10 cursor-pointer"
          }`}
        >
          {/* Subtle Accent Glow */}
          <div
            className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${
              action.color || "from-blue-500 to-indigo-600"
            } opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity duration-500`}
          />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  action.disabled
                    ? "bg-gray-100 text-gray-400 dark:bg-slate-800"
                    : `bg-gradient-to-br ${
                        action.color || "from-blue-500 to-indigo-600"
                      } text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300`
                }`}
              >
                {action.icon}
              </div>
              {action.badge && (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {action.badge}
                </span>
              )}
            </div>

            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {action.title}
            </h3>
            <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
              {action.description}
            </p>
          </div>

          <div className="mt-4">
            <span
              className={`inline-flex items-center text-sm font-semibold transition-all duration-300 ${
                action.disabled
                  ? "text-gray-500 dark:text-slate-400"
                  : "text-blue-600 group-hover:text-blue-700 group-hover:gap-2"
              }`}
            >
              {action.href ? t("common.view") : t("common.getStarted")}
              <ArrowUpRight className="w-4 h-4 ml-1 group-hover:ml-2 transition-all duration-300" />
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default QuickActions;
