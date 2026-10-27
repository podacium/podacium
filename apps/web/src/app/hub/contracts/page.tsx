// apps/web/src/app/hub/contracts/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Briefcase,
  Banknote,
  Calendar,
  ChevronRight,
  Search,
  RefreshCw,
  Eye,
  AlertTriangle,
  X,
  Lock,
  ExternalLink,
  FileCheck,
  XCircle,
  HelpCircle,
  UserCheck,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  ContractResponse,
  UserRole,
  ContractStatus,
  UserProfileResponse,
} from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { useFormatDate, useFormatCurrency } from "@/lib/date-utils";
import { StatCard as DSStatCard } from "@/components/SectionComponents";
import { useContracts } from "@/hooks/useContracts";

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
    BOUNCY: { type: "spring", stiffness: 400, damping: 15, mass: 1 },
    SMOOTH: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
    STANDARD: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    BOUNCE: { duration: 0.6, ease: [0.68, -0.55, 0.265, 1.55] },
  },
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
    SLOW: 0.2,
  },
} as const;

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
  tooltip?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color,
  isLoading = false,
  tooltip,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...ANIMATION_CONFIGS.SPRING.SMOOTH }}
      className="group relative"
    >
      {tooltip && (
        <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            {tooltip}
          </div>
        </div>
      )}
      <DSStatCard
        value={value}
        label={title}
        icon={icon}
        color={hubColorToDSColor(color)}
        trend={
          change !== undefined
            ? { value: Math.abs(change), isPositive: change >= 0 }
            : undefined
        }
      />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </motion.div>
  );
};

const hubColorToDSColor = (
  color: string,
): "blue" | "green" | "purple" | "orange" | "red" => {
  if (color.includes("green") || color.includes("emerald")) return "green";
  if (color.includes("blue")) return "blue";
  if (color.includes("purple")) return "purple";
  if (color.includes("orange")) return "orange";
  if (color.includes("red")) return "red";
  return "blue";
};

interface ContractCardProps {
  contract: ContractResponse;
  onClick?: () => void;
  variant?: "grid" | "list";
  compact?: boolean;
}

