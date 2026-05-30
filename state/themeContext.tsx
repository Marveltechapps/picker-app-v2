import createContextHook from "@nkzw/create-context-hook";
import { useState } from "react";

export type ThemeMode = "light";

export interface Theme {
  mode: ThemeMode;
  name: string;
}

/** Light theme only - single supported theme. */
export const SUPPORTED_THEMES: Theme[] = [
  { mode: "light", name: "Light" },
];

interface ThemeState {
  themeMode: ThemeMode;
  effectiveTheme: "light";
  isLoading: boolean;
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [state] = useState<ThemeState>({
    themeMode: "light",
    effectiveTheme: "light",
    isLoading: false,
  });

  const getCurrentTheme = (): Theme => SUPPORTED_THEMES[0];

  return {
    ...state,
    setTheme: async () => {},
    getCurrentTheme,
    supportedThemes: SUPPORTED_THEMES,
  };
});
