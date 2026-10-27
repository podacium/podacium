"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Camera, CameraOff, Mic, MicOff, User, Volume2 } from "lucide-react";
import { usePersistentUserChoices } from "@livekit/components-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import { useTranslations } from "@/lib/i18n";

interface Props {
  onJoin: (deviceInfo: {
    audioDeviceId: string;
    videoDeviceId: string;
    username: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  }) => void;
}

function MicVolumeMeter({
  stream,
  enabled,
}: {
  stream: MediaStream | null;
  enabled: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !enabled) {
      if (barRef.current) barRef.current.style.width = "0%";
      return;
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    let animId: number;
    try {
      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(
        new MediaStream([audioTrack]),
      );
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!audioContextRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let max = 0;
        for (const val of dataArray) {
          const abs = Math.abs(val - 128);
          if (abs > max) max = abs;
        }
        const level = Math.min(max / 128, 1);
        if (barRef.current) {
          barRef.current.style.width = `${Math.round(level * 100)}%`;
        }
        animId = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext not supported or permission denied
    }

    return () => {
      cancelAnimationFrame(animId);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [stream, enabled]);

  if (!enabled) return null;

  return (
    <div className="absolute bottom-2 start-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
      <Volume2 className="h-3.5 w-3.5 text-white" />
      <div className="w-16 h-1.5 bg-gray-600 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full bg-green-400 transition-all duration-75 rounded-full"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
}

export function PreJoinForm({ onJoin }: Props) {
  const t = useTranslations("live");
  const {
    userChoices,
    saveUsername,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices();

  const [cameraEnabled, setCameraEnabled] = useState(userChoices.videoEnabled);
  const [micEnabled, setMicEnabled] = useState(userChoices.audioEnabled);
  const [username, setUsername] = useState(userChoices.username || "");
  const [videoDeviceId, setVideoDeviceId] = useState(userChoices.videoDeviceId);
  const [audioDeviceId, setAudioDeviceId] = useState(userChoices.audioDeviceId);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Enumerate devices
  useEffect(() => {
    const listDevices = () => {
      navigator.mediaDevices?.enumerateDevices().then((devices) => {
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
      });
    };
    listDevices();
    navigator.mediaDevices?.addEventListener("devicechange", listDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener("devicechange", listDevices);
  }, []);

  // Start/stop local preview stream
  useEffect(() => {
    let cancelled = false;
    let currentStream: MediaStream | null = null;

    const startPreview = async () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (!cameraEnabled && !micEnabled) {
        setLocalStream(null);
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: cameraEnabled
            ? videoDeviceId
              ? { deviceId: { ideal: videoDeviceId } }
              : true
            : false,
          audio: micEnabled
            ? audioDeviceId
              ? { deviceId: { ideal: audioDeviceId } }
              : true
            : false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        currentStream = stream;
        setLocalStream(stream);

        if (videoRef.current && cameraEnabled) {
          videoRef.current.srcObject = stream;
        }

        // Re-enumerate devices with newly granted permissions to get real device names
        navigator.mediaDevices
          ?.enumerateDevices()
          .then((devices) => {
            if (!cancelled) {
              setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
              setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
            }
          })
          .catch(() => {});
      } catch (err) {
        console.warn("PreJoin media capture error:", err);
        // If combined capture fails, attempt video-only or fallback gracefully
        if (cameraEnabled && micEnabled) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: videoDeviceId
                ? { deviceId: { ideal: videoDeviceId } }
                : true,
              audio: false,
            });
            if (cancelled) {
              fallbackStream.getTracks().forEach((t) => t.stop());
              return;
            }
            currentStream = fallbackStream;
            setLocalStream(fallbackStream);
            setMicEnabled(false);
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
            return;
          } catch {
            setCameraEnabled(false);
          }
        } else {
          if (cameraEnabled) setCameraEnabled(false);
          if (micEnabled) setMicEnabled(false);
        }
      }
    };
    startPreview();

    return () => {
      cancelled = true;
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraEnabled, micEnabled, videoDeviceId, audioDeviceId]);

  const [joining, setJoining] = useState(false);

  // Attach/detach video stream
  useEffect(() => {
    if (videoRef.current && localStream && cameraEnabled) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraEnabled]);

  const handleJoin = useCallback(async () => {
    if (joining) return;
    setJoining(true);

    saveUsername(username);
    saveAudioInputEnabled(micEnabled);
    saveVideoInputEnabled(cameraEnabled);
    const resolvedAudioId = audioDeviceId || audioDevices[0]?.deviceId || "";
    const resolvedVideoId = videoDeviceId || videoDevices[0]?.deviceId || "";
    saveAudioInputDeviceId(resolvedAudioId);
    saveVideoInputDeviceId(resolvedVideoId);

    // Stop preview tracks to release hardware locks before LiveKit attempts capture
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }

    // Brief delay to allow the operating system and camera driver to complete
    // device teardown, preventing NotReadableError: Could not start video source
    await new Promise((resolve) => setTimeout(resolve, 100));

    onJoin({
      audioDeviceId: micEnabled ? resolvedAudioId : "",
      videoDeviceId: cameraEnabled ? resolvedVideoId : "",
      audioEnabled: micEnabled,
      videoEnabled: cameraEnabled,
      username: username || "Anonymous",
    });
  }, [
    joining,
    username,
    micEnabled,
    cameraEnabled,
    audioDeviceId,
    videoDeviceId,
    audioDevices,
    videoDevices,
    localStream,
    onJoin,
    saveUsername,
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  ]);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="aspect-video bg-gray-100 dark:bg-slate-800 flex items-center justify-center relative">
          {cameraEnabled && localStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="text-center text-gray-400">
              <CameraOff className="h-10 w-10 mx-auto mb-2" />
              <span className="text-sm">{t("room.preJoin.noCamera")}</span>
            </div>
          )}

          {/* Mic level indicator */}
          <MicVolumeMeter stream={localStream} enabled={micEnabled} />
        </div>

        <div className="p-4 space-y-3">
          <PodaciumInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("room.preJoin.yourNamePlaceholder")}
            leftIcon={<User className="h-4 w-4" />}
            label={t("room.preJoin.yourName")}
          />

          <div className="flex gap-2">
            <PodaciumButton
              variant={cameraEnabled ? "primary" : "secondary"}
              size="sm"
              onClick={() => setCameraEnabled(!cameraEnabled)}
              icon={
                cameraEnabled ? (
                  <Camera className="h-4 w-4" />
                ) : (
                  <CameraOff className="h-4 w-4" />
                )
              }
            >
              {cameraEnabled
                ? t("room.preJoin.camera")
                : t("room.preJoin.noCamera")}
            </PodaciumButton>
            <PodaciumButton
              variant={micEnabled ? "primary" : "secondary"}
              size="sm"
              onClick={() => setMicEnabled(!micEnabled)}
              icon={
                micEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )
              }
            >
              {micEnabled
                ? t("room.preJoin.microphone")
                : t("room.preJoin.noMic")}
            </PodaciumButton>
          </div>

          <PodaciumSelect
            value={videoDeviceId}
            onChange={(e) => {
              setVideoDeviceId(e.target.value);
              saveVideoInputDeviceId(e.target.value);
            }}
            label={t("room.preJoin.camera")}
            options={videoDevices.map((d) => ({
              value: d.deviceId,
              label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
            }))}
          />

          <PodaciumSelect
            value={audioDeviceId}
            onChange={(e) => {
              setAudioDeviceId(e.target.value);
              saveAudioInputDeviceId(e.target.value);
            }}
            label={t("room.preJoin.microphone")}
            options={audioDevices.map((d) => ({
              value: d.deviceId,
              label: d.label || `Mic ${d.deviceId.slice(0, 8)}`,
            }))}
          />
        </div>
      </div>

      <PodaciumButton
        variant="primary"
        className="w-full"
        disabled={joining}
        onClick={handleJoin}
      >
        {joining ? t("room.connecting") : t("room.preJoin.joinButton")}
      </PodaciumButton>
    </div>
  );
}
