import React, { createContext, useContext, useMemo } from "react";
import { getThemeColors, BaseColors } from "@/constants/theme";

type ThemeColors = ReturnType<typeof getThemeColors>;

export interface ColorsContextValue extends ThemeColors {
  primary: typeof BaseColors.primary;
  accent: typeof BaseColors.accent;
  secondary: typeof BaseColors.secondary;
  success: typeof BaseColors.success;
  error: typeof BaseColors.error;
  warning: typeof BaseColors.warning;
  info: typeof BaseColors.info;
  gray: typeof BaseColors.gray;
  white: typeof BaseColors.white;
  black: typeof BaseColors.black;
}

const ColorsContext = createContext<ColorsContextValue | null>(null);

export function ColorsProvider({ children }: { children: React.ReactNode }) {
  const colors = useMemo(() => {
    const themeColors = getThemeColors("light");
    return {
      ...themeColors,
      primary: BaseColors.primary,
      accent: BaseColors.accent,
      secondary: BaseColors.secondary,
      success: BaseColors.success,
      error: BaseColors.error,
      warning: BaseColors.warning,
      info: BaseColors.info,
      gray: BaseColors.gray,
      white: BaseColors.white,
      black: BaseColors.black,
    } as ColorsContextValue;
  }, []);

  return (
    <ColorsContext.Provider value={colors}>
      {children}
    </ColorsContext.Provider>
  );
}

export function useColors(): ColorsContextValue {
  const context = useContext(ColorsContext);
  if (!context) {
    const fallback = getThemeColors("light");
    return {
      ...fallback,
      primary: BaseColors.primary,
      accent: BaseColors.accent,
      secondary: BaseColors.secondary,
      success: BaseColors.success,
      error: BaseColors.error,
      warning: BaseColors.warning,
      info: BaseColors.info,
      gray: BaseColors.gray,
      white: BaseColors.white,
      black: BaseColors.black,
    } as ColorsContextValue;
  }
  return context;
}
