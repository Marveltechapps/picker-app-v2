import { TouchableOpacity } from "@/utils/touchables";
/**
 * Under Review screen – shown ONLY after document upload flow when picker status is PENDING.
 * User stays here until approved (ACTIVE) or rejected (REJECTED).
 * Polls onboarding state every 30s while focused.
 */
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Clock } from "lucide-react-native";
import { useAuth } from "@/state/authContext";
import { useColors } from "@/contexts/ColorsContext";
import { Typography, Spacing, BorderRadius } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";
import { getProfileApi } from "@/services/user.service";
import { apiGet } from "@/utils/apiClient";

function unwrapPickerEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in raw && (raw as { data: unknown }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export default function UnderReviewScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const colors = useColors();
  const [profileStatus, setProfileStatus] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let interval: ReturnType<typeof setInterval> | undefined;

      const checkFromProfile = async () => {
        try {
          const profileData = await getProfileApi();
          if (!active) return;
          const status = profileData?.status?.toUpperCase?.();
          setProfileStatus(status);
          if (status === "ACTIVE") {
            router.replace("/(tabs)");
            return;
          }
          if (status === "REJECTED") {
            router.replace({
              pathname: "/rejection",
              params: { rejectedReason: profileData?.rejectedReason || "Your application has been rejected." },
            });
          }
        } catch {
          /* ignore */
        }
      };

      const checkOnboarding = async () => {
        try {
          const raw = await apiGet<unknown>("/onboarding/state");
          if (!active) return;
          const unwrapped = unwrapPickerEnvelope<{ status?: string; currentStep?: string }>(raw);
          const st = unwrapped?.status?.toUpperCase?.();
          if (st === "ACTIVE" || unwrapped?.currentStep === "home" || unwrapped?.currentStep === "shifts") {
            router.replace("/(tabs)");
            return;
          }
          if (unwrapped?.currentStep === "training") {
            router.replace("/training");
            return;
          }
          if (st === "REJECTED") {
            router.replace("/rejection");
          }
        } catch {
          /* ignore */
        }
      };

      const run = async () => {
        await checkOnboarding();
        await checkFromProfile();
      };

      void run();
      interval = setInterval(run, 30000);

      return () => {
        active = false;
        if (interval) clearInterval(interval);
      };
    }, [router])
  );

  const handleBackToLogin = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary[50] }]}>
          <Clock color={colors.secondary[500]} size={48} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>Under Review</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Your application is under review. We'll notify you once it has been processed.
        </Text>
        <Text style={[styles.hint, { color: colors.text.secondary }]}>
          Please check back later. This usually takes 1–2 business days.
        </Text>
        <View style={styles.buttonWrap}>
          {profileStatus && profileStatus !== "ACTIVE" ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border.medium }]}
              onPress={() => router.push("/live-verification")}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.primary[650] }]}>Re-verify Identity</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton title="Back to Login" onPress={handleBackToLogin} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
    alignItems: "center",
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize["2xl"],
    fontWeight: Typography.fontWeight.bold,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: Typography.fontSize.md,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  hint: {
    fontSize: Typography.fontSize.sm,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  buttonWrap: {
    width: "100%",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
});
