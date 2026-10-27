import React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
}

const PodaciumTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      hint,
      maxLength,
      showCount,
      id,
      value,
      ...props
    },
    ref,
  ) => {
    const textareaId =
      id || `textarea-${label?.toLowerCase().replace(/\s/g, "-")}`;
    const charCount = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            "flex w-full min-h-[80px] rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 text-sm ring-offset-background transition-colors",
            "placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            error
              ? "border-red-500"
              : "border-gray-200 dark:border-slate-800 focus-visible:border-blue-500",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : hint
                ? `${textareaId}-hint`
                : undefined
          }
          {...props}
        />
        <div className="flex justify-between">
          <div>
            {error && (
              <p
                id={`${textareaId}-error`}
                className="text-xs text-red-500 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            {hint && !error && (
              <p
                id={`${textareaId}-hint`}
                className="text-xs text-gray-500 dark:text-slate-400"
              >
                {hint}
              </p>
            )}
          </div>
          {showCount && maxLength && (
            <span
              className={cn(
                "text-xs",
                charCount > maxLength * 0.9
                  ? "text-red-500 dark:text-red-400"
                  : "text-gray-400",
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);

PodaciumTextarea.displayName = "PodaciumTextarea";
export { PodaciumTextarea };
export default PodaciumTextarea;
