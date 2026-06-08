import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TouchableOpacity } from "@/utils/touchables";
import { useAuthScreenTheme } from "@/hooks/useAuthScreenTheme";
import type { LoginMode } from "@/services/auth.service";

interface LoginMethodTabsProps {
  value: LoginMode;
  onChange: (mode: LoginMode) => void;
}

const TABS: { key: LoginMode; label: string }[] = [
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

export default function LoginMethodTabs({ value, onChange }: LoginMethodTabsProps) {
  const theme = useAuthScreenTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        track: {
          flexDirection: "row",
          backgroundColor: theme.colors.tabTrack,
          borderRadius: theme.layout.tabRadius,
          padding: theme.layout.tabPadding,
          gap: 4,
        },
        tab: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: theme.layout.tabRadius - 2,
          alignItems: "center",
          justifyContent: "center",
        },
        tabActive: {
          backgroundColor: theme.colors.tabActiveBg,
          shadowColor: theme.colors.tabActiveBg,
          borderWidth: 0,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 3,
        },
        tabLabel: {
          fontSize: theme.typography.fontSize.md,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.tabInactiveText,
        },
        tabLabelActive: {
          color: theme.colors.onPrimary,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.track}>
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
