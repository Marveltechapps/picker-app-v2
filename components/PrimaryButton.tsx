import React from "react";
import { Text, StyleSheet, ViewStyle, ActivityIndicator, Platform, View } from "react-native";
import { TouchableOpacity } from "@/utils/touchables";
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
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    </TouchableOpacity>
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
      ? { boxShadow: "0px 4px 12px rgba(18, 19, 88, 0.3)", elevation: 4 }
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
