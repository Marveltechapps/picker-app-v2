// Base color palette (theme-agnostic)
export const BaseColors = {
  primary: {
    50: '#F5F3FF',
    100: '#EEF2FF',
    200: '#E0E7FF',
    300: '#C7D2FE',
    400: '#A5B4FC',
    500: '#8B5CF6',
    600: '#6366F1',
    650: '#5B4EFF',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },
  accent: {
    pink: '#EC4899',
    pinkLight: '#FDF2F8',
    pinkBorder: '#FCE7F3',
    purple: '#E9D5FF',
  },
  secondary: {
    50: '#FEF3C7',
    100: '#FDE68A',
    200: '#FCD34D',
    300: '#FBBF24',
    400: '#F59E0B',
    500: '#D97706',
    600: '#B45309',
    700: '#92400E',
  },
  success: {
    50: '#D1FAE5',
    100: '#A7F3D0',
    200: '#6EE7B7',
    300: '#34D399',
    400: '#10B981',
    500: '#059669',
    600: '#047857',
  },
  error: {
    50: '#FEE2E2',
    100: '#FECACA',
    200: '#FCA5A5',
    300: '#F87171',
    400: '#EF4444',
    500: '#DC2626',
    600: '#B91C1C',
  },
  warning: {
    50: '#FEF3C7',
    100: '#FDE68A',
    200: '#FCD34D',
    300: '#FBBF24',
    400: '#F59E0B',
    500: '#D97706',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

// Light theme colors
const lightColors = {
  ...BaseColors,
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  border: {
    light: '#F3F4F6',
    medium: '#E5E7EB',
    dark: '#D1D5DB',
  },
} as const;

// Light theme only. getThemeColors always returns light colors.
export const getThemeColors = (_theme?: 'light' | 'dark') => lightColors;

// Default export - static reference for backward compatibility
export const Colors = lightColors;

export const Typography = {
  fontSize: {
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    'md-lg': 15, // Used in some screens
    lg: 16,
    'lg-md': 17, // Used in inputs
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '4xl-lg': 31.5, // Used in splash screen
    '5xl': 36,
    '6xl': 48,
    '7xl': 64, // Used in large displays
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '900' as const, // Used in splash screen
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: -0.3,
    wide: 0.3,
    wider: 0.5,
  },
} as const;

export const Spacing = {
  xs: 4,
  'xs-sm': 6, // Used in gaps and small elements
  sm: 8,
  'sm-md': 10, // Used in some gaps
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  headerTop: 60, // Standard header top padding
  iconButton: 44, // Standard icon button size
  '6xl': 64,
  '7xl': 120, // Used in large containers
} as const;

export const BorderRadius = {
  xs: 4,
  'xs-sm': 6, // Used in small badges
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  'xl-sm': 21, // Used in splash logo
  '2xl': 24,
  '2xl-lg': 32, // Used in large icons
  '2xl-xl': 37, // Used in profile avatar
  full: 9999,
} as const;

import { Platform } from "react-native";

// Helper to create shadow with web compatibility
const createShadow = (
  offset: { width: number; height: number },
  radius: number,
  opacity: number,
  elevation: number
) => {
  if (Platform.OS === 'web') {
    // For web, use boxShadow instead of shadow* props to avoid deprecation warnings
    return {
      // @ts-ignore - boxShadow is valid for web
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
      elevation,
    };
  }
  
  // For native platforms, use shadow* props
  return {
    shadowColor: '#000',
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
};

// Helper to convert shadow props to web-compatible format
export const createWebShadow = (
  offset: { width: number; height: number },
  radius: number,
  opacity: number,
  elevation: number
) => {
  if (Platform.OS === 'web') {
    return {
      // @ts-ignore - boxShadow is valid for web
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
      elevation,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
};

export const Shadows = {
  sm: createShadow({ width: 0, height: 1 }, 2, 0.05, 1),
  md: createShadow({ width: 0, height: 2 }, 8, 0.05, 2),
  lg: createShadow({ width: 0, height: 4 }, 12, 0.1, 4),
  xl: createShadow({ width: 0, height: 8 }, 16, 0.15, 6),
} as const;

export const IconSizes = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
} as const;
