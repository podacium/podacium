"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type FontSizeScale = "small" | "medium" | "large";
export type LayoutDensity = "compact" | "comfortable" | "spacious";

export interface ThemeContextType {
  theme: ThemeMode;
  fontSize: FontSizeScale;
  density: LayoutDensity;
  reducedMotion: boolean;
  highContrast: boolean;
  resolvedTheme: "light" | "dark";

  setTheme: (mode: ThemeMode) => void;
  setFontSize: (size: FontSizeScale) => void;
  setDensity: (density: LayoutDensity) => void;
  setReducedMotion: (motion: boolean) => void;
  setHighContrast: (contrast: boolean) => void;
}

const STORAGE_KEYS = {
  theme: "podacium-theme",
  fontSize: "podacium-font-size",
  density: "podacium-density",
  reducedMotion: "podacium-reduced-motion",
  highContrast: "podacium-high-contrast",
} as const;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [fontSize, setFontSizeState] = useState<FontSizeScale>("medium");
  const [density, setDensityState] = useState<LayoutDensity>("comfortable");
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);
  const [highContrast, setHighContrastState] = useState<boolean>(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Helper to sync DOM class & attributes
  const updateDOM = useCallback(
    (
      currentTheme: ThemeMode,
      currentFontSize: FontSizeScale,
      currentDensity: LayoutDensity,
      currentReducedMotion: boolean,
      currentHighContrast: boolean,
    ) => {
      if (typeof document === "undefined") return;

      const root = document.documentElement;

      // Resolve system theme
      const systemIsDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const isDark =
        currentTheme === "dark" || (currentTheme === "system" && systemIsDark);

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      setResolvedTheme(isDark ? "dark" : "light");

      root.setAttribute("data-font-size", currentFontSize);
      root.setAttribute("data-density", currentDensity);

      if (currentReducedMotion) {
        root.setAttribute("data-reduced-motion", "true");
      } else {
        root.removeAttribute("data-reduced-motion");
      }

      if (currentHighContrast) {
        root.setAttribute("data-high-contrast", "true");
      } else {
        root.removeAttribute("data-high-contrast");
      }
    },
    [],
  );

  // Hydrate preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedTheme =
        (localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode) || "system";
      const savedFontSize =
        (localStorage.getItem(STORAGE_KEYS.fontSize) as FontSizeScale) ||
        "medium";
      const savedDensity =
        (localStorage.getItem(STORAGE_KEYS.density) as LayoutDensity) ||
        "comfortable";
      const savedMotion =
        localStorage.getItem(STORAGE_KEYS.reducedMotion) === "true";
      const savedContrast =
        localStorage.getItem(STORAGE_KEYS.highContrast) === "true";

      setThemeState(savedTheme);
      setFontSizeState(savedFontSize);
      setDensityState(savedDensity);
      setReducedMotionState(savedMotion);
      setHighContrastState(savedContrast);

      updateDOM(
        savedTheme,
        savedFontSize,
        savedDensity,
        savedMotion,
        savedContrast,
      );
    } catch {
      // Fallback silently if localStorage fails
    }
  }, [updateDOM]);

  // System dark mode preference change listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateDOM(theme, fontSize, density, reducedMotion, highContrast);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, fontSize, density, reducedMotion, highContrast, updateDOM]);

  const stateRef = React.useRef({
    theme,
    fontSize,
    density,
    reducedMotion,
    highContrast,
  });

  useEffect(() => {
    stateRef.current = {
      theme,
      fontSize,
      density,
      reducedMotion,
      highContrast,
    };
  }, [theme, fontSize, density, reducedMotion, highContrast]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      stateRef.current.theme = mode;
      setThemeState(mode);
      try {
        localStorage.setItem(STORAGE_KEYS.theme, mode);
      } catch {}
      const s = stateRef.current;
      updateDOM(mode, s.fontSize, s.density, s.reducedMotion, s.highContrast);
    },
    [updateDOM],
  );

  const setFontSize = useCallback(
    (size: FontSizeScale) => {
      stateRef.current.fontSize = size;
      setFontSizeState(size);
      try {
        localStorage.setItem(STORAGE_KEYS.fontSize, size);
      } catch {}
      const s = stateRef.current;
      updateDOM(s.theme, size, s.density, s.reducedMotion, s.highContrast);
    },
    [updateDOM],
  );

  const setDensity = useCallback(
    (d: LayoutDensity) => {
      stateRef.current.density = d;
      setDensityState(d);
      try {
        localStorage.setItem(STORAGE_KEYS.density, d);
      } catch {}
      const s = stateRef.current;
      updateDOM(s.theme, s.fontSize, d, s.reducedMotion, s.highContrast);
    },
    [updateDOM],
  );

  const setReducedMotion = useCallback(
    (motion: boolean) => {
      stateRef.current.reducedMotion = motion;
      setReducedMotionState(motion);
      try {
        localStorage.setItem(STORAGE_KEYS.reducedMotion, String(motion));
      } catch {}
      const s = stateRef.current;
      updateDOM(s.theme, s.fontSize, s.density, motion, s.highContrast);
    },
    [updateDOM],
  );

  const setHighContrast = useCallback(
    (contrast: boolean) => {
      stateRef.current.highContrast = contrast;
      setHighContrastState(contrast);
      try {
        localStorage.setItem(STORAGE_KEYS.highContrast, String(contrast));
      } catch {}
      const s = stateRef.current;
      updateDOM(s.theme, s.fontSize, s.density, s.reducedMotion, contrast);
    },
    [updateDOM],
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        fontSize,
        density,
        reducedMotion,
        highContrast,
        resolvedTheme,
        setTheme,
        setFontSize,
        setDensity,
        setReducedMotion,
        setHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

/**
 * Theme access that tolerates trees rendered outside `ThemeProvider`
 * (isolated component tests, marketing islands). Returns `undefined`
 * instead of throwing.
 */
export const useOptionalTheme = (): ThemeContextType | undefined =>
  useContext(ThemeContext);
