import React from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface AvatarProps {
  src?: string | null;
  alt: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  fallback?: string;
  className?: string;
  online?: boolean;
}

const sizeClasses = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

const PodaciumAvatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = "md",
  fallback,
  className,
  online,
}) => {
  const t = useTranslations("common");
  const displayName = name || alt;
  const initials =
    fallback ||
    (displayName
      ?.split(" ")
      ?.map((n) => n[0])
      ?.join("")
      ?.slice(0, 2)
      ?.toUpperCase() ??
      "?");

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 rounded-full",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            "absolute inset-0 w-full h-full rounded-full object-cover border-2 border-white/80 shadow-md shadow-indigo-500/10",
            "transition-transform duration-300 hover:scale-105",
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center w-full h-full font-semibold text-white rounded-full",
            "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-indigo-500/25 ring-2 ring-white dark:ring-slate-900/40",
          )}
          aria-label={alt}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 end-0 block rounded-full ring-2 ring-white dark:ring-slate-900",
            size === "xs" ? "w-1.5 h-1.5" : "w-2.5 h-2.5",
            online
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
              : "bg-gray-300",
          )}
          aria-label={online ? t("common.online") : t("common.offline")}
        />
      )}
    </div>
  );
};

PodaciumAvatar.displayName = "PodaciumAvatar";
export { PodaciumAvatar };
export default PodaciumAvatar;
