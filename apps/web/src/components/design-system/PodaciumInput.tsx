import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg border bg-white dark:bg-slate-900/80 px-3 py-2.5 text-sm text-gray-900 dark:text-slate-100 ring-offset-background transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-gray-300 dark:hover:border-slate-700 dark:hover:border-slate-600 focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]",
  {
    variants: {
      variant: {
        default:
          "border-gray-200 dark:border-slate-800 focus-visible:border-blue-500",
        error: "border-red-500 focus-visible:ring-red-500",
        success: "border-green-500 focus-visible:ring-green-500",
      },
      inputSize: {
        sm: "h-9 text-base sm:text-xs",
        md: "h-10 text-base sm:text-sm",
        lg: "h-12 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const PodaciumInput = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s/g, "-")}`;
    const errorVariant = error ? "error" : variant;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-slate-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              inputVariants({ variant: errorVariant, inputSize }),
              leftIcon && "ps-10",
              rightIcon && "pe-10",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-red-500 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-xs text-gray-500 dark:text-slate-400"
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

PodaciumInput.displayName = "PodaciumInput";
export { PodaciumInput, inputVariants };
export default PodaciumInput;
