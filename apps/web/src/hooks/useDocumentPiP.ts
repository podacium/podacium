"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface DocumentPiPOptions {
  width?: number;
  height?: number;
  title?: string;
}

export interface UseDocumentPiPReturn {
  isSupported: boolean;
  isPiPActive: boolean;
  pipWindow: Window | null;
  pipContainer: HTMLElement | null;
  openPiP: (options?: DocumentPiPOptions) => Promise<Window | null>;
  closePiP: () => void;
  togglePiP: (options?: DocumentPiPOptions) => Promise<void>;
}

/**
 * Copies styles and style links from the host document to the PiP window.
 */
function syncStylesToPiPWindow(pipDoc: Document) {
  // Copy all link tags (e.g., stylesheets, fonts)
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((link) => {
    pipDoc.head.appendChild(link.cloneNode(true));
  });

  // Copy all inline style elements
  const styles = document.querySelectorAll("style");
  styles.forEach((style) => {
    pipDoc.head.appendChild(style.cloneNode(true));
  });
}

/**
 * Hook to manage Document Picture-in-Picture (PiP) window.
 * Allows rendering full HTML/React component trees outside the browser tab.
 */
export function useDocumentPiP(): UseDocumentPiPReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      setIsSupported(true);
    }
  }, []);

  const closePiP = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setPipWindow(null);
    setPipContainer(null);
    setIsPiPActive(false);
  }, []);

  const openPiP = useCallback(
    async (options?: DocumentPiPOptions): Promise<Window | null> => {
      if (typeof window === "undefined") return null;

      const docPiP = (
        window as unknown as {
          documentPictureInPicture?: {
            requestWindow: (opts?: {
              width?: number;
              height?: number;
            }) => Promise<Window>;
            window?: Window | null;
          };
        }
      ).documentPictureInPicture;

      if (!docPiP || typeof docPiP.requestWindow !== "function") {
        console.warn("[useDocumentPiP] Document PiP API is not supported.");
        return null;
      }

      // If already open, focus and return existing window
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return pipWindowRef.current;
      }

      try {
        const width = options?.width ?? 480;
        const height = options?.height ?? 340;
        const newWin = await docPiP.requestWindow({ width, height });

        if (!newWin) return null;

        pipWindowRef.current = newWin;
        setPipWindow(newWin);
        setIsPiPActive(true);

        // Set title
        if (options?.title) {
          newWin.document.title = options.title;
        } else {
          newWin.document.title = "Podacium Live Classroom";
        }

        // Copy styles
        syncStylesToPiPWindow(newWin.document);

        // Setup container in pip document
        const body = newWin.document.body;
        body.className =
          "bg-slate-950 text-white m-0 p-0 overflow-hidden select-none h-full w-full";

        const root = newWin.document.createElement("div");
        root.id = "pip-interactive-root";
        root.className = "h-full w-full flex flex-col";
        body.appendChild(root);
        setPipContainer(root);

        // Listen for close from native OS window button
        newWin.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          setPipWindow(null);
          setPipContainer(null);
          setIsPiPActive(false);
        });

        return newWin;
      } catch (err) {
        console.error(
          "[useDocumentPiP] Failed to open Document PiP window:",
          err,
        );
        closePiP();
        return null;
      }
    },
    [closePiP],
  );

  const togglePiP = useCallback(
    async (options?: DocumentPiPOptions) => {
      if (isPiPActive) {
        closePiP();
      } else {
        await openPiP(options);
      }
    },
    [isPiPActive, closePiP, openPiP],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
      }
    };
  }, []);

  return {
    isSupported,
    isPiPActive,
    pipWindow,
    pipContainer,
    openPiP,
    closePiP,
    togglePiP,
  };
}
