import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  title?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    bg: "bg-green-50 border-green-200 dark:bg-green-950/60 dark:border-green-800/60",
    text: "text-green-800 dark:text-green-200",
    iconColor: "text-green-500 dark:text-green-400",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-800/60",
    text: "text-red-800 dark:text-red-200",
    iconColor: "text-red-500 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/60 dark:border-yellow-800/60",
    text: "text-yellow-800 dark:text-yellow-200",
    iconColor: "text-yellow-500 dark:text-yellow-400",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800/60",
    text: "text-blue-800 dark:text-blue-200",
    iconColor: "text-blue-500 dark:text-blue-400",
  },
};

const PodaciumToast: React.FC<ToastProps> = ({
  id,
  message,
  variant = "info",
  title,
  onDismiss,
}) => {
  const t = useTranslations("common");
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full backdrop-blur-sm",
        config.bg,
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.iconColor)} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn("text-sm font-semibold", config.text)}>{title}</p>
        )}
        <p className={cn("text-sm", config.text)}>{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label={t("dismiss")}
      >
        <X className="w-4 h-4 text-gray-400 dark:text-gray-300" />
      </button>
    </motion.div>
  );
};

// Toast container for positioning
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    variant?: ToastVariant;
    title?: string;
  }>;
  onDismiss: (id: string) => void;
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
}

const positionClasses = {
  "top-right": "top-4 end-4",
  "top-center": "top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
  "bottom-right": "bottom-4 end-4",
  "bottom-center": "bottom-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
};

export const PodaciumToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = "top-right",
}) => {
  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col gap-2",
        positionClasses[position],
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <PodaciumToast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

PodaciumToast.displayName = "PodaciumToast";
export { PodaciumToast };
export default PodaciumToast;
