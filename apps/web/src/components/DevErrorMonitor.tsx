"use client";

import { useEffect } from "react";
import { initDevErrorReporter } from "@/lib/dev-logger/client";

export function DevErrorMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const cleanup = initDevErrorReporter();
      return cleanup;
    }
  }, []);

  return null;
}
