"use client";

import React, { useEffect, useRef, useCallback } from "react";

export interface WatermarkWatchdogProps {
  userEmail?: string;
  userId: string | number;
  ipAddress?: string;
  onSecurityViolation?: (
    reason: string,
    details?: Record<string, unknown>,
  ) => void;
}

export const WatermarkWatchdog: React.FC<WatermarkWatchdogProps> = ({
  userEmail,
  userId,
  ipAddress = "127.0.0.1",
  onSecurityViolation,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const violationTriggeredRef = useRef(false);

  // 5-second randomized spatial jitter coordinates
  const jitterCoordRef = useRef<{ xPct: number; yPct: number }>({
    xPct: 0.5,
    yPct: 0.5,
  });
  const lastJitterTimeRef = useRef<number>(Date.now());

  const triggerViolation = useCallback(
    (reason: string, details: Record<string, unknown> = {}) => {
      if (violationTriggeredRef.current) return;
      violationTriggeredRef.current = true;
      if (onSecurityViolation) {
        onSecurityViolation(reason, details);
      }
    },
    [onSecurityViolation],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Attach closed Shadow DOM to isolate watermark from DOM manipulation
    if (!shadowRootRef.current) {
      try {
        shadowRootRef.current = container.attachShadow({ mode: "closed" });
      } catch {
        // Shadow root may already exist or cannot be re-attached
      }
    }

    const shadowRoot = shadowRootRef.current;
    if (!shadowRoot) return;
    shadowRoot.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "50";
    canvas.style.display = "block";
    canvas.style.visibility = "visible";
    canvas.style.opacity = "1";

    shadowRoot.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const render = () => {
      if (!canvas || !ctx) return;

      const now = Date.now();
      const rect = canvas.getBoundingClientRect();

      // Check canvas physical dimensions when parent container has rendered
      const parentRect =
        containerRef.current?.parentElement?.getBoundingClientRect();
      const parentHasSize =
        parentRect && parentRect.width >= 100 && parentRect.height >= 100;
      if (parentHasSize && (rect.width < 50 || rect.height < 50)) {
        triggerViolation(
          "Watermark canvas dimensions collapsed or manipulated",
          {
            width: rect.width,
            height: rect.height,
          },
        );
        return;
      }

      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width || 800;
        canvas.height = rect.height || 450;
      }

      // 5-Second Randomized Spatial Jitter Calculation
      if (now - lastJitterTimeRef.current >= 5000) {
        lastJitterTimeRef.current = now;
        jitterCoordRef.current = {
          xPct: 0.15 + Math.random() * 0.7,
          yPct: 0.15 + Math.random() * 0.7,
        };
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const targetX = canvas.width * jitterCoordRef.current.xPct;
      const targetY = canvas.height * jitterCoordRef.current.yPct;

      const utcTime = new Date(now)
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      const emailPart = userEmail ? `${userEmail} | ` : "";
      const watermarkLabel = `PODACIUM • ${emailPart}UID:${userId} • ${ipAddress} • ${utcTime} UTC`;

      ctx.save();
      ctx.font = "600 12px 'DM Mono', monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.textAlign = "center";
      ctx.fillText(watermarkLabel, targetX, targetY);
      ctx.restore();

      // Continuous Computed Style Tamper Verification
      const computedStyle = window.getComputedStyle(canvas);
      const isStyleSuppressed =
        computedStyle.display === "none" ||
        computedStyle.visibility === "hidden" ||
        parseFloat(computedStyle.opacity || "1") < 0.2 ||
        (computedStyle.filter &&
          (computedStyle.filter.includes("opacity(0)") ||
            computedStyle.filter.includes("blur(50px)"))) ||
        computedStyle.clipPath === "inset(100%)" ||
        computedStyle.transform === "scale(0)";

      if (isStyleSuppressed) {
        triggerViolation(
          "Watermark canvas style suppression detected via computed style",
          {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
          },
        );
        return;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    // Multi-Level MutationObserver: Inspects child removal and attribute tampering
    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          const removed = Array.from(m.removedNodes);
          if (removed.includes(canvas)) {
            triggerViolation("Watermark canvas node detached from DOM");
            return;
          }
        }
        if (m.type === "attributes") {
          const target = m.target as HTMLElement;
          const style = window.getComputedStyle(target);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            parseFloat(style.opacity || "1") < 0.2
          ) {
            triggerViolation(
              `Tampered attribute on ${target.tagName.toLowerCase()}`,
              {
                attributeName: m.attributeName,
              },
            );
            return;
          }
        }
      }
    });

    mutationObserver.observe(shadowRoot, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    mutationObserver.observe(container, {
      attributes: true,
      childList: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mutationObserver.disconnect();
    };
  }, [userEmail, userId, ipAddress, triggerViolation]);

  return (
    <div
      ref={containerRef}
      id="podacium-forensic-guard"
      className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    />
  );
};
