import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FilePreviewModal } from "./FilePreviewModal";
import { getFileCategory } from "./FileAttachmentCard";

const mockTranslate = Object.assign((k?: string) => k || "", {
  t: (k?: string) => k || "",
  i18n: { language: "en" },
  dir: "ltr" as const,
  isolate: (text: string) => text,
  forceLTR: (text: string) => text,
  raw: (k: string) => k,
});

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => mockTranslate,
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
  useLocale: () => ({ locale: "en", isRtl: false, dir: "ltr" }),
}));

describe("File Categorization & Previews", () => {
  it("correctly identifies categories for .md, .txt, .svg, and other formats", () => {
    expect(getFileCategory("README.md", "text/markdown")).toBe("code");
    expect(getFileCategory("notes.txt", "text/plain")).toBe("code");
    expect(getFileCategory("logo.svg", "image/svg+xml")).toBe("image");
    expect(getFileCategory("config.json", "application/json")).toBe("code");
    expect(getFileCategory("script.py", "text/x-python")).toBe("code");
    expect(getFileCategory("audio.mp3", "audio/mpeg")).toBe("audio");
    expect(getFileCategory("data.csv", "text/csv")).toBe("sheet");
    expect(
      getFileCategory(
        "document.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("document");
    expect(getFileCategory("manual.pdf", "application/pdf")).toBe("pdf");
  });

  it("renders text/markdown content directly in the browser preview modal", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "# Markdown Title\n\nThis is a previewable markdown document.",
    } as any);

    render(
      <FilePreviewModal
        isOpen={true}
        attachment={{
          id: "att-1",
          fileName: "guide.md",
          fileSize: 1024,
          fileType: "text/markdown",
          fileUrl: "/api/files/download/guide.md",
        }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Markdown Title")).toBeInTheDocument();
      expect(
        screen.getByText(/This is a previewable markdown document/),
      ).toBeInTheDocument();
    });
  });

  it("renders SVG image with image viewer in modal", () => {
    render(
      <FilePreviewModal
        isOpen={true}
        attachment={{
          id: "att-2",
          fileName: "vector-icon.svg",
          fileSize: 2048,
          fileType: "image/svg+xml",
          fileUrl: "/api/files/download/vector-icon.svg",
        }}
        onClose={vi.fn()}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("vector-icon.svg"),
    );
  });
});