const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  onClick,
  variant = "grid",
  compact = false,
}) => {
  const t = useTranslations();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200";
      case "COMPLETED":
        return "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200";
      case "CANCELLED":
        return "bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200";
      case "PENDING":
        return "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200";
      case "DISPUTED":
        return "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200";
      default:
        return "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <CheckCircle className="w-4 h-4" />;
      case "COMPLETED":
        return <FileCheck className="w-4 h-4" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />;
      case "PENDING":
        return <Clock className="w-4 h-4" />;
      case "DISPUTED":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const { formatDate: fmtDate } = useFormatDate();
  const { formatCurrency: fmtCurrency } = useFormatCurrency();

  const formatCurrency = (amount?: number) => {
    if (!amount) return t("contracts.list.negotiable");
    return fmtCurrency(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("contracts.list.notSet");
    return fmtDate(dateString);
  };

  const getUserRole = () => {
    if (contract.user_role) return contract.user_role;
    return "unknown";
  };

  if (variant === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: 4 }}
        onClick={onClick}
        className={`group bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 ${compact ? "py-4" : ""}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 truncate text-lg">
                    {contract.project?.title ||
                      t("contracts.list.contractTitle", {
                        id: contract.id.toString(),
                      })}
                  </h3>
                  <div
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(contract.status)}`}
                  >
                    {getStatusIcon(contract.status)}
                    <span className="ml-2 mr-2">{contract.status}</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm mt-2 line-clamp-2">
                  {contract.terms || t("contracts.list.noTermsSpecified")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {t("contracts.list.amount")}
                </div>
                <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center">
                  <Banknote className="w-4 h-4 ml-2 mr-2 text-emerald-500 dark:text-emerald-400" />
                  {formatCurrency(contract.amount)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {t("contracts.list.duration")}
                </div>
                <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center">
                  <Calendar className="w-4 h-4 ml-2 mr-2 text-blue-500 dark:text-blue-400" />
                  {contract.startDate && contract.endDate ? (
                    <>
                      {formatDate(contract.startDate)} -{" "}
                      {formatDate(contract.endDate)}
                    </>
                  ) : (
                    t("contracts.list.flexible")
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {t("contracts.list.yourRole")}
                </div>
                <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center">
                  {getUserRole() === "freelancer" ? (
                    <>
                      <Briefcase className="w-4 h-4 ml-2 mr-2 text-purple-500 dark:text-purple-400" />
                      {t("contracts.list.freelancer")}
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 ml-2 mr-2 text-blue-500 dark:text-blue-400" />
                      {t("contracts.list.client")}
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                  {t("contracts.list.created")}
                </div>
                <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center">
                  <CalendarDays className="w-4 h-4 ml-2 mr-2 text-gray-500 dark:text-slate-400" />
                  {formatDate(contract.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
              <div className="flex items-center space-x-4">
                {contract.freelancer && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      {contract.freelancer.profilePictureUrl ? (
                        <img
                          src={contract.freelancer.profilePictureUrl}
                          alt={contract.freelancer.fullName}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {t("contracts.list.freelancer")}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">
                        {contract.freelancer.fullName}
                      </div>
                    </div>
                  </div>
                )}
                {contract.client && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                      {contract.client.profilePictureUrl ? (
                        <img
                          src={contract.client.profilePictureUrl}
                          alt={contract.client.fullName}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <UserCheck className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {t("contracts.list.client")}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">
                        {contract.client.fullName}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center text-sm text-gray-600 dark:text-slate-400">
                  <Eye className="w-4 h-4 ml-2 mr-2" />
                  {t("contracts.list.viewDetails")}
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 dark:text-blue-400 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 overflow-hidden"
    >
      {/* Status badge */}
      <div className="flex justify-between items-start mb-4">
        <div
          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(contract.status)}`}
        >
          {getStatusIcon(contract.status)}
          <span className="ml-2 mr-2.5">{contract.status}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-400">
          #{contract.id}
        </div>
      </div>

      {/* Contract title and description */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-2 line-clamp-2">
          {contract.project?.title ||
            t("contracts.list.contractTitle", { id: contract.id.toString() })}
        </h3>
        <p className="text-gray-600 dark:text-slate-400 text-sm line-clamp-3">
          {contract.terms || t("contracts.list.noTermsSpecified")}
        </p>
      </div>

      {/* Contract details */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600 dark:text-slate-400">
            <Banknote className="w-4 h-4 ml-2 mr-2" />
            <span className="text-sm">{t("contracts.list.amount")}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-slate-100">
            {formatCurrency(contract.amount)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600 dark:text-slate-400">
            <Calendar className="w-4 h-4 ml-2 mr-2" />
            <span className="text-sm">{t("contracts.list.timeline")}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-slate-100 text-sm text-right">
            {contract.startDate && contract.endDate ? (
              <div>
                <div>{formatDate(contract.startDate)}</div>
                <div className="text-gray-500 dark:text-slate-400">
                  {t("contracts.list.to")}
                </div>
                <div>{formatDate(contract.endDate)}</div>
              </div>
            ) : (
              t("contracts.list.flexible")
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-gray-600 dark:text-slate-400">
            <UserCheck className="w-4 h-4 ml-2 mr-2" />
            <span className="text-sm">{t("contracts.list.yourRole")}</span>
          </div>
          <div
            className={`font-semibold ${
              getUserRole() === "freelancer"
                ? "text-purple-600"
                : "text-blue-600"
            }`}
          >
            {getUserRole() === "freelancer"
              ? t("contracts.list.freelancer")
              : t("contracts.list.client")}
          </div>
        </div>
      </div>

      {/* Parties involved */}
      <div className="pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {contract.freelancer ? (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  {contract.freelancer.profilePictureUrl ? (
                    <img
                      src={contract.freelancer.profilePictureUrl}
                      alt={contract.freelancer.fullName}
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t("contracts.list.freelancer")}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate max-w-[100px]">
                    {contract.freelancer.fullName}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("contracts.list.noFreelancerAssigned")}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {contract.client ? (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                  {contract.client.profilePictureUrl ? (
                    <img
                      src={contract.client.profilePictureUrl}
                      alt={contract.client.fullName}
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <UserCheck className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    {t("contracts.list.client")}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate max-w-[100px]">
                    {contract.client.fullName}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-slate-400">
                {t("contracts.list.noClientAssigned")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action button */}
      <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
        <button className="w-full py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300 flex items-center justify-center group/btn">
          <span>{t("contracts.list.viewContractDetails")}</span>
          <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
        </button>
      </div>
    </motion.div>
  );
};

interface SectionHeaderProps {
  title: string;
  description?: string;
  actionText?: string;
  actionLink?: string;
  actionOnClick?: () => void;
  showViewAll?: boolean;
  isLoading?: boolean;
  badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actionText,
  actionLink,
  actionOnClick,
  showViewAll = true,
  isLoading = false,
  badge,
}) => {
  const t = useTranslations();

  if (isLoading) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-64"></div>
          {description && (
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-96"></div>
          )}
        </div>
        {(actionText || showViewAll) && (
          <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-24 mt-4 sm:mt-0"></div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {title}
            </h2>
            {badge && (
              <span className="px-2.5 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-gray-600 dark:text-slate-400 mt-2 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {(actionText || showViewAll) && (
        <div className="mt-4 sm:mt-0">
          {actionLink ? (
            <Link
              href={actionLink}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : actionOnClick ? (
            <button
              onClick={actionOnClick}
              className="group inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300"
            >
              {actionText || t("hub.buttons.viewAll")}
              <ChevronRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface FilterPillProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({
  label,
  count,
  isActive,
  onClick,
  icon,
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`group relative flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-300 ${
      isActive
        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 text-gray-700 dark:text-slate-300 hover:border-blue-200 hover:shadow-md"
    }`}
  >
    {icon && (
      <div
        className={`transition-transform duration-300 ${
          isActive
            ? "text-white group-hover:scale-110"
            : "text-gray-500 dark:text-slate-400 group-hover:text-blue-500 group-hover:scale-110"
        }`}
      >
        {icon}
      </div>
    )}
    <div className="flex items-center space-x-3">
      <span
        className={`font-semibold ${isActive ? "text-white" : "text-gray-900 dark:text-slate-100"}`}
      >
        {label}
      </span>
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${
          isActive
            ? "bg-white/20 text-white"
            : count === 0
              ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"
              : count < 3
                ? "bg-blue-100 text-blue-600"
                : count < 10
                  ? "bg-green-100 text-green-600"
                  : "bg-purple-100 text-purple-600"
        }`}
      >
        {count}
      </span>
    </div>
    {isActive && <CheckCircle className="w-4 h-4 ml-2 mr-2" />}
  </motion.button>
);

// =============================================================================
// SKELETON COMPONENTS
// =============================================================================

const StatCardsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ContractGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 h-80">
          <div className="flex justify-between items-start mb-4">
            <div className="w-20 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full"></div>
            <div className="w-12 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
          </div>
          <div className="space-y-3 mb-6">
            <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded w-2/3"></div>
          </div>
          <div className="space-y-4 mb-6">
            <div className="flex justify-between">
              <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
              <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            </div>
            <div className="flex justify-between">
              <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
              <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            </div>
            <div className="flex justify-between">
              <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
            <div className="flex justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                <div>
                  <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                <div>
                  <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
              </div>
            </div>
            <div className="w-full h-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ContractListSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="w-48 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded"></div>
                    <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                  </div>
                  <div className="w-full h-4 bg-gray-200 dark:bg-slate-800/90 rounded mt-2"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                  <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                  <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
                <div className="space-y-1">
                  <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                  <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                    <div>
                      <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full"></div>
                    <div>
                      <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="w-24 h-6 bg-gray-200 dark:bg-slate-800/90 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// MAIN CONTRACTS PAGE COMPONENT
// =============================================================================

export default function ContractsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const t = useTranslations();

  // Permission check: Only freelancers and clients can access this page
  const canAccessContracts = useMemo(() => {
    if (!user) return false;
    const allowedRoles = [
      UserRole.FREELANCER,
      UserRole.BUSINESS,
      UserRole.ADMIN,
      UserRole.INSTRUCTOR,
    ];
    return allowedRoles.includes(user.role);
  }, [user]);

  // Determine role for contract query
  const contractRole = useMemo(() => {
    if (!user) return undefined;
    return user.role === UserRole.FREELANCER ||
      user.role === UserRole.INSTRUCTOR
      ? "freelancer"
      : "client";
  }, [user]);

  // React Query hooks for data fetching
  const {
    data: contractsData,
    isLoading,
    error: queryError,
  } = useContracts({ role: contractRole });

  const contracts = (contractsData?.items ||
    contractsData ||
    []) as ContractResponse[];

  // Filter and view states
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");

  // Derived stats from contracts data
  const stats = useMemo(
    () => ({
      total: contracts.length,
      active: contracts.filter((c) => c.status === "ACTIVE").length,
      completed: contracts.filter((c) => c.status === "COMPLETED").length,
      pending: contracts.filter((c) => c.status === "PENDING").length,
      cancelled: contracts.filter((c) => c.status === "CANCELLED").length,
      disputed: contracts.filter((c) => c.status === "DISPUTED").length,
    }),
    [contracts],
  );

  // Client-side filtering
  const filteredContracts = useMemo(() => {
    let filtered = [...contracts];
    if (activeFilter !== "all") {
      filtered = filtered.filter(
        (c) => c.status === activeFilter.toUpperCase(),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.project?.title?.toLowerCase().includes(q) ||
          c.freelancer?.fullName?.toLowerCase().includes(q) ||
          c.client?.fullName?.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [contracts, activeFilter, searchQuery]);

  // Format time ago for access denied countdown
  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Permission check effect
  useEffect(() => {
    if (!authLoading && !canAccessContracts) {
      setAccessDenied(true);
      setAccessDeniedMessage(t("contracts.list.accessDeniedMessage"));
      setTimeout(() => router.push("/hub"), 5000);
    }
  }, [authLoading, canAccessContracts, router]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: "grid" | "list") => {
    setViewMode(mode);
  }, []);

  // Handle contract click
  const handleContractClick = useCallback(
    (contractId: number) => {
      router.push(`/hub/contracts/${contractId}`);
    },
    [router],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // React Query will automatically refetch
  }, []);

  // Countdown for access denied redirect
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    if (accessDenied) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [accessDenied]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg max-w-2xl mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg max-w-3xl mx-auto"></div>
            </div>
            <StatCardsSkeleton />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Access denied state (non-freelancer/non-client users)
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full text-sm font-semibold mb-4">
                <Lock className="w-4 h-4 ml-2 mr-2" />
                {t("contracts.list.accessRestricted")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("contracts.list.accessDenied")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {accessDeniedMessage}
              </p>

              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-8 max-w-2xl mx-auto">
                <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                  {t("contracts.list.accessRequiresRoleTitle")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6">
                  {t("contracts.list.accessRequiresRoleDescription")}
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.list.freelancerAccess")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.list.clientAccess")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                    <span className="text-gray-700 dark:text-slate-300">
                      {t("contracts.list.studentNoAccess")}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-semibold">
                      {t("contracts.list.redirectingIn")}
                    </div>
                    <div className="text-3xl font-bold font-mono">
                      {formatTimeLeft(countdown)}
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: 5, ease: "linear" }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                  <p className="text-blue-200 text-sm mt-3">
                    {t("contracts.list.redirectMessage")}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                  <button
                    onClick={() => router.push("/hub")}
                    className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                  >
                    {t("contracts.list.goToHubNow")}
                  </button>
                  <Link
                    href="/profile/me"
                    className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                  >
                    {t("contracts.list.updateProfile")}
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4">
                <Lock className="w-4 h-4 ml-2 mr-2" />
                {t("contracts.list.authenticationRequired")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("contracts.list.signInToAccess")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("contracts.list.signInDescription")}
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <button
                  onClick={() =>
                    router.push(`/auth/login?redirect=${pathname}`)
                  }
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {t("contracts.list.signIn")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </button>
                <button
                  onClick={() =>
                    router.push(`/auth/signup?redirect=${pathname}`)
                  }
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                >
                  {t("contracts.list.createAccount")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Navbar />

      {/* Header Section */}
      <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid-blue-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
        <div className="relative max-w-8xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg">
              <FileText className="w-4 h-4 ml-2 mr-2" />
              {t("contracts.list.contractManagement")}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {t("contracts.list.your")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("contracts.list.contracts")}
              </span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t("contracts.list.manageDescription")}
            </p>

            <div className="flex items-center justify-center space-x-4 pt-4">
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <Briefcase className="w-4 h-4 ml-2 mr-2 text-blue-500 dark:text-blue-400" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {user.role === UserRole.FREELANCER ||
                  user.role === UserRole.INSTRUCTOR
                    ? t("contracts.list.freelancerDashboard")
                    : t("contracts.list.clientDashboard")}
                </span>
              </div>
              <div className="inline-flex items-center px-4 py-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm">
                <UserCheck className="w-4 h-4 ml-2 mr-2 text-green-500" />
                <span className="font-semibold text-gray-900 dark:text-slate-100">
                  {user.fullName}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-8xl mx-auto">
          {/* Error Message */}
          {queryError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 dark:border-red-800/80 rounded-2xl p-6 mb-8"
            >
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 dark:text-red-200 font-semibold">
                    {queryError?.message ||
                      t("contracts.list.errors.failedToLoad")}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="mt-3 text-red-700 dark:text-red-300 hover:text-red-800 font-semibold text-sm flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 ml-2 mr-2" />
                    {t("contracts.list.tryAgain")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("contracts.list.contractOverview")}
              description={t("contracts.list.contractOverviewDescription")}
              isLoading={isLoading}
              badge={t("contracts.list.live")}
            />

            {isLoading ? (
              <StatCardsSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title={t("contracts.list.totalContracts")}
                  value={stats.total}
                  change={stats.total > 0 ? 12 : 0}
                  icon={
                    <FileText className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                  }
                  color="text-blue-500"
                  tooltip={t("contracts.list.totalContractsTooltip")}
                />
                <StatCard
                  title={t("contracts.list.activeContracts")}
                  value={stats.active}
                  change={
                    stats.active > 0
                      ? Math.round((stats.active / stats.total) * 100)
                      : 0
                  }
                  icon={<CheckCircle className="w-6 h-6 text-green-500" />}
                  color="text-green-500"
                  tooltip={t("contracts.list.activeContractsTooltip")}
                />
                <StatCard
                  title={t("contracts.list.completed")}
                  value={stats.completed}
                  change={
                    stats.completed > 0
                      ? Math.round((stats.completed / stats.total) * 100)
                      : 0
                  }
                  icon={
                    <FileCheck className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  }
                  color="text-emerald-500"
                  tooltip={t("contracts.list.completedTooltip")}
                />
                <StatCard
                  title={t("contracts.list.pendingReview")}
                  value={stats.pending}
                  change={
                    stats.pending > 0
                      ? Math.round((stats.pending / stats.total) * 100)
                      : 0
                  }
                  icon={
                    <Clock className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                  }
                  color="text-amber-500"
                  tooltip={t("contracts.list.pendingReviewTooltip")}
                />
              </div>
            )}
          </div>

          {/* Search and Filters Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("contracts.list.manageContracts")}
              description={t("contracts.list.manageContractsDescription")}
              isLoading={isLoading}
            />

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Search Bar */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t("contracts.list.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 border border-gray-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => handleSearch("")}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center space-x-2 bg-gray-100/50 dark:bg-slate-800/50 rounded-xl p-1">
                  <button
                    onClick={() => handleViewModeChange("grid")}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                      viewMode === "grid"
                        ? "bg-white dark:bg-slate-900 shadow-sm text-gray-900 dark:text-slate-100"
                        : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleViewModeChange("list")}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                      viewMode === "list"
                        ? "bg-white dark:bg-slate-900 shadow-sm text-gray-900 dark:text-slate-100"
                        : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold rounded-xl hover:shadow-md transition-all duration-300 border border-blue-200 dark:border-blue-800/80 dark:border-blue-800/80 hover:border-blue-300 flex items-center"
                >
                  <RefreshCw className="w-4 h-4 ml-2 mr-2" />
                  {t("contracts.list.refresh")}
                </button>
              </div>

              {/* Filter Pills */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {t("contracts.list.filterByStatus")}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("contracts.list.showingCount", {
                      showing: filteredContracts.length.toString(),
                      total: contracts.length.toString(),
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <FilterPill
                    label={t("contracts.list.allContracts")}
                    count={contracts.length}
                    isActive={activeFilter === "all"}
                    onClick={() => handleFilterChange("all")}
                    icon={<FileText className="w-4 h-4" />}
                  />
                  <FilterPill
                    label={t("contracts.list.active")}
                    count={stats.active}
                    isActive={activeFilter === "ACTIVE"}
                    onClick={() => handleFilterChange("ACTIVE")}
                    icon={<CheckCircle className="w-4 h-4" />}
                  />
                  <FilterPill
                    label={t("contracts.list.completed")}
                    count={stats.completed}
                    isActive={activeFilter === "COMPLETED"}
                    onClick={() => handleFilterChange("COMPLETED")}
                    icon={<FileCheck className="w-4 h-4" />}
                  />
                  <FilterPill
                    label={t("contracts.list.pending")}
                    count={stats.pending}
                    isActive={activeFilter === "PENDING"}
                    onClick={() => handleFilterChange("PENDING")}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <FilterPill
                    label={t("contracts.list.cancelled")}
                    count={stats.cancelled}
                    isActive={activeFilter === "CANCELLED"}
                    onClick={() => handleFilterChange("CANCELLED")}
                    icon={<XCircle className="w-4 h-4" />}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contracts Section */}
          <div className="mb-12">
            <SectionHeader
              title={t("contracts.list.yourContracts")}
              description={
                activeFilter === "all"
                  ? t("contracts.list.allContractsDescription")
                  : t("contracts.list.filteredContractsDescription", {
                      status: activeFilter,
                    })
              }
              actionText={t("contracts.list.createNewContract")}
              actionOnClick={() => router.push("/hub/projects")}
              isLoading={isLoading}
              badge={activeFilter !== "all" ? activeFilter : undefined}
            />

            {isLoading ? (
              viewMode === "grid" ? (
                <ContractGridSkeleton />
              ) : (
                <ContractListSkeleton />
              )
            ) : filteredContracts.length > 0 ? (
              <>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredContracts.map((contract) => (
                      <motion.div
                        key={contract.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <ContractCard
                          contract={contract}
                          onClick={() => handleContractClick(contract.id)}
                          variant="grid"
                        />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredContracts.map((contract) => (
                      <motion.div
                        key={contract.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <ContractCard
                          contract={contract}
                          onClick={() => handleContractClick(contract.id)}
                          variant="list"
                        />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Empty search/filter results message */}
                {filteredContracts.length === 0 && searchQuery && (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
                    <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                      {t("contracts.list.noContractsFound")}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                      {t("contracts.list.noContractsSearch", {
                        query: searchQuery,
                      })}
                    </p>
                    <button
                      onClick={() => handleSearch("")}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                    >
                      {t("contracts.list.clearSearch")}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/80">
                <FileText className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                  {contracts.length === 0
                    ? t("contracts.list.noContractsYet")
                    : t("contracts.list.noContractsMatchFilter")}
                </h3>
                <p className="text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  {contracts.length === 0
                    ? t("contracts.list.noContractsDescription")
                    : t("contracts.list.noFilteredContractsDescription", {
                        status: activeFilter,
                      })}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  {contracts.length === 0 ? (
                    <>
                      <Link
                        href="/hub/projects"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                      >
                        {t("contracts.list.browseProjects")}
                      </Link>
                      <Link
                        href="/hub/projects/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                      >
                        {t("contracts.list.createProject")}
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleFilterChange("all")}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                      >
                        {t("contracts.list.viewAllContracts")}
                      </button>
                      <Link
                        href="/hub/projects"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                      >
                        {t("contracts.list.findNewProjects")}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Contract Tips & Resources */}
          <div className="mb-12">
            <SectionHeader
              title={t("contracts.list.contractTipsTitle")}
              description={t("contracts.list.contractTipsDescription")}
              actionText={t("contracts.list.learnMore")}
              actionLink="/learn/paths/freelancing"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-6 border border-blue-200 dark:border-blue-800/80 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("contracts.list.clearDeliverables")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("contracts.list.clearDeliverablesDescription")}
                </p>
                <Link
                  href="/learn/courses/free-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-bold mt-4"
                >
                  {t("contracts.list.readGuide")}
                  <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Banknote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("contracts.list.paymentTerms")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("contracts.list.paymentTermsDescription")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm font-bold mt-4"
                >
                  {t("contracts.list.readGuide")}
                  <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>

              <div className="group bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80 hover:border-green-300 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100">
                    {t("contracts.list.disputeResolution")}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                  {t("contracts.list.disputeResolutionDescription")}
                </p>
                <Link
                  href="/learn/paths/free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center text-green-600 hover:text-green-700 text-sm font-bold mt-4"
                >
                  {t("contracts.list.readGuide")}
                  <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform duration-300" />
                </Link>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16"
          >
            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 md:p-12 text-white overflow-hidden">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]"></div>

              <div className="relative z-10 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  {t("contracts.list.needHelpTitle")}
                </h2>
                <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
                  {t("contracts.list.needHelpDescription")}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-2xl hover:shadow-3xl"
                  >
                    <div className="flex items-center justify-center">
                      {t("contracts.list.contactSupport")}
                      <HelpCircle className="w-5 h-5 ml-2 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                  </Link>
                  <Link
                    href="/learn/paths/freelancing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative px-8 py-3.5 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
                  >
                    <div className="flex items-center justify-center">
                      {t("contracts.list.learnMore")}
                      <ExternalLink className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
