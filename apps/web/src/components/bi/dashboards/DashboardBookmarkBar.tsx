"use client";

import React, { useState } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Bookmark, Plus, Star, Share2, Check, Trash2, X } from "lucide-react";

export interface BookmarkItem {
  id: number;
  name: string;
  description?: string;
  is_shared: boolean;
  is_default: boolean;
  filter_state: Record<string, any>;
  layout_state?: Record<string, any>;
}

interface DashboardBookmarkBarProps {
  bookmarks: BookmarkItem[];
  activeBookmarkId?: number | null;
  onSelectBookmark: (bookmark: BookmarkItem) => void;
  onSaveBookmark: (
    name: string,
    isShared: boolean,
    isDefault: boolean,
  ) => Promise<void>;
  onDeleteBookmark: (bookmarkId: number) => Promise<void>;
}

export function DashboardBookmarkBar({
  bookmarks,
  activeBookmarkId,
  onSelectBookmark,
  onSaveBookmark,
  onDeleteBookmark,
}: DashboardBookmarkBarProps) {
  const t = useTranslations("bi");
  const { isRTL } = useBidi();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSaveBookmark(name.trim(), isShared, isDefault);
      setName("");
      setIsShared(false);
      setIsDefault(false);
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-1 scrollbar-none text-xs">
      <div className="flex items-center gap-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px] shrink-0 mr-1">
        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
        <span>{t("bookmarks.views", { defaultValue: "Views" })}</span>
      </div>

      {bookmarks.map((bm) => {
        const isActive = activeBookmarkId === bm.id;
        return (
          <div
            key={bm.id}
            className={cn(
              "group inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all shrink-0 cursor-pointer text-xs font-medium",
              isActive
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm"
                : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100",
            )}
            onClick={() => onSelectBookmark(bm)}
          >
            {bm.is_default && (
              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            )}
            {bm.is_shared && (
              <Share2 className="w-3 h-3 text-indigo-400 shrink-0" />
            )}
            <span>{bm.name}</span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBookmark(bm.id);
              }}
              className="opacity-0 group-hover:opacity-100 ml-1 hover:text-rose-400 transition-opacity"
              title={t("bookmarks.deletePreset", {
                defaultValue: "Delete view preset",
              })}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => setShowAddModal(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors shrink-0 font-medium"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>
          {t("bookmarks.saveCurrentView", {
            defaultValue: "Save Current View",
          })}
        </span>
      </button>

      {/* Save Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-semibold text-sm">
                {t("bookmarks.savePresetModalTitle", {
                  defaultValue: "Save Bookmark Preset",
                })}
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("bookmarks.presetName", { defaultValue: "Preset Name" })}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("bookmarks.presetPlaceholder", {
                    defaultValue: "e.g. Q3 Sales & Executive View",
                  })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>
                    {t("bookmarks.shareOrg", {
                      defaultValue: "Share with organization team members",
                    })}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
                  />
                  <span>
                    {t("bookmarks.setDefault", {
                      defaultValue: "Set as my default dashboard view",
                    })}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs"
                >
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-xs"
                >
                  {t("bookmarks.savePreset", { defaultValue: "Save Preset" })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
