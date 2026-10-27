"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";

interface SliderProps {
  children: React.ReactNode;
  className?: string;
  autoPlay?: boolean;
  interval?: number;
}

const LandingSlider: React.FC<SliderProps> = React.memo(
  ({ children, className = "", autoPlay = false, interval = 5000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const childrenArray = React.Children.toArray(children);

    useEffect(() => {
      if (!autoPlay || childrenArray.length <= 1) return;

      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % childrenArray.length);
      }, interval);

      return () => clearInterval(timer);
    }, [autoPlay, interval, childrenArray.length]);

    const goToSlide = useCallback((index: number) => {
      setCurrentIndex(index);
    }, []);

    const goToNext = useCallback(() => {
      setCurrentIndex((prev) => (prev + 1) % childrenArray.length);
    }, [childrenArray.length]);

    const goToPrev = useCallback(() => {
      setCurrentIndex(
        (prev) => (prev - 1 + childrenArray.length) % childrenArray.length,
      );
    }, [childrenArray.length]);

    const t = useTranslations();

    return (
      <div className={`relative ${className}`}>
        <div className="overflow-hidden rounded-2xl">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {childrenArray.map((child, index) => (
              <div key={index} className="w-full flex-shrink-0">
                {child}
              </div>
            ))}
          </div>
        </div>

        {childrenArray.length > 1 && (
          <>
            {/* Left arrow */}
            <button
              onClick={goToPrev}
              className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-white dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-full p-2.5 shadow-xl transition-all z-10 active:scale-95"
              aria-label={t("home.pillars.navigation.previous")}
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Right arrow */}
            <button
              onClick={goToNext}
              className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-white dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-full p-2.5 shadow-xl transition-all z-10 active:scale-95"
              aria-label={t("home.pillars.navigation.next")}
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
              {childrenArray.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all active:scale-125 ${
                    index === currentIndex
                      ? "bg-white dark:bg-slate-900 shadow-lg"
                      : "bg-white/50 dark:bg-slate-900/50"
                  }`}
                  aria-label={`${t("home.pillars.indicators.goToSlide")} ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  },
);

LandingSlider.displayName = "LandingSlider";

export default LandingSlider;
export type { SliderProps };
