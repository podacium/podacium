import { useEffect } from "react";

interface UseSignedCookieRefreshOptions {
  lessonId: string;
  enabled?: boolean;
  intervalSeconds?: number;
}

export function useSignedCookieRefresh({
  lessonId,
  enabled = true,
  intervalSeconds = 45,
}: UseSignedCookieRefreshOptions) {
  useEffect(() => {
    if (!enabled || !lessonId) return;

    const refreshCookie = async () => {
      try {
        await fetch(
          `/api/v1/education/video/signed-url?lesson_id=${lessonId}`,
          {
            method: "GET",
            headers: { "Cache-Control": "no-cache" },
          },
        );
      } catch (err) {
        console.warn("Signed cookie background refresh failed", err);
      }
    };

    // Initial pre-fetch
    refreshCookie();

    const interval = setInterval(refreshCookie, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [lessonId, enabled, intervalSeconds]);
}
