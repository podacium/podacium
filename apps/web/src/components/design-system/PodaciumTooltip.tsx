import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

const positionStyles = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "end-full top-1/2 -translate-y-1/2 me-2",
  right: "start-full top-1/2 -translate-y-1/2 ms-2",
};

const PodaciumTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 200,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  const show = () => {
    const id = setTimeout(() => setVisible(true), delay);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap pointer-events-none",
            positionStyles[position],
            className,
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              "absolute w-2 h-2 bg-gray-900 rotate-45",
              position === "top" && "top-full left-1/2 -translate-x-1/2 -mt-1",
              position === "bottom" &&
                "bottom-full left-1/2 -translate-x-1/2 -mb-1",
              position === "left" &&
                "start-full top-1/2 -translate-y-1/2 -ms-1",
              position === "right" && "end-full top-1/2 -translate-y-1/2 -me-1",
            )}
          />
        </div>
      )}
    </div>
  );
};

PodaciumTooltip.displayName = "PodaciumTooltip";
export { PodaciumTooltip };
export default PodaciumTooltip;
