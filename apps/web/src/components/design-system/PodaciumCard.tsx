import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-md border transition-colors", {
  variants: {
    variant: {
      default:
        "border-border dark:border-slate-800/80 bg-white dark:bg-slate-900 text-foreground dark:text-slate-100",
      elevated:
        "border-transparent shadow-md dark:shadow-slate-950/50 bg-white dark:bg-slate-900 text-foreground dark:text-slate-100",
      outline:
        "border-2 border-border dark:border-slate-800 bg-transparent text-foreground dark:text-slate-100",
      glass:
        "border-border/50 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-foreground dark:text-slate-100",
      premium:
        "gradient-border border-transparent bg-white dark:bg-slate-900 text-foreground dark:text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)] transition-shadow duration-300",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    },
    hover: {
      true: "hover:shadow-md hover:-translate-y-0.5",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
    hover: false,
  },
});

export interface CardProps
  extends
    Omit<HTMLMotionProps<"div">, "children">,
    VariantProps<typeof cardVariants> {
  children: React.ReactNode;
}

const PodaciumCard = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(cardVariants({ variant, padding, hover, className }))}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
PodaciumCard.displayName = "PodaciumCard";

export { PodaciumCard };
export default PodaciumCard;
