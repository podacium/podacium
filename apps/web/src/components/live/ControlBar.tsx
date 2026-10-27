"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  useLocalParticipant,
  useIsRecording,
  useRoomContext,
  useMediaDeviceSelect,
} from "@livekit/components-react";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  Radio,
  Lock,
  Unlock,
  Square,
  LogOut,
  MoreHorizontal,
  ChevronUp,
  Volume2,
  VolumeX,
  LayoutGrid,
  Maximize2,
  Presentation,
  PictureInPicture,
  MicOff as MuteAllIcon,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { AudioOnlyToggle } from "./AudioOnlyToggle";
import { EmojiReactions } from "./EmojiReactions";
import { HandRaise } from "./HandRaise";
import { BottomSheet } from "./BottomSheet";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { isSoundMuted, setSoundMuted } from "@/lib/audioChimes";
import { useDocumentPiP } from "@/hooks/useDocumentPiP";
import { DocumentPiPPortal } from "./DocumentPiPPortal";
import {
  BreakoutRoomsModal,
  type BreakoutSessionState,
} from "./BreakoutRoomsModal";

export type LayoutMode = "grid" | "spotlight" | "presentation";

interface Props {
  isHost: boolean;
  isCoHost?: boolean;
  sessionId: string;
  layoutMode?: LayoutMode;
  onLayoutChange?: (mode: LayoutMode) => void;
  onLeave: () => void;
  onEndSession: () => void;
  onToggleScreenShare: () => void;
  screenSharing: boolean;
  onToggleWhiteboard?: () => void;
  isWhiteboardOpen?: boolean;
  activeBreakoutSession?: BreakoutSessionState | null;
  onStartBreakout?: (roomsCount: number, durationMinutes: number) => void;
  onEndBreakout?: () => void;
  onBroadcastBreakout?: (message: string) => void;
  className?: string;
}

