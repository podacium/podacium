import React from "react";
import { useTranslations } from "@/lib/i18n";

interface HighlightCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color:
    | "blue"
    | "green"
    | "yellow"
    | "purple"
    | "red"
    | "indigo"
    | "emerald"
    | "orange";
  className?: string;
  dir?: "ltr" | "rtl";
}

const LegalHighlightCard: React.FC<HighlightCardProps> = ({
  icon,
  title,
  description,
  color,
  className = "",
  dir,
}) => {
  const t = useTranslations();
  const direction = dir || t.dir;

  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-100/50 border-yellow-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200",
    indigo: "bg-indigo-50 border-indigo-200",
    emerald: "bg-emerald-50 border-emerald-200",
    orange: "bg-orange-50 border-orange-200",
  };

  const iconColorClasses = {
    blue: "text-blue-600 bg-blue-100",
    green: "text-green-600 bg-green-100",
    yellow: "text-yellow-600 bg-yellow-100",
    purple: "text-purple-600 bg-purple-100",
    red: "text-red-600 bg-red-100",
    indigo: "text-indigo-600 bg-indigo-100",
    emerald: "text-emerald-600 bg-emerald-100",
    orange: "text-orange-600 bg-orange-100",
  };

  return (
    <div
      className={`p-5 rounded-xl border ${colorClasses[color]} ${className} text-start`}
      dir={direction}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`p-2 rounded-lg flex-shrink-0 ${iconColorClasses[color]} rtl:-scale-x-100`}
        >
          {icon}
        </div>
        <h4 className="font-bold text-gray-900 dark:text-slate-100 flex-1 text-start">
          {title}
        </h4>
      </div>
      <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed text-start">
        {description}
      </p>
    </div>
  );
};

export default LegalHighlightCard;
