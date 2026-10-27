"use client";
import React, { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "@/lib/i18n";
import { api } from "@/lib/api";

import { PodaciumButton } from "@/components/design-system/PodaciumButton";

interface ShareButtonProps {
  datasetId?: string;
  type?: "health" | "dataset" | "dashboard";
  title?: string;
  className?: string;
}

export function ShareButton({
  datasetId,
  type = "health",
  title,
  className = "",
}: ShareButtonProps) {
  const { t } = useTranslations("bi");
  const locale = useLocale();
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    try {
      // 1. Generate text using backend WhatsApp digest service
      const res = await api.post<{ text: string; share_url: string }>(
        `/api/bi/analytics/share/whatsapp?type=${type}&locale=${locale}${datasetId ? `&dataset_id=${datasetId}` : ""}`,
      );

      const shareText = res.text || t("share.defaultText");
      const shareUrl = res.share_url || window.location.href;

      // 2. Try native share if available (Mobile first)
      if (navigator.share) {
        try {
          await navigator.share({
            title: title || t("share.defaultText"),
            text: shareText,
            url: shareUrl,
          });
          showSuccess();
          return;
        } catch (err: any) {
          if (err.name !== "AbortError") {
            console.error("Native share failed", err);
            // Fall back to clipboard
          } else {
            // User cancelled
            return;
          }
        }
      }

      // 3. Fallback: Copy to clipboard
      const fullText = `${shareText}\n\n${shareUrl}`;
      await navigator.clipboard.writeText(fullText);
      toast.success(t("share.copied"));
      showSuccess();
    } catch (e) {
      console.error("Share failed", e);
      toast.error(t("share.error"));
    } finally {
      setSharing(false);
    }
  };

  const showSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <PodaciumButton
      variant="craft"
      onClick={handleShare}
      disabled={sharing}
      loading={sharing}
      className={className}
      icon={
        success ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Share2 className="w-4 h-4" />
        )
      }
    >
      {success
        ? t("share.done")
        : sharing
          ? t("share.preparing")
          : t("share.button")}
    </PodaciumButton>
  );
}
