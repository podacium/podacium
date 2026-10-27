import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VideoPlayer from "../VideoPlayer";

// Mock hls.js
vi.mock("hls.js", () => {
  class MockHls {
    static isSupported() {
      return true;
    }
    static Events = { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" };
    static ErrorTypes = {
      NETWORK_ERROR: "networkError",
      MEDIA_ERROR: "mediaError",
    };
    loadSource() {}
    attachMedia() {}
    on() {}
    destroy() {}
  }
  return { default: MockHls };
});

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

// Mock server action
vi.mock("@/app/actions/video", () => ({
  getSignedVideoUrl: vi.fn().mockImplementation((id, provider, hlsPath) => {
    if (hlsPath) {
      return Promise.resolve({
        signedUrl:
          "https://d111.cloudfront.net/hls/lesson-1/index.m3u8?Policy=xyz",
        isHls: true,
      });
    }
    return Promise.resolve({
      signedUrl:
        "https://d111.cloudfront.net/raw/lesson-1/video.mp4?Signature=abc",
      isHls: false,
    });
  }),
}));

describe("Course Lesson VideoPlayer Container", () => {
  const mockLesson = {
    id: "lesson-1",
    moduleId: "module-1",
    title: "Introduction to Podacium",
    description: "Learn the basics of Podacium platform",
    videoUrl: null,
    hlsPath: "hls/lesson-1/index.m3u8",
    storageProvider: "aws",
    transcodingStatus: "completed",
    isLocked: false,
  };

  const mockProps = {
    activeLesson: mockLesson as any,
    lessons: [mockLesson] as any[],
    onLessonSelect: vi.fn(),
    getLessonStatus: () => "UNLOCKED" as any,
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    isRtl: false,
    milestones: [],
    courseId: "course-1",
  };

  it("fetches signed URL and renders HLS player when videoUrl is null and hlsPath exists", async () => {
    render(<VideoPlayer {...mockProps} />);

    await waitFor(() => {
      const video = document.querySelector("video");
      expect(video).toBeInTheDocument();
    });
  });

  it("renders video transcoding in progress banner when transcodingStatus is processing", async () => {
    const processingLesson = {
      ...mockLesson,
      hlsPath: null,
      videoUrl: null,
      transcodingStatus: "processing",
    };
    render(<VideoPlayer {...mockProps} activeLesson={processingLesson} />);

    expect(
      screen.getByText("course.lessons.transcoding.title"),
    ).toBeInTheDocument();
  });

  it("renders transcoding failed banner when transcodingStatus is failed", async () => {
    const failedLesson = {
      ...mockLesson,
      hlsPath: null,
      videoUrl: null,
      transcodingStatus: "failed",
    };
    render(<VideoPlayer {...mockProps} activeLesson={failedLesson} />);

    expect(
      screen.getByText("course.lessons.transcodingFailed.title"),
    ).toBeInTheDocument();
  });
});
