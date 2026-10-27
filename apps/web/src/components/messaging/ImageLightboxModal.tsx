"use client";

import React, { useEffect, useCallback } from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { resolveFileUrl } from "@/lib/utils";

interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl: string;
  imageAlt?: string;
  onClose: () => void;
}

export function ImageLightboxModal({
  isOpen,
  imageUrl,
  imageAlt,
  onClose,
}: ImageLightboxModalProps) {
  const t = useTranslations("messaging");
  const [zoom, setZoom] = React.useState(1);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Controls */}
      <div
        className="absolute top-4 end-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={t("attachments.zoomIn")}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={t("attachments.zoomOut")}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <a
          href={resolveFileUrl(imageUrl)}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={t("attachments.download")}
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={t("fileRejection.close")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image container */}
      <div
        className="relative max-w-5xl max-h-[85vh] overflow-hidden flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={resolveFileUrl(imageUrl)}
          alt={imageAlt || t("attachments.preview")}
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-transform duration-200 select-none"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

export default ImageLightboxModal;
