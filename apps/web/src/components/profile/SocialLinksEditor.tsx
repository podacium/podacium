"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  X,
  Save,
  Loader2,
  ExternalLink,
  AlertCircle,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

const SOCIAL_PLATFORMS = [
  {
    id: "linkedin",
    name: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    color: "text-blue-600",
  },
  {
    id: "github",
    name: "GitHub",
    placeholder: "https://github.com/username",
    color: "text-gray-800 dark:text-slate-200",
  },
  {
    id: "twitter",
    name: "Twitter/X",
    placeholder: "https://twitter.com/username",
    color: "text-black",
  },
  {
    id: "facebook",
    name: "Facebook",
    placeholder: "https://facebook.com/username",
    color: "text-blue-600",
  },
  {
    id: "instagram",
    name: "Instagram",
    placeholder: "https://instagram.com/username",
    color: "text-pink-600",
  },
  {
    id: "youtube",
    name: "YouTube",
    placeholder: "https://youtube.com/c/username",
    color: "text-red-600",
  },
  {
    id: "behance",
    name: "Behance",
    placeholder: "https://behance.net/username",
    color: "text-blue-600",
  },
  {
    id: "dribbble",
    name: "Dribbble",
    placeholder: "https://dribbble.com/username",
    color: "text-pink-500",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    placeholder: "https://yourportfolio.com",
    color: "text-purple-600",
  },
  {
    id: "personalWebsite",
    name: "Personal Website",
    placeholder: "https://yourwebsite.com",
    color: "text-indigo-600",
  },
];

interface SocialLinksEditorProps {
  socialLinks: Record<string, string>;
  onChange: (links: Record<string, string>) => void;
  isEditing: boolean;
  maxLinks?: number;
}

export function SocialLinksEditor({
  socialLinks,
  onChange,
  isEditing,
  maxLinks = 10,
}: SocialLinksEditorProps) {
  const t = useTranslations("profile");
  const [newPlatform, setNewPlatform] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const safeLinks =
    socialLinks &&
    typeof socialLinks === "object" &&
    !Array.isArray(socialLinks)
      ? socialLinks
      : {};
  const entries = Object.entries(safeLinks);
  const hasLinks = entries.length > 0;

  const handleAdd = useCallback(() => {
    if (!newPlatform.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://"))
      url = "https://" + url;
    onChange({ ...safeLinks, [newPlatform.trim().toLowerCase()]: url });
    setNewPlatform("");
    setNewUrl("");
  }, [newPlatform, newUrl, safeLinks, onChange]);

  const handleRemove = useCallback(
    (platform: string) => {
      const next = { ...safeLinks };
      delete next[platform];
      onChange(next);
    },
    [safeLinks, onChange],
  );

  const handleUpdate = useCallback(
    (platform: string, url: string) => {
      onChange({ ...safeLinks, [platform]: url });
    },
    [safeLinks, onChange],
  );

  return (
    <div className="space-y-4">
      {hasLinks && (
        <div className="space-y-2">
          {entries.map(([platform, url]) => (
            <div
              key={platform}
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 hover:shadow-sm transition-shadow"
            >
              {isEditing ? (
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-28 capitalize flex-shrink-0">
                    {platform}
                  </span>
                  <input
                    type="url"
                    value={url as string}
                    onChange={(e) => handleUpdate(platform, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t("socialLinks.urlPlaceholder")}
                  />
                  <button
                    onClick={() => handleRemove(platform)}
                    type="button"
                    className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <a
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 flex-1 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                >
                  <span className="font-medium capitalize text-gray-900 dark:text-slate-100 block">
                    {platform}
                  </span>
                  <p className="text-gray-500 dark:text-slate-400 text-sm truncate flex-1">
                    {url as string}
                  </p>
                  <ExternalLink
                    size={16}
                    className="text-gray-400 group-hover:text-blue-500 dark:text-blue-400 flex-shrink-0"
                  />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="p-5 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800">
          <h4 className="font-semibold text-gray-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Plus size={18} />
            {t("buttons.addLink")}
            <span className="text-sm text-gray-500 dark:text-slate-400">
              ({entries.length}/{maxLinks})
            </span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {SOCIAL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setNewPlatform(p.id)}
                className={cn(
                  "p-2.5 rounded-lg border text-left transition-all text-sm",
                  newPlatform === p.id
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700",
                )}
              >
                <span className="font-medium truncate block">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("socialLinks.platformPlaceholder")}
            />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("socialLinks.urlPlaceholder")}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={
              !newPlatform.trim() ||
              !newUrl.trim() ||
              entries.length >= maxLinks
            }
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} /> {t("buttons.addLink")}
          </button>
        </div>
      )}

      {entries.length >= maxLinks && isEditing && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          {t("socialLinks.maxLinksWarning", { max: String(maxLinks) })}
        </div>
      )}

      {!hasLinks && !isEditing && (
        <div className="text-center py-10 text-gray-500 dark:text-slate-400 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
          <Share2 size={40} className="mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-semibold mb-1">
            {t("socialLinks.emptyTitle")}
          </h3>
          <p className="text-sm max-w-sm mx-auto">
            {t("socialLinks.emptyDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
