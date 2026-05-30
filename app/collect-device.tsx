import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  InteractionManager,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Smartphone, CheckCircle2, RotateCcw } from "lucide-react-native";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { apiGet, apiPost, ApiClientError } from "@/utils/apiClient";
import { useAuth } from "@/state/authContext";

interface OnboardingPayload {
  hasCompletedManagerOTP?: boolean;
  hasCompletedDeviceCollection?: boolean;
}

function unwrapPickerEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in raw && (raw as { data: unknown }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export default function CollectDeviceScreen() {
  const router = useRouter();
  const { otp } = useLocalSearchParams();
  const { completeManagerOTP } = useAuth();
  const [collected, setCollected] = useState<boolean>(false);
  const navigatingRef = useRef<boolean>(false);

  const [managerApproved, setManagerApproved] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshOnboarding = useCallback(async () => {
    try {
      const raw = await apiGet<unknown>("/onboarding/state");
      const state = unwrapPickerEnvelope<OnboardingPayload>(raw);
      setManagerApproved(!!state.hasCompletedManagerOTP);
    } catch {
      // keep local flags
    }
  }, []);

  useEffect(() => {
    void refreshOnboarding();
  }, [refreshOnboarding]);

  const navigateToHome = () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    InteractionManager.runAfterInteractions(() => {
      try {
        router.replace("/(tabs)");
      } catch (_) {
        try {
          router.push("/" as any);
        } catch (_) {}
      }
      navigatingRef.current = false;
    });
  };

  const handleRequestOtp = async () => {
    setErrorMessage(null);
    setRequestLoading(true);
    try {
      const res = (await apiPost("/manager/request-otp", {})) as {
        success?: boolean;
        maskedPhone?: string;
        devOtp?: string;
      };
      if (res?.success && res.maskedPhone) {
        setOtpHint(
          `OTP sent to your manager (${res.maskedPhone}). Ask them for the code.${
            __DEV__ && res.devOtp ? ` Dev OTP: ${res.devOtp}` : ""
          }`
        );
      } else {
        setErrorMessage("Could not send OTP. Try again.");
      }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Request failed";
      setErrorMessage(msg);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    const trimmed = otpInput.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setErrorMessage("Enter the 6-digit code.");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = (await apiPost("/manager/verify-otp", { otp: trimmed })) as { success?: boolean };
      if (res?.success) {
        await completeManagerOTP();
        setManagerApproved(true);
        setOtpInput("");
        await refreshOnboarding();
      } else {
        setErrorMessage("Verification failed.");
      }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Verification failed";
      setErrorMessage(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!collected || !managerApproved) return;
    setCompleteLoading(true);
    setErrorMessage(null);
    try {
      await apiPost("/devices/collection-complete", {});
      navigateToHome();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Could not complete. Try again.";
      setErrorMessage(msg);
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleBackPress = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/");
      }
    } catch {
      try {
        router.push("/");
      } catch {
        // Fallback failed
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Header title="Collect Device" showBack onBackPress={handleBackPress} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Smartphone color="#8B5CF6" size={56} strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Collect HHD Device</Text>
          <Text style={styles.subtitle}>Get your handheld device from supervisor</Text>

          {!managerApproved ? (
            <View style={styles.managerCard}>
              <Text style={styles.managerTitle}>Manager Approval Required</Text>
              <Text style={styles.managerBody}>
                Your manager needs to approve your device collection before you can continue.
              </Text>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              <PrimaryButton
                title={requestLoading ? "Sending…" : "Request Approval OTP"}
                onPress={handleRequestOtp}
                disabled={requestLoading}
              />
              {otpHint ? <Text style={styles.hintText}>{otpHint}</Text> : null}
              <Text style={styles.inputLabel}>Enter 6-digit code from manager</Text>
              <TextInput
                style={styles.otpInput}
                value={otpInput}
                onChangeText={(t) => setOtpInput(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor="#9CA3AF"
              />
              <PrimaryButton
                title={verifyLoading ? "Verifying…" : "Verify"}
                onPress={handleVerifyOtp}
                disabled={verifyLoading || otpInput.replace(/\D/g, "").length !== 6}
              />
            </View>
          ) : (
            <>
              <View style={styles.approvedBadge}>
                <CheckCircle2 color="#059669" size={22} strokeWidth={2.5} />
                <Text style={styles.approvedText}>Manager Approved</Text>
              </View>

              <View style={styles.deviceCard}>
                <View style={styles.deviceIllustration}>
                  <View style={styles.deviceScreen}>
                    <Smartphone color="#6366F1" size={80} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.deviceLabel}>Handheld Device (HHD)</Text>
                </View>
              </View>

              <View style={styles.stepsCard}>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Go to Supervisor Desk</Text>
                    <Text style={styles.stepText}>Visit the supervisor&apos;s desk at the warehouse</Text>
                  </View>
                  <View style={styles.stepIcon}>
                    <Text style={styles.stepIconText}>📍</Text>
                  </View>
                </View>

                <View style={styles.stepDivider} />

                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Show Your OTP</Text>
                    <Text style={styles.stepText}>
                      Present the OTP code{" "}
                      {otp && <Text style={styles.otpHighlight}>{otp}</Text>} to verify your identity
                    </Text>
                  </View>
                  <View style={styles.stepIcon}>
                    <Text style={styles.stepIconText}>#️⃣</Text>
                  </View>
                </View>
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <TouchableOpacity
                style={styles.checkboxCard}
                onPress={() => setCollected(!collected)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, collected && styles.checkboxChecked]}>
                  {collected && <CheckCircle2 color="#10B981" size={24} strokeWidth={2.5} fill="#10B981" />}
                </View>
                <Text style={styles.checkboxLabel}>I&apos;ve collected my handheld device</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.returnDeviceLink}
                onPress={() => router.push("/return-device")}
                activeOpacity={0.7}
              >
                <RotateCcw color="#6366F1" size={20} strokeWidth={2} />
                <Text style={styles.returnDeviceLinkText}>Return Device</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {managerApproved ? (
        <View style={styles.footer}>
          {completeLoading ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color="#5B4EFF" />
            </View>
          ) : (
            <PrimaryButton title="I've Collected My Device" onPress={handleComplete} disabled={!collected} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  managerCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#FDE68A",
    gap: 14,
    marginBottom: 16,
  },
  managerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400E",
  },
  managerBody: {
    fontSize: 14,
    fontWeight: "500",
    color: "#78350F",
    lineHeight: 20,
  },
  hintText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 4,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
  },
  approvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  approvedText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  deviceCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  deviceIllustration: {
    alignItems: "center",
  },
  deviceScreen: {
    width: 160,
    height: 200,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#E5E7EB",
  },
  deviceLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  stepText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
  },
  otpHighlight: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
  },
  stepIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconText: {
    fontSize: 24,
  },
  stepDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
    marginLeft: 44,
  },
  checkboxCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: "#D1FAE5",
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "transparent",
  },
  returnDeviceLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  returnDeviceLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#059669",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    ...(Platform.OS === "web"
      ? { boxShadow: "0px -2px 8px rgba(0, 0, 0, 0.05)", elevation: 8 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
  footerLoading: {
    paddingVertical: 14,
    alignItems: "center",
  },
});
