/** Shared layout + brand constants for login / OTP screens. Colors come from useAuthScreenTheme(). */
export const AUTH_BRAND_NAME = "Selorg Picker";

import { BRAND_PRIMARY } from "@/constants/theme";

/** Selorg Picker auth brand color — header text, tabs, inputs, links. */
export const AUTH_DARK_BLUE = BRAND_PRIMARY;

export const AUTH_THEME = {
  primary: AUTH_DARK_BLUE,
  headerBg: "#EEEEF5",
  headerBorder: "#D8DAEB",
  pageBg: "#F7F7FB",
  primarySoft: "#F0F0F7",
  primaryMuted: "#C5C7DC",
  primaryLight: "#E4E5F0",
  legalLink: BRAND_PRIMARY,
  checkboxBorder: "#9A9CB8",
  disabledButton: "#9CA3AF",
} as const;

/** Static color tokens for auth components that cannot use hooks. */
export const AuthColors = AUTH_THEME;

export const AuthLayout = {
  contentPaddingH: 21,
  headerRadius: 24,
  tabRadius: 16,
  tabPadding: 4,
  otpBoxWidth: 42,
  otpBoxHeight: 56,
  otpGap: 10.5,
  resendCooldownSec: 30,
} as const;
