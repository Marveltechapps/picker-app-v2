import { useMemo } from "react";
import { useColors } from "@/contexts/ColorsContext";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";
import { AUTH_BRAND_NAME, AUTH_DARK_BLUE, AUTH_THEME, AuthLayout } from "@/constants/authTheme";

export function useAuthScreenTheme() {
  const colors = useColors();

  return useMemo(
    () => ({
      brandName: AUTH_BRAND_NAME,
      colors: {
        primary: AUTH_THEME.primary,
        headerBrand: AUTH_DARK_BLUE,
        primaryLight: AUTH_THEME.primaryLight,
        primarySoft: AUTH_THEME.primarySoft,
        primaryMuted: AUTH_THEME.primaryMuted,
        pageBg: AUTH_THEME.pageBg,
        surface: colors.card,
        background: AUTH_THEME.pageBg,
        inputBg: colors.card,
        headerBg: AUTH_THEME.headerBg,
        headerBorder: AUTH_THEME.headerBorder,
        mutedText: colors.text.secondary,
        tabTrack: "#F3F4F6",
        tabActiveBg: AUTH_THEME.primary,
        inputBorder: AUTH_THEME.primaryMuted,
        inputBorderError: colors.error[600],
        inputFocus: AUTH_THEME.primary,
        disabledButton: colors.gray[400],
        legalLink: AUTH_THEME.legalLink,
        placeholder: colors.gray[500],
        resendText: colors.text.tertiary,
        countrySelectedBg: AUTH_THEME.primaryLight,
        tabInactiveText: colors.text.primary,
        textPrimary: colors.text.primary,
        onPrimary: colors.white,
        checkboxBorder: AUTH_THEME.checkboxBorder,
      },
      layout: AuthLayout,
      radius: BorderRadius,
      spacing: Spacing,
      typography: Typography,
    }),
    [colors]
  );
}
