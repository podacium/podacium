"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  readOnly = false,
  size = "md",
}) => {
  const t = useTranslations("learn");
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;
  const starSize = sizeMap[size];

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`transition-all duration-150 ${
            readOnly
              ? "cursor-default"
              : "cursor-pointer hover:scale-110 active:scale-95"
          }`}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHoverValue(star)}
          onMouseLeave={() => !readOnly && setHoverValue(0)}
          aria-label={t("course.reviews.rateStar", { count: star })}
        >
          <Star
            className={`${starSize} transition-colors duration-150 ${
              star <= displayValue
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300"
            } ${!readOnly && hoverValue >= star ? "drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]" : ""}`}
          />
        </button>
      ))}
    </div>
  );
};
