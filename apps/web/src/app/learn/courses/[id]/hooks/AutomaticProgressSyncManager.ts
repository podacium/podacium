import { apiHelpers, LessonProgressResponse } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";

export class AutomaticProgressSyncManager {
  private static readonly STORAGE_KEYS = {
    courseProgress: (courseId: string, userId: string) =>
      `course-progress-${courseId}-${userId}`,
    videoPosition: (courseId: string, userId: string, lessonId: string) =>
      `video-position-${courseId}-${userId}-${lessonId}`,
    pendingSyncQueue: (courseId: string, userId: string) =>
      `pending-sync-queue-${courseId}-${userId}`,
    lastSyncTime: (courseId: string, userId: string) =>
      `last-sync-${courseId}-${userId}`,
    syncStatus: (courseId: string, userId: string) =>
      `sync-status-${courseId}-${userId}`,
  };

  private static syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private static isSyncing: Map<string, boolean> = new Map();
  /**
   * Tracks lesson IDs that have been permanently rejected (HTTP 403/404) by the
   * server during this session.  These are not retried on the next sync tick —
   * instead they are evicted from the queue.  A higher-progress update clears
   * the block, because the video has advanced and a retry may now succeed.
   */
  private static permanentlyRejected: Map<string, Set<string>> = new Map();

  private static unloadHandlers: Map<string, () => void> = new Map();

  // Initialize automatic sync for a course
  static initializeAutomaticSync(courseId: string, userId: string | number) {
    const key = `${courseId}-${userId}`;

    // Clear any existing interval
    this.clearSyncInterval(courseId, userId);

    // Start automatic sync every 30 seconds
    const interval = setInterval(() => {
      this.processAutomaticSync(courseId, userId.toString());
    }, 30000); // 30 seconds

    this.syncIntervals.set(key, interval);

    // Register unload flush handler using keepalive fetch
    if (typeof window !== "undefined") {
      const handleUnload = () => {
        this.flushSyncQueueBeacon(courseId, userId);
      };
      window.addEventListener("pagehide", handleUnload);
      this.unloadHandlers.set(key, handleUnload);
    }

    // Process any pending updates immediately (in case page was reloaded)
    setTimeout(() => {
      this.processAutomaticSync(courseId, userId.toString());
    }, 5000); // Wait 5 seconds before first sync
  }

