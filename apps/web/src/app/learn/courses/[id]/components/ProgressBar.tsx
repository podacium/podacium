import React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  color?: "blue" | "green" | "purple" | "orange" | "gray" | "indigo";
  animated?: boolean;
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = true,
  size = "md",
  color = "blue",
  animated = true,
  showPercentage = true,
}) => {
  const t = useTranslations();
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-3.5",
    xl: "h-5",
  };

  const radiusClasses = {
    sm: "rounded-full",
    md: "rounded-full",
    lg: "rounded-full",
    xl: "rounded-full",
  };

  const gradientColors = {
    blue: "from-blue-500 via-blue-600 to-indigo-600",
    green: "from-green-500 via-emerald-500 to-emerald-600",
    purple: "from-purple-500 via-purple-600 to-pink-600",
    orange: "from-orange-500 via-amber-500 to-amber-600",
    gray: "from-gray-400 via-gray-500 to-gray-600",
    indigo: "from-indigo-500 via-purple-500 to-purple-600",
  };

  const textColors = {
    blue: "text-blue-700",
    green: "text-green-700",
    purple: "text-purple-700",
    orange: "text-orange-700",
    gray: "text-gray-700 dark:text-slate-300",
    indigo: "text-indigo-700",
  };

  return (
    <div className="space-y-2">
      <div
        className={`${heightClasses[size]} ${radiusClasses[size]} bg-gray-100/80 dark:bg-slate-800/80 shadow-inner overflow-hidden relative border border-gray-200 dark:border-slate-800/30`}
      >
        <motion.div
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: animated ? 1.2 : 0,
            ease: [0.34, 1.56, 0.64, 1],
            delay: animated ? 0.1 : 0,
          }}
          className={`h-full bg-gradient-to-r ${gradientColors[color]} relative rounded-full`}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/20 blur-md pointer-events-none" />
        </motion.div>
      </div>
      {showLabel && (
        <div className="flex justify-between items-center px-1">
          <span
            className={`text-xs font-bold uppercase tracking-wider ${textColors[color]} opacity-80 font-mono`}
          >
            {t("course.progress.label")}
          </span>
          {showPercentage && (
            <span
              className={`text-sm font-black ${textColors[color]} flex items-center`}
            >
              <span className="text-lg leading-none me-0.5">
                {Math.round(percentage)}
              </span>
              <span className="text-[10px] opacity-70">%</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
