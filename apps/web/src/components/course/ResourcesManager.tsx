// components/course/ResourcesManager.tsx
"use client";

import React, { useState } from "react";
import {
  Download,
  Eye,
  File,
  FileText,
  FileVideo,
  FileCode,
  Image,
  Music,
  Video,
  Archive,
  ExternalLink,
  Copy,
  CheckCircle,
  Lock,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface ResourceFile {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: string;
  downloadable: boolean;
}

interface ResourcesManagerProps {
  resources: any[];
  canDownload: boolean;
  lessonId: string;
}

const ResourcesManager: React.FC<ResourcesManagerProps> = ({
  resources,
  canDownload,
  lessonId,
}) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const t = useTranslations();

  // Transform resources to ResourceFile format
  const resourceFiles: ResourceFile[] = resources.map((resource, index) => ({
    id: resource.id || `resource-${index}`,
    name: resource.name || `Resource ${index + 1}`,
    type: resource.type || "file",
    url: resource.url || "#",
    size: resource.size || 0,
    uploadedAt: resource.uploadedAt || new Date().toISOString(),
    downloadable: canDownload && resource.downloadable !== false,
  }));

  const getFileIcon = (type: string) => {
    if (type.includes("pdf"))
      return <FileText className="w-6 h-6 text-red-500 dark:text-red-400" />;
    if (type.includes("video"))
      return (
        <FileVideo className="w-6 h-6 text-purple-500 dark:text-purple-400" />
      );
    if (type.includes("image"))
      return <Image className="w-6 h-6 text-green-500" />;
    if (type.includes("audio"))
      return <Music className="w-6 h-6 text-amber-500 dark:text-amber-400" />;
    if (type.includes("zip") || type.includes("rar"))
      return <Archive className="w-6 h-6 text-gray-500 dark:text-slate-400" />;
    if (type.includes("code") || type.includes("text"))
      return <FileCode className="w-6 h-6 text-blue-500 dark:text-blue-400" />;
    return <File className="w-6 h-6 text-gray-500 dark:text-slate-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDownload = async (resource: ResourceFile) => {
    if (!resource.downloadable) return;

    setDownloading(resource.id);

    try {
      window.open(resource.url, "_blank");

      // Optional: simulate delay if needed
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloading(null);
    }
  };

  const handleCopyLink = async (resource: ResourceFile) => {
    try {
      await navigator.clipboard.writeText(resource.url);
      setCopied(resource.id);

      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  const handlePreview = (resource: ResourceFile) => {
    // In production, you'd open in a modal or new tab
    window.open(resource.url, "_blank");
  };

  if (resourceFiles.length === 0) {
    return (
      <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
        <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          {t("compcourse.resources.noResources")}
        </h3>
        <p className="text-gray-600 dark:text-slate-400">
          {t("compcourse.resources.noResourcesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-gray-900 dark:text-slate-100">
          {t("compcourse.resources.title")}
        </h4>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          {t("compcourse.resources.resourceCount", {
            count: resourceFiles.length.toString(),
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resourceFiles.map((resource) => (
          <div
            key={resource.id}
            className={`group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl border transition-all duration-300 overflow-hidden ${
              resource.downloadable
                ? "border-gray-200 dark:border-slate-800 hover:border-blue-200 hover:shadow-lg"
                : "border-gray-200 dark:border-slate-800 opacity-75"
            }`}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getFileIcon(resource.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                    {resource.name}
                  </h5>
                  <div className="flex items-center text-sm text-gray-500 dark:text-slate-400 mt-1">
                    <span>{formatFileSize(resource.size)}</span>
                    <span className="mx-2">•</span>
                    <span>{formatDate(resource.uploadedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePreview(resource)}
                    className="p-2 text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                    title={t("compcourse.resources.preview")}
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCopyLink(resource)}
                    className="p-2 text-gray-600 dark:text-slate-400 hover:text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:bg-purple-950/60 rounded-lg transition-colors"
                    title={t("compcourse.resources.copyLink")}
                  >
                    {copied === resource.id ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {resource.downloadable ? (
                  <button
                    onClick={() => handleDownload(resource)}
                    disabled={downloading === resource.id}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      downloading === resource.id
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-blue-600 hover:from-blue-100 hover:to-indigo-100"
                    }`}
                  >
                    {downloading === resource.id ? (
                      <div className="flex items-center">
                        <div className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mr-1.5"></div>
                        {t("compcourse.resources.downloading")}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Download className="w-3 h-3 mr-1.5" />
                        {t("compcourse.resources.download")}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-lg text-sm font-semibold">
                    <Lock className="w-3 h-3 mr-1.5" />
                    {t("compcourse.resources.locked")}
                  </div>
                )}
              </div>
            </div>

            {/* Hover effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {canDownload && resourceFiles.some((r) => r.downloadable) && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-blue-200 dark:border-blue-800/80">
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">
              {t("compcourse.resources.downloadAll")}
            </h5>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t("compcourse.resources.downloadAllDescription")}
            </p>
          </div>
          <button
            onClick={() => {
              // In production, you'd create a zip file or provide bulk download
              resourceFiles
                .filter((r) => r.downloadable)
                .forEach(handleDownload);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
          >
            <Download className="w-4 h-4 mr-2 inline" />
            {t("compcourse.resources.downloadAll")}
          </button>
        </div>
      )}

      {/* Usage guidelines */}
      <div className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
        <h5 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
          {t("compcourse.resources.usageGuidelines")}
        </h5>
        <ul className="text-sm text-gray-600 dark:text-slate-400 space-y-1">
          {(
            t("compcourse.resources.guidelines", {
              returnObjects: "true",
            }) as unknown as string[]
          ).map((guideline: string, index: number) => (
            <li key={index}>• {guideline}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ResourcesManager;
