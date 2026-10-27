"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LiveKitRoom as LKLiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
} from "@livekit/components-react";
import type {
  AudioCaptureOptions,
  VideoCaptureOptions,
  RoomOptions,
} from "livekit-client";
import { ConnectionState, VideoPreset } from "livekit-client";
import { WifiOff } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

/**
 * Adaptive simulcast layers and low bitrate profiles tuned for Algerian
 * cellular networks (Mobilis, Djezzy, Ooredoo) with high jitter and packet loss:
 * - 1080p: ~1.5 Mbps, 30 fps (high / full layer "f")
 * - 720p:  ~650 kbps, 25 fps (medium / half layer "h")
 * - 360p:  ~200 kbps, 20 fps (low / quarter layer "q")
 */
export const ALGERIA_CELLULAR_SIMULCAST_PRESETS = {
  h360: new VideoPreset(640, 360, 200_000, 20),
  h720: new VideoPreset(1280, 720, 650_000, 25),
  h1080: new VideoPreset(1920, 1080, 1_500_000, 30),
} as const;

export const ALGERIA_SIMULCAST_LAYERS: VideoPreset[] = [
  ALGERIA_CELLULAR_SIMULCAST_PRESETS.h360,
  ALGERIA_CELLULAR_SIMULCAST_PRESETS.h720,
  ALGERIA_CELLULAR_SIMULCAST_PRESETS.h1080,
];

interface Props {
  token: string;
  serverUrl: string;
  connect?: boolean;
  audio?: boolean | AudioCaptureOptions;
  video?: boolean | VideoCaptureOptions;
  options?: RoomOptions;
  onDisconnected?: () => void;
  onConnected?: () => void;
  onTokenRefresh?: () => Promise<{
    token: string;
    roomName: string;
    serverUrl: string;
  }>;
  children: React.ReactNode;
}

// B6: after a transient error we force a fresh connection attempt with
// exponential backoff. After 5 attempts we stop retrying and let the page-level
// onDisconnected flow take over (which returns the user to the lobby).
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 800;

function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function ConnectionStatusMonitor({
  onDegraded,
}: {
  onDegraded: (degraded: boolean) => void;
}) {
  const connectionState = useConnectionState();

  useEffect(() => {
    if (
      connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting
    ) {
      onDegraded(true);
    } else if (connectionState === ConnectionState.Connected) {
      onDegraded(false);
    }
  }, [connectionState, onDegraded]);

  return null;
}

export function LiveKitRoom({
  token,
  serverUrl,
  connect = true,
  audio = true,
  video = true,
  options: customOptions,
  onDisconnected,
  onConnected,
  onTokenRefresh,
  children,
}: Props) {
  const t = useTranslations("live");
  const [currentToken, setCurrentToken] = useState(token);
  const [connectFlag, setConnectFlag] = useState(connect);
  const [currentVideo, setCurrentVideo] = useState(video);
  const [degraded, setDegraded] = useState(false);
  const retryCountRef = useRef(0);
  const isReconnectingRef = useRef(false);

  const roomOptions: RoomOptions = React.useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoEncoding: ALGERIA_CELLULAR_SIMULCAST_PRESETS.h1080.encoding,
        videoSimulcastLayers: [
          ALGERIA_CELLULAR_SIMULCAST_PRESETS.h360,
          ALGERIA_CELLULAR_SIMULCAST_PRESETS.h720,
          ALGERIA_CELLULAR_SIMULCAST_PRESETS.h1080,
        ],
        dtx: true,
        red: true,
        ...customOptions?.publishDefaults,
      },
      ...customOptions,
    }),
    [customOptions],
  );

  useEffect(() => {
    setCurrentToken(token);
  }, [token]);

  // Sync the connect prop but never overwrite an in-progress reconnect cycle.
  useEffect(() => {
    setConnectFlag(connect);
  }, [connect]);

  // Sync video prop changes
  useEffect(() => {
    setCurrentVideo(video);
  }, [video]);

  // LiveKit tokens are short-lived; silently refresh two minutes before the
  // current token expires so an active room never drops mid-session.
  useEffect(() => {
    if (!onTokenRefresh) return;
    const expMs = getTokenExpiryMs(currentToken);
    if (!expMs) return;
    const refreshAt = Math.max(0, expMs - Date.now() - 120_000);
    const timer = setTimeout(async () => {
      try {
        const res = await onTokenRefresh();
        setCurrentToken(res.token);
      } catch {
        // Keep the current token; the next refresh cycle retries.
      }
    }, refreshAt);
    return () => clearTimeout(timer);
  }, [currentToken, onTokenRefresh]);

  // B6: onError must NOT kick participants to the lobby.
  // 1. If the error is a camera/video acquisition failure (e.g. NotReadableError,
  //    webcam in use, driver locked), fall back to audio-only and stay in the room.
  // 2. If it is a transport error, show the degraded banner and schedule an
  //    exponential-backoff reconnect without triggering page navigation.
  const handleRoomError = (err?: Error) => {
    console.error("LiveKit room error:", err);

    const isVideoAcquisitionError =
      err?.name === "NotReadableError" ||
      err?.name === "OverconstrainedError" ||
      err?.name === "TrackInvalidError" ||
      err?.name === "NotFoundError" ||
      err?.message?.toLowerCase().includes("video") ||
      err?.message?.toLowerCase().includes("could not start video source");

    if (isVideoAcquisitionError && currentVideo) {
      console.warn(
        "Camera acquisition failed — falling back to audio-only to preserve room connection.",
      );
      setCurrentVideo(false);
      return;
    }

    setDegraded(true);
    const attempt = retryCountRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      isReconnectingRef.current = false;
      onDisconnected?.();
      return;
    }

    retryCountRef.current = attempt + 1;
    // AWS Full Jitter to prevent thundering herd during carrier hiccups or room flaps
    const maxDelay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, 15_000);
    const delay = Math.floor(Math.random() * maxDelay);
    isReconnectingRef.current = true;
    setConnectFlag(false);
    window.setTimeout(() => {
      setConnectFlag(true);
    }, delay);
  };

  const handleDisconnected = () => {
    // If an internal reconnection cycle is underway, do not propagate
    // onDisconnected to the page (which kicks participants back to the lobby).
    if (isReconnectingRef.current) {
      return;
    }
    onDisconnected?.();
  };

  const handleConnected = () => {
    isReconnectingRef.current = false;
    retryCountRef.current = 0;
    setDegraded(false);
    onConnected?.();
  };

  return (
    <>
      <LKLiveKitRoom
        token={currentToken}
        serverUrl={serverUrl}
        connect={connectFlag}
        audio={audio}
        video={currentVideo}
        options={roomOptions}
        onDisconnected={handleDisconnected}
        onConnected={handleConnected}
        onError={handleRoomError}
      >
        <ConnectionStatusMonitor onDegraded={setDegraded} />
        <RoomAudioRenderer />
        {children}
      </LKLiveKitRoom>

      {/* B6: non-blocking degraded-connection banner */}
      {degraded && (
        <div
          className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          data-testid="degraded-banner"
        >
          <div className="flex items-center gap-2 rounded-full bg-amber-500/90 text-amber-950 dark:text-amber-50 text-xs font-medium px-3 py-1.5 shadow-lg">
            <WifiOff className="h-3.5 w-3.5" />
            {t("room.connectionStatus.degraded")}
          </div>
        </div>
      )}
    </>
  );
}
