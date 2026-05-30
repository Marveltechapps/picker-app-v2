import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScanFace, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import { useColors } from "@/contexts/ColorsContext";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";

const PURPLE = "#5B4EFF";

export default function LiveVerificationIntroScreen() {
  const router = useRouter();
  const colors = useColors();
  const { hasCompletedVerification } = useAuth();

  if (hasCompletedVerification) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]} edges={["bottom", "left", "right"]}>
        <Header title="Identity Verification" showBack onBackPress={() => router.back()} />
        <View style={styles.completedBody}>
          <CheckCircle2 color={colors.success[400]} size={64} strokeWidth={2} />
          <Text style={[styles.completedTitle, { color: colors.text.primary }]}>Verification Complete</Text>
          <Text style={[styles.completedSubtitle, { color: colors.text.secondary }]}>
            Your identity has been verified.
          </Text>
          <View style={styles.completedButtonWrap}>
            <PrimaryButton title="Continue" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.card }]} edges={["bottom", "left", "right"]}>
      <Header title="Identity Verification" showBack onBackPress={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <ScanFace color={PURPLE} size={80} strokeWidth={1.75} />
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>Live Verification Required</Text>
          <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            We need to verify your identity before you can start working. This is a one-time process.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.gray?.[200] ?? "#E5E7EB" }]}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>What will happen</Text>
          {[
            "Look directly at the camera",
            "Follow the on-screen prompts",
            "Wait for verification to complete",
          ].map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.text.primary }]}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.gray?.[200] ?? "#E5E7EB" }]}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Before you start</Text>
          {[
            "Good lighting (face clearly visible)",
            "Remove sunglasses or hat",
            "Hold phone steady at eye level",
            "Ensure stable internet connection",
          ].map((line) => (
            <View key={line} style={styles.bulletRow}>
              <CheckCircle2 color={PURPLE} size={18} strokeWidth={2} style={styles.bulletIcon} />
              <Text style={[styles.bulletText, { color: colors.text.secondary }]}>{line}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.privacy, { color: colors.text.secondary }]}>
          Your biometric data is encrypted and used only for identity verification. It is never shared with third
          parties.
        </Text>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.gray?.[100] ?? "#F3F4F6" }]}>
        <PrimaryButton title="Start Verification" onPress={() => router.push("/verification")} />
        <TouchableOpacity onPress={() => router.push("/contact-support")} style={styles.supportLink}>
          <Text style={[styles.supportText, { color: colors.text.secondary }]}>Having trouble? Contact support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    alignItems: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  heroTitle: {
    marginTop: Spacing.lg,
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    textAlign: "center",
    letterSpacing: Typography.letterSpacing.tight,
  },
  heroSubtitle: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    textAlign: "center",
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
    maxWidth: 340,
  },
  card: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: Typography.fontWeight.bold,
  },
  stepText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  bulletIcon: { marginRight: Spacing.sm, marginTop: 2 },
  bulletText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
  },
  privacy: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 340,
    marginTop: Spacing.sm,
  },
  bottomSpacer: { height: 120 },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
    borderTopWidth: 1,
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.05)" }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
  supportLink: { marginTop: Spacing.md, alignItems: "center" },
  supportText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },
  completedBody: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Spacing["3xl"],
  },
  completedTitle: {
    marginTop: Spacing.xl,
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    textAlign: "center",
  },
  completedSubtitle: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.lg,
    textAlign: "center",
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.lg,
  },
  completedButtonWrap: { width: "100%", marginTop: Spacing["3xl"] },
});
