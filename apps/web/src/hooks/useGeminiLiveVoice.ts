"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type LiveVoiceStatus =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "connected"
  | "speaking"
  | "listening"
  | "interrupted"
  | "error";

export interface LiveVoiceTranscript {
  id: string;
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

export interface UseGeminiLiveVoiceOptions {
  /**
   * WebSocket or gateway endpoint URL (e.g. /api/v1/agent/live-voice or ws://...)
   */
  endpointUrl?: string;
  /**
   * Trilingual locale instruction or language code: 'ar-DZ' | 'fr-DZ' | 'en' | 'auto'
   */
  language?: string;
  /**
   * System voice name (e.g. 'Puck', 'Aoede', 'Charon', 'Kore', 'Fenrir')
   */
  voiceName?: string;
  /**
   * Custom instructions for trilingual Algerian code-switching & business domain
   */
  systemInstruction?: string;
  /**
   * Event callbacks
   */
  onTranscript?: (transcript: LiveVoiceTranscript) => void;
  onInterrupted?: () => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: LiveVoiceStatus) => void;
}

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are Podacium's elite real-time AI copilot, operating in Algeria and the Maghreb. " +
  "You are naturally fluent in Algerian Darija (written in Arabic script: الدارجة الجزائرية), " +
  "French (Français professionnel), and Tech English. Seamlessly code-switch between these three " +
  "languages according to user preference, matching local Algerian cultural, fiscal, and business nuances.";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useGeminiLiveVoice(options: UseGeminiLiveVoiceOptions = {}) {
  const {
    endpointUrl,
    language = "auto",
    voiceName = "Puck",
    systemInstruction = DEFAULT_SYSTEM_INSTRUCTION,
    onTranscript,
    onInterrupted,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<LiveVoiceStatus>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [speakerVolume, setSpeakerVolume] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [transcripts, setTranscripts] = useState<LiveVoiceTranscript[]>([]);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Refs for audio hardware and networking
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null);

  const updateStatus = useCallback(
    (newStatus: LiveVoiceStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange],
  );

  /**
   * Instantly cut off assistant audio playback upon user interruption (barge-in)
   */
  const interruptPlayback = useCallback(() => {
    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ type: "flush" });
    }
    setIsSpeaking(false);
    updateStatus("interrupted");
    onInterrupted?.();
  }, [updateStatus, onInterrupted]);

  /**
   * Teardown all audio contexts, nodes, and websocket connections
   */
  const cleanup = useCallback(async () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (recorderNodeRef.current) {
      recorderNodeRef.current.port.postMessage({ type: "pause" });
      recorderNodeRef.current.disconnect();
      recorderNodeRef.current = null;
    }

    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ type: "flush" });
      playerNodeRef.current.disconnect();
      playerNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        await audioContextRef.current.close();
      } catch {
        // Ignored
      }
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setIsListening(false);
    setMicVolume(0);
    setSpeakerVolume(0);
  }, []);

  /**
   * Initialize AudioWorklets & Web Audio Context
   */
  const initAudioWorklet = useCallback(async () => {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    // Use default sample rate (or 16000 if supported) for maximum hardware compatibility
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    audioContextRef.current = ctx;

    // Load recorder and player processors
    await Promise.all([
      ctx.audioWorklet.addModule("/audio/pcm-recorder-processor.js"),
      ctx.audioWorklet.addModule("/audio/pcm-player-processor.js"),
    ]);

    // Setup Player Node (jitter buffer, 24kHz downsampling)
    const playerNode = new AudioWorkletNode(ctx, "pcm-player-processor", {
      processorOptions: { inputSampleRate: 24000 },
    });

    const speakerAnalyser = ctx.createAnalyser();
    speakerAnalyser.fftSize = 256;
    playerNode.connect(speakerAnalyser);
    speakerAnalyser.connect(ctx.destination);

    playerNode.port.onmessage = (e) => {
      if (e.data?.event === "underrun") {
        setIsSpeaking(false);
      }
    };

    playerNodeRef.current = playerNode;
    speakerAnalyserRef.current = speakerAnalyser;

    // Setup Microphone Input & Recorder Node (16kHz PCM Int16 mono)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    mediaStreamRef.current = stream;

    const micSource = ctx.createMediaStreamSource(stream);
    const micAnalyser = ctx.createAnalyser();
    micAnalyser.fftSize = 256;
    micSource.connect(micAnalyser);
    micAnalyserRef.current = micAnalyser;

    const recorderNode = new AudioWorkletNode(ctx, "pcm-recorder-processor", {
      processorOptions: { bufferSize: 2048 },
    });

    micSource.connect(recorderNode);
    // Recorder node does not need to connect to destination (it only captures)

    recorderNode.port.onmessage = (e) => {
      const { event: evtType, buffer } = e.data || {};
      if (
        evtType === "chunk" &&
        buffer &&
        wsRef.current?.readyState === WebSocket.OPEN
      ) {
        if (!isMutedRef.current) {
          const base64Audio = arrayBufferToBase64(buffer);
          // Stream raw 16kHz PCM audio chunk
          wsRef.current.send(
            JSON.stringify({
              realtime_input: {
                media_chunks: [
                  {
                    mime_type: "audio/pcm;rate=16000",
                    data: base64Audio,
                  },
                ],
              },
            }),
          );
        }
      }
    };

    recorderNodeRef.current = recorderNode;

    // Amplitude measurement loop for audio visualization (throttled to max 10fps for 60fps UI performance)
    const micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
    const spkDataArray = new Uint8Array(speakerAnalyser.frequencyBinCount);
    let lastMeterTime = 0;

    const updateAudioMeters = (currentTime: number) => {
      if (currentTime - lastMeterTime >= 95) {
        lastMeterTime = currentTime;
        if (micAnalyserRef.current) {
          micAnalyserRef.current.getByteFrequencyData(micDataArray);
          let sum = 0;
          for (let i = 0; i < micDataArray.length; i++) {
            sum += micDataArray[i];
          }
          const avg = sum / micDataArray.length / 255;
          setMicVolume(avg);
          setIsListening(avg > 0.05);
        }

        if (speakerAnalyserRef.current) {
          speakerAnalyserRef.current.getByteFrequencyData(spkDataArray);
          let sum = 0;
          for (let i = 0; i < spkDataArray.length; i++) {
            sum += spkDataArray[i];
          }
          const avg = sum / spkDataArray.length / 255;
          setSpeakerVolume(avg);
        }
      }

      animFrameRef.current = requestAnimationFrame(updateAudioMeters);
    };

    animFrameRef.current = requestAnimationFrame(updateAudioMeters);
  }, []);

  /**
   * Start bidirectional live voice session
   */
  const startSession = useCallback(async () => {
    try {
      setError(null);
      updateStatus("requesting_permission");

      // Initialize audio pipeline
      await initAudioWorklet();

      updateStatus("connecting");

      // Build WebSocket Gateway URL
      let wsUrl: string;
      if (endpointUrl) {
        wsUrl = endpointUrl;
      } else {
        const apiBase =
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost:8000");
        const protocol = apiBase.startsWith("https") ? "wss:" : "ws:";
        const host = apiBase.replace(/^https?:\/\//, "").replace(/\/$/, "");
        wsUrl = `${protocol}//${host}/api/v1/agent/live-voice`;
      }

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        updateStatus("connected");

        // Send Session Setup Configuration Frame (Bilingual / Trilingual setup)
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generation_config: {
              response_modalities: ["audio"],
              speech_config: {
                voice_config: {
                  prebuilt_voice_config: {
                    voice_name: voiceName,
                  },
                },
              },
            },
            system_instruction: {
              parts: [
                {
                  text: `${systemInstruction}\nTarget language code: ${language}`,
                },
              ],
            },
          },
        };
        socket.send(JSON.stringify(setupMessage));
      };

      socket.onmessage = (evt) => {
        try {
          if (typeof evt.data === "string") {
            const data = JSON.parse(evt.data);

            // 1. Handle Server Barge-in / Interruption signal
            if (
              data.interrupted ||
              data.serverContent?.interrupted ||
              data.type === "interrupted"
            ) {
              interruptPlayback();
              return;
            }

            // 2. Handle Model Output PCM Audio Turn
            const parts = data.serverContent?.modelTurn?.parts || data.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                // If model returns audio
                if (part.inlineData?.data) {
                  const pcmBuffer = base64ToArrayBuffer(part.inlineData.data);
                  if (playerNodeRef.current) {
                    setIsSpeaking(true);
                    updateStatus("speaking");
                    playerNodeRef.current.port.postMessage(
                      {
                        type: "audio",
                        buffer: pcmBuffer,
                        sampleRate: 24000,
                      },
                      [pcmBuffer],
                    );
                  }
                }

                // If transcript text is attached
                if (part.text) {
                  const item: LiveVoiceTranscript = {
                    id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    role: "assistant",
                    text: part.text,
                    isFinal: true,
                    timestamp: new Date(),
                  };
                  setTranscripts((prev) => [...prev, item]);
                  onTranscript?.(item);
                }
              }
            }

            // 3. User Speech Recognition / Transcription Echo
            if (data.serverContent?.turnComplete) {
              setIsSpeaking(false);
            }

            if (data.clientTranscript) {
              const item: LiveVoiceTranscript = {
                id: `usr_${Date.now()}`,
                role: "user",
                text: data.clientTranscript,
                isFinal: true,
                timestamp: new Date(),
              };
              setTranscripts((prev) => [...prev, item]);
              onTranscript?.(item);
            }
          } else if (evt.data instanceof ArrayBuffer) {
            // Binary PCM audio frame received directly
            if (playerNodeRef.current) {
              setIsSpeaking(true);
              updateStatus("speaking");
              playerNodeRef.current.port.postMessage(
                {
                  type: "audio",
                  buffer: evt.data,
                  sampleRate: 24000,
                },
                [evt.data],
              );
            }
          }
        } catch (parseErr) {
          console.error(
            "[useGeminiLiveVoice] Error parsing incoming frame:",
            parseErr,
          );
        }
      };

      socket.onerror = (evt) => {
        const err = new Error("WebSocket error occurred in live voice session");
        setError(err);
        updateStatus("error");
        onError?.(err);
      };

      socket.onclose = () => {
        setIsConnected(false);
        updateStatus("idle");
      };
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      updateStatus("error");
      onError?.(errorObj);
      await cleanup();
    }
  }, [
    endpointUrl,
    language,
    voiceName,
    systemInstruction,
    initAudioWorklet,
    updateStatus,
    interruptPlayback,
    cleanup,
    onTranscript,
    onError,
  ]);

  /**
   * Stop session and release audio tracks
   */
  const stopSession = useCallback(async () => {
    await cleanup();
    updateStatus("idle");
  }, [cleanup, updateStatus]);

  /**
   * Toggle microphone mute state
   */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (recorderNodeRef.current) {
        recorderNodeRef.current.port.postMessage({
          type: next ? "pause" : "resume",
        });
      }
      return next;
    });
  }, []);

  /**
   * Send a textual chat message during a live duplex session
   */
  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && text.trim()) {
      wsRef.current.send(
        JSON.stringify({
          client_content: {
            turns: [
              {
                role: "user",
                parts: [{ text: text.trim() }],
              },
            ],
            turn_complete: true,
          },
        }),
      );
    }
  }, []);

  /**
   * Send an image frame (JPEG base64) for real-time multimodal vision
   */
  const sendImageFrame = useCallback((base64Jpeg: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && base64Jpeg) {
      const cleanBase64 = base64Jpeg.replace(/^data:image\/[a-z]+;base64,/, "");
      wsRef.current.send(
        JSON.stringify({
          realtime_input: {
            media_chunks: [
              {
                mime_type: "image/jpeg",
                data: cleanBase64,
              },
            ],
          },
        }),
      );
    }
  }, []);

  // Teardown when component unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    isConnected,
    isMuted,
    isSpeaking,
    isListening,
    micVolume,
    speakerVolume,
    error,
    transcripts,
    startSession,
    stopSession,
    toggleMute,
    interruptPlayback,
    sendTextMessage,
    sendImageFrame,
  };
}
