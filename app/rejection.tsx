/**
 * Rejection screen – shown when picker status is REJECTED.
 * Displays rejectedReason and redirects to login (cannot proceed).
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { AlertCircle } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useColors } from "@/contexts/ColorsContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";

export default function RejectionScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const params = useLocalSearchParams<{ rejectedReason?: string }>();
  const colors = useColors();
  const raw = params.rejectedReason;
  const rejectedReason = (typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null) || "Your application has been rejected.";

  const handleBackToLogin = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.error[50] }]}>
          <AlertCircle color={colors.error[500]} size={48} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>Application Rejected</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          We're sorry, but your application to become a picker has been rejected.
        </Text>
        <View style={[styles.reasonBox, { backgroundColor: colors.background, borderColor: colors.border.medium }]}>
          <Text style={[styles.reasonLabel, { color: colors.text.secondary }]}>Reason</Text>
          <Text style={[styles.reasonText, { color: colors.text.primary }]}>{rejectedReason}</Text>
        </View>
        <Text style={[styles.footer, { color: colors.text.secondary }]}>
          If you believe this is an error, please contact support.
        </Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton title="Back to Login" onPress={handleBackToLogin} />
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
    marginBottom: Spacing.xl,
  },
  reasonBox: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  reasonLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  reasonText: {
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
  },
  footer: {
    fontSize: Typography.fontSize.sm,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  buttonWrap: {
    width: "100%",
    marginTop: "auto",
  },
});
