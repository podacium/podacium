// components/course/adapters/NativeHlsAdapter.ts
import Hls from "hls.js";
import {
  PlayerAdapter,
  PlayerEvent,
  PlayerEventListener,
  QualityLevel,
} from "./PlayerAdapter";

export class NativeHlsAdapter implements PlayerAdapter {
  readonly provider = "HLS";
  private video: HTMLVideoElement;
  private hls: Hls | null = null;
  private listeners: Map<PlayerEvent, Set<PlayerEventListener>> = new Map();

  constructor(videoElement: HTMLVideoElement, hlsInstance?: Hls | null) {
    this.video = videoElement;
    this.hls = hlsInstance || null;
    this.attachDomEvents();
  }

  private attachDomEvents() {
    this.video.addEventListener("play", () => this.emit("play"));
    this.video.addEventListener("pause", () => this.emit("pause"));
    this.video.addEventListener("timeupdate", () =>
      this.emit("timeupdate", this.getCurrentTime()),
    );
    this.video.addEventListener("ended", () => this.emit("ended"));
    this.video.addEventListener("waiting", () => this.emit("buffering"));
    this.video.addEventListener("canplay", () => this.emit("canplay"));
    this.video.addEventListener("error", (e) => this.emit("error", e));
  }

  async play(): Promise<void> {
    return this.video.play();
  }

  pause(): void {
    this.video.pause();
  }

  seek(seconds: number): void {
    this.video.currentTime = Math.max(0, Math.min(seconds, this.getDuration()));
  }

  setVolume(volume: number): void {
    this.video.volume = Math.max(0, Math.min(volume, 1));
  }

  setMuted(muted: boolean): void {
    this.video.muted = muted;
  }

  setPlaybackRate(rate: number): void {
    this.video.playbackRate = rate;
  }

  getCurrentTime(): number {
    return this.video.currentTime || 0;
  }

  getDuration(): number {
    return this.video.duration || 0;
  }

  getVolume(): number {
    return this.video.volume;
  }

  isMuted(): boolean {
    return this.video.muted;
  }

  getPlaybackRate(): number {
    return this.video.playbackRate;
  }

  getQualityLevels(): QualityLevel[] {
    if (!this.hls || !this.hls.levels) return [];
    return this.hls.levels.map((lvl, index) => ({
      id: index,
      height: lvl.height || 0,
      name: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
    }));
  }

  setQualityLevel(levelId: number): void {
    if (this.hls) {
      this.hls.currentLevel = levelId;
    }
  }

  on(event: PlayerEvent, listener: PlayerEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: PlayerEvent, listener: PlayerEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: PlayerEvent, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  destroy(): void {
    this.listeners.clear();
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }
}
