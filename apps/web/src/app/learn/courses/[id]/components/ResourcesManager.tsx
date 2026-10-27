"use client";

import React, { useMemo } from "react";
import {
  FileText,
  Download,
  Lock,
  CheckCircle,
  File,
  Image,
  Film,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Music,
  BookOpen,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import { LessonResponse } from "../types";
import { useTranslations } from "@/lib/i18n";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size?: string;
  url?: string;
  mimeType?: string;
}

interface ResourcesManagerProps {
  activeLesson: LessonResponse | null;
  isRtl: boolean;
}

export const ResourcesManager: React.FC<ResourcesManagerProps> = ({
  activeLesson,
  isRtl,
}) => {
  const t = useTranslations();

  // Hooks must run before the early return below.
  const resources = useMemo(() => {
    const attachments = activeLesson?.attachments;
    if (attachments && attachments.length > 0) {
      return attachments.map((att: any, idx: number): Attachment => ({
        id: att.id || String(idx),
        name: att.name || att.filename || t("course.resources.defaultName"),
        type: att.type || att.mimeType || t("course.resources.defaultType"),
        size: att.size
          ? formatFileSize(att.size)
          : att.fileSize
            ? formatFileSize(att.fileSize)
            : "",
        url: att.url || att.downloadUrl || att.path,
        mimeType: att.mimeType || att.type,
      }));
    }
    return [];
  }, [activeLesson?.attachments, t]);

  if (!activeLesson) return null;

  // Get appropriate icon based on file type
  const getFileIcon = (mimeType?: string, type?: string) => {
    const fileType = (mimeType || type || "").toLowerCase();

    if (fileType.includes("pdf"))
      return <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />;
    if (
      fileType.includes("image") ||
      fileType.includes("jpg") ||
      fileType.includes("png") ||
      fileType.includes("gif")
    )
      return <Image className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    if (
      fileType.includes("video") ||
      fileType.includes("mp4") ||
      fileType.includes("mov")
    )
      return <Film className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
    if (
      fileType.includes("audio") ||
      fileType.includes("mp3") ||
      fileType.includes("wav")
    )
      return <Music className="w-5 h-5 text-pink-500" />;
    if (
      fileType.includes("code") ||
      fileType.includes("javascript") ||
      fileType.includes("typescript") ||
      fileType.includes("html") ||
      fileType.includes("css")
    )
      return <FileCode className="w-5 h-5 text-yellow-500" />;
    if (
      fileType.includes("spreadsheet") ||
      fileType.includes("excel") ||
      fileType.includes("csv")
    )
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    if (
      fileType.includes("zip") ||
      fileType.includes("archive") ||
      fileType.includes("rar") ||
      fileType.includes("7z")
    )
      return <FileArchive className="w-5 h-5 text-orange-500" />;
    if (
      fileType.includes("doc") ||
      fileType.includes("word") ||
      fileType.includes("text")
    )
      return <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
    if (fileType.includes("epub") || fileType.includes("book"))
      return (
        <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
      );
    if (fileType.includes("link") || fileType.includes("url"))
      return <LinkIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;

    return <File className="w-5 h-5 text-gray-500 dark:text-slate-400" />;
  };

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return `0 ${t("course.resources.size.bytes")}`;
    const k = 1024;
    const sizes = [
      t("course.resources.size.bytes"),
      t("course.resources.size.kb"),
      t("course.resources.size.mb"),
      t("course.resources.size.gb"),
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Handle resource click - open in new tab
  const handleResourceClick = (resource: Attachment) => {
    if (resource.url) {
      // Open in new tab
      window.open(resource.url, "_blank", "noopener,noreferrer");
    }
  };

  // Handle download
  const handleDownload = (e: React.MouseEvent, resource: Attachment) => {
    e.stopPropagation();
    if (resource.url) {
      // Create a temporary anchor element for download
      const link = document.createElement("a");
      link.href = resource.url;
      link.download = resource.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const hasResources = resources.length > 0;

  return (
    <div className="space-y-6">
      {/* Resources List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {t("course.resources.title")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t("course.resources.subtitle")}
            </p>
          </div>
          {hasResources && (
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-50">
          {hasResources ? (
            resources.map((item) => (
              <div
                key={item.id}
                onClick={() => handleResourceClick(item)}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleResourceClick(item)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-sm transition-all">
                    {getFileIcon(item.mimeType, item.type)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {item.type} {item.size && `• ${item.size}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.url && (
                    <>
                      <button
                        onClick={(e) => handleDownload(e, item)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-all"
                        title={t("course.resources.download")}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResourceClick(item);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-all"
                        title={t("course.resources.open")}
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <File className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400 italic">
                {t("course.states.noData")}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {t("course.resources.noResources")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related Resources Section */}
      {activeLesson.relatedResources &&
        activeLesson.relatedResources.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {t("course.resources.related")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("course.resources.relatedSubtitle")}
              </p>
            </div>

            <div className="divide-y divide-gray-50">
              {(activeLesson.relatedResources || []).map(
                (resource: any, idx: number) => (
                  <a
                    key={idx}
                    href={resource.url || resource.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/60 transition-colors">
                        <LinkIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-slate-100">
                          {resource.title || resource.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {resource.description || resource.type}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 dark:text-indigo-400 transition-colors" />
                  </a>
                ),
              )}
            </div>
          </div>
        )}

      {/* Pro Member Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wider">
              {t("course.resources.accessGranted")}
            </span>
          </div>
          <h3 className="text-2xl font-bold mb-2">
            {t("course.resources.proTitle")}
          </h3>
          <p className="text-indigo-100 text-sm mb-4 max-w-md">
            {t("course.resources.proDescription")}
          </p>
          <button
            onClick={() => window.open("/learn", "_blank")}
            className="px-6 py-2 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:shadow-lg hover:shadow-white/10 transition-all"
          >
            {t("course.resources.seeAllLibrary")}
          </button>
        </div>
        {/* Background Decor */}
        <div className="absolute top-0 end-0 -me-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 start-0 -ms-8 -mb-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
      </div>

      {/* Usage Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/60 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/50 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm">
            {t("course.resources.usageNotice")}
          </h4>
          <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
            {t("course.resources.usageDescription")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResourcesManager;
