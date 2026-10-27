// components/course/adapters/PlayerAdapter.ts
/**
 * Universal Player Adapter interface.
 * Standardizes player controls, events, and telemetry across native HTML5/HLS.js,
 * YouTube IFrame API, Vimeo Player SDK, and Dailymotion JS Player.
 */

export type PlayerEvent =
  "play" | "pause" | "timeupdate" | "ended" | "buffering" | "canplay" | "error";

export type PlayerEventListener = (...args: any[]) => void;

export interface QualityLevel {
  id: number;
  height: number;
  name: string;
}

export interface PlayerAdapter {
  readonly provider: "HLS" | "YOUTUBE" | "VIMEO" | "DAILYMOTION" | "HTML5";

  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void; // 0.0 to 1.0
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;

  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  isMuted(): boolean;
  getPlaybackRate(): number;

  getQualityLevels?(): QualityLevel[];
  setQualityLevel?(levelId: number): void;

  on(event: PlayerEvent, listener: PlayerEventListener): void;
  off(event: PlayerEvent, listener: PlayerEventListener): void;
  destroy(): void;
}
