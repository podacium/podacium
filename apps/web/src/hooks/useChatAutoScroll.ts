import { useState, useEffect, useRef, useCallback } from "react";

export interface UseChatAutoScrollOptions {
  unpinThreshold?: number; // Distance in px from bottom before unpinning (default 80px)
}

export interface UseChatAutoScrollReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isPinned: boolean;
  unreadCount: number;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  notifyNewToken: () => void;
  handleScroll: () => void;
}

export function useChatAutoScroll(
  options: UseChatAutoScrollOptions = {},
): UseChatAutoScrollReturn {
  const { unpinThreshold = 80 } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const isPinnedRef = useRef<boolean>(true);
  const rafIdRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performScroll = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current !== null) {
        clearTimeout(programmaticScrollTimerRef.current);
        programmaticScrollTimerRef.current = null;
      }

      if (behavior === "smooth" && typeof el.scrollTo === "function") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          programmaticScrollTimerRef.current = null;
        }, 350);
      } else {
        el.scrollTop = el.scrollHeight;
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          programmaticScrollTimerRef.current = null;
        }, 50);
      }
      rafIdRef.current = null;
    });
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      isPinnedRef.current = true;
      setIsPinned(true);
      setUnreadCount(0);
      performScroll(behavior);
    },
    [performScroll],
  );

  const notifyNewToken = useCallback(() => {
    if (isPinnedRef.current) {
      performScroll("auto");
    } else {
      setUnreadCount((prev) => prev + 1);
    }
  }, [performScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isProgrammaticScrollRef.current) {
      return;
    }

    const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const shouldPin = dist <= unpinThreshold;

    if (shouldPin !== isPinnedRef.current) {
      isPinnedRef.current = shouldPin;
      setIsPinned(shouldPin);
      if (shouldPin) {
        setUnreadCount(0);
      }
    }
  }, [unpinThreshold]);

  // Handle ResizeObserver when message cards or widgets expand
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(() => {
      if (isPinnedRef.current) {
        performScroll("auto");
      }
    });

    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }
    if (el.lastElementChild && el.lastElementChild !== el.firstElementChild) {
      resizeObserver.observe(el.lastElementChild);
    }

    return () => {
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (programmaticScrollTimerRef.current !== null) {
        clearTimeout(programmaticScrollTimerRef.current);
      }
    };
  }, [performScroll]);

  return {
    containerRef,
    isPinned,
    unreadCount,
    scrollToBottom,
    notifyNewToken,
    handleScroll,
  };
}
