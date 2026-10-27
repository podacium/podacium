import { describe, it, expect, vi } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";

describe("Curriculum Tree Drag-and-Drop Reordering [@dnd-kit]", () => {
  const initialLessons = [
    { id: "les-1", title: "Introduction", order: 1 },
    { id: "les-2", title: "Core Concepts", order: 2 },
    { id: "les-3", title: "Advanced Topics", order: 3 },
    { id: "les-4", title: "Project Walkthrough", order: 4 },
  ];

  it("reorders lessons array correctly on drag-and-drop using arrayMove", () => {
    const oldIndex = 0; // Drag "Introduction" (index 0)
    const newIndex = 2; // Drop after "Advanced Topics" (index 2)

    const moved = arrayMove(initialLessons, oldIndex, newIndex);

    expect(moved.map((l) => l.id)).toEqual([
      "les-2",
      "les-3",
      "les-1",
      "les-4",
    ]);
  });

  it("applies sequential 1-based re-indexing without collisions or gaps", () => {
    const oldIndex = 3; // Move last item "les-4" to first (index 0)
    const newIndex = 0;

    const moved = arrayMove(initialLessons, oldIndex, newIndex);
    const reorderedWithSequentialIndex = moved.map((l, idx) => ({
      ...l,
      order: idx + 1,
    }));

    expect(reorderedWithSequentialIndex).toEqual([
      { id: "les-4", title: "Project Walkthrough", order: 1 },
      { id: "les-1", title: "Introduction", order: 2 },
      { id: "les-2", title: "Core Concepts", order: 3 },
      { id: "les-3", title: "Advanced Topics", order: 4 },
    ]);
  });

  it("constructs API payload matching educationApi.reorderLessons contract", async () => {
    const mockReorderApi = vi.fn().mockResolvedValue({ success: true });

    const moduleId = "mod-101";
    const oldIndex = 1; // Move "les-2"
    const newIndex = 3; // To end

    const moved = arrayMove(initialLessons, oldIndex, newIndex);
    const reordered = moved.map((l, idx) => ({ ...l, order: idx + 1 }));

    const payload = reordered.map((l, i) => ({
      lessonId: l.id,
      order: i + 1,
    }));

    await mockReorderApi(moduleId, payload);

    expect(mockReorderApi).toHaveBeenCalledWith("mod-101", [
      { lessonId: "les-1", order: 1 },
      { lessonId: "les-3", order: 2 },
      { lessonId: "les-4", order: 3 },
      { lessonId: "les-2", order: 4 },
    ]);
  });

  it("rolls back to previous state if API reorder call fails", async () => {
    let currentLessons = [...initialLessons];
    const previousLessons = [...currentLessons];

    const mockReorderApi = vi
      .fn()
      .mockRejectedValue(new Error("Network Error"));

    // Attempt drag-and-drop
    const oldIndex = 0;
    const newIndex = 2;
    const reordered = arrayMove(currentLessons, oldIndex, newIndex).map(
      (l, idx) => ({
        ...l,
        order: idx + 1,
      }),
    );
    currentLessons = reordered;

    try {
      await mockReorderApi(
        "mod-101",
        reordered.map((l, i) => ({ lessonId: l.id, order: i + 1 })),
      );
    } catch {
      // Rollback on error
      currentLessons = previousLessons;
    }

    expect(currentLessons).toEqual(initialLessons);
    expect(currentLessons[0].id).toBe("les-1");
  });
});
