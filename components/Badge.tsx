import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";

interface BadgeProps {
  label: string;
  variant?: "success" | "warning" | "error" | "info" | "primary" | "default";
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
}

export default function Badge({ 
  label, 
  variant = "default", 
  size = "md",
  style 
}: BadgeProps) {
  const badgeStyle = [
    styles.badge,
    styles[variant],
    styles[`size_${size}`],
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
  ];

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  size_sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius["xs-sm"],
  },
  size_md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  size_lg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  success: {
    backgroundColor: Colors.success[50],
  },
  warning: {
    backgroundColor: Colors.warning[50],
  },
  error: {
    backgroundColor: Colors.error[50],
  },
  info: {
    backgroundColor: Colors.info[50],
  },
  primary: {
    backgroundColor: Colors.primary[100],
  },
  default: {
    backgroundColor: Colors.gray[100],
  },
  text: {
    fontWeight: Typography.fontWeight.bold,
  },
  textSize_sm: {
    fontSize: Typography.fontSize.xs,
  },
  textSize_md: {
    fontSize: Typography.fontSize.sm,
  },
  textSize_lg: {
    fontSize: Typography.fontSize.base,
  },
  text_success: {
    color: Colors.success[400],
  },
  text_warning: {
    color: Colors.warning[400],
  },
  text_error: {
    color: Colors.error[400],
  },
  text_info: {
    color: Colors.info[600],
  },
  text_primary: {
    color: Colors.primary[600],
  },
  text_default: {
    color: Colors.gray[600],
  },
});