export function ControlBar({
  isHost,
  isCoHost = false,
  sessionId,
  layoutMode = "spotlight",
  onLayoutChange,
  onLeave,
  onEndSession,
  onToggleScreenShare,
  screenSharing,
  onToggleWhiteboard,
  isWhiteboardOpen = false,
  activeBreakoutSession,
  onStartBreakout,
  onEndBreakout,
  onBroadcastBreakout,
  className = "",
}: Props) {
  const t = useTranslations("live");
  const { dir } = useBidi();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const isRecording = useIsRecording();

  // Media device selectors from LiveKit
  const {
    devices: audioInputs,
    activeDeviceId: activeAudioId,
    setActiveMediaDevice: setAudioDevice,
  } = useMediaDeviceSelect({ kind: "audioinput" });

  const {
    devices: videoInputs,
    activeDeviceId: activeVideoId,
    setActiveMediaDevice: setVideoDevice,
  } = useMediaDeviceSelect({ kind: "videoinput" });

  const {
    devices: audioOutputs,
    activeDeviceId: activeOutputId,
    setActiveMediaDevice: setAudioOutput,
  } = useMediaDeviceSelect({ kind: "audiooutput" });

  const [roomLocked, setRoomLocked] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [soundMuted, setLocalSoundMuted] = useState(isSoundMuted());

  // Popover menus
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [videoMenuOpen, setVideoMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  const audioMenuRef = useRef<HTMLDivElement>(null);
  const videoMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const cameraEnabled = localParticipant?.isCameraEnabled ?? false;

  const toggleMic = () => localParticipant?.setMicrophoneEnabled(!micEnabled);
  const toggleCamera = () => localParticipant?.setCameraEnabled(!cameraEnabled);

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setLocalSoundMuted(next);
  };

  const toggleRecording = useCallback(async () => {
    if (recordingLoading) return;
    setRecordingLoading(true);
    try {
      if (isRecording) {
        await liveSessionsApi.stopRecording(sessionId);
      } else {
        await liveSessionsApi.startRecording(sessionId);
      }
    } catch (e) {
      console.error("Recording toggle failed:", e);
    } finally {
      setRecordingLoading(false);
    }
  }, [sessionId, isRecording, recordingLoading]);

  const toggleLock = () => setRoomLocked(!roomLocked);

  const handleMuteAll = async () => {
    if ((!isHost && !isCoHost) || !room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "mute_all",
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.error("Failed to broadcast mute_all:", e);
    }
  };

  const handleDisableAllCameras = async () => {
    if ((!isHost && !isCoHost) || !room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          action: "disable_cameras_all",
          hostIdentity: localParticipant?.identity,
        }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.error("Failed to broadcast disable_cameras_all:", e);
    }
  };

  const [breakoutModalOpen, setBreakoutModalOpen] = useState(false);

  const {
    isSupported: isDocPiPSupported,
    isPiPActive: isDocPiPActive,
    pipContainer,
    closePiP: closeDocPiP,
    togglePiP: toggleDocPiP,
  } = useDocumentPiP();

  const handleTogglePiP = async () => {
    try {
      if (isDocPiPSupported) {
        await toggleDocPiP({
          title: "Podacium Live Session",
          width: 480,
          height: 320,
        });
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const videos = document.querySelectorAll("video");
        if (videos.length > 0) {
          const mainVideo = videos[0] as HTMLVideoElement;
          if (mainVideo && document.pictureInPictureEnabled) {
            await mainVideo.requestPictureInPicture();
          }
        }
      }
    } catch (err) {
      console.warn("PiP not supported or failed:", err);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        audioMenuRef.current &&
        !audioMenuRef.current.contains(e.target as Node)
      ) {
        setAudioMenuOpen(false);
      }
      if (
        videoMenuRef.current &&
        !videoMenuRef.current.contains(e.target as Node)
      ) {
        setVideoMenuOpen(false);
      }
      if (
        layoutMenuRef.current &&
        !layoutMenuRef.current.contains(e.target as Node)
      ) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleMic();
      } else if (isModifier && e.key.toLowerCase() === "e") {
        e.preventDefault();
        toggleCamera();
      } else if (isModifier && e.key.toLowerCase() === "w") {
        e.preventDefault();
        onLeave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMic, toggleCamera, onLeave]);

  return (
    <>
      {/* Desktop: Full Glassmorphism Dock */}
      <div
        role="toolbar"
        aria-label={t("room.controls.toolbar")}
        className={`hidden md:flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur-xl ${className}`}
      >
        {/* Audio Split Button (Mic toggle + Device Menu) */}
        <div ref={audioMenuRef} className="relative flex items-center">
          <button
            onClick={toggleMic}
            className={`min-w-[44px] min-h-[44px] p-2.5 rounded-s-xl text-white hover:bg-white/10 transition-colors ${
              !micEnabled ? "bg-red-500/20 text-red-300" : ""
            }`}
            title={`${micEnabled ? t("room.hostControls.micOn") : t("room.hostControls.micOff")} (Ctrl+D)`}
            aria-label={
              micEnabled
                ? t("room.hostControls.micOn")
                : t("room.hostControls.micOff")
            }
          >
            {micEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setAudioMenuOpen(!audioMenuOpen)}
            className="min-h-[44px] p-2 rounded-e-xl text-white/70 hover:text-white hover:bg-white/10 border-s border-white/10 transition-colors"
            title={t("room.devices.selectAudio")}
            aria-expanded={audioMenuOpen}
            aria-haspopup="menu"
          >
            <ChevronUp
              className={`h-3.5 w-3.5 transition-transform ${audioMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {audioMenuOpen && (
            <div
              className={`absolute bottom-full mb-3 ${dir === "rtl" ? "right-0" : "left-0"} w-64 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50 text-xs text-white`}
              role="menu"
            >
              <div className="px-2 py-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                {t("room.devices.microphones")}
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {audioInputs.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => {
                      setAudioDevice(d.deviceId);
                      setAudioMenuOpen(false);
                    }}
                    className={`w-full text-start px-2.5 py-2 rounded-lg truncate transition-colors ${
                      d.deviceId === activeAudioId
                        ? "bg-purple-600 text-white font-medium"
                        : "hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    {d.label || `Mic ${d.deviceId.slice(0, 5)}`}
                  </button>
                ))}
              </div>

              {audioOutputs.length > 0 && (
                <>
                  <div className="my-1.5 border-t border-white/10" />
                  <div className="px-2 py-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                    {t("room.devices.speakers")}
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {audioOutputs.map((d) => (
                      <button
                        key={d.deviceId}
                        onClick={() => {
                          setAudioOutput(d.deviceId);
                          setAudioMenuOpen(false);
                        }}
                        className={`w-full text-start px-2.5 py-2 rounded-lg truncate transition-colors ${
                          d.deviceId === activeOutputId
                            ? "bg-purple-600 text-white font-medium"
                            : "hover:bg-white/10 text-gray-300"
                        }`}
                      >
                        {d.label || `Speaker ${d.deviceId.slice(0, 5)}`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Video Split Button (Camera toggle + Device Menu) */}
        <div ref={videoMenuRef} className="relative flex items-center">
          <button
            onClick={toggleCamera}
            className={`min-w-[44px] min-h-[44px] p-2.5 rounded-s-xl text-white hover:bg-white/10 transition-colors ${
              !cameraEnabled ? "bg-red-500/20 text-red-300" : ""
            }`}
            title={`${cameraEnabled ? t("room.hostControls.cameraOn") : t("room.hostControls.cameraOff")} (Ctrl+E)`}
            aria-label={
              cameraEnabled
                ? t("room.hostControls.cameraOn")
                : t("room.hostControls.cameraOff")
            }
          >
            {cameraEnabled ? (
              <Camera className="h-5 w-5" />
            ) : (
              <CameraOff className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setVideoMenuOpen(!videoMenuOpen)}
            className="min-h-[44px] p-2 rounded-e-xl text-white/70 hover:text-white hover:bg-white/10 border-s border-white/10 transition-colors"
            title={t("room.devices.selectVideo")}
            aria-expanded={videoMenuOpen}
            aria-haspopup="menu"
          >
            <ChevronUp
              className={`h-3.5 w-3.5 transition-transform ${videoMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {videoMenuOpen && (
            <div
              className={`absolute bottom-full mb-3 ${dir === "rtl" ? "right-0" : "left-0"} w-64 rounded-xl border border-white/15 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50 text-xs text-white`}
              role="menu"
            >
              <div className="px-2 py-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                {t("room.devices.cameras")}
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {videoInputs.map((d) => (
                  <button
                    key={d.deviceId}
                    onClick={() => {
                      setVideoDevice(d.deviceId);
                      setVideoMenuOpen(false);
                    }}
                    className={`w-full text-start px-2.5 py-2 rounded-lg truncate transition-colors ${
                      d.deviceId === activeVideoId
                        ? "bg-purple-600 text-white font-medium"
                        : "hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-white/20 mx-1.5" />

        {/* Audio Only Mode */}
        <AudioOnlyToggle />

        {/* Sound Chimes Toggle */}
        <button
          onClick={toggleSound}
          className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center ${
            soundMuted ? "bg-amber-500/20 text-amber-300" : ""
          }`}
          title={soundMuted ? t("room.sound.unmute") : t("room.sound.mute")}
          aria-label={
            soundMuted ? t("room.sound.unmute") : t("room.sound.mute")
          }
        >
          {soundMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>

        <div className="w-px h-6 bg-white/20 mx-1.5" />

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center ${
            screenSharing
              ? "bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50"
              : ""
          }`}
          title={screenSharing ? t("room.stopSharing") : t("room.shareScreen")}
          aria-label={
            screenSharing ? t("room.stopSharing") : t("room.shareScreen")
          }
        >
          <Monitor className="h-5 w-5" />
        </button>

        {/* Whiteboard Stage Takeover */}
        {onToggleWhiteboard && (
          <button
            onClick={onToggleWhiteboard}
            className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center ${
              isWhiteboardOpen
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400"
                : ""
            }`}
            title={t("room.sidebar.whiteboard")}
            aria-label={t("room.sidebar.whiteboard")}
          >
            <LayoutDashboard className="h-5 w-5" />
          </button>
        )}

        {/* Layout Switcher */}
        <div ref={layoutMenuRef} className="relative">
          <button
            onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
            title={t("room.layout.switch")}
            aria-expanded={layoutMenuOpen}
            aria-haspopup="menu"
          >
            {layoutMode === "grid" ? (
              <LayoutGrid className="h-5 w-5" />
            ) : layoutMode === "presentation" ? (
              <Presentation className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>

          {layoutMenuOpen && (
            <div
              className={`absolute bottom-full mb-3 ${dir === "rtl" ? "right-0" : "left-0"} w-48 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 text-xs text-white`}
              role="menu"
            >
              <div className="px-2 py-1 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
                {t("room.layout.title")}
              </div>
              <button
                onClick={() => {
                  onLayoutChange?.("spotlight");
                  setLayoutMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-start transition-colors ${
                  layoutMode === "spotlight"
                    ? "bg-purple-600 text-white font-medium"
                    : "hover:bg-white/10 text-gray-300"
                }`}
              >
                <Maximize2 className="h-4 w-4" />
                <span>{t("room.layout.spotlight")}</span>
              </button>
              <button
                onClick={() => {
                  onLayoutChange?.("grid");
                  setLayoutMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-start transition-colors ${
                  layoutMode === "grid"
                    ? "bg-purple-600 text-white font-medium"
                    : "hover:bg-white/10 text-gray-300"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>{t("room.layout.grid")}</span>
              </button>
              <button
                onClick={() => {
                  onLayoutChange?.("presentation");
                  setLayoutMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-start transition-colors ${
                  layoutMode === "presentation"
                    ? "bg-purple-600 text-white font-medium"
                    : "hover:bg-white/10 text-gray-300"
                }`}
              >
                <Presentation className="h-4 w-4" />
                <span>{t("room.layout.presentation")}</span>
              </button>
            </div>
          )}
        </div>

        {/* Picture-in-Picture */}
        <button
          onClick={handleTogglePiP}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center"
          title={t("room.pip.toggle")}
          aria-label={t("room.pip.toggle")}
        >
          <PictureInPicture className="h-5 w-5" />
        </button>

        <div className="w-px h-6 bg-white/20 mx-1.5" />

        {/* Emoji Reactions & Hand Raise */}
        <EmojiReactions />
        <HandRaise isHost={isHost} />

        {/* Host Controls */}
        {(isHost || isCoHost) && (
          <>
            <div className="w-px h-6 bg-white/20 mx-1.5" />

            {/* Mute All */}
            <button
              onClick={handleMuteAll}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center justify-center"
              title={t("room.hostControls.muteAll") || "Mute All Participants"}
              aria-label={
                t("room.hostControls.muteAll") || "Mute All Participants"
              }
              data-testid="mute-all-btn"
            >
              <MuteAllIcon className="h-5 w-5" />
            </button>

            {/* Disable All Cameras */}
            <button
              onClick={handleDisableAllCameras}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-amber-500/20 hover:text-amber-300 transition-colors flex items-center justify-center"
              title={t("room.hostControls.disableCamerasAll")}
              aria-label={t("room.hostControls.disableCamerasAll")}
              data-testid="disable-cameras-all-btn"
            >
              <CameraOff className="h-5 w-5" />
            </button>

            {/* Breakout Rooms */}
            <button
              onClick={() => setBreakoutModalOpen(true)}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-purple-500/20 hover:text-purple-300 transition-colors flex items-center justify-center relative ${
                activeBreakoutSession?.isActive
                  ? "bg-purple-600/30 text-purple-300 ring-1 ring-purple-400"
                  : ""
              }`}
              title={t("room.breakout.title")}
              aria-label={t("room.breakout.title")}
              data-testid="breakout-rooms-btn"
            >
              <Users className="h-5 w-5" />
              {activeBreakoutSession?.isActive && (
                <span className="absolute top-2 end-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Recording */}
            <button
              onClick={toggleRecording}
              disabled={recordingLoading}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center ${
                isRecording
                  ? "bg-red-500/20 text-red-300 ring-1 ring-red-400"
                  : ""
              } ${recordingLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              title={
                isRecording
                  ? t("room.hostControls.stopRecording")
                  : t("room.hostControls.startRecording")
              }
              aria-label={
                isRecording
                  ? t("room.hostControls.stopRecording")
                  : t("room.hostControls.startRecording")
              }
            >
              <Radio
                className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
              />
            </button>

            {/* Lock Room */}
            <button
              onClick={toggleLock}
              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-white hover:bg-white/10 transition-colors flex items-center justify-center ${
                roomLocked
                  ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-400"
                  : ""
              }`}
              title={
                roomLocked
                  ? t("room.hostControls.unlockRoom")
                  : t("room.hostControls.lockRoom")
              }
              aria-label={
                roomLocked
                  ? t("room.hostControls.unlockRoom")
                  : t("room.hostControls.lockRoom")
              }
            >
              {roomLocked ? (
                <Lock className="h-5 w-5" />
              ) : (
                <Unlock className="h-5 w-5" />
              )}
            </button>

            {/* End Session */}
            <button
              onClick={onEndSession}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center justify-center"
              title={t("room.hostControls.endSession")}
              aria-label={t("room.hostControls.endSession")}
            >
              <Square className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="w-px h-6 bg-white/20 mx-1.5" />

        {/* Leave Room */}
        <button
          onClick={onLeave}
          className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400"
          title={`${t("room.leave")} (Ctrl+W)`}
          aria-label={t("room.leave")}
        >
          <LogOut className="h-4 w-4" />
          <span>{t("room.leave")}</span>
        </button>
      </div>

      {/* Mobile: Ergonomic Touch Bar (Enforcing >= 48x48px Touch Targets per HIG / Material 3) */}
      <div
        role="toolbar"
        aria-label={t("room.controls.toolbar")}
        className={`md:hidden flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950/92 px-3 py-2 shadow-2xl backdrop-blur-2xl ${className}`}
      >
        <button
          onClick={toggleMic}
          className={`min-w-[48px] min-h-[48px] p-3 rounded-2xl transition-all active:scale-95 text-white hover:bg-white/10 flex items-center justify-center ${
            !micEnabled
              ? "bg-red-500/20 text-red-300 ring-1 ring-red-400/40"
              : "bg-white/5"
          }`}
          title={
            micEnabled
              ? t("room.hostControls.micOn")
              : t("room.hostControls.micOff")
          }
          aria-label={
            micEnabled
              ? t("room.hostControls.micOn")
              : t("room.hostControls.micOff")
          }
        >
          {micEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={toggleCamera}
          className={`min-w-[48px] min-h-[48px] p-3 rounded-2xl transition-all active:scale-95 text-white hover:bg-white/10 flex items-center justify-center ${
            !cameraEnabled
              ? "bg-red-500/20 text-red-300 ring-1 ring-red-400/40"
              : "bg-white/5"
          }`}
          title={
            cameraEnabled
              ? t("room.hostControls.cameraOn")
              : t("room.hostControls.cameraOff")
          }
          aria-label={
            cameraEnabled
              ? t("room.hostControls.cameraOn")
              : t("room.hostControls.cameraOff")
          }
        >
          {cameraEnabled ? (
            <Camera className="h-5 w-5" />
          ) : (
            <CameraOff className="h-5 w-5" />
          )}
        </button>

        <EmojiReactions />
        <HandRaise isHost={isHost} />

        <button
          onClick={() => setMoreOpen(true)}
          className="min-w-[48px] min-h-[48px] p-3 rounded-2xl text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center"
          title={t("room.more")}
          aria-label={t("room.more")}
          data-testid="more-controls"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        <div className="w-px h-7 bg-white/20 mx-0.5" />

        <button
          onClick={onLeave}
          className="min-w-[48px] min-h-[48px] p-3 rounded-2xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all active:scale-95 flex items-center justify-center shadow-md shadow-red-500/25"
          title={t("room.leave")}
          aria-label={t("room.leave")}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile "More" Bottom Sheet with complete touch-accessible control list */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t("room.more")}
      >
        <div className="flex flex-col gap-3 p-1 text-white">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-sm font-medium">{t("room.shareScreen")}</span>
            <button
              onClick={() => {
                onToggleScreenShare();
                setMoreOpen(false);
              }}
              className={`min-w-[48px] min-h-[48px] p-3 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                screenSharing
                  ? "bg-purple-600 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-label={t("room.shareScreen")}
            >
              <Monitor className="h-5 w-5" />
            </button>
          </div>

          {onToggleWhiteboard && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-sm font-medium">
                {t("room.sidebar.whiteboard")}
              </span>
              <button
                onClick={() => {
                  onToggleWhiteboard();
                  setMoreOpen(false);
                }}
                className={`min-w-[48px] min-h-[48px] p-3 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  isWhiteboardOpen
                    ? "bg-purple-600 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                aria-label={t("room.sidebar.whiteboard")}
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-sm font-medium">{t("room.sound.title")}</span>
            <button
              onClick={toggleSound}
              className={`min-w-[48px] min-h-[48px] p-3 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                soundMuted
                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-label={t("room.sound.title")}
            >
              {soundMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-sm font-medium">{t("room.pip.title")}</span>
            <button
              onClick={() => {
                handleTogglePiP();
                setMoreOpen(false);
              }}
              className="min-w-[48px] min-h-[48px] p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center"
              aria-label={t("room.pip.title")}
            >
              <PictureInPicture className="h-5 w-5" />
            </button>
          </div>

          {/* Layout switches (Touch Friendly >= 48px height) */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2.5">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
              {t("room.layout.title")}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onLayoutChange?.("spotlight");
                  setMoreOpen(false);
                }}
                className={`min-h-[48px] p-2.5 rounded-xl text-xs font-semibold text-center flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  layoutMode === "spotlight"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-white/10 text-gray-300 hover:bg-white/15"
                }`}
              >
                <Maximize2 className="h-4 w-4" />
                <span>{t("room.layout.spotlight")}</span>
              </button>
              <button
                onClick={() => {
                  onLayoutChange?.("grid");
                  setMoreOpen(false);
                }}
                className={`min-h-[48px] p-2.5 rounded-xl text-xs font-semibold text-center flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  layoutMode === "grid"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-white/10 text-gray-300 hover:bg-white/15"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>{t("room.layout.grid")}</span>
              </button>
              <button
                onClick={() => {
                  onLayoutChange?.("presentation");
                  setMoreOpen(false);
                }}
                className={`min-h-[48px] p-2.5 rounded-xl text-xs font-semibold text-center flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  layoutMode === "presentation"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-white/10 text-gray-300 hover:bg-white/15"
                }`}
              >
                <Presentation className="h-4 w-4" />
                <span>{t("room.layout.presentation")}</span>
              </button>
            </div>
          </div>

          {(isHost || isCoHost) && (
            <div className="p-3 rounded-2xl bg-red-950/30 border border-red-500/20 space-y-2.5">
              <span className="text-xs text-red-400 font-semibold uppercase tracking-wider block">
                {t("room.hostControls.title")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleMuteAll();
                    setMoreOpen(false);
                  }}
                  className="min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all active:scale-95"
                  data-testid="mobile-mute-all-btn"
                >
                  <MuteAllIcon className="h-4 w-4 text-red-300" />
                  <span>{t("room.hostControls.muteAll")}</span>
                </button>
                <button
                  onClick={() => {
                    handleDisableAllCameras();
                    setMoreOpen(false);
                  }}
                  className="min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all active:scale-95"
                  data-testid="mobile-disable-cameras-btn"
                >
                  <CameraOff className="h-4 w-4 text-amber-300" />
                  <span>{t("room.hostControls.disableCamerasAll")}</span>
                </button>
                <button
                  onClick={() => {
                    setBreakoutModalOpen(true);
                    setMoreOpen(false);
                  }}
                  className="min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-all active:scale-95 col-span-2"
                  data-testid="mobile-breakout-rooms-btn"
                >
                  <Users className="h-4 w-4 text-purple-300" />
                  <span>{t("room.breakout.title")}</span>
                </button>
                <button
                  onClick={() => {
                    toggleLock();
                    setMoreOpen(false);
                  }}
                  className={`min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                    roomLocked
                      ? "bg-yellow-500/30 text-yellow-200 ring-1 ring-yellow-400/50"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {roomLocked ? (
                    <Lock className="h-4 w-4 text-yellow-300" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  <span>
                    {roomLocked
                      ? t("room.hostControls.unlockRoom")
                      : t("room.hostControls.lockRoom")}
                  </span>
                </button>
                <button
                  onClick={() => {
                    toggleRecording();
                    setMoreOpen(false);
                  }}
                  className={`min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-medium col-span-2 transition-all active:scale-95 ${
                    isRecording
                      ? "bg-red-500/30 text-red-200 ring-1 ring-red-400/50"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Radio
                    className={`h-4 w-4 ${isRecording ? "animate-pulse text-red-400" : ""}`}
                  />
                  <span>
                    {isRecording
                      ? t("room.hostControls.stopRecording")
                      : t("room.hostControls.startRecording")}
                  </span>
                </button>
                <button
                  onClick={() => {
                    onEndSession();
                    setMoreOpen(false);
                  }}
                  className="min-h-[48px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold col-span-2 transition-all active:scale-95 shadow-md shadow-red-600/30"
                >
                  <Square className="h-4 w-4" />
                  <span>{t("room.hostControls.endSession")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Breakout Rooms Modal */}
      <BreakoutRoomsModal
        open={breakoutModalOpen}
        onClose={() => setBreakoutModalOpen(false)}
        isHost={isHost || isCoHost}
        activeSession={activeBreakoutSession ?? null}
        onStartBreakout={(rooms, duration) => {
          onStartBreakout?.(rooms, duration);
          setBreakoutModalOpen(false);
        }}
        onEndBreakout={() => {
          onEndBreakout?.();
          setBreakoutModalOpen(false);
        }}
        onBroadcastMessage={(msg) => onBroadcastBreakout?.(msg)}
      />

      {/* Document Picture-in-Picture Floating Window Portal */}
      {isDocPiPActive && (
        <DocumentPiPPortal
          pipContainer={pipContainer}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onLeave={onLeave}
          onClosePiP={closeDocPiP}
          title={t("room.pip.sessionTitle")}
        />
      )}
    </>
  );
}
