import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import { tokens, type ColorScheme } from "./tokens";

// Light by default (« Atelier clair », Ryan, 28 octobre 2026); the video editor nests a dark provider,
// because footage is judged on a dark ground.
export type ThemePreference = ColorScheme | "system";

export type Theme = {
  scheme: ColorScheme;
  c: (typeof tokens.color)[ColorScheme];
  // The Ma DA gradient, first colour = c.action (proposition B2, Ryan, 28 octobre 2026).
  g: (typeof tokens.gradient)[ColorScheme];
  space: typeof tokens.space;
  radius: typeof tokens.radius;
  size: typeof tokens.size;
  opacity: typeof tokens.opacity;
  motion: typeof tokens.motion;
  layout: typeof tokens.layout;
  reduceMotion: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children, initial = "light" }: { children: ReactNode; initial?: ThemePreference }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(initial);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const scheme: ColorScheme = preference === "system" ? (system === "light" ? "light" : "dark") : preference;
  const value = useMemo<Theme>(() => ({
    scheme, c: tokens.color[scheme], g: tokens.gradient[scheme], space: tokens.space, radius: tokens.radius, size: tokens.size,
    opacity: tokens.opacity, motion: tokens.motion, layout: tokens.layout, reduceMotion, preference, setPreference,
  }), [scheme, reduceMotion, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme doit être utilisé sous <ThemeProvider>.");
  return t;
}
