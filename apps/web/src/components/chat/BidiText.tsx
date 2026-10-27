"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BidiTextProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  as?: "span" | "div" | "p" | "code" | "bdi";
  dir?: "auto" | "ltr" | "rtl";
  isolate?: boolean;
}

export function BidiText({
  children,
  as: Component = "bdi",
  dir = "auto",
  isolate = true,
  className,
  ...props
}: BidiTextProps) {
  return (
    <Component
      dir={dir}
      className={cn(isolate && "unicode-bidi-isolate", className)}
      {...props}
    >
      {children}
    </Component>
  );
}
