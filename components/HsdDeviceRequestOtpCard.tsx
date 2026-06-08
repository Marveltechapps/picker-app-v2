import { TouchableOpacity } from "@/utils/touchables";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View, Text, StyleSheet, TextInput } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  CheckCircle2,
} from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { apiGet } from "@/utils/apiClient";
import { useAuth } from "@/state/authContext";
import {
  getManagerOtpErrorMessage,
  requestManagerApprovalOtp,
  verifyManagerApprovalOtp,
} from "@/services/managerOtp.service";
import { Spacing, BorderRadius } from "@/constants/theme";

interface OnboardingPayload {
  hasCompletedManagerOTP?: boolean;
}

function unwrapPickerEnvelope<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    (raw as { data: unknown }).data !== undefined
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export default function HsdDeviceRequestOtpCard() {
  const { completeManagerOTP } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshVerificationState = useCallback(async () => {
    try {
      const raw = await apiGet<unknown>("/onboarding/state");
      const state = unwrapPickerEnvelope<OnboardingPayload>(raw);
      setVerified(!!state.hasCompletedManagerOTP);
    } catch {
      // keep local state
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshVerificationState();
    }, [refreshVerificationState])
  );

  const handleRequestOtp = async () => {
    setErrorMessage(null);
    setRequestLoading(true);
    try {
      const res = await requestManagerApprovalOtp();
      if (res?.success) {
        const smsNote = res.maskedPhone
          ? ` A copy was also sent to your manager (${res.maskedPhone}).`
          : "";
        setOtpHint(
          `${res.message || "OTP generated."} Your supervisor can read the code from the Admin Operations Dashboard (Master Data → Picker List).${smsNote}${
            __DEV__ && res.devOtp ? ` Dev OTP: ${res.devOtp}` : ""
          }`
        );
      } else {
        setErrorMessage(res?.error || "Could not request OTP. Try again.");
      }
    } catch (e) {
      setErrorMessage(getManagerOtpErrorMessage(e, "Request failed"));
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
      const res = await verifyManagerApprovalOtp(trimmed);
      if (res?.success) {
        await completeManagerOTP();
        setVerified(true);
        setOtpInput("");
        setOtpHint(null);
        await refreshVerificationState();
      } else {
        setErrorMessage(res?.error || "Verification failed.");
      }
    } catch (e) {
      setErrorMessage(getManagerOtpErrorMessage(e, "Verification failed"));
    } finally {
      setVerifyLoading(false);
    }
  };

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <KeyRound size={22} color="#121358" strokeWidth={2} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>HSD Device Request OTP</Text>
            <Text style={styles.subtitle}>
              {verified
                ? "Manager approval completed"
                : "Request and verify manager OTP"}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {verified ? (
            <View style={styles.verifiedBadge}>
              <CheckCircle2 size={14} color="#059669" strokeWidth={2.5} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          ) : null}
          {expanded ? (
            <ChevronUp size={20} color="#9CA3AF" strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
          )}
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          {verified ? (
            <View style={styles.successBox}>
              <CheckCircle2 color="#059669" size={20} strokeWidth={2.5} />
              <Text style={styles.successText}>
                Your HSD device request has been verified by your manager.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.bodyText}>
                Request an approval OTP, then enter the 6-digit code shown in
                the Admin Operations Dashboard (Master Data → Picker List) for
                your name.
              </Text>
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
              <PrimaryButton
                title={requestLoading ? "Sending…" : "Request Approval OTP"}
                onPress={handleRequestOtp}
                disabled={requestLoading}
                loading={requestLoading}
              />
              {otpHint ? <Text style={styles.hintText}>{otpHint}</Text> : null}
              <Text style={styles.inputLabel}>
                Enter 6-digit code from dashboard
              </Text>
              <TextInput
                style={styles.otpInput}
                value={otpInput}
                onChangeText={(t) =>
                  setOtpInput(t.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor="#9CA3AF"
              />
              <PrimaryButton
                title={verifyLoading ? "Verifying…" : "Verify"}
                onPress={handleVerifyOtp}
                disabled={
                  verifyLoading || otpInput.replace(/\D/g, "").length !== 6
                }
                loading={verifyLoading}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEEEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  bodyText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    paddingTop: Spacing.md,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 14,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#065F46",
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
});
