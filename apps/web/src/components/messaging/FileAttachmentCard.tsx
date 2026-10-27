"use client";

import React, { useCallback } from "react";
import {
  FileText,
  Table,
  FileCode2,
  Archive,
  Film,
  Music,
  File,
  Download,
  Eye,
  Presentation,
  Palette,
  ShieldAlert,
  Image as ImageIcon,
} from "lucide-react";
import { MessageAttachment } from "./types";
import { cn, resolveFileUrl } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

export { resolveFileUrl };

interface FileAttachmentCardProps {
  attachment: MessageAttachment;
  isOwn?: boolean;
  onPreview: (attachment: MessageAttachment) => void;
  className?: string;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export type FileCategory =
  | "pdf"
  | "sheet"
  | "document"
  | "presentation"
  | "code"
  | "archive"
  | "video"
  | "audio"
  | "image"
  | "design"
  | "binary"
  | "other";

export function getFileCategory(
  fileName: string,
  mimeType: string = "",
): FileCategory {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mime = mimeType.toLowerCase();

  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (
    ["xlsx", "xls", "csv", "tsv", "ods"].includes(ext) ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  )
    return "sheet";
  if (
    ["pptx", "ppt", "key", "odp"].includes(ext) ||
    mime.includes("presentation") ||
    mime.includes("powerpoint")
  )
    return "presentation";
  if (
    ["psd", "ai", "eps", "sketch", "fig", "xd"].includes(ext) ||
    mime.includes("photoshop") ||
    mime.includes("illustrator") ||
    mime.includes("postscript")
  )
    return "design";
  if (
    [
      "exe",
      "dmg",
      "apk",
      "deb",
      "iso",
      "bin",
      "msi",
      "appimage",
      "pkg",
    ].includes(ext)
  )
    return "binary";
  if (
    [
      "txt",
      "md",
      "markdown",
      "log",
      "env",
      "ini",
      "conf",
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "json",
      "sql",
      "html",
      "css",
      "sh",
      "yaml",
      "yml",
      "prisma",
      "xml",
    ].includes(ext) ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("python") ||
    mime.includes("markdown") ||
    mime.startsWith("text/")
  )
    return "code";
  if (
    ["doc", "docx", "odt", "rtf"].includes(ext) ||
    mime.includes("word") ||
    (mime.includes("document") && !mime.includes("presentation"))
  )
    return "document";
  if (
    ["zip", "rar", "tar", "gz", "7z", "bz2", "xz", "tgz"].includes(ext) ||
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("compressed") ||
    mime.includes("archive")
  )
    return "archive";
  if (
    ["mp4", "webm", "mov", "avi", "mkv", "flv", "m4v"].includes(ext) ||
    mime.startsWith("video/")
  )
    return "video";
  if (
    ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma", "aiff"].includes(ext) ||
    mime.startsWith("audio/")
  )
    return "audio";
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "ico"].includes(
      ext,
    ) ||
    mime.startsWith("image/") ||
    mime.includes("svg")
  )
    return "image";

  return "other";
}

