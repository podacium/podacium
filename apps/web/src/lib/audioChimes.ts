/**
 * Web Audio API synthesizer for zero-latency in-room audio cues.
 * Produces pleasant, harmonic chimes for room events without downloading audio files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("podacium_live_sound_muted") === "true";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("podacium_live_sound_muted", muted ? "true" : "false");
}

/**
 * Play a gentle ascending chime (C5 -> G5) when a participant joins.
 */
export function playJoinChime(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(523.25, now); // C5
  osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5
  osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.28); // G5

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.35);
  osc2.start(now + 0.1);
  osc2.stop(now + 0.35);
}

/**
 * Play a gentle descending chime (G5 -> C5) when a participant leaves.
 */
export function playLeaveChime(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(783.99, now); // G5
  osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.22); // C5

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play a distinct soft ping (A5) when someone raises their hand.
 */
export function playHandRaiseChime(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880.0, now); // A5
  osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // D6

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.28);
}

/**
 * Play a discrete soft tap when an in-room chat message arrives.
 */
export function playChatPing(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(700.0, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}
