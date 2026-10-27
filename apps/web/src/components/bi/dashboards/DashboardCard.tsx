"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import {
  LayoutDashboard,
  MoreVertical,
  Calendar,
  BarChart2,
  Eye,
  Clock,
  Share2,
} from "lucide-react";
import { motion } from "framer-motion";
import { BiDashboardMetadata } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

interface DashboardCardProps {
  dashboard: BiDashboardMetadata;
  onDelete?: (id: number) => void;
  onShare?: (id: number) => void;
}

export function DashboardCard({
  dashboard,
  onDelete,
  onShare,
}: DashboardCardProps) {
  const router = useRouter();
  const t = useTranslations("bi.dashboards");
  const tCommon = useTranslations("common");
  const createdDate = dashboard.created_at
    ? new Date(dashboard.created_at).toLocaleDateString()
    : "";
  const updatedDate = dashboard.updated_at
    ? new Date(dashboard.updated_at).toLocaleDateString()
    : "";

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => router.push(`/bi/dashboards/${dashboard.id}`)}
      className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl border border-gray-200/50 dark:border-slate-800/50 p-6 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden"
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-slate-800/40 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      {/* Header */}
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
          {dashboard.layout_type === "presentation" ? (
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          ) : (
            <LayoutDashboard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(dashboard.id);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mr-1"
            title={t("detail.actions.share")}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative z-10">
        <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 mb-2 group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors tracking-tight">
          {dashboard.title || dashboard.name}
        </h3>
        <p className="text-[15px] text-gray-500 dark:text-slate-400 line-clamp-2 min-h-[45px] leading-relaxed font-medium">
          {dashboard.description || t("list.noDescription")}
        </p>
      </div>

      {/* Stats/Badges */}
      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800/80 dark:border-slate-800/50 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-slate-900/60 rounded-lg font-bold text-gray-600 dark:text-slate-400">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>{dashboard.widget_count || 0}</span>
          </div>
          {dashboard.is_public && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg font-bold">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {t("list.filters.public")}
            </div>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 font-bold"
          title={tCommon("uiLabels.updatedTitle", { date: updatedDate })}
        >
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>{updatedDate}</span>
        </div>
      </div>
    </motion.div>
  );
}
