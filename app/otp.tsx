import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/state/authContext";
import { verifyOtp, resendOtp } from "@/services/auth.service";
import { Colors, Typography, Spacing, BorderRadius } from "@/constants/theme";
import Header from "@/components/Header";
import PrimaryButton from "@/components/PrimaryButton";
import { appNotify } from "@/utils/appNotify";

const RESEND_COOLDOWN_SEC = 60;

export default function OTPScreen() {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber?: string }>();
  const { completeLogin } = useAuth();
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState<boolean>(false);
  const [resendCountdown, setResendCountdown] = useState<number>(RESEND_COOLDOWN_SEC);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const isVerifyingRef = useRef(false);
  const isResendingRef = useRef(false);
  const hasVerifiedSuccessfullyRef = useRef(false);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCountdown]);

  const handleOtpChange = (text: string, index: number) => {
    const numeric = text.replace(/[^0-9]/g, "");
    if (numeric.length > 1) {
      const digits = numeric.split("").slice(0, 4);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 4) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 3);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = numeric;
      setOtp(newOtp);
      if (numeric && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    if (isVerifyingRef.current || hasVerifiedSuccessfullyRef.current) return;
    const otpValue = otp.join("");
    if (otpValue.length !== 4) return;
    const ph = typeof phoneNumber === "string" ? phoneNumber : Array.isArray(phoneNumber) ? phoneNumber[0] : "";
    if (!ph || String(ph).replace(/\D/g, "").length !== 10) {
      appNotify.error("Phone number is missing or invalid. Please go back and enter your number.");
      return;
    }
    
    // Validate OTP is numeric
    if (!/^\d{4}$/.test(otpValue)) {
      appNotify.error("OTP must be 4 digits.");
      return;
    }
    
    console.log(`[OTP Screen] Verifying OTP for phone: ${ph}, OTP: ${otpValue}`);
    isVerifyingRef.current = true;
    setLoading(true);
    try {
      const result = await verifyOtp(ph, otpValue);
      console.log(`[OTP Screen] Verify result:`, { success: result.success, hasToken: !!result.token, error: result.error });
      
      if (result.success && result.token) {
        hasVerifiedSuccessfullyRef.current = true;
        // completeLogin now awaits storage writes before updating state
        // This ensures _layout.tsx navigation logic sees the token
        await completeLogin(ph, result.token, { isNewUser: result.isNewUser });
        
        // No need for manual navigation or profile fetching here.
        // _layout.tsx is the source of truth for routing and will
        // fetch onboarding state/profile automatically.
        setLoading(false);
      } else {
        appNotify.error(result.error || "Invalid or expired OTP. Please try again.");
      }
    } catch (error) {
      console.error(`[OTP Screen] Verify error:`, error);
      appNotify.error("Failed to verify OTP. Please try again.");
    } finally {
      isVerifyingRef.current = false;
      if (!hasVerifiedSuccessfullyRef.current) {
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (isResendingRef.current) return;
    const ph = typeof phoneNumber === "string" ? phoneNumber : Array.isArray(phoneNumber) ? phoneNumber[0] : "";
    if (!ph || String(ph).replace(/\D/g, "").length !== 10) {
      appNotify.error("Phone number is missing. Please go back to login.");
      return;
    }
    isResendingRef.current = true;
    setLoading(true);
    try {
      const result = await resendOtp(ph);
      if (result.success) {
        setResendCountdown(RESEND_COOLDOWN_SEC);
        appNotify.info("A new code has been sent to your phone.", "OTP Sent");
      } else {
        appNotify.error(result.error || result.message || "Failed to resend OTP.");
      }
    } catch {
      appNotify.error("Failed to resend OTP.");
    } finally {
      isResendingRef.current = false;
      setLoading(false);
    }
  };

  const isValid = otp.every((digit) => digit !== "");

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <Header 
        title="Verify OTP"
        subtitle="Enter the code sent to your phone"
        showBack={canGoBack}
      />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.subtitle}>
              Enter the 4-digit code sent to{"\n"}
              <Text style={styles.phoneNumber}>{phoneNumber}</Text>
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={loading || resendCountdown > 0}
          >
            <Text style={styles.resendText}>
              {resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : "Didn't receive the code? "}
              {resendCountdown === 0 && <Text style={styles.resendLink}>Resend</Text>}
            </Text>
          </TouchableOpacity>

          <View style={styles.spacer} />

          <View style={styles.buttonContainer}>
            <PrimaryButton 
              title="Verify OTP" 
              onPress={handleVerifyOTP} 
              disabled={!isValid}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  titleSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  subtitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.lg,
  },
  phoneNumber: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary[650],
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginBottom: Spacing['3xl'],
  },
  otpInput: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 56,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    textAlign: "center",
  },
  otpInputFilled: {
    borderColor: Colors.primary[650],
    backgroundColor: Colors.primary[100],
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  resendText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.secondary,
  },
  resendLink: {
    color: Colors.primary[650],
    fontWeight: Typography.fontWeight.bold,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing["4xl"],
  },
  buttonContainer: {
    marginBottom: Spacing.xl,
  },
});
