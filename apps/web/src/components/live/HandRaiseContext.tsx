"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface HandRaiseContextValue {
  raisedHands: Set<string>;
  raiseHand: (identity: string) => void;
  lowerHand: (identity: string) => void;
  lowerAllHands: () => void;
  isHandRaised: (identity: string) => boolean;
}

const HandRaiseContext = createContext<HandRaiseContextValue | null>(null);

export function HandRaiseProvider({ children }: { children: React.ReactNode }) {
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  const raiseHand = useCallback((identity: string) => {
    setRaisedHands((prev) => new Set(prev).add(identity));
  }, []);

  const lowerHand = useCallback((identity: string) => {
    setRaisedHands((prev) => {
      const next = new Set(prev);
      next.delete(identity);
      return next;
    });
  }, []);

  const lowerAllHands = useCallback(() => {
    setRaisedHands(new Set());
  }, []);

  const isHandRaised = useCallback(
    (identity: string) => raisedHands.has(identity),
    [raisedHands],
  );

  const contextValue = React.useMemo(
    () => ({ raisedHands, raiseHand, lowerHand, lowerAllHands, isHandRaised }),
    [raisedHands, raiseHand, lowerHand, lowerAllHands, isHandRaised],
  );

  return (
    <HandRaiseContext.Provider value={contextValue}>
      {children}
    </HandRaiseContext.Provider>
  );
}

export function useHandRaise() {
  const ctx = useContext(HandRaiseContext);
  if (!ctx)
    throw new Error("useHandRaise must be used within HandRaiseProvider");
  return ctx;
}
