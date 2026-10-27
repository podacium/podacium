/**
 * Motion-grid frame presets.
 *
 * Coordinates are `[row, column]` pairs on a square grid (5×5 by default).
 * Every state is a sequence of frames; the grid lights up the coordinates
 * present in the current frame and fades out the rest.
 *
 * Frames are plain data so they can be authored, tested and reused without
 * pulling animation code into the data layer.
 */

export type Frame = [row: number, col: number];
export type Frames = Frame[][];

export type MotionStatusState =
  | "importing"
  | "syncing"
  | "searching"
  | "busy"
  | "saving"
  | "initializing"
  | "thinking"
  | "listening"
  | "idle"
  | "success"
  | "error";

export type MotionStatusTone =
  "neutral" | "info" | "success" | "warning" | "danger";

export interface MotionGridStateConfig {
  frames: Frames;
  /** Milliseconds each frame stays on screen. */
  interval: number;
  /** Whether the sequence loops forever. */
  loop: boolean;
  /** Semantic tone used by the status pill. */
  tone: MotionStatusTone;
}

/* ────────────────────────────────────────────────────────────────
 * Core sequences
 * ──────────────────────────────────────────────────────────────── */

const importingFrames: Frames = [
  [[2, 2]],
  [
    [1, 2],
    [2, 1],
    [2, 3],
    [3, 2],
  ],
  [
    [2, 2],
    [0, 2],
    [1, 1],
    [1, 3],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 3],
    [4, 2],
  ],
  [
    [0, 1],
    [0, 3],
    [1, 0],
    [1, 2],
    [1, 4],
    [2, 1],
    [2, 3],
    [3, 0],
    [3, 2],
    [3, 4],
    [4, 1],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 2],
    [0, 4],
    [1, 1],
    [1, 3],
    [2, 0],
    [2, 2],
    [2, 4],
    [3, 1],
    [3, 3],
    [4, 0],
    [4, 2],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 3],
    [1, 0],
    [1, 2],
    [1, 4],
    [2, 1],
    [2, 3],
    [3, 0],
    [3, 2],
    [3, 4],
    [4, 1],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 2],
    [0, 4],
    [1, 1],
    [1, 3],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 3],
    [4, 0],
    [4, 2],
    [4, 4],
  ],
  [
    [0, 1],
    [1, 0],
    [3, 0],
    [4, 1],
    [0, 3],
    [1, 4],
    [3, 4],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 4],
  ],
  [],
];

const arrowDownFrames: Frames = [
  [[2, 0]],
  [
    [1, 0],
    [2, 0],
    [3, 0],
    [2, 1],
  ],
  [
    [2, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 3],
  ],
  [
    [2, 1],
    [2, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 4],
  ],
  [
    [2, 2],
    [2, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ],
  [
    [2, 3],
    [2, 4],
  ],
  [[2, 4]],
  [],
];

const arrowUpFrames: Frames = [
  [[2, 4]],
  [
    [1, 4],
    [2, 4],
    [3, 4],
    [2, 3],
  ],
  [
    [2, 4],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 2],
  ],
  [
    [2, 4],
    [2, 3],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 1],
  ],
  [
    [2, 3],
    [2, 2],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 0],
  ],
  [
    [2, 2],
    [2, 1],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [2, 1],
    [2, 0],
  ],
  [[2, 0]],
  [],
];

const syncingFrames: Frames = [...arrowDownFrames, ...arrowUpFrames];

const searchingFrames: Frames = [
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
  ],
  [
    [3, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [3, 2],
  ],
  [
    [3, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [3, 3],
  ],
  [
    [3, 2],
    [2, 3],
    [3, 3],
    [4, 3],
    [3, 4],
  ],
  [
    [1, 2],
    [0, 3],
    [1, 3],
    [2, 3],
    [1, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [],
];

const busyFrames: Frames = [
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [3, 4],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 3],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [2, 1],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
  [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 1],
    [4, 0],
    [4, 1],
    [4, 2],
  ],
];

const savingFrames: Frames = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 0],
    [3, 1],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 0],
    [4, 0],
    [4, 1],
    [4, 3],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [2, 0],
    [4, 0],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2],
    [0, 2],
    [4, 3],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [4, 1],
    [3, 1],
    [2, 1],
    [1, 1],
    [0, 1],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2],
    [0, 2],
    [4, 3],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [4, 1],
    [3, 1],
    [2, 1],
    [1, 1],
    [0, 1],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2],
    [0, 2],
    [4, 3],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [4, 1],
    [3, 1],
    [2, 1],
    [1, 1],
    [0, 1],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2],
    [0, 2],
    [4, 3],
    [3, 3],
    [2, 3],
    [1, 3],
    [0, 3],
    [4, 4],
    [3, 4],
    [2, 4],
    [1, 4],
    [0, 4],
  ],
];

