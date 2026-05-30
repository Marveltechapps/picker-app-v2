import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "outlined";
  padding?: keyof typeof Spacing;
}

export default function Card({ 
  children, 
  style, 
  variant = "default",
  padding = "xl" 
}: CardProps) {
  const cardStyle = [
    styles.card,
    styles[variant],
    { padding: Spacing[padding] },
    style,
  ];

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
  },
  default: {
    ...Shadows.md,
  },
  elevated: {
    ...Shadows.lg,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
});

