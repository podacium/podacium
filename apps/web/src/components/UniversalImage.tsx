"use client";

import React, { useState } from "react";
import NextImage, { ImageProps as NextImageProps } from "next/image";
import { ImageOff } from "lucide-react";

type FillProps = {
  fill: true;
  width?: never;
  height?: never;
};

type SizedProps = {
  fill?: false;
  width: number;
  height: number;
};

type OptImageProps = Omit<
  NextImageProps,
  "src" | "width" | "height" | "fill" | "onError"
> &
  (FillProps | SizedProps) & {
    /** Primary image source. */
    src: string | null | undefined;
    /** Fallback sources tried in order if primary fails. */
    fallbackSrc?: (string | null | undefined)[];
    /** Final fallback UI when all sources fail. */
    fallback?: React.ReactNode;
    fallbackClassName?: string;
    /** Proxy external URLs through /api/image-proxy to avoid CORS/hotlink issues. */
    proxy?: boolean;
  };

function resolveUrl(src: string | null | undefined): string | null {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  // Block dangerous URI schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  )
    return null;

  if (trimmed.startsWith("data:image/") || trimmed.startsWith("blob:"))
    return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://"))
    return trimmed.replace("http://", "https://");
  if (trimmed.startsWith("https://")) return trimmed;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  return `${apiUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

// Module-level cache of URLs that failed direct loading — retried via proxy
const failedUrls = new Set<string>();

/**
 * Universal image component with fallback chain.
 *
 * Tries sources in order: src → fallbackSrc[0] → fallbackSrc[1] → ... → fallback UI
 * Failed external URLs are cached and automatically retried through /api/image-proxy.
 */
const UniversalImage: React.FC<OptImageProps> = ({
  src,
  fallbackSrc,
  alt,
  fallback,
  fallbackClassName,
  className,
  fill,
  width,
  height,
  sizes,
  proxy,
  ...rest
}) => {
  const [index, setIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const chain = [src, ...(fallbackSrc || [])]
    .map(resolveUrl)
    .filter(Boolean) as string[];
  const resolvedChain = chain.map((u) => {
    if (proxy || (failedUrls.has(u) && u.startsWith("https://"))) {
      return u.includes("/api/image-proxy")
        ? u
        : `/api/image-proxy?url=${encodeURIComponent(u)}`;
    }
    return u;
  });

  const currentSrc = resolvedChain[index];

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    const style = fill ? { width: "100%", height: "100%" } : { width, height };
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-slate-800 ${fallbackClassName || ""}`}
        style={style}
      >
        <ImageOff className="w-1/3 h-1/3 text-gray-400" />
      </div>
    );
  }

  const isCdnOrProxy =
    currentSrc.includes("/api/image-proxy") ||
    currentSrc.includes(".r2.dev") ||
    currentSrc.includes(".b-cdn.net") ||
    currentSrc.includes("cdn.podacium.com") ||
    currentSrc.includes("files.podacium.com");

  const imageProps: any = {
    src: currentSrc,
    alt: alt || "",
    className,
    sizes,
    unoptimized: isCdnOrProxy || rest.unoptimized,
    onError: () => {
      const directUrl = chain[index];
      // If direct load failed and not yet proxied, cache and retry via proxy
      if (
        directUrl &&
        !failedUrls.has(directUrl) &&
        directUrl.startsWith("https://")
      ) {
        failedUrls.add(directUrl);
        setRetryCount((c) => c + 1); // re-render with proxied URL
        return;
      }
      if (index < resolvedChain.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setIndex(resolvedChain.length);
      }
    },
    ...rest,
  };

  // Prevent crash: strip placeholder="blur" if blurDataURL is missing
  if (imageProps.placeholder === "blur" && !imageProps.blurDataURL) {
    delete imageProps.placeholder;
  }

  if (fill) {
    imageProps.fill = true;
  } else {
    imageProps.width = width;
    imageProps.height = height;
  }

  return <NextImage {...imageProps} />;
};

export default UniversalImage;
