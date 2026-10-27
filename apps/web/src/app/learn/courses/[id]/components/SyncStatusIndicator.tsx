import React from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Database,
  RotateCw,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { SyncStatus } from "../types";

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSynced?: Date;
  pendingCount?: number;
  onForceSync?: () => void;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  lastSynced,
  pendingCount = 0,
  onForceSync,
}) => {
  const t = useTranslations();

  const statusConfig = {
    [SyncStatus.ONLINE]: {
      icon: Wifi,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200/50",
      glow: "shadow-emerald-500/20",
      text: t("course.sync.status.online"),
      pulse: false,
    },
    [SyncStatus.OFFLINE]: {
      icon: WifiOff,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200/50",
      glow: "shadow-amber-500/20",
      text: t("course.sync.status.offline"),
      pulse: false,
    },
    [SyncStatus.SYNCING]: {
      icon: RefreshCw,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200/50",
      glow: "shadow-blue-500/20",
      text: t("course.sync.status.syncing"),
      pulse: true,
    },
    [SyncStatus.ERROR]: {
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200/50",
      glow: "shadow-rose-500/20",
      text: t("course.sync.status.error"),
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`group inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.border} border shadow-sm ${config.glow} backdrop-blur-md transition-all duration-500 hover:shadow-md`}
    >
      <div className={`relative ${config.bg} ${config.color} p-1 rounded-full`}>
        <Icon className={`w-3.5 h-3.5 ${config.pulse ? "animate-spin" : ""}`} />
        {config.pulse && (
          <div className="absolute inset-0 animate-ping bg-blue-400 rounded-full opacity-40" />
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span
          className={`${config.color} font-bold text-[11px] uppercase tracking-wider`}
        >
          {config.text}
        </span>

        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 text-orange-600 text-[11px] font-black border-s border-gray-200 dark:border-slate-800 ps-2 ms-1">
            <Database className="w-3 h-3" />
            {pendingCount}
          </span>
        )}
      </div>

      {lastSynced && status === SyncStatus.ONLINE && pendingCount === 0 && (
        <span className="text-gray-400 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {t("course.sync.last")}:{" "}
          {lastSynced.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}

      {pendingCount > 0 && status === SyncStatus.ONLINE && onForceSync && (
        <button
          onClick={onForceSync}
          className="ms-2 p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/50 rounded-full transition-colors"
          title={t("course.actions.syncNow")}
        >
          <RotateCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
