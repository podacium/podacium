// /components/hub/SearchFilters.tsx - INTERNATIONALIZED
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Check,
  DollarSign,
  Award,
  MapPin,
  Calendar,
  Clock,
  Star,
  Phone,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface SearchFiltersProps {
  onSearch: (query: string) => void;
  onFiltersChange: (filters: any) => void;
  skills: string[];
  isLoading?: boolean;
  className?: string;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  onSearch,
  onFiltersChange,
  skills = [],
  isLoading = false,
  className = "",
}) => {
  const { t } = useTranslations("component");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [hasCertificates, setHasCertificates] = useState<boolean | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSkills, setShowSkills] = useState(false);

  const statusOptions = [
    { value: "all", label: t("comphub.searchFilters.status.all") },
    { value: "OPEN", label: t("comphub.searchFilters.status.open") },
    {
      value: "IN_PROGRESS",
      label: t("comphub.searchFilters.status.inProgress"),
    },
    { value: "COMPLETED", label: t("comphub.searchFilters.status.completed") },
  ];

  const handleSearch = () => {
    onSearch(searchQuery);
    const filters = {
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      status: selectedStatus === "all" ? undefined : selectedStatus,
      has_certificates: hasCertificates,
      phone_verified: phoneVerified,
    };
    // Filter out undefined and null values
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(
        ([_, value]) => value !== undefined && value !== null,
      ),
    );
    onFiltersChange(cleanFilters);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSkills([]);
    setSelectedStatus("all");
    setHasCertificates(null);
    setPhoneVerified(null);
    onSearch("");
    onFiltersChange({});
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={t("comphub.searchFilters.placeholders.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full pl-9 pr-8 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-200 transition-colors"
        >
          <Filter className="w-4 h-4 mr-1.5" />
          {showAdvanced
            ? t("comphub.searchFilters.buttons.hideFilters")
            : t("comphub.searchFilters.buttons.moreFilters")}
          <ChevronDown
            className={`w-4 h-4 ml-1.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </button>

        {selectedSkills.map((skill) => (
          <div
            key={skill}
            className="flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium border border-blue-200 dark:border-blue-800/80"
          >
            {skill}
            <button
              onClick={() =>
                setSelectedSkills((prev) => prev.filter((s) => s !== skill))
              }
              className="ml-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-300"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Advanced Filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Skills Filter */}
            {skills.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {t("comphub.searchFilters.labels.skills")}
                  </label>
                  <button
                    onClick={() => setShowSkills(!showSkills)}
                    className="text-blue-600 dark:text-blue-400 text-sm hover:text-blue-700"
                  >
                    {showSkills
                      ? t("comphub.searchFilters.buttons.hide")
                      : t("comphub.searchFilters.buttons.browse")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {skills.slice(0, showSkills ? 20 : 8).map((skill) => (
                    <button
                      key={skill}
                      onClick={() => {
                        setSelectedSkills((prev) =>
                          prev.includes(skill)
                            ? prev.filter((s) => s !== skill)
                            : [...prev, skill],
                        );
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedSkills.includes(skill)
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                      }`}
                    >
                      {selectedSkills.includes(skill) && (
                        <Check className="w-3 h-3 mr-1.5" />
                      )}
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("comphub.searchFilters.labels.status")}
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedStatus(option.value)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selectedStatus === option.value
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                    }`}
                  >
                    {selectedStatus === option.value && (
                      <Check className="w-3 h-3 mr-1.5" />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {t("comphub.searchFilters.labels.verification")}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPhoneVerified(phoneVerified === true ? null : true)
                    }
                    className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      phoneVerified === true
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                    }`}
                  >
                    <Phone className="w-4 h-4 mr-1.5" />
                    {t("comphub.searchFilters.filters.phoneVerified")}
                  </button>
                  <button
                    onClick={() => setPhoneVerified(null)}
                    className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      phoneVerified === null
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                    }`}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    {t("comphub.searchFilters.filters.any")}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  {t("comphub.searchFilters.labels.certificates")}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setHasCertificates(hasCertificates === true ? null : true)
                    }
                    className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      hasCertificates === true
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                    }`}
                  >
                    <Award className="w-4 h-4 mr-1.5" />
                    {t("comphub.searchFilters.filters.hasCertificates")}
                  </button>
                  <button
                    onClick={() => setHasCertificates(null)}
                    className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      hasCertificates === null
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:bg-gray-200"
                    }`}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    {t("comphub.searchFilters.filters.any")}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-2">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-200 transition-colors"
              >
                {t("comphub.searchFilters.buttons.clearAll")}
              </button>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? t("comphub.searchFilters.buttons.searching")
                  : t("comphub.searchFilters.buttons.applyFilters")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
