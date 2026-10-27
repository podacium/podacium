"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  ZapOff,
  SwitchCamera,
  Upload,
  FileCheck,
  Loader2,
  X,
} from "lucide-react";
import { PodaciumButton, PodaciumBadge } from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";
import type { CameraOcrArtifact } from "@/types/copilot";

export interface CameraOcrScannerProps {
  artifact?: CameraOcrArtifact;
  onScanSubmit?: (data: {
    imageBase64: string;
    receiptText?: string;
  }) => Promise<void> | void;
  onChange?: (updated: CameraOcrArtifact) => void;
  onClose?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function CameraOcrScanner({
  artifact,
  onScanSubmit,
  onChange,
  onClose,
  isSubmitting = false,
  className = "",
}: CameraOcrScannerProps) {
  const { t } = useTranslations();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Captured snapshot state
  const [capturedImage, setCapturedImage] = useState<string | null>(
    artifact?.capturedImage || null,
  );
  const [receiptType, setReceiptType] = useState<
    "baridimob" | "ccp" | "edahabia" | "general_invoice"
  >("baridimob");
  const [ocrSubmitted, setOcrSubmitted] = useState(false);

  /**
   * Stop any active video stream tracks
   */
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  }, [stream]);

  /**
   * Start camera with given facingMode
   */
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "L'API Caméra n'est pas supportée dans cet environnement (HTTPS requis).",
        );
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }

      // Check for torch capability
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() ||
          {}) as MediaTrackCapabilities & { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'accéder à la caméra.";
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, [facingMode, stream]);

  // Start camera when component mounts if not already displaying a snapshot
  useEffect(() => {
    if (!capturedImage) {
      startCamera();
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  /**
   * Toggle Torch / Flashlight
   */
  const toggleTorch = async () => {
    if (!stream || !hasTorch) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !isTorchOn;
        await (
          videoTrack as MediaStreamTrack & {
            applyConstraints: (c: Record<string, unknown>) => Promise<void>;
          }
        ).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn("Could not toggle torch:", err);
      }
    }
  };

  /**
   * Flip between back/environment and front/user camera
   */
  const flipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  /**
   * Capture still frame from live video
   */
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    setCapturedImage(dataUrl);
    stopStream();

    if (artifact && onChange) {
      onChange({
        ...artifact,
        capturedImage: dataUrl,
        status: "analyzing",
      });
    }
  };

  /**
   * Discard snapshot and resume camera
   */
  const handleRetake = () => {
    setCapturedImage(null);
    setOcrSubmitted(false);
    startCamera();
  };

  /**
   * Fallback: Handle file upload if camera unavailable
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        stopStream();
        if (artifact && onChange) {
          onChange({
            ...artifact,
            capturedImage: reader.result,
            status: "analyzing",
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Submit image to ocr_receipt_scan tool
   */
  const handleSubmitToOcr = async () => {
    if (!capturedImage) return;

    setOcrSubmitted(true);
    const cleanBase64 = capturedImage.replace(
      /^data:image\/[a-z]+;base64,/,
      "",
    );

    if (onScanSubmit) {
      await onScanSubmit({
        imageBase64: cleanBase64,
        receiptText: `Scan de reçu fiscal/bancaire type ${receiptType.toUpperCase()}`,
      });
    }

    if (artifact && onChange) {
      onChange({
        ...artifact,
        status: "scanned",
      });
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-slate-950 text-white rounded-2xl overflow-hidden relative shadow-xl border border-slate-800 ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
            <Camera className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white tracking-tight flex items-center gap-2">
              {t("component.copilot.cameraOcr.title")}
              <PodaciumBadge
                variant="outline"
                className="text-[10px] text-rose-400 border-rose-500/30"
              >
                ocr_receipt_scan
              </PodaciumBadge>
            </h3>
            <p className="text-[10px] text-slate-400">
              {t("component.copilot.cameraOcr.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCameraActive && (
            <>
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    isTorchOn
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                  title={t("component.copilot.cameraOcr.toggleTorch")}
                >
                  {isTorchOn ? (
                    <Zap className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <ZapOff className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={flipCamera}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white transition-colors cursor-pointer"
                title={t("component.copilot.cameraOcr.switchCamera")}
              >
                <SwitchCamera className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={t("component.copilot.cameraOcr.close")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden select-none">
        {capturedImage ? (
          /* Snapshot Preview Mode */
          <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt={t("component.copilot.cameraOcr.capturedReceiptAlt")}
              className="max-h-[75%] max-w-full object-contain rounded-xl border border-slate-700 shadow-2xl"
            />

            {/* Target format badge & review pills */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {t("component.copilot.cameraOcr.docTypeLabel")}
              </span>
              <div className="flex gap-1.5">
                {(
                  ["baridimob", "ccp", "edahabia", "general_invoice"] as const
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReceiptType(type)}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                      receiptType === type
                        ? "bg-rose-500 text-white shadow-xs"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Live Camera Viewfinder Mode */
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />

            {/* Hidden canvas for taking snapshot */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Error Message & Fallback */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 p-6 flex flex-col items-center justify-center text-center z-10">
                <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
                <h4 className="text-sm font-bold text-white mb-1">
                  {t("component.copilot.cameraOcr.cameraUnavailable")}
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mb-4">
                  {cameraError}
                </p>
                <div className="flex gap-2">
                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    className="text-xs border-slate-700 text-slate-200"
                  >
                    {t("component.copilot.cameraOcr.retry")}
                  </PodaciumButton>
                  <PodaciumButton
                    variant="gradient"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("component.copilot.cameraOcr.uploadPhoto")}
                  </PodaciumButton>
                </div>
              </div>
            )}

            {/* Viewfinder Guide Overlay with Corners and Scanline */}
            {isCameraActive && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                {/* Viewfinder Box for Receipts (3:4 ratio standard) */}
                <div className="relative w-full max-w-sm aspect-3/4 rounded-2xl border-2 border-dashed border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.15)] flex flex-col justify-between p-3">
                  {/* Top-Start Corner */}
                  <div className="absolute -top-1 -start-1 w-6 h-6 border-t-4 border-s-4 border-rose-500 rounded-ss-lg" />
                  {/* Top-End Corner */}
                  <div className="absolute -top-1 -end-1 w-6 h-6 border-t-4 border-e-4 border-rose-500 rounded-se-lg" />
                  {/* Bottom-Start Corner */}
                  <div className="absolute -bottom-1 -start-1 w-6 h-6 border-b-4 border-s-4 border-rose-500 rounded-es-lg" />
                  {/* Bottom-End Corner */}
                  <div className="absolute -bottom-1 -end-1 w-6 h-6 border-b-4 border-e-4 border-rose-500 rounded-ee-lg" />

                  {/* Animated Scanning Laser Line */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent animate-pulse shadow-[0_0_12px_#f43f5e]" />

                  {/* Top instruction header */}
                  <div className="bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-300 font-mono py-1 px-2.5 rounded-full self-center border border-slate-700">
                    {t("component.copilot.cameraOcr.alignReceipt")}
                  </div>

                  {/* Stamp validation hint */}
                  <div className="bg-slate-900/80 backdrop-blur-md text-[10px] text-emerald-400 font-mono py-1 px-2.5 rounded-full self-center border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("component.copilot.cameraOcr.stampVisible")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input for Image Upload Fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Footer Controls */}
      <div className="p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between gap-3 z-20">
        {capturedImage ? (
          <>
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={handleRetake}
              disabled={isSubmitting}
              className="text-xs border-slate-700 text-slate-300 hover:text-white gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("component.copilot.cameraOcr.retake")}
            </PodaciumButton>

            <PodaciumButton
              variant="gradient"
              size="sm"
              onClick={handleSubmitToOcr}
              disabled={isSubmitting || ocrSubmitted}
              className="text-xs bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white gap-1.5 shadow-md shadow-rose-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("component.copilot.cameraOcr.extracting")}
                </>
              ) : ocrSubmitted ? (
                <>
                  <FileCheck className="h-3.5 w-3.5 text-white" />
                  {t("component.copilot.cameraOcr.submitted")}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("component.copilot.cameraOcr.analyzeWithOcr")}
                </>
              )}
            </PodaciumButton>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded-lg"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{t("component.copilot.cameraOcr.gallery")}</span>
            </button>

            {/* Shutter Capture Button */}
            <button
              type="button"
              onClick={captureFrame}
              disabled={!isCameraActive || Boolean(cameraError)}
              className="relative p-1 rounded-full border-2 border-rose-500 hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              title={t("component.copilot.cameraOcr.takePhoto")}
            >
              <div className="h-12 w-12 rounded-full bg-rose-500 group-hover:bg-rose-400 transition-colors flex items-center justify-center shadow-lg shadow-rose-500/30">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>

            <div className="w-16" />
          </>
        )}
      </div>
    </div>
  );
}
