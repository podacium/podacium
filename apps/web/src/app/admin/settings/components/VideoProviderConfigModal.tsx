"use client";

import React, { useState } from "react";
import { X, Eye, EyeOff, Lock, Check } from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useTranslations } from "@/lib/i18n";

interface VideoProviderConfigModalProps {
  providerId: string;
  onClose: () => void;
}

export const VideoProviderConfigModal: React.FC<
  VideoProviderConfigModalProps
> = ({ providerId, onClose }) => {
  const t = useTranslations("admin");
  const [apiKey, setApiKey] = useState<string>("••••••••3a9b");
  const [libraryId, setLibraryId] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const toggleShowKey = () => {
    setShowKey((prev) => {
      const next = !prev;
      if (next) {
        // Auto-remask secret key after 10 seconds for security
        setTimeout(() => setShowKey(false), 10000);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (providerId === "bunny") {
        payload["video.bunny.api_key"] = apiKey;
        payload["video.bunny.library_id"] = libraryId;
      } else if (providerId === "cloudflare") {
        payload["video.cloudflare.api_token"] = apiKey;
        payload["video.cloudflare.account_id"] = libraryId;
      } else if (providerId === "aws") {
        payload["video.aws.access_key_id"] = libraryId;
        payload["video.aws.secret_access_key"] = apiKey;
      }

      await fetch("/api/v1/admin/settings/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onClose();
    } catch (e) {
      console.error("Failed to save provider config", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <Lock className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-slate-100 capitalize">
            {t("settings.video.modal.title", { provider: providerId })}
          </h3>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("settings.video.modal.accountId")}
            </label>
            <input
              type="text"
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              placeholder={t("settings.video.modal.accountIdPlaceholder")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("settings.video.modal.secretKey")}
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
              <button
                type="button"
                onClick={toggleShowKey}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <PodaciumButton
            variant="outline"
            onClick={onClose}
            className="text-xs"
          >
            {t("settings.video.modal.cancel")}
          </PodaciumButton>
          <PodaciumButton
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-4 py-2 rounded-xl"
          >
            {saving
              ? t("settings.video.modal.saving")
              : t("settings.video.modal.save")}
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
};
