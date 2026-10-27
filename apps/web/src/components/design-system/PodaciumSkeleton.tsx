import React from "react";
import { motion } from "framer-motion";

// Enhanced Skeleton Loader with Podacium Design System
interface PodaciumSkeletonProps {
  variant?: "text" | "circular" | "circle" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: "pulse" | "wave" | "none";
}

const PodaciumSkeleton: React.FC<PodaciumSkeletonProps> = ({
  variant = "text",
  width = "100%",
  height = "1rem",
  className = "",
  animation = "pulse",
}) => {
  const baseClasses =
    "bg-gray-200 dark:bg-slate-800/90 dark:bg-gray-700 rounded-lg";

  const variantClasses = {
    text: "rounded-lg",
    circular: "rounded-full",
    circle: "rounded-full",
    rectangular: "rounded-none",
    rounded: "rounded-2xl",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]",
    none: "",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`;

  return (
    <motion.div
      className={classes}
      style={{ width, height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    />
  );
};

export default PodaciumSkeleton;
