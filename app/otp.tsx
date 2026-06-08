import { ScrollView } from "@/utils/scrollables";
import { TouchableOpacity } from "@/utils/touchables";
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useAuth } from "@/state/authContext";
import {
  getChannelLabel,
  resendLoginOtp,
  verifyLoginOtp,
  type LoginMode,
  type OtpTarget,
} from "@/services/auth.service";
import AuthHeader from "@/components/auth/AuthHeader";
import PrimaryButton from "@/components/PrimaryButton";
import { useAuthScreenTheme } from "@/hooks/useAuthScreenTheme";
import { AuthLayout } from "@/constants/authTheme";
import {
  clearPendingOtpSession,
  loadPendingOtpSession,
  type PendingOtpSession,
} from "@/utils/pendingOtpSession";
import { resolvePostOtpRoute } from "@/utils/startupRoute";
import { markStartupRouteResolved, resetStartupRouteResolution } from "@/utils/startupNavigation";

const RESEND_COOLDOWN_SEC: number = AuthLayout.resendCooldownSec;

function resolveRouteParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return "";
}

export default function OTPScreen() {
  const router = useRouter();
  const theme = useAuthScreenTheme();
  const params = useLocalSearchParams<{
    loginMode?: string | string[];
    otpTarget?: string | string[];
    countryCode?: string | string[];
    phone?: string | string[];
    email?: string | string[];
    channel?: string | string[];
    displayTarget?: string | string[];
    phoneNumber?: string | string[];
  }>();

  const [otpSession, setOtpSession] = useState<PendingOtpSession | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await loadPendingOtpSession();
      const routeEmail = resolveRouteParam(params.email);
      const routePhone = resolveRouteParam(params.phone) || resolveRouteParam(params.phoneNumber);
      const routeLoginMode = (resolveRouteParam(params.loginMode) as LoginMode) || saved?.loginMode || "mobile";
      const routeOtpTarget =
        (resolveRouteParam(params.otpTarget) as OtpTarget) ||
        saved?.otpTarget ||
        (routeLoginMode === "email" ? "email" : "phone");
      const merged: PendingOtpSession = {
        loginMode: routeLoginMode,
        otpTarget: routeOtpTarget,
        countryCode: resolveRouteParam(params.countryCode) || saved?.countryCode || "+91",
        phone: routePhone || saved?.phone || "",
        email: routeEmail || saved?.email || "",
        channel: resolveRouteParam(params.channel) || saved?.channel || "sms",
        displayTarget:
          resolveRouteParam(params.displayTarget) ||
          saved?.displayTarget ||
          (routeOtpTarget === "email" ? routeEmail || saved?.email || "" : routePhone || saved?.phone || ""),
      };
      if (active) setOtpSession(merged);
    })();
    return () => {
      active = false;
    };
  }, [
    params.loginMode,
    params.otpTarget,
    params.countryCode,
    params.phone,
    params.phoneNumber,
    params.email,
    params.channel,
    params.displayTarget,
  ]);

  const loginMode = otpSession?.loginMode ?? "mobile";
  const otpTarget = otpSession?.otpTarget ?? "phone";
  const countryCode = otpSession?.countryCode ?? "+91";
  const phone = otpSession?.phone ?? "";
  const email = otpSession?.email ?? "";
  const channel = otpSession?.channel ?? "sms";
  const displayTarget = otpSession?.displayTarget ?? (otpTarget === "email" ? email : phone);

  const { completeLogin } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SEC);
  const [otpError, setOtpError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const isVerifyingRef = useRef(false);
  const isResendingRef = useRef(false);
  const hasVerifiedSuccessfullyRef = useRef(false);

  const dismissKeyboard = React.useCallback(() => {
    inputRefs.current.forEach((ref) => ref?.blur());
    Keyboard.dismiss();
  }, []);

  React.useEffect(() => {
    dismissKeyboard();
  }, [dismissKeyboard]);

  const contentWidth = useMemo(
    () => Math.min(Math.max(screenWidth - 32, 320), 420),
    [screenWidth]
  );

  const channelLabel = getChannelLabel(channel, loginMode);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.pageBg,
        },
        scroll: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          paddingHorizontal: theme.layout.contentPaddingH,
          paddingBottom: theme.spacing["2xl"],
        },
        content: {
          paddingTop: theme.spacing["2xl"],
        },
        title: {
          fontSize: theme.typography.fontSize["2xl"],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          textAlign: "center",
          marginBottom: theme.spacing.sm,
        },
        subtitle: {
          fontSize: theme.typography.fontSize.md,
          lineHeight: 21,
          color: theme.colors.mutedText,
          textAlign: "center",
          marginBottom: theme.spacing["2xl"],
        },
        target: {
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.primary,
        },
        otpContainer: {
          flexDirection: "row",
          justifyContent: "center",
          gap: theme.layout.otpGap,
          marginBottom: theme.spacing.lg,
        },
        otpInput: {
          width: theme.layout.otpBoxWidth,
          height: theme.layout.otpBoxHeight,
          backgroundColor: theme.colors.inputBg,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.inputBorder,
          fontSize: theme.typography.fontSize["3xl"],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          textAlign: "center",
        },
        errorText: {
          textAlign: "center",
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.inputBorderError,
          marginBottom: theme.spacing.md,
        },
        resendSection: {
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginBottom: theme.spacing["2xl"],
          marginTop: theme.spacing.sm,
          minHeight: 24,
        },
        resendActionsRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.spacing.xl,
        },
        resendTimer: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.resendText,
          textAlign: "center",
        },
        resendLink: {
          fontSize: theme.typography.fontSize.md,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.primary,
          textDecorationLine: "underline",
        },
        changeContact: {
          fontSize: theme.typography.fontSize.md,
          color: theme.colors.primary,
          fontWeight: theme.typography.fontWeight.semibold,
          textDecorationLine: "underline",
        },
        otpCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.primaryMuted,
        },
        otpInputFilled: {
          borderColor: theme.colors.inputFocus,
          borderWidth: 2,
          backgroundColor: theme.colors.primaryLight,
        },
        authButton: {
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.primary,
        },
      }),
    [theme]
  );

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setInterval(() => {
      setResendCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCountdown]);

  const handleOtpChange = (text: string, index: number) => {
    const numeric = text.replace(/[^0-9]/g, "");
    setOtpError(null);

    if (numeric.length > 1) {
      const digits = numeric.split("").slice(0, 4);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 4) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      if (newOtp.every((digit) => digit !== "")) {
        dismissKeyboard();
        return;
      }
      const nextIndex = Math.min(index + digits.length, 3);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = numeric;
      setOtp(newOtp);
      if (numeric && index < 3) {
        inputRefs.current[index + 1]?.focus();
        return;
      }
      if (newOtp.every((digit) => digit !== "")) {
        dismissKeyboard();
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
    if (!otpSession) {
      setOtpError("Session expired. Please go back and request OTP again.");
      return;
    }
    const otpValue = otp.join("");
    if (otpValue.length !== 4) return;

    if (!/^\d{4}$/.test(otpValue)) {
      setOtpError("OTP must be 4 digits.");
      return;
    }

    if (otpTarget === "email" && !email) {
      setOtpError("Email address is missing. Please go back and enter your email.");
      return;
    }
    if (otpTarget === "phone" && !phone) {
      setOtpError("Phone number is missing. Please go back and enter your number.");
      return;
    }

    dismissKeyboard();
    isVerifyingRef.current = true;
    setLoading(true);
    setOtpError(null);

    try {
      const result = await verifyLoginOtp({
        otpTarget,
        otp: otpValue,
        countryCode,
        phone,
        email,
        loginMode,
      });

      const token = typeof result.token === "string" ? result.token.trim() : "";
      if (!result.success || !token) {
        if (__DEV__) {
          console.warn("[OTP] Verify failed:", {
            otpTarget,
            email,
            phone,
            error: result.error,
          });
        }
        setOtpError(result.error || "Invalid or expired OTP. Please try again.");
        return;
      }

      hasVerifiedSuccessfullyRef.current = true;
      await clearPendingOtpSession();
      const loginPhone = otpTarget === "email" ? "" : phone;
      try {
        await completeLogin(loginPhone, token, {
          isNewUser: result.isNewUser,
          loginMethod: loginMode,
          email: otpTarget === "email" ? email : result.user?.email,
          countryCode,
        });

        resetStartupRouteResolution();
        const target = await resolvePostOtpRoute(result.isNewUser === true);
        markStartupRouteResolved();
        router.replace(target as Href);
      } catch (loginError) {
        // OTP already consumed — keep success flag so user cannot re-submit the same code.
        if (__DEV__) {
          console.error("[OTP] Post-verify login failed:", loginError);
        }
        const msg =
          loginError instanceof Error
            ? loginError.message
            : "Verified, but could not complete login. Please try again.";
        setOtpError(msg);
        return;
      }
      setLoading(false);
    } catch (error) {
      if (__DEV__) {
        console.error("[OTP] Verify request failed:", error);
      }
      const msg =
        error instanceof Error && error.message
          ? error.message
          : "Failed to verify OTP. Please try again.";
      setOtpError(msg);
    } finally {
      isVerifyingRef.current = false;
      if (!hasVerifiedSuccessfullyRef.current) {
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (isResendingRef.current || resendCountdown > 0) return;
    dismissKeyboard();
    isResendingRef.current = true;
    setLoading(true);
    setOtpError(null);

    try {
      const result = await resendLoginOtp({
        loginMode,
        countryCode,
        phone,
        email,
      });
      if (result.success) {
        setResendCountdown(RESEND_COOLDOWN_SEC);
        setOtp(["", "", "", ""]);
      } else {
        setOtpError(result.error || result.message || "Failed to resend OTP.");
      }
    } catch {
      setOtpError("Failed to resend OTP.");
    } finally {
      isResendingRef.current = false;
      setLoading(false);
    }
  };

  const handleChangeContact = async () => {
    dismissKeyboard();
    await clearPendingOtpSession();
    router.replace("/login");
  };

  const isValid = otp.every((digit) => digit !== "");

  return (
    <Pressable style={styles.container} onPress={dismissKeyboard} accessible={false}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <AuthHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth, alignSelf: "center" }]}>
          <View style={styles.otpCard}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit OTP sent to{" "}
            <Text style={styles.target}>{displayTarget}</Text> via{" "}
            <Text style={styles.target}>{channelLabel}</Text>.
          </Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                showSoftInputOnFocus
                onBlur={() => {
                  if (otp.every((digit) => digit !== "")) {
                    Keyboard.dismiss();
                  }
                }}
              />
            ))}
          </View>

          {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

          <View style={styles.resendSection}>
            {resendCountdown > 0 ? (
              <Text style={styles.resendTimer}>Resend OTP in {resendCountdown}s</Text>
            ) : (
              <View style={styles.resendActionsRow}>
                <TouchableOpacity onPress={handleResend} disabled={loading} activeOpacity={0.85}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleChangeContact} activeOpacity={0.85}>
                  <Text style={styles.changeContact}>
                    {otpTarget === "email" ? "Change email" : "Change number"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <PrimaryButton
            title="Verify & Continue"
            onPress={handleVerifyOTP}
            disabled={!isValid || loading}
            loading={loading}
            style={styles.authButton}
          />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </Pressable>
  );
}
