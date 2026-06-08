import React from "react";
import { ActivityIndicator, StyleSheet, Text, ViewStyle } from "react-native";
import { TouchableOpacity } from "@/utils/touchables";
import { AuthColors, AuthTypography } from "@/constants/authTheme";

interface AuthPrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function AuthPrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  style,
}: AuthPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={AuthColors.pageBg} size="small" />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: AuthColors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    shadowColor: AuthColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: AuthColors.disabledButton,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontSize: AuthTypography.primaryButton.fontSize,
    fontWeight: AuthTypography.primaryButton.fontWeight,
    color: AuthColors.pageBg,
  },
});
