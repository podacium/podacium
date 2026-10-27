"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useBidi } from "@/lib/i18n";

interface ProfileQRCodeModalProps {
  profileUrl: string;
  username: string;
  onClose: () => void;
}

export function ProfileQRCodeModal({
  profileUrl,
  username,
  onClose,
}: ProfileQRCodeModalProps) {
  const t = useTranslations("profile");
  const { dir } = useBidi();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(profileUrl, {
          width: 300,
          margin: 2,
          color: { dark: "#1e3a5f", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success(t("qrCode.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("qrCode.linkCopyFailed"));
    }
  };

  const handleShare = async () => {
    if ("share" in navigator) {
      await (navigator as any).share({
        title: `${username} on Podacium`,
        url: profileUrl,
      });
    } else {
      handleCopy();
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${username}-qr.png`;
    a.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          dir={dir}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {t("qrCode.share")}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>

          <div className="flex justify-center mb-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={t("qrCode.alt", { username })}
                className="w-60 h-60 rounded-xl border border-gray-100 dark:border-slate-800"
              />
            ) : (
              <div className="w-60 h-60 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-200 dark:border-blue-800/80 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mb-4">
            {t("qrCode.scanToView", { username })}
          </p>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-900/60 rounded-lg text-sm text-gray-600 dark:text-slate-400 truncate border border-gray-100 dark:border-slate-800">
              {profileUrl}
            </div>
            <button
              onClick={handleCopy}
              className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Share2 className="w-4 h-4 text-gray-600 dark:text-slate-400" />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t("qrCode.download")}
            </button>
            {"share" in navigator && (
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                {t("buttons.share")}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
