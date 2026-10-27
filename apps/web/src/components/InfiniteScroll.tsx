"use client";

import { useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface InfiniteScrollProps {
  loadMore: () => void | Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  loader?: React.ReactNode;
}

export function InfiniteScroll({
  loadMore,
  hasMore,
  isLoading,
  children,
  threshold = 200,
  rootMargin = "0px 0px 200px 0px",
  loader,
}: InfiniteScrollProps) {
  const t = useTranslations("common");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    },
    [loadMore, hasMore, isLoading],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin,
      threshold: 0,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect, rootMargin]);

  return (
    <>
      {children}

      <div ref={sentinelRef} className="h-px" />

      {isLoading &&
        (loader || (
          <div className="flex items-center justify-center py-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("loadingMore")}</span>
            </div>
          </div>
        ))}

      {!hasMore && !isLoading && (
        <div className="flex items-center justify-center py-6">
          <span className="text-[10px] text-muted-foreground/40">
            {t("allLoaded")}
          </span>
        </div>
      )}
    </>
  );
}
