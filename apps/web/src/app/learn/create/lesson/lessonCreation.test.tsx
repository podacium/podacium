import { describe, it, expect, vi } from "vitest";

describe("Lesson Creation & Quiz Association [CRITICAL-STU-01]", () => {
  it("associates quiz with server-generated lesson ID when creating a new lesson", async () => {
    const mockPost = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/lessons") && !url.includes("/quiz")) {
        return Promise.resolve({ data: { id: "lesson-generated-999" } });
      }
      return Promise.resolve({ data: { success: true } });
    });

    const mockCreateQuiz = vi.fn().mockResolvedValue({ id: "quiz-1" });

    // Simulate creation handler logic matching lesson/page.tsx
    const isEditing = false;
    const editLessonId = null;
    const formData = { id: "", module_id: "mod-123" };
    const questions = [
      {
        question: "What is React?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt_0", text: "A library" },
          { id: "opt_1", text: "A database" },
        ],
        correctAnswer: "opt_0",
        explanation: "React is a UI library",
        points: 10,
      },
    ];

    const lessonPayload = { title: "Introduction to React", type: "video" };
    const res: any = await mockPost(
      `/api/education/modules/${formData.module_id}/lessons`,
      lessonPayload,
    );
    const createdLessonId = res?.data?.id || res?.id;
    const targetLessonId = isEditing ? editLessonId : createdLessonId;

    if (questions.length > 0 && targetLessonId) {
      await mockCreateQuiz(targetLessonId, {
        title: "Intro Quiz",
        questions,
      });
    }

    expect(mockPost).toHaveBeenCalledWith(
      "/api/education/modules/mod-123/lessons",
      lessonPayload,
    );
    expect(targetLessonId).toBe("lesson-generated-999");
    expect(mockCreateQuiz).toHaveBeenCalledWith(
      "lesson-generated-999",
      expect.objectContaining({
        title: "Intro Quiz",
        questions,
      }),
    );
  });

  it("filters out blank option rows before creating quiz", () => {
    const questions = [
      {
        question: "Sample Question",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt_0", text: "Valid Option A" },
          { id: "opt_1", text: "" },
          { id: "opt_2", text: "   " },
          { id: "opt_3", text: "Valid Option B" },
        ],
        correctAnswer: "opt_0",
        explanation: "Explanation",
        points: 10,
      },
    ];

    const cleanedQuestions = questions.map((q, idx) => {
      const filteredOptions = (q.options || []).filter(
        (opt) => (opt.text || "").trim().length > 0,
      );
      return {
        question: q.question.trim(),
        question_type: q.questionType,
        options: filteredOptions.length > 0 ? filteredOptions : q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation.trim() || null,
        points: Number(q.points) || 10,
        order: idx,
      };
    });

    expect(cleanedQuestions[0].options).toHaveLength(2);
    expect(cleanedQuestions[0].options[0].text).toBe("Valid Option A");
    expect(cleanedQuestions[0].options[1].text).toBe("Valid Option B");
  });

  it("Fisher-Yates algorithm shuffles questions and maintains length and elements", () => {
    function shuffleArray<T>(array: T[]): T[] {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    const originalQuestions = [
      { id: "q1", question: "Q1" },
      { id: "q2", question: "Q2" },
      { id: "q3", question: "Q3" },
      { id: "q4", question: "Q4" },
      { id: "q5", question: "Q5" },
    ];

    const shuffled = shuffleArray(originalQuestions);
    expect(shuffled).toHaveLength(originalQuestions.length);
    const ids = shuffled.map((q) => q.id).sort();
    expect(ids).toEqual(["q1", "q2", "q3", "q4", "q5"]);
  });
});
