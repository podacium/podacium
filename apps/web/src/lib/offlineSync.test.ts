import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enqueueOfflineMutation,
  getPendingMutations,
  getPendingCount,
  syncPendingMutations,
} from "./offlineSync";

describe("offlineSync queue", () => {
  let mockStore: Map<number, any>;
  let autoId: number;

  beforeEach(() => {
    mockStore = new Map();
    autoId = 1;

    const mockIDBStore = {
      add: vi.fn((record: any) => {
        const id = autoId++;
        const saved = { ...record, id };
        mockStore.set(id, saved);
        const req: any = {};
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: { result: id } });
        }, 0);
        return req;
      }),
      put: vi.fn((record: any) => {
        mockStore.set(record.id, record);
        const req: any = {};
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: { result: record.id } });
        }, 0);
        return req;
      }),
      delete: vi.fn((id: number) => {
        mockStore.delete(id);
        const req: any = {};
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess({ target: { result: undefined } });
        }, 0);
        return req;
      }),
      getAll: vi.fn(() => {
        const req: any = {};
        setTimeout(() => {
          req.result = Array.from(mockStore.values());
          if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
        }, 0);
        return req;
      }),
    };

    const mockDB: any = {
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      transaction: vi.fn(() => {
        const tx: any = {
          objectStore: vi.fn(() => mockIDBStore),
          oncomplete: null,
        };
        setTimeout(() => {
          if (typeof tx.oncomplete === "function") tx.oncomplete();
        }, 0);
        return tx;
      }),
    };

    const mockOpenReq: any = {
      result: mockDB,
    };

    Object.defineProperty(window, "indexedDB", {
      value: {
        open: vi.fn(() => {
          setTimeout(() => {
            if (mockOpenReq.onsuccess)
              mockOpenReq.onsuccess({ target: mockOpenReq });
          }, 0);
          return mockOpenReq;
        }),
      },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues an offline action with generated idempotency key and pending status", async () => {
    const mutation = await enqueueOfflineMutation({
      type: "quiz_submission",
      endpoint: "/api/v1/quizzes/1/submit",
      method: "POST",
      payload: { answers: { q1: "a" } },
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.status).toBe("pending");
    expect(mutation.idempotency_key).toBeDefined();

    const count = await getPendingCount();
    expect(count).toBe(1);

    const pending = await getPendingMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].type).toBe("quiz_submission");
  });

  it("syncs pending mutations and removes them from queue on 200 OK", async () => {
    await enqueueOfflineMutation({
      type: "milestone_approval",
      endpoint: "/api/v1/contracts/10/milestones/1/approve",
      method: "POST",
      payload: { approved: true },
    });

    expect(await getPendingCount()).toBe(1);

    const result = await syncPendingMutations();

    expect(result.synced).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/contracts/10/milestones/1/approve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Idempotency-Key": expect.any(String),
        }),
      }),
    );

    const remaining = await getPendingCount();
    expect(remaining).toBe(0);
  });
});
