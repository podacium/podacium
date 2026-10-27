"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

interface FocusChromeState {
  title?: string;
  backHref?: string;
  progressPercent?: number;
}

interface RootChromeContextValue {
  hasRootNavbar: boolean;
  focusState: FocusChromeState;
  setFocusState: React.Dispatch<React.SetStateAction<FocusChromeState>>;
}

const RootChromeContext = createContext<RootChromeContextValue>({
  hasRootNavbar: false,
  focusState: {},
  setFocusState: () => {},
});

export function RootNavbarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focusState, setFocusState] = useState<FocusChromeState>({});

  const value = useMemo(
    () => ({
      hasRootNavbar: true,
      focusState,
      setFocusState,
    }),
    [focusState],
  );

  return (
    <RootChromeContext.Provider value={value}>
      {children}
    </RootChromeContext.Provider>
  );
}

export function useHasRootNavbar(): boolean {
  return useContext(RootChromeContext).hasRootNavbar;
}

export function useFocusChrome() {
  const ctx = useContext(RootChromeContext);
  return {
    focusState: ctx.focusState,
    setFocusState: ctx.setFocusState,
  };
}
