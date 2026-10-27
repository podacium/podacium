"use client";

import { useMemo } from "react";
import { MOTION_GRID_STATES } from "@/components/design-system/motion-grid-frames";
import type {
  MotionGridStateConfig,
  MotionStatusState,
} from "@/components/design-system/motion-grid-frames";

/**
 * Generic signals any async surface can provide. Everything is optional so
 * the hook can be fed straight from TanStack Query, an agent stream, an
 * upload mutation, or a plain boolean.
 */
export interface MotionStatusInput {
  /** First load with no cached data (TanStack Query `isLoading`). */
  isLoading?: boolean;
  /** Background refetch or revalidation (TanStack Query `isFetching`). */
  isFetching?: boolean;
  /** Agent tokens are streaming in. */
  isStreaming?: boolean;
  /** A tool call is currently executing during a stream. */
  activeTool?: string | null;
  /** Voice capture / live audio is active. */
  isListening?: boolean;
  /** A mutation is saving. */
  isSaving?: boolean;
  /** A file or data import is running. */
  isImporting?: boolean;
  /** The surface is bootstrapping for the first time. */
  isInitializing?: boolean;
  /** Generic long-running task. */
  isBusy?: boolean;
  /** A terminal success state (e.g. mutation just succeeded). */
  success?: boolean;
  /** A terminal failure state. Any truthy value wins over everything else. */
  error?: unknown;
}

/**
 * Map arbitrary async signals to a single motion-grid state.
 *
 * Precedence is intentional: a failure is always shown, live listening takes
 * over the indicator, terminal success wins over background refetches, and
 * foreground work outranks idle.
 */
export function deriveMotionStatus(
  input: MotionStatusInput = {},
): MotionStatusState {
  if (input.error) return "error";
  if (input.isListening) return "listening";
  if (input.isImporting) return "importing";
  if (input.isInitializing) return "initializing";
  if (input.isSaving) return "saving";
  if (input.isBusy) return "busy";
  if (input.isStreaming) return input.activeTool ? "busy" : "thinking";
  if (input.success) return "success";
  if (input.isFetching) return "syncing";
  if (input.isLoading) return "searching";
  return "idle";
}

export interface UseMotionStatusResult {
  state: MotionStatusState;
  config: MotionGridStateConfig;
}

/**
 * Reactive wrapper around {@link deriveMotionStatus}. Returns the state plus
 * its frame config so callers can render `<PodaciumMotionStatus state={state} />`
 * or drive a bare `<PodaciumMotionGrid />`.
 */
export function useMotionStatus(
  input: MotionStatusInput = {},
): UseMotionStatusResult {
  const {
    isLoading,
    isFetching,
    isStreaming,
    activeTool,
    isListening,
    isSaving,
    isImporting,
    isInitializing,
    isBusy,
    success,
    error,
  } = input;

  const hasError = Boolean(error);

  const state = useMemo(
    () =>
      deriveMotionStatus({
        isLoading,
        isFetching,
        isStreaming,
        activeTool,
        isListening,
        isSaving,
        isImporting,
        isInitializing,
        isBusy,
        success,
        error: hasError,
      }),
    [
      activeTool,
      hasError,
      isBusy,
      isFetching,
      isImporting,
      isInitializing,
      isLoading,
      isListening,
      isSaving,
      isStreaming,
      success,
    ],
  );

  return { state, config: MOTION_GRID_STATES[state] };
}
