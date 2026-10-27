// components/course/adapters/VimeoAdapter.ts
import {
  PlayerAdapter,
  PlayerEvent,
  PlayerEventListener,
  QualityLevel,
} from "./PlayerAdapter";

export class VimeoAdapter implements PlayerAdapter {
  readonly provider = "VIMEO";
  private playerInstance: any;
  private listeners: Map<PlayerEvent, Set<PlayerEventListener>> = new Map();
  private currentTime: number = 0;
  private duration: number = 0;
  private volume: number = 1;
  private muted: boolean = false;
  private playbackRate: number = 1;

  constructor(playerInstance: any) {
    this.playerInstance = playerInstance;
    this.initVimeoListeners();
  }

  private initVimeoListeners() {
    if (!this.playerInstance?.on) return;

    this.playerInstance.on("play", () => this.emit("play"));
    this.playerInstance.on("pause", () => this.emit("pause"));
    this.playerInstance.on(
      "timeupdate",
      (data: { seconds: number; duration: number }) => {
        this.currentTime = data.seconds;
        this.duration = data.duration;
        this.emit("timeupdate", data.seconds);
      },
    );
    this.playerInstance.on("ended", () => this.emit("ended"));
    this.playerInstance.on("bufferstart", () => this.emit("buffering"));
    this.playerInstance.on("loaded", () => this.emit("canplay"));
    this.playerInstance.on("error", (e: any) => this.emit("error", e));
  }

  async play(): Promise<void> {
    if (this.playerInstance?.play) {
      await this.playerInstance.play();
    }
  }

  pause(): void {
    if (this.playerInstance?.pause) {
      this.playerInstance.pause();
    }
  }

  seek(seconds: number): void {
    if (this.playerInstance?.setCurrentTime) {
      this.playerInstance.setCurrentTime(seconds);
      this.currentTime = seconds;
    }
  }

  setVolume(volume: number): void {
    if (this.playerInstance?.setVolume) {
      this.playerInstance.setVolume(volume);
      this.volume = volume;
    }
  }

  setMuted(muted: boolean): void {
    if (this.playerInstance?.setMuted) {
      this.playerInstance.setMuted(muted);
      this.muted = muted;
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.playerInstance?.setPlaybackRate) {
      this.playerInstance.setPlaybackRate(rate);
      this.playbackRate = rate;
    }
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  getQualityLevels(): QualityLevel[] {
    return [];
  }

  setQualityLevel(): void {}

  on(event: PlayerEvent, listener: PlayerEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: PlayerEvent, listener: PlayerEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: PlayerEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  destroy(): void {
    this.listeners.clear();
    this.playerInstance = null;
  }
}