const initializingFrames: Frames = [
  [],
  [
    [1, 0],
    [3, 0],
  ],
  [
    [1, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
  ],
  [
    [1, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ],
  [
    [1, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
  ],
  [
    [1, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 4],
  ],
  [
    [1, 2],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 2],
  ],
  [[2, 2]],
  [],
];

/* ────────────────────────────────────────────────────────────────
 * New sequences — thinking, listening, idle, success, error
 * ──────────────────────────────────────────────────────────────── */

/** A soft arced wave that travels up and down — used while the agent thinks. */
const thinkingFrames: Frames = [
  [
    [4, 0],
    [3, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ],
  [
    [3, 0],
    [2, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
  [
    [2, 0],
    [1, 1],
    [0, 2],
    [1, 3],
    [2, 4],
  ],
  [
    [1, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
  ],
  [
    [2, 0],
    [1, 1],
    [0, 2],
    [1, 3],
    [2, 4],
  ],
  [
    [3, 0],
    [2, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
];

/** Three vertical bars dancing like a voice equalizer. */
const listeningFrames: Frames = [
  [
    [2, 0],
    [3, 0],
    [4, 0],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [2, 4],
    [3, 4],
    [4, 4],
  ],
  [
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [2, 2],
    [3, 2],
    [4, 2],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
  ],
  [
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [2, 2],
    [3, 2],
    [4, 2],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],
  ],
];

/** A calm diamond that expands and contracts — the resting state. */
const idleFrames: Frames = [
  [[2, 2]],
  [
    [1, 2],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 2],
  ],
  [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  [
    [0, 2],
    [2, 0],
    [2, 4],
    [4, 2],
  ],
  [
    [0, 1],
    [0, 3],
    [4, 1],
    [4, 3],
  ],
  [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 4],
  ],
  [
    [0, 1],
    [0, 3],
    [4, 1],
    [4, 3],
  ],
  [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
];

/** A checkmark drawn stroke by stroke. */
const successFrames: Frames = [
  [[3, 0]],
  [
    [3, 0],
    [4, 1],
  ],
  [
    [3, 0],
    [4, 1],
    [3, 2],
  ],
  [
    [3, 0],
    [4, 1],
    [3, 2],
    [2, 3],
  ],
  [
    [3, 0],
    [4, 1],
    [3, 2],
    [2, 3],
    [1, 4],
  ],
];

/** An X drawn stroke by stroke. */
const errorFrames: Frames = [
  [[0, 0]],
  [
    [0, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 4],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 4],
    [1, 3],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 4],
    [1, 3],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 1],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 0],
  ],
];

/* ────────────────────────────────────────────────────────────────
 * State registry
 * ──────────────────────────────────────────────────────────────── */

export const MOTION_GRID_STATES: Record<
  MotionStatusState,
  MotionGridStateConfig
> = {
  importing: {
    frames: importingFrames,
    interval: 110,
    loop: true,
    tone: "info",
  },
  syncing: { frames: syncingFrames, interval: 90, loop: true, tone: "info" },
  searching: {
    frames: searchingFrames,
    interval: 110,
    loop: true,
    tone: "info",
  },
  busy: { frames: busyFrames, interval: 120, loop: true, tone: "warning" },
  saving: { frames: savingFrames, interval: 220, loop: true, tone: "info" },
  initializing: {
    frames: initializingFrames,
    interval: 100,
    loop: true,
    tone: "neutral",
  },
  thinking: {
    frames: thinkingFrames,
    interval: 140,
    loop: true,
    tone: "info",
  },
  listening: {
    frames: listeningFrames,
    interval: 120,
    loop: true,
    tone: "info",
  },
  idle: { frames: idleFrames, interval: 240, loop: true, tone: "neutral" },
  success: {
    frames: successFrames,
    interval: 90,
    loop: false,
    tone: "success",
  },
  error: { frames: errorFrames, interval: 110, loop: false, tone: "danger" },
};

/** English fallbacks used when i18n messages are unavailable. */
export const MOTION_STATUS_FALLBACK_LABELS: Record<MotionStatusState, string> =
  {
    importing: "Importing",
    syncing: "Syncing",
    searching: "Searching",
    busy: "Busy",
    saving: "Saving",
    initializing: "Initializing",
    thinking: "Thinking",
    listening: "Listening",
    idle: "Ready",
    success: "Done",
    error: "Something went wrong",
  };

/**
 * The frame that best represents a sequence when motion is disabled.
 * Prefers the last non-empty frame so success/error show their finished
 * drawing and loop states rest on a full silhouette.
 */
export function getRestingFrame(frames: Frames): number {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (frames[index] && frames[index].length > 0) return index;
  }
  return 0;
}
