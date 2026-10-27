"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Users,
  Star,
  BookOpen,
  BarChart3,
  Flame,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface StatCardProps {
  icon: any;
  label: string;
  value: string | number;
  color?: string;
  delay?: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-blue-600",
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="flex items-center gap-4 p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-lg transition-all duration-300 cursor-default"
    >
      <div
        className={`p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 ${color}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

interface PathStatsBarProps {
  modulesCount: number;
  duration: string;
  enrolledCount: number;
  rating?: number;
  progress?: number;
  streakDays?: number;
  pace?: string;
  isEnrolled: boolean;
  t: (key: string) => string;
}

export default function PathStatsBar({
  modulesCount,
  duration,
  enrolledCount,
  rating,
  progress,
  streakDays,
  pace,
  isEnrolled,
  t,
}: PathStatsBarProps) {
  const items = [
    {
      icon: BookOpen,
      label: t("path.hero.stats.modules"),
      value: modulesCount,
      color: "text-blue-600",
      key: "modules",
    },
    {
      icon: Clock,
      label: t("path.hero.stats.duration"),
      value: duration || t("path.hero.stats.selfPaced"),
      color: "text-purple-600",
      key: "duration",
    },
    {
      icon: Users,
      label: t("path.hero.stats.enrolled"),
      value: enrolledCount,
      color: "text-green-600",
      key: "enrolled",
    },
  ];

  if (rating) {
    items.push({
      icon: Star,
      label: t("path.hero.stats.rating"),
      value: rating.toFixed(1),
      color: "text-amber-500",
      key: "rating",
    });
  }

  if (isEnrolled && progress !== undefined) {
    items.push({
      icon: BarChart3,
      label: t("path.labels.progress"),
      value: `${Math.round(progress)}%`,
      color: "text-purple-600 dark:text-purple-400",
      key: "progress",
    });
  }

  if (isEnrolled && streakDays !== undefined && streakDays > 0) {
    items.push({
      icon: Flame,
      label: t("path.labels.streak"),
      value: `${streakDays} ${t("path.labels.days")}`,
      color: "text-orange-500",
      key: "streak",
    });
  }

  if (isEnrolled && pace) {
    const paceIcon =
      pace === "ahead"
        ? TrendingUp
        : pace === "behind"
          ? AlertCircle
          : CheckCircle;
    const paceColor =
      pace === "ahead"
        ? "text-green-600"
        : pace === "behind"
          ? "text-amber-600"
          : "text-blue-600";
    items.push({
      icon: paceIcon,
      label: t("path.labels.pace"),
      value: t(`path.labels.pace_${pace}`),
      color: paceColor,
      key: "pace",
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item, idx) => (
        <StatCard
          key={item.key}
          icon={item.icon}
          label={item.label}
          value={item.value}
          color={item.color}
          delay={0.1 * idx}
        />
      ))}
    </div>
  );
}
