import React, { useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { TouchableOpacity } from "@/utils/touchables";
import { ScrollView } from "@/utils/scrollables";
import BottomSheetModal from "@/components/BottomSheetModal";
import { useAuthScreenTheme } from "@/hooks/useAuthScreenTheme";
import { COUNTRY_LIST, type CountryOption } from "@/lib/countries";

interface CountryPickerModalProps {
  visible: boolean;
  selectedCode: string;
  onSelect: (country: CountryOption) => void;
  onClose: () => void;
}

export default function CountryPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const theme = useAuthScreenTheme();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_LIST;
    return COUNTRY_LIST.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [query]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        search: {
          marginHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.background,
        },
        list: {
          flex: 1,
          paddingHorizontal: theme.spacing.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.sm,
          gap: theme.spacing.sm,
        },
        rowSelected: {
          backgroundColor: theme.colors.countrySelectedBg,
        },
        flag: {
          fontSize: 20,
          width: 28,
        },
        name: {
          flex: 1,
          fontSize: theme.typography.fontSize.lg,
          color: theme.colors.textPrimary,
        },
        dial: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.mutedText,
          fontWeight: theme.typography.fontWeight.semibold,
        },
      }),
    [theme]
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Select country"
      height="75%"
      scrollable={false}
    >
      <TextInput
        style={styles.search}
        placeholder="Search country"
        placeholderTextColor={theme.colors.placeholder}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <ScrollView
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((country) => {
          const selected = country.code === selectedCode;
          return (
            <TouchableOpacity
              key={country.code}
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => {
                onSelect(country);
                onClose();
                setQuery("");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={styles.name}>{country.name}</Text>
              <Text style={styles.dial}>{country.dialCode}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}
