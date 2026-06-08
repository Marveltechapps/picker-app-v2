import React, { useMemo, type RefObject } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { TouchableOpacity } from "@/utils/touchables";
import { ChevronDown } from "lucide-react-native";
import { useAuthScreenTheme } from "@/hooks/useAuthScreenTheme";
import type { CountryOption } from "@/lib/countries";
import { getPlaceholder } from "@/lib/phoneValidation";

interface PhoneInputRowProps {
  country: CountryOption;
  value: string;
  onChangeText: (text: string) => void;
  onCountryPress: () => void;
  hasError?: boolean;
  isFocused?: boolean;
  hasInput?: boolean;
  label: string;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: RefObject<TextInput | null>;
  onSubmitEditing?: () => void;
}

export default function PhoneInputRow({
  country,
  value,
  onChangeText,
  onCountryPress,
  hasError,
  isFocused,
  hasInput,
  label,
  onFocus,
  onBlur,
  inputRef,
  onSubmitEditing,
}: PhoneInputRowProps) {
  const theme = useAuthScreenTheme();
  const placeholder = useMemo(() => getPlaceholder(country.code), [country.code]);
  const showFocus = (isFocused || hasInput) && !hasError;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.textPrimary,
          marginBottom: theme.spacing.sm,
        },
        row: {
          flexDirection: "row",
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderRadius: theme.radius.md,
          overflow: "hidden",
          backgroundColor: theme.colors.inputBg,
        },
        rowFocus: {
          borderColor: theme.colors.inputFocus,
          borderWidth: 2,
        },
        rowError: {
          borderColor: theme.colors.inputBorderError,
          borderWidth: 2,
        },
        countryButton: {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md + 2,
          gap: 4,
          borderRightWidth: 1,
          borderRightColor: theme.colors.inputBorder,
          backgroundColor: theme.colors.primarySoft,
        },
        flag: { fontSize: 18 },
        dialCode: {
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.textPrimary,
        },
        input: {
          flex: 1,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md + 2,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
        },
      }),
    [theme]
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, showFocus && styles.rowFocus, hasError && styles.rowError]}>
        <TouchableOpacity style={styles.countryButton} onPress={onCountryPress} activeOpacity={0.8}>
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dialCode}>{country.dialCode}</Text>
          <ChevronDown size={14} color={theme.colors.mutedText} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.placeholder}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          blurOnSubmit
          showSoftInputOnFocus
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
    </View>
  );
}
