/**
 * Blocked screen – shown when picker status is BLOCKED.
 * Account blocked, force logout, contact support.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useColors } from "@/contexts/ColorsContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";

export default function BlockedScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const colors = useColors();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.error[50] }]}>
          <Lock color={colors.error[500]} size={48} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>Account Blocked</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Your account has been blocked. You cannot access the app at this time.
        </Text>
        <Text style={[styles.support, { color: colors.text.secondary }]}>
          If you believe this is an error, please contact support to resolve this issue.
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton title="Sign Out" onPress={handleLogout} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["7xl"],
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius["2xl-lg"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    textAlign: "center",
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.lg,
    marginBottom: Spacing.lg,
  },
  support: {
    fontSize: Typography.fontSize.md,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  buttonWrap: {
    width: "100%",
    marginTop: "auto",
  },
});
