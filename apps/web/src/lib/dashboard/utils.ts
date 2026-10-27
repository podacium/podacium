export const formatCurrency = (
  amount: number,
  locale = "en",
  currency = "DZD",
): string => {
  if (!amount || amount === 0) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(0);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string, locale = "en"): string => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatRelativeTime = (
  dateString: string,
  t?: (key: string) => string,
): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return t ? t("dashboard.time.justNow") : "Just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)}${t ? t("dashboard.time.minutes") : "m"}`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)}${t ? t("dashboard.time.hours") : "h"}`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}${t ? t("dashboard.time.days") : "d"}`;
  return formatDate(dateString);
};

export const getProgressColor = (progress: number): string => {
  if (progress >= 80) return "text-emerald-500";
  if (progress >= 60) return "text-blue-500";
  if (progress >= 40) return "text-amber-500";
  return "text-orange-500";
};

export type UserRoleStr =
  "STUDENT" | "FREELANCER" | "BUSINESS" | "ADMIN" | "INSTRUCTOR";

export const ROLE_THEMES: Record<
  UserRoleStr,
  { gradient: string; iconBg: string; accent: string }
> = {
  STUDENT: {
    gradient: "from-blue-600 to-blue-400",
    iconBg: "from-blue-100 to-indigo-100",
    accent: "blue",
  },
  FREELANCER: {
    gradient: "from-purple-600 to-pink-400",
    iconBg: "from-purple-100 to-pink-100",
    accent: "purple",
  },
  BUSINESS: {
    gradient: "from-emerald-600 to-teal-400",
    iconBg: "from-emerald-100 to-teal-100",
    accent: "emerald",
  },
  ADMIN: {
    gradient: "from-slate-700 to-gray-500",
    iconBg: "from-slate-100 to-gray-100",
    accent: "slate",
  },
  INSTRUCTOR: {
    gradient: "from-blue-600 to-blue-400",
    iconBg: "from-blue-100 to-indigo-100",
    accent: "blue",
  },
};
