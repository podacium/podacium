"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-[4px] border-2 transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input bg-white dark:bg-slate-900/80 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground hover:border-primary/50",
        outline:
          "border-input bg-transparent data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground hover:bg-primary/5 hover:border-primary",
        soft: "border-transparent bg-muted data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground hover:bg-primary/10",
      },
      size: {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
        lg: "h-5 w-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

const labelVariants = cva(
  "text-sm font-medium text-foreground peer-disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      position: {
        right: "ms-2",
        left: "me-2",
      },
    },
    defaultVariants: {
      position: "right",
    },
  },
);

export interface CheckboxProps
  extends
    Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      "type" | "size" | "checked" | "onChange"
    >,
    VariantProps<typeof checkboxVariants> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  labelPosition?: "left" | "right";
  id?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      variant,
      size,
      label,
      description,
      checked = false,
      indeterminate = false,
      onCheckedChange,
      onChange,
      labelPosition = "right",
      id,
      disabled = false,
      required = false,
      error,
      ...props
    },
    ref,
  ) => {
    const checkboxId =
      id || `checkbox-${label?.toString().toLowerCase().replace(/\s+/g, "-")}`;
    const describedBy =
      [
        error && `${checkboxId}-error`,
        description && `${checkboxId}-description`,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextChecked = event.target.checked;
      onCheckedChange?.(nextChecked);
      onChange?.(nextChecked);
    };

    const state = indeterminate
      ? "indeterminate"
      : checked
        ? "checked"
        : "unchecked";

    return (
      <div className="flex items-start">
        {labelPosition === "left" && label && (
          <label
            htmlFor={checkboxId}
            className={cn(labelVariants({ position: "left" }), "mt-0.5 flex-1")}
          >
            {label}
            {required && (
              <span className="text-destructive ms-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div
          className={cn(
            "flex flex-col",
            labelPosition === "right" && "items-start",
          )}
        >
          <label
            htmlFor={checkboxId}
            className={cn(
              "flex items-center cursor-pointer peer relative",
              labelPosition === "right" && "group",
            )}
          >
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              onChange={handleChange}
              disabled={disabled}
              required={required}
              {...(indeterminate && { indeterminate: true })}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              aria-required={required}
              className={cn("sr-only peer", className)}
              data-slot="checkbox"
              {...props}
            />
            <div
              className={cn(
                checkboxVariants({ variant, size }),
                "pointer-events-none flex items-center justify-center",
              )}
              data-state={state}
              aria-hidden="true"
            >
              {indeterminate && (
                <svg
                  className="h-full w-full stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <line
                    x1="5"
                    y1="12"
                    x2="19"
                    y2="12"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {!indeterminate && checked && (
                <svg
                  className="h-full w-full stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <polyline
                    points="20 6 9 17 4 12"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            {labelPosition === "right" && label && (
              <span
                className={cn(
                  labelVariants({ position: "right" }),
                  "group-has-[:focus-visible]/peer:ring-0",
                )}
              >
                {label}
                {required && (
                  <span className="text-destructive ms-1" aria-hidden="true">
                    *
                  </span>
                )}
              </span>
            )}
          </label>
          {description && (
            <p
              id={`${checkboxId}-description`}
              className="text-xs text-muted-foreground ms-6 mt-1"
            >
              {description}
            </p>
          )}
          {error && (
            <p
              id={`${checkboxId}-error`}
              className="text-xs text-destructive ms-6 mt-1 flex items-center"
              role="alert"
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  },
);

Checkbox.displayName = "PodaciumCheckbox";

export { Checkbox, checkboxVariants };
export default Checkbox;
