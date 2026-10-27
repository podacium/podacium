import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CameraOcrScanner } from "./CameraOcrScanner";

const translations: Record<string, string> = {
  "component.copilot.cameraOcr.title": "Scanner de Reçu Fiscal & CCP",
  "component.copilot.cameraOcr.subtitle":
    "BaridiMob • EDAHABIA • CCP • Facture Proforma",
  "component.copilot.cameraOcr.takePhoto": "Prendre la photo du reçu",
  "component.copilot.cameraOcr.capturedReceiptAlt": "Reçu capturé",
  "component.copilot.cameraOcr.retake": "Reprendre la photo",
  "component.copilot.cameraOcr.analyzeWithOcr":
    "Analyser avec ocr_receipt_scan",
  "component.copilot.cameraOcr.extracting": "Extraction OCR en cours...",
  "component.copilot.cameraOcr.cameraUnavailable":
    "Accès Caméra Non Disponible",
  "component.copilot.cameraOcr.retry": "Réessayer",
  "component.copilot.cameraOcr.uploadPhoto": "Importer une photo",
  "component.copilot.cameraOcr.alignReceipt":
    "Alignez le reçu ou le bordereau CCP",
  "component.copilot.cameraOcr.stampVisible":
    "Tampon postal & Montant visibles",
  "component.copilot.cameraOcr.gallery": "Galerie",
  "component.copilot.cameraOcr.submitted": "Reçu transmis à l'IA",
  "component.copilot.cameraOcr.toggleTorch": "Activer la torche",
  "component.copilot.cameraOcr.switchCamera": "Changer de caméra",
  "component.copilot.cameraOcr.close": "Fermer",
};

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    t: (key: string, _opts?: any, fallback?: string) =>
      translations[key] || fallback || key,
  }),
  useLocale: () => "fr",
  useBidi: () => ({ isRTL: false }),
}));

describe("CameraOcrScanner Component", () => {
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;

  beforeEach(() => {
    vi.clearAllMocks();

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        writable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [
        {
          getCapabilities: () => ({ torch: true }),
          applyConstraints: vi.fn().mockResolvedValue(undefined),
        },
      ],
    });

    // Mock HTMLMediaElement.prototype.play
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.resolve(),
    );
  });

  afterEach(() => {
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
  });

  it("renders live viewfinder mode with receipt alignment guidelines", async () => {
    render(<CameraOcrScanner />);

    expect(
      screen.getByText(
        /Scanner de Reçu Fiscal & CCP|component\.copilot\.cameraOcr\.title/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("ocr_receipt_scan")).toBeInTheDocument();
    expect(
      screen.getByText(
        /BaridiMob • EDAHABIA • CCP • Facture Proforma|component\.copilot\.cameraOcr\.subtitle/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle(
        /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
      ),
    ).toBeInTheDocument();
  });

  it("captures a frame snapshot and displays document format selectors", async () => {
    const onScanSubmitMock = vi.fn();

    // Mock HTMLCanvasElement.prototype.toDataURL and getContext
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,mockedbase64receipt",
    );

    render(<CameraOcrScanner onScanSubmit={onScanSubmitMock} />);

    await waitFor(() => {
      expect(
        screen.getByTitle(
          /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
        ),
      ).not.toBeDisabled();
    });

    const shutterBtn = screen.getByTitle(
      /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
    );
    fireEvent.click(shutterBtn);

    // After snapshot, preview screen with retake and submit buttons appears
    expect(
      screen.getByText(
        /Reprendre la photo|component\.copilot\.cameraOcr\.retake/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Analyser avec ocr_receipt_scan|component\.copilot\.cameraOcr\.analyzeWithOcr/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("BARIDIMOB")).toBeInTheDocument();
    expect(screen.getByText("CCP")).toBeInTheDocument();
    expect(screen.getByText("EDAHABIA")).toBeInTheDocument();

    // Change format to CCP
    fireEvent.click(screen.getByText("CCP"));

    // Submit to ocr_receipt_scan
    fireEvent.click(
      screen.getByText(
        /Analyser avec ocr_receipt_scan|component\.copilot\.cameraOcr\.analyzeWithOcr/,
      ),
    );

    await waitFor(() => {
      expect(onScanSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imageBase64: "mockedbase64receipt",
          receiptText: expect.stringContaining("CCP"),
        }),
      );
    });
  });

  it("allows retaking photo from snapshot review mode", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,dummyimage",
    );

    render(<CameraOcrScanner />);

    await waitFor(() => {
      expect(
        screen.getByTitle(
          /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
        ),
      ).not.toBeDisabled();
    });

    fireEvent.click(
      screen.getByTitle(
        /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
      ),
    );
    expect(
      screen.getByText(
        /Reprendre la photo|component\.copilot\.cameraOcr\.retake/,
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByText(
        /Reprendre la photo|component\.copilot\.cameraOcr\.retake/,
      ),
    );
    expect(
      screen.getByTitle(
        /Prendre la photo du reçu|component\.copilot\.cameraOcr\.takePhoto/,
      ),
    ).toBeInTheDocument();
  });

  it("displays error fallback when camera is unavailable", async () => {
    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(new Error("Permission denied by user"));

    render(<CameraOcrScanner />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Accès Caméra Non Disponible|component\.copilot\.cameraOcr\.cameraUnavailable/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Permission denied by user")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Importer une photo|component\.copilot\.cameraOcr\.uploadPhoto/,
        ),
      ).toBeInTheDocument();
    });
  });
});
