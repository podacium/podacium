"use client";

import React from "react";
import { motion } from "framer-motion";
import { premiumStagger, premiumStaggerItem } from "@/lib/animation-presets";

interface PageHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Optional icon to display next to the title */
  icon?: React.ReactNode;
  /** Optional action buttons */
  actions?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Consistent page header component for all pages.
 * Premium entrance, gradient icon tile, and refined typography.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={premiumStagger}
      className={`mb-8 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          variants={premiumStaggerItem}
          className="flex items-center gap-3.5"
        >
          {icon && (
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl blur-md opacity-30" />
              <div className="relative p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/25">
                {icon}
              </div>
            </div>
          )}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 dark:text-slate-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        </motion.div>

        {actions && (
          <motion.div
            variants={premiumStaggerItem}
            className="flex items-center gap-3"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default PageHeader;
