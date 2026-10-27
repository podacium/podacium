"use client";

import React, { Component, ReactNode } from "react";
import { ImageOff } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
}

class ImageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            className={`flex items-center justify-center bg-gray-100 dark:bg-slate-800 ${this.props.className || ""}`}
          >
            <ImageOff className="w-6 h-6 text-gray-400" />
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ImageErrorBoundary;
