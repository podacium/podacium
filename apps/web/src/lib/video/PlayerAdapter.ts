export interface UnifiedPlayerAdapter {
  play(): Promise<void>;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}

export class NativeHlsPlayerAdapter implements UnifiedPlayerAdapter {
  private videoEl: HTMLVideoElement;

  constructor(videoEl: HTMLVideoElement) {
    this.videoEl = videoEl;
  }

  async play(): Promise<void> {
    return this.videoEl.play();
  }

  pause(): void {
    this.videoEl.pause();
  }

  seekTo(seconds: number): void {
    this.videoEl.currentTime = seconds;
  }

  setVolume(volume: number): void {
    this.videoEl.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean): void {
    this.videoEl.muted = muted;
  }

  setPlaybackRate(rate: number): void {
    this.videoEl.playbackRate = rate;
  }

  getCurrentTime(): number {
    return this.videoEl.currentTime || 0;
  }

  getDuration(): number {
    return this.videoEl.duration || 0;
  }
}

export class YouTubePlayerAdapter implements UnifiedPlayerAdapter {
  private iframeEl: HTMLIFrameElement;
  private currentTime: number = 0;
  private duration: number = 0;

  constructor(iframeEl: HTMLIFrameElement) {
    this.iframeEl = iframeEl;
  }

  private postCommand(func: string, args: any[] = []): void {
    if (this.iframeEl && this.iframeEl.contentWindow) {
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*",
      );
    }
  }

  async play(): Promise<void> {
    this.postCommand("playVideo");
  }

  pause(): void {
    this.postCommand("pauseVideo");
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.postCommand("seekTo", [seconds, true]);
  }

  setVolume(volume: number): void {
    this.postCommand("setVolume", [volume * 100]);
  }

  setMuted(muted: boolean): void {
    if (muted) {
      this.postCommand("mute");
    } else {
      this.postCommand("unMute");
    }
  }

  setPlaybackRate(rate: number): void {
    this.postCommand("setPlaybackRate", [rate]);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  updateState(currentTime: number, duration: number): void {
    this.currentTime = currentTime;
    this.duration = duration;
  }
}

export class VimeoPlayerAdapter implements UnifiedPlayerAdapter {
  private iframeEl: HTMLIFrameElement;
  private currentTime: number = 0;
  private duration: number = 0;

  constructor(iframeEl: HTMLIFrameElement) {
    this.iframeEl = iframeEl;
  }

  private postMessage(payload: Record<string, any>): void {
    if (this.iframeEl && this.iframeEl.contentWindow) {
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify(payload),
        "https://player.vimeo.com",
      );
    }
  }

  async play(): Promise<void> {
    this.postMessage({ method: "play" });
  }

  pause(): void {
    this.postMessage({ method: "pause" });
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.postMessage({ method: "seekTo", value: seconds });
  }

  setVolume(volume: number): void {
    this.postMessage({
      method: "setVolume",
      value: Math.max(0, Math.min(1, volume)),
    });
  }

  setMuted(muted: boolean): void {
    this.postMessage({ method: "setVolume", value: muted ? 0 : 1 });
  }

  setPlaybackRate(rate: number): void {
    this.postMessage({ method: "setPlaybackRate", value: rate });
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  updateState(currentTime: number, duration: number): void {
    this.currentTime = currentTime;
    this.duration = duration;
  }
}

export class DailymotionPlayerAdapter implements UnifiedPlayerAdapter {
  private iframeEl: HTMLIFrameElement;
  private currentTime: number = 0;
  private duration: number = 0;

  constructor(iframeEl: HTMLIFrameElement) {
    this.iframeEl = iframeEl;
  }

  private postCommand(command: string, parameters: any[] = []): void {
    if (this.iframeEl && this.iframeEl.contentWindow) {
      this.iframeEl.contentWindow.postMessage(
        JSON.stringify({ command, parameters }),
        "*",
      );
    }
  }

  async play(): Promise<void> {
    this.postCommand("play");
  }

  pause(): void {
    this.postCommand("pause");
  }

  seekTo(seconds: number): void {
    this.currentTime = seconds;
    this.postCommand("seek", [seconds]);
  }

  setVolume(volume: number): void {
    this.postCommand("volume", [volume]);
  }

  setMuted(muted: boolean): void {
    this.postCommand("muted", [muted]);
  }

  setPlaybackRate(rate: number): void {
    this.postCommand("playbackRate", [rate]);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  updateState(currentTime: number, duration: number): void {
    this.currentTime = currentTime;
    this.duration = duration;
  }
}
