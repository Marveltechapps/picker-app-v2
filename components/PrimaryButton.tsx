import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, Platform, View } from "react-native";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const BUTTON_FONT_SIZE = 16; // Explicit size so text shows on all devices (Expo Go, web, native)

export default function PrimaryButton({ title, onPress, disabled, loading, style }: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        style,
        !disabled && !loading && pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <View style={styles.textWrap}>
          <Text style={styles.buttonText} numberOfLines={1} allowFontScaling>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary[650],
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 120,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px 4px 12px rgba(91, 78, 255, 0.3)", elevation: 4 }
      : { ...Shadows.lg, shadowColor: Colors.primary[650], shadowOpacity: 0.3 }),
  },
  buttonDisabled: {
    backgroundColor: Colors.border.medium,
    ...(Platform.OS === "web" ? {} : { shadowOpacity: 0 }),
  },
  textWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "100%",
  },
  buttonText: {
    fontSize: BUTTON_FONT_SIZE,
    fontWeight: Platform.OS === "web" ? "700" : Typography.fontWeight.bold,
    color: Colors.white,
    letterSpacing: Typography.letterSpacing.wide,
    fontFamily: Platform.select({
      web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      default: undefined,
    }),
    ...(Platform.OS === "web"
      ? { WebkitFontSmoothing: "antialiased" as any, MozOsxFontSmoothing: "grayscale" as any }
      : {}),
  },
});
