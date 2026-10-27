"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  MapPin,
  CheckCircle2,
  Trash2,
  FileText,
  MessageSquare,
  HelpCircle,
  Eye,
  EyeOff,
  Send,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumButton,
  PodaciumBadge,
} from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

export interface ReviewPin {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  page?: number;
  authorName: string;
  comment: string;
  timestamp: string;
  isResolved: boolean;
  category?: string;
}

export interface DeliverableFile {
  name: string;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
  totalPages?: number;
}

export interface DeliverableReviewCanvasProps {
  milestoneId: number;
  milestoneTitle: string;
  deliverableFile?: DeliverableFile | null;
  initialPins?: ReviewPin[];
  currentUserName?: string;
  isClient?: boolean;
  onSavePins?: (pins: ReviewPin[]) => void;
  onRequestRevisions?: (pins: ReviewPin[]) => void;
  className?: string;
}

export const DeliverableReviewCanvas: React.FC<
  DeliverableReviewCanvasProps
> = ({
  milestoneId,
  milestoneTitle,
  deliverableFile,
  initialPins = [],
  currentUserName = "Client",
  isClient = true,
  onSavePins,
  onRequestRevisions,
  className = "",
}) => {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const [pins, setPins] = useState<ReviewPin[]>(initialPins);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPinModeActive, setIsPinModeActive] = useState<boolean>(true);
  const [showResolvedPins, setShowResolvedPins] = useState<boolean>(true);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [newPinCoords, setNewPinCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [newPinComment, setNewPinComment] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);

  const fileType = useMemo(() => {
    if (!deliverableFile?.url) return "unknown";
    const lower = deliverableFile.url.toLowerCase();
    if (
      lower.endsWith(".pdf") ||
      deliverableFile.mimeType === "application/pdf"
    ) {
      return "pdf";
    }
    if (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".svg") ||
      deliverableFile.mimeType?.startsWith("image/")
    ) {
      return "image";
    }
    return "document";
  }, [deliverableFile]);

  const totalPages = useMemo(() => {
    if (deliverableFile?.totalPages) return deliverableFile.totalPages;
    return fileType === "pdf" ? 3 : 1;
  }, [deliverableFile, fileType]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        if (currentPage < totalPages) {
          setCurrentPage((p) => p + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (currentPage > 1) {
          setCurrentPage((p) => p - 1);
        }
      } else if (e.key === "+" || e.key === "=") {
        setZoomLevel((z) => Math.min(200, z + 20));
      } else if (e.key === "-" || e.key === "_") {
        setZoomLevel((z) => Math.max(50, z - 20));
      } else if (e.key === "0") {
        setZoomLevel(100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages]);

  // Click on canvas to drop a new pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinModeActive || !canvasRef.current || !isClient) return;

    // Ignore clicks if clicking an existing pin or popover
    if ((e.target as HTMLElement).closest(".review-pin-element")) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewPinCoords({
      x: Math.max(2, Math.min(98, Number(x.toFixed(2)))),
      y: Math.max(2, Math.min(98, Number(y.toFixed(2)))),
    });
    setNewPinComment("");
    setActivePinId(null);
  };

  const handleAddPin = () => {
    if (!newPinCoords || !newPinComment.trim()) return;

    const newPin: ReviewPin = {
      id: `pin_${Date.now()}`,
      x: newPinCoords.x,
      y: newPinCoords.y,
      page: currentPage,
      authorName: currentUserName,
      comment: newPinComment.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isResolved: false,
    };

    const updated = [...pins, newPin];
    setPins(updated);
    setNewPinCoords(null);
    setNewPinComment("");
    setActivePinId(newPin.id);

    if (onSavePins) {
      onSavePins(updated);
    }
  };

  const togglePinResolved = (pinId: string) => {
    const updated = pins.map((p) =>
      p.id === pinId ? { ...p, isResolved: !p.isResolved } : p,
    );
    setPins(updated);
    if (onSavePins) {
      onSavePins(updated);
    }
  };

  const deletePin = (pinId: string) => {
    const updated = pins.filter((p) => p.id !== pinId);
    setPins(updated);
    if (activePinId === pinId) setActivePinId(null);
    if (onSavePins) {
      onSavePins(updated);
    }
  };

  const visiblePins = useMemo(() => {
    return pins.filter(
      (p) =>
        (showResolvedPins || !p.isResolved) &&
        (p.page === undefined || p.page === currentPage),
    );
  }, [pins, showResolvedPins, currentPage]);

  const unresolvedCount = useMemo(() => {
    return pins.filter((p) => !p.isResolved).length;
  }, [pins]);

  return (
    <PodaciumCard
      variant="default"
      className={`overflow-hidden border border-border/80 ${className}`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gray-50/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs text-foreground">
              {t("contracts.detail.reviewCanvas.title")}
            </span>
            <PodaciumBadge variant="secondary" className="text-[10px]">
              {tCommon("uiLabels.annotationsCount", { count: pins.length })}
            </PodaciumBadge>
            {unresolvedCount > 0 && (
              <PodaciumBadge variant="warning" className="text-[10px]">
                {t("contracts.detail.reviewCanvas.toResolve", {
                  count: unresolvedCount,
                })}
              </PodaciumBadge>
            )}
          </div>
          {deliverableFile?.name && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              • {deliverableFile.name}
            </span>
          )}
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* Multi-page controls for documents / PDFs */}
          {totalPages > 1 && (
            <div className="flex items-center rounded-lg border border-border bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 text-gray-600 hover:text-foreground rounded hover:bg-gray-100 disabled:opacity-30"
                title={t("contracts.detail.reviewCanvas.prevPage")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-[11px] font-medium text-gray-700">
                {t("contracts.detail.reviewCanvas.pageIndicator", {
                  current: currentPage,
                  total: totalPages,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="p-1.5 text-gray-600 hover:text-foreground rounded hover:bg-gray-100 disabled:opacity-30"
                title={t("contracts.detail.reviewCanvas.nextPage")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
              className="p-1.5 text-gray-600 hover:text-foreground rounded hover:bg-gray-100"
              title={t("contracts.detail.reviewCanvas.zoomOut")}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono text-gray-600">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(200, z + 20))}
              className="p-1.5 text-gray-600 hover:text-foreground rounded hover:bg-gray-100"
              title={t("contracts.detail.reviewCanvas.zoomIn")}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 text-gray-600 hover:text-foreground rounded hover:bg-gray-100 border-s border-border ms-0.5"
              title={t("contracts.detail.reviewCanvas.resetZoom")}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Toggle resolved filter */}
          <PodaciumButton
            variant="outline"
            size="sm"
            onClick={() => setShowResolvedPins((s) => !s)}
            className="text-xs h-8"
          >
            {showResolvedPins ? (
              <>
                <Eye className="h-3.5 w-3.5 me-1 text-gray-500" />
                {t("contracts.detail.reviewCanvas.hideResolved")}
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 me-1 text-gray-500" />
                {t("contracts.detail.reviewCanvas.showAll")}
              </>
            )}
          </PodaciumButton>

          {/* Toggle pin mode */}
          {isClient && (
            <PodaciumButton
              variant={isPinModeActive ? "primary" : "secondary"}
              size="sm"
              onClick={() => setIsPinModeActive((p) => !p)}
              className="text-xs h-8"
            >
              <MapPin className="h-3.5 w-3.5 me-1" />
              {isPinModeActive
                ? t("contracts.detail.reviewCanvas.pinModeActive")
                : t("contracts.detail.reviewCanvas.activatePinMode")}
            </PodaciumButton>
          )}

          {/* Launch revision request */}
          {isClient && onRequestRevisions && (
            <PodaciumButton
              variant="gradient"
              size="sm"
              onClick={() => onRequestRevisions(pins)}
              className="text-xs h-8"
            >
              <Send className="h-3.5 w-3.5 me-1" />
              {t("contracts.detail.reviewCanvas.requestRevisions")}
            </PodaciumButton>
          )}
        </div>
      </div>

      {/* Main Canvas + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[460px]">
        {/* Deliverable preview viewport */}
        <div className="lg:col-span-3 bg-slate-900/5 relative overflow-auto p-6 flex items-center justify-center min-h-[440px]">
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ width: `${zoomLevel}%` }}
            className={`relative max-w-full rounded-lg bg-white shadow-md transition-all select-none ${
              isPinModeActive ? "cursor-crosshair" : "cursor-default"
            }`}
          >
            {/* Content rendering based on file type */}
            {fileType === "image" && deliverableFile?.url ? (
              <img
                src={deliverableFile.url}
                alt={deliverableFile.name || "Deliverable preview"}
                className="w-full h-auto object-contain rounded-lg pointer-events-none"
              />
            ) : fileType === "pdf" && deliverableFile?.url ? (
              <div className="w-full h-[540px] flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <FileText className="h-16 w-16 text-primary/70 mb-3" />
                <p className="font-semibold text-sm text-foreground mb-1">
                  {t("contracts.detail.reviewCanvas.pdfDocument", {
                    name: deliverableFile.name,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mb-4 max-w-md">
                  {t("contracts.detail.reviewCanvas.pdfInstructions")}
                </p>
                <a
                  href={deliverableFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {t("contracts.detail.reviewCanvas.openPdfFullscreen")}
                </a>
              </div>
            ) : (
              <div className="w-full h-[400px] flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <FileText className="h-16 w-16 text-indigo-400 mb-3" />
                <p className="font-semibold text-sm text-foreground">
                  {t("contracts.detail.reviewCanvas.previewTitle", {
                    milestoneId,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {deliverableFile?.name || "Livrable de jalon"} (
                  {milestoneTitle})
                </p>
                {isPinModeActive && (
                  <p className="mt-3 text-[11px] font-medium text-primary">
                    {t("contracts.detail.reviewCanvas.clickToAddPin")}
                  </p>
                )}
              </div>
            )}

            {/* Dropped pins on the canvas */}
            {visiblePins.map((pin, index) => {
              const isSelected = activePinId === pin.id;

              return (
                <div
                  key={pin.id}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePinId((prev) => (prev === pin.id ? null : pin.id));
                  }}
                  className="review-pin-element absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow-lg transition-transform ${
                      pin.isResolved
                        ? "bg-emerald-500 text-white"
                        : "bg-indigo-600 text-white hover:scale-110"
                    } ${isSelected ? "ring-4 ring-indigo-300 scale-125" : ""}`}
                  >
                    {index + 1}
                  </div>

                  {/* Pin Popup Dialog when selected */}
                  {isSelected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-1/2 top-7 -translate-x-1/2 z-30 w-64 rounded-xl border border-border bg-white p-3 shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                        <span className="text-xs font-bold text-foreground">
                          {t("contracts.detail.reviewCanvas.pinHeader", {
                            index: index + 1,
                            author: pin.authorName,
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {pin.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed mb-3">
                        {pin.comment}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => togglePinResolved(pin.id)}
                          className={`text-[11px] font-semibold flex items-center gap-1 ${
                            pin.isResolved
                              ? "text-emerald-700 hover:text-emerald-800"
                              : "text-gray-600 hover:text-foreground"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {pin.isResolved
                            ? t("contracts.detail.reviewCanvas.resolved")
                            : t("contracts.detail.reviewCanvas.markResolved")}
                        </button>
                        {isClient && (
                          <button
                            type="button"
                            onClick={() => deletePin(pin.id)}
                            className="text-[11px] text-red-600 hover:text-red-700 p-1"
                            title={t("contracts.detail.reviewCanvas.deletePin")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pending new pin placement box */}
            {newPinCoords && (
              <div
                style={{
                  left: `${newPinCoords.x}%`,
                  top: `${newPinCoords.y}%`,
                }}
                onClick={(e) => e.stopPropagation()}
                className="review-pin-element absolute -translate-x-1/2 -translate-y-1/2 z-30 w-72 rounded-xl border border-primary bg-white p-3 shadow-2xl ring-2 ring-primary/20"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>
                      {t("contracts.detail.reviewCanvas.newAnnotation")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({newPinCoords.x}%, {newPinCoords.y}%)
                  </span>
                </div>
                <textarea
                  autoFocus
                  rows={2}
                  value={newPinComment}
                  onChange={(e) => setNewPinComment(e.target.value)}
                  placeholder={t(
                    "contracts.detail.reviewCanvas.annotationPlaceholder",
                  )}
                  className="w-full rounded-lg border border-border p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPinCoords(null)}
                    className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    {t("contracts.detail.reviewCanvas.cancel")}
                  </button>
                  <PodaciumButton
                    variant="gradient"
                    size="sm"
                    disabled={!newPinComment.trim()}
                    onClick={handleAddPin}
                    className="text-xs h-7 px-3"
                  >
                    {t("contracts.detail.reviewCanvas.save")}
                  </PodaciumButton>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: list of all annotations */}
        <div className="border-t lg:border-t-0 lg:border-s border-border bg-white p-4 flex flex-col justify-between">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {t("contracts.detail.reviewCanvas.annotationsList", {
                count: pins.length,
              })}
            </h5>

            {pins.length === 0 ? (
              <div className="text-center py-10 px-2">
                <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-foreground">
                  {t("contracts.detail.reviewCanvas.noAnnotationsTitle")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t("contracts.detail.reviewCanvas.noAnnotationsDesc")}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pe-1">
                {pins.map((pin, idx) => (
                  <div
                    key={pin.id}
                    onClick={() => setActivePinId(pin.id)}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all text-xs ${
                      activePinId === pin.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground">
                          {pin.authorName}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {pin.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {pin.comment}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px]">
                      <span
                        className={
                          pin.isResolved
                            ? "text-emerald-700 font-semibold"
                            : "text-amber-700 font-semibold"
                        }
                      >
                        {pin.isResolved
                          ? t("contracts.detail.reviewCanvas.statusResolved")
                          : t("contracts.detail.reviewCanvas.statusPending")}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {pin.page ? `P.${pin.page} • ` : ""}({pin.x.toFixed(1)}
                        %, {pin.y.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick tips footer */}
          <div className="mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1 font-medium text-foreground">
              <HelpCircle className="h-3 w-3 text-primary" />
              {t("contracts.detail.reviewCanvas.reviewTipTitle")}
            </p>
            <p className="mt-0.5 text-[10px]">
              {t("contracts.detail.reviewCanvas.reviewTipDesc")}
            </p>
          </div>
        </div>
      </div>
    </PodaciumCard>
  );
};

export default DeliverableReviewCanvas;
