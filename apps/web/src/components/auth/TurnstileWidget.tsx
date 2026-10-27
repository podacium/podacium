"use client";

import { useEffect, useRef } from "react";

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  className = "my-3 flex justify-center",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  }, [onSuccess, onError, onExpire]);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAEwKsAwhy0wmVegg";

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (isMounted && onSuccessRef.current) {
              onSuccessRef.current(token);
            }
          },
          "error-callback": () => {
            if (isMounted && onErrorRef.current) {
              onErrorRef.current();
            }
          },
          "expired-callback": () => {
            if (isMounted && onExpireRef.current) {
              onExpireRef.current();
            }
          },
          theme: "auto",
          size: "flexible",
        });
        widgetIdRef.current = id;
      } catch (e) {
        console.warn("Turnstile render warning:", e);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.getElementById(
        "cloudflare-turnstile-script",
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cloudflare-turnstile-script";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          renderWidget();
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", renderWidget);
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          const idToClean = widgetIdRef.current;
          widgetIdRef.current = null;
          window.turnstile.remove(idToClean);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey]);

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
}
