"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Video } from "lucide-react";

import { LiveKitRoom } from "@/components/live/LiveKitRoom";
import { LiveRoom } from "@/components/live/LiveRoom";
import { PreJoinForm } from "@/components/live/PreJoinForm";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  liveSessionsApi,
  type JoinTokenResponse,
} from "@/lib/api/live-sessions";

function RoomContent({
  token,
  serverUrl,
  roomName,
  sessionId,
  ownerId,
  onTokenRefresh,
}: {
  token: string;
  serverUrl: string;
  roomName: string;
  sessionId: string;
  ownerId: number | null;
  onTokenRefresh?: () => Promise<JoinTokenResponse>;
}) {
  const t = useTranslations("live");
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [showPreJoin, setShowPreJoin] = useState(true);
  const [audioCapture, setAudioCapture] = useState<
    boolean | { deviceId: string }
  >(true);
  const [videoCapture, setVideoCapture] = useState<
    boolean | { deviceId: string }
  >(true);

  const handleLeave = useCallback(() => {
    router.push(`/live/${sessionId}`);
  }, [sessionId, router]);

  const handleEndSession = useCallback(async () => {
    try {
      await liveSessionsApi.endSession(sessionId);
      router.push(`/live/${sessionId}`);
    } catch {
      router.push(`/live/${sessionId}`);
    }
  }, [sessionId, router]);

  const handleConnected = useCallback(() => {
    setConnected(true);
  }, []);

  const handleDisconnected = useCallback(() => {
    setConnected(false);
    liveSessionsApi.leaveSession(sessionId).catch(() => {});
    router.push(`/live/${sessionId}`);
  }, [sessionId, router]);

  const handleJoin = useCallback(
    (deviceInfo: {
      audioDeviceId: string;
      videoDeviceId: string;
      audioEnabled?: boolean;
      videoEnabled?: boolean;
    }) => {
      const isVideoOn =
        deviceInfo.videoEnabled !== undefined
          ? deviceInfo.videoEnabled
          : Boolean(deviceInfo.videoDeviceId);
      const isAudioOn =
        deviceInfo.audioEnabled !== undefined
          ? deviceInfo.audioEnabled
          : Boolean(deviceInfo.audioDeviceId);

      setVideoCapture(
        isVideoOn
          ? deviceInfo.videoDeviceId
            ? { deviceId: deviceInfo.videoDeviceId }
            : true
          : false,
      );
      setAudioCapture(
        isAudioOn
          ? deviceInfo.audioDeviceId
            ? { deviceId: deviceInfo.audioDeviceId }
            : true
          : false,
      );
      setShowPreJoin(false);
    },
    [],
  );

  // Report the participant as having left whenever the tab is closed or navigated away.
  // Use sendBeacon or keepalive fetch so the request is guaranteed to deliver.
  useEffect(() => {
    if (!connected) return;
    const leave = () => {
      liveSessionsApi.leaveSession(sessionId).catch(() => {});
      const leaveUrl = `/api/v1/live-sessions/sessions/${encodeURIComponent(sessionId)}/leave`;
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(leaveUrl);
      }
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("pagehide", leave);
    };
  }, [connected, sessionId]);

  if (showPreJoin) {
    return (
      <div className="h-dvh min-h-dvh bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 text-center mb-1">
            {t("room.preJoin.title")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-2">
            {roomName}
          </p>
          <p className="text-xs text-gray-400 text-center mb-6">
            {t("room.preJoin.subtitle")}
          </p>
          <PreJoinForm onJoin={handleJoin} />
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      audio={audioCapture}
      video={videoCapture}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onTokenRefresh={onTokenRefresh}
    >
      <LiveRoom
        roomName={roomName}
        sessionId={sessionId}
        ownerId={ownerId}
        onLeave={handleLeave}
        onEndSession={handleEndSession}
      />
    </LiveKitRoom>
  );
}

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();

  const isReplay = searchParams.get("mode") === "replay";
  const [tokenData, setTokenData] = useState<JoinTokenResponse | null>(null);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // LiveKit tokens are short-lived credentials: they are fetched over the
  // authenticated API and held only in React state. They must never appear in
  // the URL (which leaks into logs, referrers, and the browser history).
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setErrorMessage(null);

    const tokenRequest = isReplay
      ? liveSessionsApi.getReplay(sessionId)
      : liveSessionsApi.getJoinToken(sessionId);

    tokenRequest
      .then((res) => {
        if (!cancelled) setTokenData(res);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(true);
          const code = err?.code || err?.status;
          if (
            code === "NOT_BOOKED" ||
            err?.message?.toLowerCase().includes("not booked")
          ) {
            setErrorMessage(t("errors.notBooked"));
          } else if (
            code === "NOT_APPROVED" ||
            err?.message?.toLowerCase().includes("not approved")
          ) {
            setErrorMessage(t("errors.notApproved"));
          } else if (
            code === "NOT_LIVE" ||
            err?.message?.toLowerCase().includes("not live")
          ) {
            setErrorMessage(t("errors.notLive"));
          } else if (
            code === "SESSION_FULL" ||
            err?.message?.toLowerCase().includes("capacity")
          ) {
            setErrorMessage(t("errors.sessionFull"));
          } else if (err?.message) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage(t("errors.noRoom"));
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // ownerId drives host-only UI; read it from the session, never from a
    // user-supplied URL parameter.
    liveSessionsApi
      .getSession(sessionId)
      .then((s) => {
        if (!cancelled) setOwnerId(s.ownerId);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sessionId, isReplay, t]);

  if (loading) {
    return (
      <div
        dir={dir}
        className="h-dvh min-h-dvh bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center"
      >
        <div className="text-center max-w-md mx-auto px-4">
          <Video className="h-12 w-12 text-gray-300 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500 dark:text-slate-400">
            {t("room.connecting")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !tokenData || !tokenData.token || !tokenData.roomName) {
    return (
      <div
        dir={dir}
        className="h-dvh min-h-dvh bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center"
      >
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl text-gray-900 dark:text-slate-100 font-semibold mb-2">
            {t("room.disconnected")}
          </h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">
            {errorMessage || t("errors.noRoom")}
          </p>
          <PodaciumButton
            variant="primary"
            onClick={() => router.push(`/live/${sessionId}`)}
          >
            {t("room.leave")}
          </PodaciumButton>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir}>
      <RoomContent
        token={tokenData.token}
        serverUrl={tokenData.serverUrl}
        roomName={tokenData.roomName}
        sessionId={sessionId}
        ownerId={ownerId}
        onTokenRefresh={() => liveSessionsApi.refreshToken(sessionId)}
      />
    </div>
  );
}
