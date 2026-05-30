import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { Colors, Typography, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = "left",
  style,
  fullWidth = true,
}: ButtonProps) {
  const getButtonStyle = () => {
    if (disabled) {
      return [
        styles.button,
        styles[`button_${size}`],
        fullWidth && styles.buttonFullWidth,
        styles.buttonDisabled,
      ];
    }
    return [
      styles.button,
      styles[`button_${size}`],
      fullWidth && styles.buttonFullWidth,
      styles[`button_${variant}`],
    ];
  };

  const getTextStyle = () => {
    if (disabled) {
      return [styles.buttonText, styles[`buttonText_${size}`], styles.buttonTextDisabled];
    }
    return [styles.buttonText, styles[`buttonText_${size}`], styles[`buttonText_${variant}`]];
  };

  const getIconColor = () => {
    if (disabled) return Colors.gray[400];
    
    switch (variant) {
      case "primary":
      case "danger":
        return Colors.white;
      case "secondary":
        return Colors.primary[700];
      case "outline":
        return Colors.primary[500];
      case "ghost":
        return Colors.text.primary;
      default:
        return Colors.white;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 16;
      case "md":
        return 18;
      case "lg":
        return 20;
      default:
        return 20;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator color={getIconColor()} />
      ) : (
        <>
          {Icon && iconPosition === "left" && (
            <Icon color={getIconColor()} size={getIconSize()} strokeWidth={2.5} />
          )}
          <Text style={getTextStyle()}>{title}</Text>
          {Icon && iconPosition === "right" && (
            <Icon color={getIconColor()} size={getIconSize()} strokeWidth={2.5} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  buttonFullWidth: {
    width: "100%",
  },
  button_sm: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  button_md: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  button_lg: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing['2xl'],
  },
  button_primary: {
    backgroundColor: Colors.primary[500],
    ...Shadows.md,
  },
  button_secondary: {
    backgroundColor: Colors.primary[50],
  },
  button_outline: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary[500],
  },
  button_ghost: {
    backgroundColor: "transparent",
  },
  button_danger: {
    backgroundColor: Colors.error[400],
    ...Shadows.md,
  },
  buttonDisabled: {
    backgroundColor: Colors.gray[200],
    ...Shadows.sm,
  },
  buttonText: {
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
  buttonText_sm: {
    fontSize: Typography.fontSize.sm,
  },
  buttonText_md: {
    fontSize: Typography.fontSize.md,
  },
  buttonText_lg: {
    fontSize: Typography.fontSize.lg,
  },
  buttonText_primary: {
    color: Colors.white,
  },
  buttonText_secondary: {
    color: Colors.primary[700],
  },
  buttonText_outline: {
    color: Colors.primary[500],
  },
  buttonText_ghost: {
    color: Colors.text.primary,
  },
  buttonText_danger: {
    color: Colors.white,
  },
  buttonTextDisabled: {
    color: Colors.gray[400],
  },
});
