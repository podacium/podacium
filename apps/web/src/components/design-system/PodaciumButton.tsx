import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input dark:border-slate-700 bg-transparent hover:bg-secondary dark:hover:bg-slate-800 dark:text-slate-100",
        secondary:
          "bg-secondary dark:bg-slate-800 text-secondary-foreground dark:text-slate-100 hover:bg-secondary/80 dark:hover:bg-slate-700",
        craft: "btn-craft-secondary active:scale-[0.98] select-none",
        tactile: "btn-tactile-keycap select-none",
        toggle: "btn-tactile-toggle select-none",
        ghost: "hover:bg-secondary dark:hover:bg-slate-800 dark:text-slate-100",
        link: "text-primary underline-offset-4 hover:underline",
        gradient:
          "relative overflow-hidden bg-gradient-to-r from-primary to-indigo-600 text-white hover:from-primary/90 hover:to-indigo-600/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-13 rounded-xl px-8 py-3.5 text-base",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  href?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  /** Enable a soft brand glow halo on hover */
  glow?: boolean;
}

const PodaciumButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading,
      href,
      icon,
      iconPosition = "left",
      glow,
      children,
      ...props
    },
    ref,
  ) => {
    // If href is provided, render as Link
    if (href) {
      return (
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant, size, fullWidth, className }),
            glow && "hover:animate-ring-pulse",
          )}
        >
          {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {!loading && icon && iconPosition === "left" && (
            <span className="me-2">{icon}</span>
          )}
          {children}
          {!loading && icon && iconPosition === "right" && (
            <span className="ms-2">{icon}</span>
          )}
        </Link>
      );
    }

    return (
      <motion.button
        className={cn(
          buttonVariants({ variant, size, fullWidth, className }),
          glow && "hover:animate-ring-pulse",
        )}
        ref={ref}
        disabled={props.disabled || loading}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...(props as any)} // framer-motion props
      >
        {variant === "gradient" && (
          <span aria-hidden className="absolute inset-0 shimmer-sweep" />
        )}
        {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {!loading && icon && iconPosition === "left" && (
          <span className="me-2">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === "right" && (
          <span className="ms-2">{icon}</span>
        )}
      </motion.button>
    );
  },
);
PodaciumButton.displayName = "PodaciumButton";

export { PodaciumButton, buttonVariants };
export default PodaciumButton;
