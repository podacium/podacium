import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useOfflineVideoCache,
  normalizeVideoUrl,
} from "./useOfflineVideoCache";

describe("useOfflineVideoCache & normalizeVideoUrl", () => {
  describe("normalizeVideoUrl", () => {
    it("strips CDN signing tokens (Expires, Signature, Key-Pair-Id)", () => {
      const signedUrl1 =
        "https://cdn.podacium.com/courses/lesson-1.mp4?Expires=1700000000&Signature=abc123xyz&Key-Pair-Id=K12345";
      const signedUrl2 =
        "https://cdn.podacium.com/courses/lesson-1.mp4?Expires=1800000000&Signature=def456uvw&Key-Pair-Id=K12345";

      const normalized1 = normalizeVideoUrl(signedUrl1);
      const normalized2 = normalizeVideoUrl(signedUrl2);

      expect(normalized1).toBe("https://cdn.podacium.com/courses/lesson-1.mp4");
      expect(normalized2).toBe("https://cdn.podacium.com/courses/lesson-1.mp4");
      expect(normalized1).toBe(normalized2);
    });

    it("handles relative and token paths gracefully", () => {
      const urlWithToken = "/api/v1/media/stream.m3u8?token=xyz789&exp=1234";
      const normalized = normalizeVideoUrl(urlWithToken);
      expect(normalized).toBe("/api/v1/media/stream.m3u8");
    });
  });

  describe("useOfflineVideoCache hook", () => {
    let mockStore: Map<string, any>;
    let mockMetaStore: Map<string, any>;

    beforeEach(() => {
      mockStore = new Map();
      mockMetaStore = new Map();

      const createMockStore = (storeMap: Map<string, any>) => ({
        put: vi.fn((record: any) => {
          const req: any = {};
          setTimeout(() => {
            storeMap.set(record.url || record.lessonId, record);
            if (req.onsuccess) req.onsuccess({ target: { result: record } });
          }, 0);
          return req;
        }),
        get: vi.fn((key: string) => {
          const req: any = {};
          setTimeout(() => {
            req.result = storeMap.get(key);
            if (req.onsuccess)
              req.onsuccess({ target: { result: req.result } });
          }, 0);
          return req;
        }),
        delete: vi.fn((key: string) => {
          const req: any = {};
          setTimeout(() => {
            storeMap.delete(key);
            if (req.onsuccess) req.onsuccess({ target: { result: undefined } });
          }, 0);
          return req;
        }),
        getAll: vi.fn(() => {
          const req: any = {};
          setTimeout(() => {
            req.result = Array.from(storeMap.values());
            if (req.onsuccess)
              req.onsuccess({ target: { result: req.result } });
          }, 0);
          return req;
        }),
        openCursor: vi.fn(() => {
          const req: any = {};
          setTimeout(() => {
            req.result = null;
            if (req.onsuccess) req.onsuccess({ target: { result: null } });
          }, 0);
          return req;
        }),
        index: vi.fn(() => ({
          openCursor: vi.fn(() => {
            const req: any = {};
            setTimeout(() => {
              req.result = null;
              if (req.onsuccess) req.onsuccess({ target: { result: null } });
            }, 0);
            return req;
          }),
        })),
      });

      const mockDB: any = {
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        transaction: vi.fn((storeName: string) => ({
          objectStore: vi.fn(() =>
            storeName === "lesson_metadata"
              ? createMockStore(mockMetaStore)
              : createMockStore(mockStore),
          ),
        })),
      };

      const mockOpenRequest: any = {
        result: mockDB,
      };

      const mockIndexedDB: any = {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess)
              mockOpenRequest.onsuccess({ target: mockOpenRequest });
          }, 0);
          return mockOpenRequest;
        }),
      };

      Object.defineProperty(window, "indexedDB", {
        value: mockIndexedDB,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(navigator, "storage", {
        value: {
          persist: vi.fn().mockResolvedValue(true),
          estimate: vi
            .fn()
            .mockResolvedValue({ usage: 1000, quota: 500000000 }),
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("initializes and detects IndexedDB support", async () => {
      const { result } = renderHook(() => useOfflineVideoCache());
      expect(result.current.isSupported).toBe(true);
      expect(result.current.cacheSize).toBe(0);
      expect(result.current.cachedLessons).toEqual([]);
    });

    it("stores and retrieves a video segment", async () => {
      const { result } = renderHook(() => useOfflineVideoCache());

      const testBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const testUrl = "https://cdn.podacium.com/video/chunk1.ts?Expires=123";

      let stored = false;
      await act(async () => {
        stored = await result.current.storeSegment(
          testUrl,
          testBuffer,
          "lesson-1",
        );
      });

      expect(stored).toBe(true);

      let retrieved: ArrayBuffer | null = null;
      await act(async () => {
        retrieved = await result.current.getSegment(testUrl);
      });

      expect(retrieved).not.toBeNull();
      expect(new Uint8Array(retrieved!)).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("clears cached lesson data", async () => {
      const { result } = renderHook(() => useOfflineVideoCache());

      let cleared = false;
      await act(async () => {
        cleared = await result.current.clearLessonCache("lesson-1");
      });

      expect(cleared).toBe(true);
    });

    it("tracks download progress and cancels download", async () => {
      const { result } = renderHook(() => useOfflineVideoCache());

      act(() => {
        result.current.cancelDownload("lesson-123");
      });

      expect(result.current.isDownloading["lesson-123"]).toBe(false);
      expect(result.current.downloadProgress["lesson-123"]).toBe(0);
    });
  });
});
