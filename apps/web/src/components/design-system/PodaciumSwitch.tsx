import React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  id?: string;
}

const sizeConfig = {
  sm: { track: "w-8 h-4", thumb: "w-3 h-3" },
  md: { track: "w-11 h-6", thumb: "w-5 h-5" },
  lg: { track: "w-14 h-7", thumb: "w-6 h-6" },
};

const PodaciumSwitch: React.FC<SwitchProps> = ({
  checked = false,
  onChange,
  onCheckedChange,
  label,
  description,
  disabled = false,
  size = "md",
  id,
}) => {
  const switchId = id || `switch-${label?.toLowerCase().replace(/\s/g, "-")}`;
  const config = sizeConfig[size];

  const handleToggle = () => {
    if (disabled) return;
    const nextVal = !checked;
    onChange?.(nextVal);
    onCheckedChange?.(nextVal);
  };

  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label
              htmlFor={switchId}
              className="text-sm font-medium text-foreground cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          config.track,
          checked ? "bg-primary" : "bg-input",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-white dark:bg-slate-900 shadow-sm ring-0 transition-all duration-200 ease-in-out absolute top-0.5",
            config.thumb,
            checked
              ? "start-[calc(100%-0.25rem)] -translate-x-full"
              : "start-0.5",
          )}
        />
      </button>
    </div>
  );
};

PodaciumSwitch.displayName = "PodaciumSwitch";
export { PodaciumSwitch };
export default PodaciumSwitch;
