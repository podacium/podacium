"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Camera, CameraOff, LogOut, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface Props {
  pipContainer: HTMLElement | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  onClosePiP: () => void;
  title?: string;
  activeSpeakerName?: string;
  children?: React.ReactNode;
}

export function DocumentPiPPortal({
  pipContainer,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onLeave,
  onClosePiP,
  title,
  activeSpeakerName,
  children,
}: Props) {
  const t = useTranslations("live");
  const displayTitle = title || t("room.pip.sessionTitle");

  if (!pipContainer) return null;

  const returnToTabLabel = t("room.pip.returnToTab");
  const micLabel = micEnabled ? t("room.pip.muteMic") : t("room.pip.unmuteMic");
  const camLabel = cameraEnabled
    ? t("room.pip.turnOffCamera")
    : t("room.pip.turnOnCamera");
  const leaveLabel = t("room.leave");

  return createPortal(
    <div
      data-testid="document-pip-window"
      className="flex flex-col h-full w-full bg-slate-950 text-white p-3 justify-between select-none font-sans"
    >
      {/* PiP Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-semibold text-slate-200 truncate">
            {displayTitle}
          </span>
        </div>
        <button
          onClick={onClosePiP}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={returnToTabLabel}
          aria-label={returnToTabLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Content / Video Stage */}
      <div className="flex-1 my-2 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex flex-col items-center justify-center relative min-h-0">
        {children ? (
          children
        ) : (
          <div className="text-center p-4">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg font-bold">
              {activeSpeakerName ? activeSpeakerName[0].toUpperCase() : "P"}
            </div>
            <p className="text-xs font-medium text-slate-300 truncate max-w-[200px]">
              {activeSpeakerName || t("room.pip.stagePlaceholder")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {t("room.pip.floatingActive")}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Controls Dock */}
      <div className="flex items-center justify-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-white/10 shrink-0">
        <button
          onClick={onToggleMic}
          className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            micEnabled
              ? "bg-white/10 text-slate-200 hover:bg-white/15"
              : "bg-red-500/20 text-red-300 hover:bg-red-500/30 ring-1 ring-red-400/40"
          }`}
          title={micLabel}
          aria-label={micLabel}
        >
          {micEnabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={onToggleCamera}
          className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            cameraEnabled
              ? "bg-white/10 text-slate-200 hover:bg-white/15"
              : "bg-red-500/20 text-red-300 hover:bg-red-500/30 ring-1 ring-red-400/40"
          }`}
          title={camLabel}
          aria-label={camLabel}
        >
          {cameraEnabled ? (
            <Camera className="h-4 w-4" />
          ) : (
            <CameraOff className="h-4 w-4" />
          )}
        </button>

        <div className="w-px h-5 bg-white/20 mx-1" />

        <button
          onClick={onLeave}
          className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
          title={leaveLabel}
          aria-label={leaveLabel}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>,
    pipContainer,
  );
}