  // Clear sync interval and unload listeners
  static clearSyncInterval(courseId: string, userId: string | number) {
    const key = `${courseId}-${userId}`;
    const interval = this.syncIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(key);
    }
    if (typeof window !== "undefined") {
      const unloadHandler = this.unloadHandlers.get(key);
      if (unloadHandler) {
        window.removeEventListener("pagehide", unloadHandler);
        this.unloadHandlers.delete(key);
      }
    }
  }

  // Flush pending updates immediately using keepalive fetch on page unload
  static flushSyncQueueBeacon(courseId: string, userId: string | number): void {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const queueKey = this.STORAGE_KEYS.pendingSyncQueue(
      courseId,
      userId.toString(),
    );
    const pendingUpdates = this.loadFromStorage<
      Array<{
        lessonId: string;
        progress: number;
        videoPosition?: number;
        timestamp: number;
      }>
    >(queueKey, []);

    if (pendingUpdates.length === 0) return;

    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    for (const update of pendingUpdates) {
      try {
        if (update.progress >= 100) {
          fetch(`/api/v1/education/lessons/${update.lessonId}/complete`, {
            method: "POST",
            keepalive: true,
            credentials: "include",
            headers,
          }).catch(() => {});
        } else if (update.progress > 0) {
          fetch(`/api/v1/education/lessons/${update.lessonId}/progress`, {
            method: "POST",
            keepalive: true,
            credentials: "include",
            headers,
            body: JSON.stringify({
              progress: update.progress,
              completed: false,
            }),
          }).catch(() => {});
        }
      } catch (_) {
        // Ignore errors during unload
      }
    }
  }

  // Process automatic sync in background
  public static async processAutomaticSync(courseId: string, userId: string) {
    const key = `${courseId}-${userId}`;

    // Don't sync if already syncing or offline
    if (this.isSyncing.get(key) || !navigator.onLine) return;

    const pendingQueueKey = this.STORAGE_KEYS.pendingSyncQueue(
      courseId,
      userId,
    );
    const pendingUpdates = this.loadFromStorage<
      Array<{
        lessonId: string;
        progress: number;
        videoPosition?: number;
        timestamp: number;
      }>
    >(pendingQueueKey, []);

    if (pendingUpdates.length === 0) return;

    // Evict any entries that were permanently rejected (403/404) in a prior
    // tick so they don't sit in the queue forever.
    const rejected = this.permanentlyRejected.get(key);
    const filteredUpdates =
      rejected && rejected.size > 0
        ? pendingUpdates.filter((u) => !rejected.has(u.lessonId))
        : pendingUpdates;

    if (filteredUpdates.length !== pendingUpdates.length) {
      this.saveToStorage(pendingQueueKey, filteredUpdates);
    }

    if (filteredUpdates.length === 0) return;

    this.isSyncing.set(key, true);

    try {
      // Process updates in batches of 5
      const batchSize = 5;
      for (let i = 0; i < filteredUpdates.length; i += batchSize) {
        const batch = filteredUpdates.slice(i, i + batchSize);
        const permanentFailures = await this.syncBatchToDatabase(batch);

        // Mark any permanent failures so they are skipped next tick
        if (permanentFailures.length > 0) {
          if (!this.permanentlyRejected.has(key)) {
            this.permanentlyRejected.set(key, new Set());
          }
          const rejectedSet = this.permanentlyRejected.get(key)!;
          permanentFailures.forEach((id) => rejectedSet.add(id));
        }

        // Remove processed items from queue (including permanent failures)
        const processedIds = new Set(batch.map((u) => u.lessonId));
        const remaining = this.loadFromStorage<
          Array<{
            lessonId: string;
            progress: number;
            videoPosition?: number;
            timestamp: number;
          }>
        >(pendingQueueKey, []).filter((u) => !processedIds.has(u.lessonId));
        this.saveToStorage(pendingQueueKey, remaining);

        // Update last sync time
        this.saveLastSyncTime(courseId, userId);
      }
    } catch (error) {
      console.error("❌ Automatic sync failed:", error);
    } finally {
      this.isSyncing.set(key, false);
    }
  }

  /**
   * Sync a batch to the database.
   *
   * Returns the list of lesson IDs that were **permanently** rejected by the
   * server (HTTP 403 policy rejection or 404 not-found).  The caller evicts
   * these from the pending queue and blocks re-queuing until the video
   * advances past the current progress level.
   *
   * Transient failures (network errors, 5xx, 429) are left in the queue
   * and will be retried on the next sync tick.
   */
  private static async syncBatchToDatabase(
    batch: Array<{
      lessonId: string;
      progress: number;
      videoPosition?: number;
    }>,
  ): Promise<string[]> {
    const permanentFailures: string[] = [];

    const syncPromises = batch.map(async (update) => {
      try {
        if (update.progress >= 100) {
          // Mark as completed using existing API
          await apiHelpers.education.completeLesson(update.lessonId);
        } else if (update.progress > 0) {
          // Update progress using existing API
          await apiHelpers.education.updateLessonProgress(
            update.lessonId,
            update.progress,
          );
        }
        return { lessonId: update.lessonId, success: true, permanent: false };
      } catch (error) {
        // 403 = policy rejection (criteria not met / access denied)
        // 404 = lesson no longer exists
        // Both are permanent for the current progress level — stop retrying.
        const isPermanent =
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404);

        if (isPermanent) {
          console.warn(
            `⚠️ Lesson ${update.lessonId} sync permanently rejected (HTTP ${(error as ApiError).status}). ` +
              `Will retry only when video progress advances.`,
          );
        } else {
          console.error(`❌ Failed to sync lesson ${update.lessonId}:`, error);
        }
        return {
          lessonId: update.lessonId,
          success: false,
          permanent: isPermanent,
          error,
        };
      }
    });

    const results = await Promise.allSettled(syncPromises);
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value.permanent) {
        permanentFailures.push(r.value.lessonId);
      }
    });

    return permanentFailures;
  }

  // Queue progress update for automatic sync
  static queueProgressUpdate(
    courseId: string,
    userId: string | number,
    lessonId: string,
    progress: number,
    videoPosition?: number,
  ) {
    const queueKey = this.STORAGE_KEYS.pendingSyncQueue(
      courseId,
      userId.toString(),
    );

    // Load existing queue
    let queue = this.loadFromStorage<
      Array<{
        lessonId: string;
        progress: number;
        videoPosition?: number;
        timestamp: number;
      }>
    >(queueKey, []);

    // Check for existing update for this lesson
    const existingIndex = queue.findIndex((u) => u.lessonId === lessonId);

    if (existingIndex >= 0) {
      // Only update if progress is higher
      if (progress > queue[existingIndex].progress) {
        // Higher progress clears any permanent-rejection block for this lesson
        const key = `${courseId}-${userId}`;
        this.permanentlyRejected.get(key)?.delete(lessonId);

        queue[existingIndex] = {
          lessonId,
          progress,
          videoPosition: videoPosition || queue[existingIndex].videoPosition,
          timestamp: Date.now(),
        };
      }
    } else {
      queue.push({
        lessonId,
        progress,
        videoPosition,
        timestamp: Date.now(),
      });
    }

    // Limit queue size
    if (queue.length > 50) {
      queue = queue.slice(-50);
    }

    // Save to localStorage
    this.saveToStorage(queueKey, queue);
  }

  // Save video position to localStorage
  static saveVideoPosition(
    courseId: string,
    userId: string | number,
    lessonId: string,
    position: number,
  ): void {
    if (position < 0 || position > 86400) return;

    this.saveToStorage(
      this.STORAGE_KEYS.videoPosition(courseId, userId.toString(), lessonId),
      Math.round(position),
    );
  }

  // Get saved video position
  static getVideoPosition(
    courseId: string,
    userId: string | number,
    lessonId: string,
  ): number {
    const position = this.loadFromStorage<number>(
      this.STORAGE_KEYS.videoPosition(courseId, userId.toString(), lessonId),
      0,
    );
    return Math.max(0, Math.min(position, 86400));
  }

  // Save progress to localStorage
  static saveProgressLocally(
    courseId: string,
    userId: string | number,
    progress: Record<string, LessonProgressResponse>,
  ): void {
    this.saveToStorage(
      this.STORAGE_KEYS.courseProgress(courseId, userId.toString()),
      progress,
    );
  }

  // Load progress from localStorage
  static loadProgressLocally(
    courseId: string,
    userId: string | number,
  ): Record<string, LessonProgressResponse> {
    return this.loadFromStorage<Record<string, LessonProgressResponse>>(
      this.STORAGE_KEYS.courseProgress(courseId, userId.toString()),
      {},
    );
  }

  // Save last sync time
  static saveLastSyncTime(courseId: string, userId: string | number): void {
    this.saveToStorage(
      this.STORAGE_KEYS.lastSyncTime(courseId, userId.toString()),
      Date.now(),
    );
  }

  // Get last sync time
  static getLastSyncTime(courseId: string, userId: string | number): number {
    return this.loadFromStorage<number>(
      this.STORAGE_KEYS.lastSyncTime(courseId, userId.toString()),
      0,
    );
  }

  // Get pending updates count
  static getPendingUpdatesCount(
    courseId: string,
    userId: string | number,
  ): number {
    const queue = this.loadFromStorage<Array<any>>(
      this.STORAGE_KEYS.pendingSyncQueue(courseId, userId.toString()),
      [],
    );
    return queue.length;
  }

  // Clear all data for course
  static clearCourseData(courseId: string, userId: string | number): void {
    const keys = [
      this.STORAGE_KEYS.courseProgress(courseId, userId.toString()),
      this.STORAGE_KEYS.pendingSyncQueue(courseId, userId.toString()),
      this.STORAGE_KEYS.syncStatus(courseId, userId.toString()),
    ];

    keys.forEach((key) => {
      localStorage.removeItem(key);
    });

    // Clear video positions
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes(`video-position-${courseId}-${userId}`)) {
        localStorage.removeItem(key);
      }
    }

    // Clear interval
    this.clearSyncInterval(courseId, userId);
  }

  // Helper methods
  private static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;

    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch (error) {
      console.error(`Error loading from localStorage:`, error);
      return defaultValue;
    }
  }

  private static saveToStorage<T>(key: string, data: T): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  }
}
