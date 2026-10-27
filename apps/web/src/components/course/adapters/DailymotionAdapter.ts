// components/course/adapters/DailymotionAdapter.ts
import {
  PlayerAdapter,
  PlayerEvent,
  PlayerEventListener,
  QualityLevel,
} from "./PlayerAdapter";

export class DailymotionAdapter implements PlayerAdapter {
  readonly provider = "DAILYMOTION";
  private playerInstance: any;
  private listeners: Map<PlayerEvent, Set<PlayerEventListener>> = new Map();

  constructor(playerInstance: any) {
    this.playerInstance = playerInstance;
  }

  async play(): Promise<void> {
    if (this.playerInstance?.play) {
      this.playerInstance.play();
    }
  }

  pause(): void {
    if (this.playerInstance?.pause) {
      this.playerInstance.pause();
    }
  }

  seek(seconds: number): void {
    if (this.playerInstance?.seek) {
      this.playerInstance.seek(seconds);
    }
  }

  setVolume(volume: number): void {
    if (this.playerInstance?.setVolume) {
      this.playerInstance.setVolume(volume);
    }
  }

  setMuted(muted: boolean): void {
    if (this.playerInstance?.setMuted) {
      this.playerInstance.setMuted(muted);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.playerInstance?.setPlaybackSpeed) {
      this.playerInstance.setPlaybackSpeed(rate);
    }
  }

  getCurrentTime(): number {
    return this.playerInstance?.currentTime || 0;
  }

  getDuration(): number {
    return this.playerInstance?.duration || 0;
  }

  getVolume(): number {
    return this.playerInstance?.volume ?? 1;
  }

  isMuted(): boolean {
    return this.playerInstance?.muted ?? false;
  }

  getPlaybackRate(): number {
    return this.playerInstance?.playbackSpeed ?? 1;
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

  emit(event: PlayerEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  destroy(): void {
    this.listeners.clear();
    this.playerInstance = null;
  }
}
