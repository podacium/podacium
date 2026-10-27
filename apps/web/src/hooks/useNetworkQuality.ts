"use client";

import { useState, useEffect, useCallback } from "react";

export type EffectiveConnectionType = "slow-2g" | "2g" | "3g" | "4g";

export interface NetworkQualityState {
  isSupported: boolean;
  effectiveType: EffectiveConnectionType;
  downlink: number; // in Mbps
  rtt: number; // in ms
  saveData: boolean;
  isPoorConnection: boolean;
  shouldDeferPrefetch: boolean;
  recommendedResolution: "240p" | "360p" | "720p" | "1080p";
}

interface NetworkInformation extends EventTarget {
  effectiveType: EffectiveConnectionType;
  downlink: number;
  rtt: number;
  saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => any) | null;
}

export function useNetworkQuality(): NetworkQualityState {
  const [networkState, setNetworkState] = useState<NetworkQualityState>({
    isSupported: false,
    effectiveType: "4g",
    downlink: 10,
    rtt: 50,
    saveData: false,
    isPoorConnection: false,
    shouldDeferPrefetch: false,
    recommendedResolution: "1080p",
  });

  const evaluateQuality = useCallback(
    (conn?: Partial<NetworkInformation>): NetworkQualityState => {
      const isSupported = !!conn;
      const effectiveType = conn?.effectiveType || "4g";
      const downlink = typeof conn?.downlink === "number" ? conn.downlink : 10;
      const rtt = typeof conn?.rtt === "number" ? conn.rtt : 50;
      const saveData = !!conn?.saveData;

      const isPoorConnection =
        effectiveType === "slow-2g" ||
        effectiveType === "2g" ||
        rtt > 600 ||
        downlink < 0.8;

      const shouldDeferPrefetch = saveData || isPoorConnection;

      let recommendedResolution: "240p" | "360p" | "720p" | "1080p" = "1080p";
      if (saveData || effectiveType === "slow-2g") {
        recommendedResolution = "240p";
      } else if (effectiveType === "2g" || downlink < 1.2) {
        recommendedResolution = "360p";
      } else if (effectiveType === "3g" || downlink < 3.0) {
        recommendedResolution = "720p";
      }

      return {
        isSupported,
        effectiveType,
        downlink,
        rtt,
        saveData,
        isPoorConnection,
        shouldDeferPrefetch,
        recommendedResolution,
      };
    },
    [],
  );

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    // Network Information API vendor prefixes are not in lib.dom yet.
    const nav = navigator as Navigator & {
      connection?: NetworkInformation;
      mozConnection?: NetworkInformation;
      webkitConnection?: NetworkInformation;
    };
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    setNetworkState(evaluateQuality(conn));

    if (conn && typeof conn.addEventListener === "function") {
      const handleChange = () => {
        setNetworkState(evaluateQuality(conn));
      };

      conn.addEventListener("change", handleChange);
      return () => {
        conn.removeEventListener("change", handleChange);
      };
    }
  }, [evaluateQuality]);

  return networkState;
}
