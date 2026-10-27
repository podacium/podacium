"use client";

import { useEffect, useRef } from "react";

interface LiveMediaSessionOptions {
  roomName: string;
  isHost?: boolean;
  isMuted?: boolean;
  onToggleMic?: () => void;
  onLeave?: () => void;
  isActive?: boolean;
}

/**
 * Hook to manage WebRTC background audio and the Media Session API on mobile browsers
 * (iOS Safari and Android Chrome).
 *
 * Configures system-level media playback metadata, lock screen controls, Bluetooth
 * accessory buttons (hangup, mic mute), and keeps audio playback active in background.
 */
export function useLiveMediaSession({
  roomName,
  isHost = false,
  isMuted = false,
  onToggleMic,
  onLeave,
  isActive = true,
}: LiveMediaSessionOptions) {
  const onToggleMicRef = useRef(onToggleMic);
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    onToggleMicRef.current = onToggleMic;
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    if (!isActive) {
      navigator.mediaSession.playbackState = "none";
      return;
    }

    try {
      // Configure Media Session Metadata
      if (typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: roomName || "Live Session",
          artist: isHost ? "Podacium Live (Host)" : "Podacium Live",
          album: "Podacium Live Sessions",
          artwork: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        });
      } else {
        (navigator.mediaSession as any).metadata = {
          title: roomName || "Live Session",
          artist: isHost ? "Podacium Live (Host)" : "Podacium Live",
          album: "Podacium Live Sessions",
        };
      }

      navigator.mediaSession.playbackState = "playing";

      // Set Action Handlers for lock screen / notifications / bluetooth headsets
      const handlers: Array<[string, MediaSessionActionHandler | null]> = [
        [
          "hangup",
          () => {
            onLeaveRef.current?.();
          },
        ],
        [
          "togglemicrophone",
          () => {
            onToggleMicRef.current?.();
          },
        ],
        [
          "stop",
          () => {
            onLeaveRef.current?.();
          },
        ],
        [
          "play",
          () => {
            navigator.mediaSession.playbackState = "playing";
          },
        ],
        [
          "pause",
          () => {
            // Live sessions are continuous streams; keep playback active
            navigator.mediaSession.playbackState = "playing";
          },
        ],
      ];

      for (const [action, handler] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(
            action as MediaSessionAction,
            handler,
          );
        } catch (_) {
          // Some browsers might not support certain actions (e.g. togglemicrophone)
        }
      }
    } catch (err) {
      console.warn("[MediaSession] Setup error:", err);
    }

    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
        try {
          navigator.mediaSession.setActionHandler(
            "hangup" as MediaSessionAction,
            null,
          );
          navigator.mediaSession.setActionHandler(
            "togglemicrophone" as MediaSessionAction,
            null,
          );
          navigator.mediaSession.setActionHandler("stop", null);
        } catch (_) {}
      }
    };
  }, [roomName, isHost, isActive]);

  // Handle mobile visibility change & background audio recovery for iOS / Android
  useEffect(() => {
    if (typeof document === "undefined" || !isActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // When tab is restored to foreground, ensure Web Audio / AudioContext is active
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive]);
}
