import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FileRejectionNotice, RejectedFile } from "./FileRejectionNotice";

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

describe("FileRejectionNotice", () => {
  it("renders null when there are no rejections", () => {
    const { container } = render(
      <FileRejectionNotice rejections={[]} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders executable security rejection with isolated filename", () => {
    const rejections: RejectedFile[] = [
      {
        id: "rej-1",
        filename: "malware.exe",
        size: 1024 * 500, // 500 KB
        reasonCode: "executable_blocked",
      },
    ];

    render(<FileRejectionNotice rejections={rejections} onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("malware.exe")).toBeInTheDocument();
    expect(screen.getByText("malware.exe").tagName.toLowerCase()).toBe("bdi");
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    const rejections: RejectedFile[] = [
      {
        id: "rej-1",
        filename: "heavy_video.mp4",
        size: 1024 * 1024 * 50,
        reasonCode: "file_too_large",
        maxSize: "20 MB",
      },
    ];

    render(
      <FileRejectionNotice rejections={rejections} onDismiss={onDismiss} />,
    );

    const dismissBtn = screen.getByRole("button", {
      name: /dismiss|fileRejection\.dismiss/i,
    });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectAnother when action button is clicked", () => {
    const onSelectAnother = vi.fn();
    const rejections: RejectedFile[] = [
      {
        id: "rej-1",
        filename: "bad_archive.zip",
        reasonCode: "zip_bomb",
      },
    ];

    render(
      <FileRejectionNotice
        rejections={rejections}
        onDismiss={vi.fn()}
        onSelectAnother={onSelectAnother}
      />,
    );

    const selectBtn = screen.getByText(
      /select another file|fileRejection\.selectAnother/i,
    );
    fireEvent.click(selectBtn);
    expect(onSelectAnother).toHaveBeenCalledTimes(1);
  });
});
