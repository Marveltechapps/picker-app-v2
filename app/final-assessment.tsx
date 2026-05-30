import React, { useState } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Award, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";
import { apiPost } from "@/utils/apiClient";

/**
 * Final Assessment screen - the missing step in the training flow.
 * Shown after user completes all training videos and taps "Start Final Assessment".
 * Confirms completion and proceeds to location type selection.
 */
export default function FinalAssessmentScreen() {
  const router = useRouter();
  const { completeTraining } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    try {
      setLoading(true);
      const res = await apiPost<{
        success: boolean;
        data: { passed: boolean; score: number; passingScore: number };
      }>("/training/assessment", { score: 100, answers: {} });
      const payload = res?.data;
      const passed = payload?.passed !== false;
      const passingScore = payload?.passingScore ?? 70;
      const score = payload?.score ?? 0;
      if (!passed) {
        setLoading(false);
        appNotify.error(`You need at least ${passingScore}% to pass. Your score: ${score}. Please review training and try again.`);
        return;
      }
      await completeTraining();
      setLoading(false);
      router.replace("/location-type");
    } catch (error) {
      setLoading(false);
      appNotify.error("Failed to complete assessment. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Header
        title="Final Assessment"
        subtitle="You're almost ready"
        showBack={true}
        onBackPress={() => router.back()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Award color={Colors.primary[600]} size={48} strokeWidth={2} />
          </View>
        </View>

        <Text style={styles.title}>Training Complete!</Text>
        <Text style={styles.subtitle}>
          You've successfully completed all training modules. All required training milestones are now completed for Picker Certification setup.
        </Text>

        <View style={styles.checkList}>
          <View style={styles.checkItem}>
            <CheckCircle2 color={Colors.success[500]} size={24} strokeWidth={2} fill={Colors.success[50]} />
            <Text style={styles.checkText}>All video modules completed</Text>
          </View>
          <View style={styles.checkItem}>
            <CheckCircle2 color={Colors.success[500]} size={24} strokeWidth={2} fill={Colors.success[50]} />
            <Text style={styles.checkText}>All pre-assessment requirements completed</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title="Complete Assessment & Continue"
          onPress={handleComplete}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary[200],
  },
  title: {
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.md,
    marginBottom: Spacing["2xl"],
  },
  checkList: {
    gap: Spacing.lg,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success[50],
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.success[200],
  },
  checkText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  bottomSpacer: {
    height: 100,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
});
