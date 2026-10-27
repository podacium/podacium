import React from "react";
import { motion } from "framer-motion";

// Enhanced Progress Ring with Hub Page Design System
interface PodaciumProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  animated?: boolean;
  variant?: "default" | "success" | "warning" | "info" | "purple" | "blue";
  compact?: boolean;
}

const PodaciumProgressRing: React.FC<PodaciumProgressRingProps> = ({
  progress,
  size = 50,
  strokeWidth = 4,
  showPercentage = true,
  animated = true,
  variant = "purple",
  compact = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  // Hub page color variants
  const variantColors = {
    default: {
      gradient: "from-gray-600 to-gray-800",
      text: "text-gray-700 dark:text-slate-300",
      bg: "bg-gray-100 dark:bg-slate-800",
      border: "border-gray-200 dark:border-slate-800",
    },
    success: {
      gradient: "from-green-500 to-emerald-500",
      text: "text-green-700",
      bg: "bg-green-100",
      border: "border-green-200",
    },
    warning: {
      gradient: "from-amber-500 to-orange-500",
      text: "text-amber-700",
      bg: "bg-amber-100",
      border: "border-amber-200",
    },
    info: {
      gradient: "from-blue-500 to-indigo-500",
      text: "text-blue-700",
      bg: "bg-blue-100",
      border: "border-blue-200",
    },
    purple: {
      gradient: "from-purple-600 to-indigo-600",
      text: "text-purple-700",
      bg: "bg-purple-100",
      border: "border-purple-200",
    },
    blue: {
      gradient: "from-blue-500 to-indigo-500",
      text: "text-blue-700",
      bg: "bg-blue-100",
      border: "border-blue-200",
    },
  };

  const colors = variantColors[variant];

  return (
    <motion.div
      className="relative inline-flex items-center justify-center group"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        className={`transform -rotate-90 ${compact ? "" : "group-hover:scale-105 transition-transform duration-300"}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-gray-200/80"
        />

        {/* Progress circle with gradient */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="fill-none stroke-current"
          strokeLinecap="round"
          initial={animated ? { strokeDashoffset: circumference } : undefined}
          animate={animated ? { strokeDashoffset: offset } : undefined}
          transition={animated ? { duration: 1.2, ease: "circOut" } : undefined}
          style={{
            stroke: `url(#hub-gradient-${variant}-${size})`,
          }}
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient
            id={`hub-gradient-${variant}-${size}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={
                variant === "purple"
                  ? "#9333ea"
                  : variant === "info"
                    ? "#3b82f6"
                    : variant === "success"
                      ? "#10b981"
                      : variant === "warning"
                        ? "#f59e0b"
                        : "#4b5563"
              }
            />
            <stop
              offset="100%"
              stopColor={
                variant === "purple"
                  ? "#4f46e5"
                  : variant === "info"
                    ? "#6366f1"
                    : variant === "success"
                      ? "#059669"
                      : variant === "warning"
                        ? "#d97706"
                        : "#1f2937"
              }
            />
          </linearGradient>
        </defs>
      </svg>

      {/* Percentage text - styled like hub page */}
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`font-bold transition-colors duration-300 ${
              compact
                ? "text-[10px]"
                : size <= 40
                  ? "text-xs"
                  : size <= 60
                    ? "text-sm"
                    : "text-base"
            } ${colors.text}`}
            initial={animated ? { scale: 0, opacity: 0 } : undefined}
            animate={animated ? { scale: 1, opacity: 1 } : undefined}
            transition={
              animated
                ? {
                    delay: 0.6,
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                  }
                : undefined
            }
          >
            {Math.round(progress)}%
          </motion.span>
        </div>
      )}

      {/* Subtle glow effect on hover - like hub page elements */}
      {!compact && (
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white to-transparent"></div>
      )}
    </motion.div>
  );
};

export default PodaciumProgressRing;
