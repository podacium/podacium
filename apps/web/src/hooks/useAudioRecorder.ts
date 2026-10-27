"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // in seconds
  waveformData: number[]; // normalized 0..100 amplitude bars
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    waveformData: [],
    audioBlob: null,
    audioUrl: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupAudioNodes = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    cleanupAudioNodes();
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup Web Audio Analyser
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      // Choose supported mimeType
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioBlob,
          audioUrl,
        }));
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        waveformData: [],
        audioBlob: null,
        audioUrl: null,
        error: null,
      });

      // Duration timer
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Waveform sampling loop
      const sampleWaveform = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / dataArrayRef.current.length;
        const normalized = Math.min(100, Math.round((average / 255) * 100));

        setState((prev) => ({
          ...prev,
          waveformData: [
            ...prev.waveformData.slice(-40),
            Math.max(15, normalized),
          ],
        }));

        animationFrameRef.current = requestAnimationFrame(sampleWaveform);
      };

      animationFrameRef.current = requestAnimationFrame(sampleWaveform);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to access microphone",
        isRecording: false,
      }));
    }
  }, [cleanupAudioNodes]);

  const stopRecording = useCallback(() => {
    cleanupAudioNodes();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, [cleanupAudioNodes]);

  const cancelRecording = useCallback(() => {
    cleanupAudioNodes();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      waveformData: [],
      audioBlob: null,
      audioUrl: null,
      error: null,
    });
  }, [cleanupAudioNodes]);

  useEffect(() => {
    return () => {
      cleanupAudioNodes();
    };
  }, [cleanupAudioNodes]);

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
