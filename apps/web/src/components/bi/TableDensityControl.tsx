"use client";

import React from "react";
import { Rows3, AlignJustify, Maximize2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export type TableDensity = "compact" | "comfortable" | "spacious";

export const DENSITY_TABLE_CLASSES: Record<
  TableDensity,
  {
    th: string;
    td: string;
    icon: string;
    badge: string;
  }
> = {
  compact: {
    th: "px-3 py-1.5 text-xs font-semibold",
    td: "px-3 py-1.5 text-xs",
    icon: "w-3.5 h-3.5",
    badge: "text-[10px] px-1.5 py-0.2",
  },
  comfortable: {
    th: "px-4 py-2.5 text-xs font-semibold",
    td: "px-4 py-2.5 text-sm",
    icon: "w-4 h-4",
    badge: "text-xs px-2 py-0.5",
  },
  spacious: {
    th: "px-6 py-4 text-xs font-semibold",
    td: "px-6 py-4 text-sm",
    icon: "w-4 h-4",
    badge: "text-xs px-2.5 py-1",
  },
};

interface TableDensityControlProps {
  density: TableDensity;
  onChange: (density: TableDensity) => void;
  className?: string;
}

export const TableDensityControl: React.FC<TableDensityControlProps> = ({
  density,
  onChange,
  className = "",
}) => {
  const { t } = useTranslations();

  const options: { value: TableDensity; label: string; icon: React.FC<{ className?: string }> }[] = [
    { value: "compact", label: t("bi.density.compact"), icon: Rows3 },
    { value: "comfortable", label: t("bi.density.comfortable"), icon: AlignJustify },
    { value: "spacious", label: t("bi.density.spacious"), icon: Maximize2 },
  ];

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 ${className}`}
      role="group"
      aria-label={t("bi.density.label")}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = density === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              isActive
                ? "bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            }`}
            title={opt.label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
