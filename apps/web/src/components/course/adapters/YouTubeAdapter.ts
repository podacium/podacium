// components/course/adapters/YouTubeAdapter.ts
import {
  PlayerAdapter,
  PlayerEvent,
  PlayerEventListener,
  QualityLevel,
} from "./PlayerAdapter";

export class YouTubeAdapter implements PlayerAdapter {
  readonly provider = "YOUTUBE";
  private playerInstance: any;
  private listeners: Map<PlayerEvent, Set<PlayerEventListener>> = new Map();

  constructor(playerInstance: any) {
    this.playerInstance = playerInstance;
  }

  async play(): Promise<void> {
    if (this.playerInstance?.playVideo) {
      this.playerInstance.playVideo();
    }
  }

  pause(): void {
    if (this.playerInstance?.pauseVideo) {
      this.playerInstance.pauseVideo();
    }
  }

  seek(seconds: number): void {
    if (this.playerInstance?.seekTo) {
      this.playerInstance.seekTo(seconds, true);
    }
  }

  setVolume(volume: number): void {
    if (this.playerInstance?.setVolume) {
      this.playerInstance.setVolume(Math.round(volume * 100));
    }
  }

  setMuted(muted: boolean): void {
    if (!this.playerInstance) return;
    if (muted && this.playerInstance.mute) {
      this.playerInstance.mute();
    } else if (!muted && this.playerInstance.unMute) {
      this.playerInstance.unMute();
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.playerInstance?.setPlaybackRate) {
      this.playerInstance.setPlaybackRate(rate);
    }
  }

  getCurrentTime(): number {
    return this.playerInstance?.getCurrentTime
      ? this.playerInstance.getCurrentTime()
      : 0;
  }

  getDuration(): number {
    return this.playerInstance?.getDuration
      ? this.playerInstance.getDuration()
      : 0;
  }

  getVolume(): number {
    return this.playerInstance?.getVolume
      ? this.playerInstance.getVolume() / 100
      : 1;
  }

  isMuted(): boolean {
    return this.playerInstance?.isMuted ? this.playerInstance.isMuted() : false;
  }

  getPlaybackRate(): number {
    return this.playerInstance?.getPlaybackRate
      ? this.playerInstance.getPlaybackRate()
      : 1;
  }

  getQualityLevels(): QualityLevel[] {
    if (!this.playerInstance?.getAvailableQualityLevels) return [];
    const levels = this.playerInstance.getAvailableQualityLevels() || [];
    return levels.map((lvl: string, idx: number) => ({
      id: idx,
      height: parseInt(lvl.replace(/[^0-9]/g, ""), 10) || 720,
      name: lvl,
    }));
  }

  setQualityLevel(levelId: number): void {
    const levels = this.getQualityLevels();
    const target = levels.find((l) => l.id === levelId);
    if (target && this.playerInstance?.setPlaybackQuality) {
      this.playerInstance.setPlaybackQuality(target.name);
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

  emit(event: PlayerEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  destroy(): void {
    this.listeners.clear();
    this.playerInstance = null;
  }
}