export function FileAttachmentCard({
  attachment,
  isOwn = false,
  onPreview,
  className,
}: FileAttachmentCardProps) {
  const t = useTranslations("messaging");
  const category = getFileCategory(attachment.fileName, attachment.fileType);

  const getCategoryConfig = () => {
    switch (category) {
      case "pdf":
        return {
          icon: FileText,
          label: t("attachments.pdf"),
          badgeBg: isOwn
            ? "bg-rose-500/20 text-rose-100 border-rose-400/30"
            : "bg-rose-500/10 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
          iconBg: isOwn ? "bg-rose-500 text-white" : "bg-rose-600 text-white",
        };
      case "sheet":
        return {
          icon: Table,
          label: t("attachments.sheet"),
          badgeBg: isOwn
            ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/30"
            : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
          iconBg: isOwn
            ? "bg-emerald-500 text-white"
            : "bg-emerald-600 text-white",
        };
      case "presentation":
        return {
          icon: Presentation,
          label: t("attachments.presentation"),
          badgeBg: isOwn
            ? "bg-amber-500/20 text-amber-100 border-amber-400/30"
            : "bg-amber-500/10 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
          iconBg: isOwn ? "bg-amber-500 text-white" : "bg-amber-600 text-white",
        };
      case "code":
        return {
          icon: FileCode2,
          label: t("attachments.code"),
          badgeBg: isOwn
            ? "bg-indigo-500/20 text-indigo-100 border-indigo-400/30"
            : "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50",
          iconBg: isOwn
            ? "bg-indigo-500 text-white"
            : "bg-indigo-600 text-white",
        };
      case "design":
        return {
          icon: Palette,
          label: t("attachments.design"),
          badgeBg: isOwn
            ? "bg-pink-500/20 text-pink-100 border-pink-400/30"
            : "bg-pink-500/10 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400 border-pink-200 dark:border-pink-900/50",
          iconBg: isOwn ? "bg-pink-500 text-white" : "bg-pink-600 text-white",
        };
      case "binary":
        return {
          icon: ShieldAlert,
          label: t("attachments.binary"),
          badgeBg: isOwn
            ? "bg-amber-500/20 text-amber-100 border-amber-400/30"
            : "bg-amber-500/10 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
          iconBg: isOwn ? "bg-amber-500 text-white" : "bg-amber-600 text-white",
        };
      case "archive":
        return {
          icon: Archive,
          label: t("attachments.archive"),
          badgeBg: isOwn
            ? "bg-teal-500/20 text-teal-100 border-teal-400/30"
            : "bg-teal-500/10 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 border-teal-200 dark:border-teal-900/50",
          iconBg: isOwn ? "bg-teal-500 text-white" : "bg-teal-600 text-white",
        };
      case "video":
        return {
          icon: Film,
          label: t("attachments.video"),
          badgeBg: isOwn
            ? "bg-purple-500/20 text-purple-100 border-purple-400/30"
            : "bg-purple-500/10 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
          iconBg: isOwn
            ? "bg-purple-500 text-white"
            : "bg-purple-600 text-white",
        };
      case "audio":
        return {
          icon: Music,
          label: t("attachments.audio"),
          badgeBg: isOwn
            ? "bg-violet-500/20 text-violet-100 border-violet-400/30"
            : "bg-violet-500/10 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-900/50",
          iconBg: isOwn
            ? "bg-violet-500 text-white"
            : "bg-violet-600 text-white",
        };
      case "image":
        return {
          icon: ImageIcon,
          label: t("attachments.image"),
          badgeBg: isOwn
            ? "bg-sky-500/20 text-sky-100 border-sky-400/30"
            : "bg-sky-500/10 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-900/50",
          iconBg: isOwn ? "bg-sky-500 text-white" : "bg-sky-600 text-white",
        };
      case "document":
        return {
          icon: FileText,
          label: t("attachments.document"),
          badgeBg: isOwn
            ? "bg-blue-500/20 text-blue-100 border-blue-400/30"
            : "bg-blue-500/10 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
          iconBg: isOwn ? "bg-blue-500 text-white" : "bg-blue-600 text-white",
        };
      default:
        return {
          icon: File,
          label: t("attachments.other"),
          badgeBg: isOwn
            ? "bg-slate-500/20 text-slate-100 border-slate-400/30"
            : "bg-slate-500/10 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
          iconBg: isOwn ? "bg-slate-500 text-white" : "bg-slate-600 text-white",
        };
    }
  };

  const config = getCategoryConfig();
  const IconComponent = config.icon;

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = resolveFileUrl(attachment.fileUrl);
      link.download = attachment.fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [attachment.fileUrl, attachment.fileName],
  );

  return (
    <div
      onClick={() => onPreview(attachment)}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none",
        isOwn
          ? "bg-white/10 hover:bg-white/15 border-white/20 text-white"
          : "bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 shadow-xs hover:shadow-md",
        className,
      )}
      title={`${t("attachments.preview")} ${attachment.fileName}`}
    >
      {/* File Icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs transition-transform group-hover:scale-105",
          config.iconBg,
        )}
      >
        <IconComponent className="w-5 h-5" />
      </div>

      {/* File Metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <bdi
            dir="auto"
            className="text-xs sm:text-sm font-semibold truncate block leading-snug"
          >
            {attachment.fileName}
          </bdi>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <bdi
            dir="ltr"
            className={cn(
              "text-[11px] font-mono",
              isOwn ? "text-blue-100" : "text-slate-500 dark:text-slate-400",
            )}
          >
            {formatFileSize(attachment.fileSize)}
          </bdi>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-md font-medium border",
              config.badgeBg,
            )}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 flex-shrink-0 ms-1">
        {/* Preview Indicator Icon */}
        <div
          className={cn(
            "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
            isOwn
              ? "text-blue-100 hover:bg-white/20"
              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700",
          )}
          title={t("attachments.preview")}
        >
          <Eye className="w-4 h-4" />
        </div>

        {/* Direct Download Button */}
        <button
          type="button"
          onClick={handleDownload}
          aria-label={t("attachments.download")}
          className={cn(
            "p-2 rounded-xl transition-all cursor-pointer hover:scale-110",
            isOwn
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-slate-100 dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400",
          )}
          title={t("attachments.download")}
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default FileAttachmentCard;
