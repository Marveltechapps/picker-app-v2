import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import { LucideIcon, Eye, EyeOff } from "lucide-react-native";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  containerStyle?: any;
  secureTextEntry?: boolean;
}

export default function Input({
  label,
  error,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  onRightIconPress,
  containerStyle,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  const showPasswordToggle = secureTextEntry !== undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        {LeftIcon && (
          <View style={styles.leftIconContainer}>
            <LeftIcon
              color={error ? Colors.error[400] : isFocused ? Colors.primary[500] : Colors.gray[400]}
              size={20}
              strokeWidth={2}
            />
          </View>
        )}
        
        <TextInput
          style={[styles.input, LeftIcon && styles.inputWithLeftIcon]}
          placeholderTextColor={Colors.gray[400]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          {...props}
        />

        {showPasswordToggle ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={() => setIsSecure(!isSecure)}
            activeOpacity={0.7}
          >
            {isSecure ? (
              <EyeOff color={Colors.gray[400]} size={20} strokeWidth={2} />
            ) : (
              <Eye color={Colors.gray[400]} size={20} strokeWidth={2} />
            )}
          </TouchableOpacity>
        ) : RightIcon ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            activeOpacity={0.7}
          >
            <RightIcon color={Colors.gray[400]} size={20} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: Colors.primary[500],
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: Colors.error[400],
  },
  leftIconContainer: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  rightIconContainer: {
    marginLeft: Spacing.md,
    padding: Spacing.xs,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.error[400],
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
