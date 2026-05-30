/**
 * Suspended screen – shown when picker status is SUSPENDED.
 * Account suspended, wallet and shift actions disabled (view-only).
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { PauseCircle } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useColors } from "@/contexts/ColorsContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";

export default function SuspendedScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const colors = useColors();

  const handleSignOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.warning[50] }]}>
          <PauseCircle color={colors.warning[500]} size={48} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>Account Suspended</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Your account has been temporarily suspended. Wallet and shift actions are disabled.
        </Text>
        <Text style={[styles.hint, { color: colors.text.secondary }]}>
          Please contact support if you have questions about your suspension.
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton title="Sign Out" onPress={handleSignOut} />
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
  hint: {
    fontSize: Typography.fontSize.md,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  buttonWrap: {
    width: "100%",
    marginTop: "auto",
  },
});
