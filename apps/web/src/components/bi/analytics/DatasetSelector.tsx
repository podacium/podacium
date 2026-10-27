"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PodaciumCard } from "@/components/design-system";
import { BiDatasetMetadata } from "@/lib/api";
import {
  Database,
  Search,
  Calendar,
  FileText,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface DatasetSelectorProps {
  datasets: BiDatasetMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function DatasetSelector({
  datasets,
  selectedId,
  onSelect,
  loading,
}: DatasetSelectorProps) {
  const { t, i18n } = useTranslations("bi.analytics.selection");
  const locale = i18n.language;
  const [search, setSearch] = useState("");

  const filteredDatasets = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.domain?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="w-full space-y-6">
      {/* Search Header */}
      <div className="relative">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t("placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-12 pe-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium placeholder:text-gray-400"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse"
                />
              ))
          ) : filteredDatasets.length > 0 ? (
            filteredDatasets.map((dataset, idx) => {
              const isSelected = selectedId === dataset.dataset_id;

              return (
                <motion.div
                  key={dataset.dataset_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onSelect(dataset.dataset_id)}
                >
                  <PodaciumCard
                    variant={isSelected ? "default" : "elevated"}
                    hover={true}
                    padding="md"
                    className={cn(
                      "cursor-pointer relative overflow-hidden group transition-all duration-300",
                      isSelected
                        ? "ring-2 ring-blue-600 bg-blue-50/50"
                        : "hover:border-blue-200",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600",
                        )}
                      >
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={cn(
                            "font-bold text-gray-900 dark:text-slate-100 truncate mb-1",
                            isSelected && "text-blue-900",
                          )}
                        >
                          {dataset.name}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {dataset.row_count?.toLocaleString(locale)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{dataset.domain || t("general")}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-4 end-4 text-blue-600 dark:text-blue-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </PodaciumCard>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-gray-400">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">{t("empty")}</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
