"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  X,
  FileQuestion,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import { cn } from "@/lib/utils";

export interface RejectedFile {
  id: string;
  filename: string;
  size?: number;
  reasonCode:
    | "file_too_large"
    | "executable_blocked"
    | "polyglot_detected"
    | "dangerous_extension"
    | "zip_bomb"
    | "unsupported_format"
    | "upload_failed"
    | string;
  customMessage?: string;
  maxSize?: string;
}

export interface FileRejectionNoticeProps {
  rejections: RejectedFile[];
  onDismiss: (id?: string) => void;
  onSelectAnother?: () => void;
  className?: string;
  compact?: boolean;
}

export const FileRejectionNotice: React.FC<FileRejectionNoticeProps> = ({
  rejections,
  onDismiss,
  onSelectAnother,
  className,
  compact = false,
}) => {
  const t = useTranslations("messaging");
  const { isRTL } = useBidi();
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!rejections || rejections.length === 0) {
    return null;
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  const getReasonDetails = (rejection: RejectedFile) => {
    switch (rejection.reasonCode) {
      case "executable_blocked":
        return {
          title: t("fileRejection.fileBlocked"),
          description: t("fileRejection.executableDesc"),
          icon: ShieldAlert,
          badgeColor:
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "polyglot_detected":
        return {
          title: t("fileRejection.fileBlocked"),
          description: t("fileRejection.polyglotDesc"),
          icon: ShieldAlert,
          badgeColor:
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "dangerous_extension":
        return {
          title: t("fileRejection.fileBlocked"),
          description: t("fileRejection.extensionDesc"),
          icon: ShieldAlert,
          badgeColor:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "zip_bomb":
        return {
          title: t("fileRejection.fileBlocked"),
          description: t("fileRejection.zipBombDesc"),
          icon: ShieldAlert,
          badgeColor:
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        };
      case "file_too_large":
        return {
          title: t("fileRejection.sizeExceeded"),
          description: t("fileRejection.sizeDesc", {
            size: formatFileSize(rejection.size),
            maxSize: rejection.maxSize || "10 MB",
          }),
          icon: AlertTriangle,
          badgeColor:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "unsupported_format":
        return {
          title: t("fileRejection.formatUnsupported"),
          description: t("fileRejection.unsupportedDesc"),
          icon: FileQuestion,
          badgeColor:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "upload_failed":
      default:
        return {
          title: t("fileRejection.uploadFailed"),
          description:
            rejection.customMessage || t("fileRejection.generalDesc"),
          icon: AlertTriangle,
          badgeColor:
            "bg-destructive/10 text-destructive border-destructive/20",
        };
    }
  };

  const isMultiple = rejections.length > 1;
  const firstRejection = rejections[0];
  const firstDetails = getReasonDetails(firstRejection);
  const IconComponent = firstDetails.icon;

  return (
    <>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          "relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200",
          "bg-destructive/5 dark:bg-destructive/10 border-destructive/20 dark:border-destructive/30",
          "shadow-sm animate-in fade-in slide-in-from-bottom-2",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              firstDetails.badgeColor,
            )}
          >
            <IconComponent className="h-5 w-5" aria-hidden="true" />
          </div>

          {/* Main Error Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-destructive dark:text-rose-400">
                {isMultiple
                  ? t("fileRejection.multipleTitle", {
                      count: rejections.length,
                    })
                  : firstDetails.title}
              </h4>
              <button
                type="button"
                onClick={() => onDismiss()}
                aria-label={t("fileRejection.dismiss")}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* File specific breakdown */}
            <div className="mt-1 space-y-2">
              {rejections
                .slice(0, expanded ? rejections.length : 2)
                .map((rej) => {
                  const rejDetails = getReasonDetails(rej);
                  return (
                    <div
                      key={rej.id}
                      className="flex flex-col gap-0.5 text-xs text-foreground/80 dark:text-foreground/90"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <bdi
                          dir="ltr"
                          className="font-medium text-foreground underline decoration-destructive/30 underline-offset-2"
                        >
                          {rej.filename}
                        </bdi>
                        {rej.size ? (
                          <span className="text-muted-foreground">
                            (<bdi dir="ltr">{formatFileSize(rej.size)}</bdi>)
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {rejDetails.description}
                      </p>
                    </div>
                  );
                })}

              {rejections.length > 2 && !expanded && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t("fileRejection.moreFiles", {
                    count: rejections.length - 2,
                  })}
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}

              {expanded && rejections.length > 2 && (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {t("fileRejection.showLess")}
                  <ChevronUp className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Remediation & Help Actions */}
            {!compact && (
              <div className="mt-3 flex items-center gap-2 flex-wrap pt-1 border-t border-destructive/10 dark:border-destructive/20">
                {onSelectAnother && (
                  <PodaciumButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onSelectAnother}
                    className="h-8 text-xs font-medium border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {t("fileRejection.selectAnother")}
                  </PodaciumButton>
                )}
                <button
                  type="button"
                  onClick={() => setShowGuidelines(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {t("fileRejection.viewGuidelines")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Guidelines Modal / Sheet */}
      <PodaciumModal
        isOpen={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        title={t("fileRejection.guidelinesTitle")}
        size="md"
      >
        <div className="space-y-4 text-sm text-foreground/90 p-1">
          <p className="leading-relaxed text-muted-foreground">
            {t("fileRejection.guidelinesDesc")}
          </p>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-2">
            <h5 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              {t("fileRejection.allowedFormats")}
            </h5>
            <ul className="text-xs space-y-1 text-foreground/80 list-disc list-inside">
              <li>
                <span className="font-medium">
                  {t("fileRejection.documents")}
                </span>{" "}
                {t("fileRejection.documentsFormats")}
              </li>
              <li>
                <span className="font-medium">
                  {t("fileRejection.dataSheets")}
                </span>{" "}
                {t("fileRejection.dataSheetsFormats")}
              </li>
              <li>
                <span className="font-medium">
                  {t("fileRejection.imagesVisuals")}
                </span>{" "}
                {t("fileRejection.imagesVisualsFormats")}
              </li>
              <li>
                <span className="font-medium">
                  {t("fileRejection.mediaAudio")}
                </span>{" "}
                {t("fileRejection.mediaAudioFormats")}
              </li>
              <li>
                <span className="font-medium">
                  {t("fileRejection.archives")}
                </span>{" "}
                {t("fileRejection.archivesFormats")}
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
            <span className="font-semibold">
              {t("fileRejection.strictlyProhibited")}
            </span>
            <p>{t("fileRejection.strictlyProhibitedDesc")}</p>
          </div>

          <div className="flex justify-end pt-2">
            <PodaciumButton
              variant="primary"
              size="sm"
              onClick={() => setShowGuidelines(false)}
            >
              {t("fileRejection.close")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>
    </>
  );
};
