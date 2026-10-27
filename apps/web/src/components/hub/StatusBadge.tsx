// /components/hub/StatusBadge.tsx - INTERNATIONALIZED
"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  AlertCircle,
  Briefcase,
  Award,
  Loader2,
  FileText,
  UserCheck,
} from "lucide-react";
import { ProjectStatus, ProposalStatus, ContractStatus } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface StatusBadgeProps {
  status: ProjectStatus | ProposalStatus | ContractStatus | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "md",
  showIcon = true,
  showText = true,
  className = "",
}) => {
  const { t } = useTranslations("component");

  const getStatusConfig = (status: string) => {
    const baseConfig = {
      color:
        "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-800",
      icon: AlertCircle,
      text: status,
    };

    switch (status) {
      // Project Status
      case ProjectStatus.OPEN:
      case "OPEN":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: Clock,
          text: t("comphub.statusBadge.project.open"),
        };
      case ProjectStatus.IN_PROGRESS:
      case "IN_PROGRESS":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Play,
          text: t("comphub.statusBadge.project.inProgress"),
        };
      case ProjectStatus.COMPLETED:
      case "COMPLETED":
        return {
          color: "bg-purple-100 text-purple-800 border-purple-200",
          icon: CheckCircle,
          text: t("comphub.statusBadge.project.completed"),
        };
      case ProjectStatus.CANCELLED:
      case "CANCELLED":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: XCircle,
          text: t("comphub.statusBadge.project.cancelled"),
        };
      // Proposal Status
      case ProposalStatus.PENDING:
      case "PENDING":
        return {
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          icon: FileText,
          text: t("comphub.statusBadge.proposal.pending"),
        };
      case ProposalStatus.ACCEPTED:
      case "ACCEPTED":
        return {
          color: "bg-green-100 text-green-800 border-green-200",
          icon: UserCheck,
          text: t("comphub.statusBadge.proposal.accepted"),
        };
      case ProposalStatus.REJECTED:
      case "REJECTED":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: XCircle,
          text: t("comphub.statusBadge.proposal.rejected"),
        };
      // Contract Status
      case ContractStatus.ACTIVE:
      case "ACTIVE":
        return {
          color: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Briefcase,
          text: t("comphub.statusBadge.contract.active"),
        };
      case ContractStatus.COMPLETED:
      case "COMPLETED":
        return {
          color: "bg-purple-100 text-purple-800 border-purple-200",
          icon: Award,
          text: t("comphub.statusBadge.contract.completed"),
        };
      case ContractStatus.CANCELLED:
      case "CANCELLED":
        return {
          color: "bg-red-100 text-red-800 border-red-200",
          icon: XCircle,
          text: t("comphub.statusBadge.contract.cancelled"),
        };
      default:
        return baseConfig;
    }
  };

  const config = getStatusConfig(status as string);

  const Icon = config.icon;
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center ${sizeClasses[size]} rounded-lg font-medium border ${config.color} ${className}`}
    >
      {showIcon && <Icon className={`${iconSize[size]} mr-2`} />}
      {showText && config.text}
    </motion.span>
  );
};
