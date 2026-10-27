import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary dark:bg-slate-800 text-secondary-foreground dark:text-slate-100",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline:
          "border-border dark:border-slate-700 text-foreground dark:text-slate-100",
        success:
          "border-transparent bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300",
        gradient:
          "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const PodaciumBadge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
PodaciumBadge.displayName = "PodaciumBadge";

export { PodaciumBadge };
export default PodaciumBadge;
