import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "size"
> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  selectSize?: "sm" | "md" | "lg";
}

const PodaciumSelect = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      hint,
      options,
      placeholder,
      selectSize = "md",
      id,
      ...props
    },
    ref,
  ) => {
    const selectId = id || `select-${label?.toLowerCase().replace(/\s/g, "-")}`;

    const sizeClasses = {
      sm: "h-9 text-xs",
      md: "h-10 text-sm",
      lg: "h-12 text-base",
    };

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-gray-700 dark:text-slate-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "flex w-full appearance-none rounded-lg border bg-white dark:bg-slate-900/80 text-gray-900 dark:text-slate-100 ps-3 pe-10 ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red-500"
                : "border-gray-200 dark:border-slate-800 focus-visible:border-blue-500",
              sizeClasses[selectSize],
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${selectId}-error`
                : hint
                  ? `${selectId}-hint`
                  : undefined
            }
            {...props}
          >
            {placeholder && (
              <option
                value=""
                disabled
                className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              >
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
            className="text-xs text-red-500 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${selectId}-hint`}
            className="text-xs text-gray-500 dark:text-slate-400"
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

PodaciumSelect.displayName = "PodaciumSelect";
export { PodaciumSelect };
export default PodaciumSelect;
